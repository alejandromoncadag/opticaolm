"""Phase 1F-A authoritative cart and favorites API.

The API is server-to-server only. It deliberately contains no checkout,
reservation, payment, order, branch-selection, or stock-mutation behavior.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import os
import secrets
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
import psycopg
from psycopg.rows import dict_row

from public_catalog import (
    PublicCatalogConfig,
    UnsafeImageUrl,
    normalize_public_image_url,
)


COMMERCE_SCHEMA_VERSION = "1.0"
PURCHASABLE_CATEGORIES = {
    "lentes_de_sol",
    "lentes_de_contacto",
    "accesorios_y_refacciones",
    "soluciones_y_cuidado",
}


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "si", "sí"}


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


@dataclass(frozen=True)
class CommerceConfig:
    db_conninfo: str
    bearer_token: str
    enabled: bool
    guest_lifetime_days: int = 30
    customer_abandonment_days: int = 90
    idempotency_lifetime_hours: int = 24
    catalog_config: PublicCatalogConfig | None = None

    @classmethod
    def from_env(cls, db_conninfo: str) -> "CommerceConfig":
        return cls(
            db_conninfo=db_conninfo,
            bearer_token=os.getenv("ONLINE_COMMERCE_BEARER_TOKEN", "").strip(),
            enabled=_env_bool("ONLINE_COMMERCE_API_ENABLED", False),
            catalog_config=PublicCatalogConfig.from_env(db_conninfo),
        )


@dataclass(frozen=True)
class CommerceOwner:
    owner_type: Literal["guest", "customer"]
    owner_hash: str

    @property
    def db_type(self) -> str:
        return "invitado" if self.owner_type == "guest" else "cliente"


class AddCartItemRequest(BaseModel):
    productId: int = Field(gt=0)
    quantity: int = Field(default=1, gt=0)
    configuration: dict[str, Any] = Field(default_factory=dict)


class UpdateCartItemRequest(BaseModel):
    quantity: int = Field(gt=0)


class MergeRequest(BaseModel):
    guestOwnerHash: str = Field(min_length=64, max_length=64)


class CommerceRuleError(RuntimeError):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def commerce_credentials_valid(
    credentials: HTTPAuthorizationCredentials | None, expected_token: str
) -> bool:
    if not credentials or credentials.scheme.lower() != "bearer":
        return False
    return bool(expected_token) and secrets.compare_digest(
        credentials.credentials, expected_token
    )


def _valid_owner_hash(value: str) -> bool:
    return len(value) == 64 and all(character in "0123456789abcdef" for character in value)


class CommerceRepository:
    def __init__(
        self,
        config: CommerceConfig,
        connect: Callable[..., Any] = psycopg.connect,
    ) -> None:
        self.config = config
        self._connect = connect

    def _connection(self):
        return self._connect(self.config.db_conninfo, row_factory=dict_row)

    @staticmethod
    def _record_event(
        cur,
        *,
        entity_type: str,
        entity_id: int | None,
        event_type: str,
        owner: CommerceOwner | None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        cur.execute(
            """
            INSERT INTO core.online_comercio_eventos (
                entidad_tipo, entidad_id, evento_tipo,
                propietario_tipo, propietario_ref_hash, metadata
            ) VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            """,
            (
                entity_type,
                entity_id,
                event_type,
                owner.db_type if owner else None,
                owner.owner_hash if owner else None,
                _canonical_json(metadata or {}),
            ),
        )

    @staticmethod
    def _product_row(cur, product_id: int) -> dict[str, Any] | None:
        cur.execute(
            """
            SELECT
                product.producto_id,
                product.sku,
                product.slug,
                product.nombre,
                product.descripcion,
                product.categoria,
                product.tipo_producto,
                product.precio,
                product.moneda,
                product.controla_stock,
                product.activo,
                product.publicado_online,
                product.updated_at,
                COALESCE(config.comprable_online, FALSE) AS comprable_online,
                COALESCE(config.permite_favorito, TRUE) AS permite_favorito,
                config.cantidad_maxima_por_linea
            FROM core.catalogo_productos product
            LEFT JOIN core.online_producto_configuracion config
              ON config.producto_id = product.producto_id
            WHERE product.producto_id = %s
            """,
            (product_id,),
        )
        return cur.fetchone()

    @staticmethod
    def _product_can_purchase(product: dict[str, Any]) -> bool:
        return bool(
            product["activo"]
            and product["publicado_online"]
            and product["comprable_online"]
            and product["tipo_producto"] == "producto_fisico"
            and product["categoria"] in PURCHASABLE_CATEGORIES
            and product["sku"]
            and product["slug"]
            and product["precio"] is not None
            and Decimal(product["precio"]) >= 0
        )

    @staticmethod
    def _product_can_favorite(product: dict[str, Any]) -> bool:
        return bool(
            product["activo"]
            and product["publicado_online"]
            and product["permite_favorito"]
            and product["sku"]
            and product["slug"]
        )

    def _resolve_cart(
        self, cur, owner: CommerceOwner, *, create: bool = True
    ) -> dict[str, Any] | None:
        if owner.owner_type == "guest":
            cur.execute(
                """
                UPDATE core.online_carritos
                SET estado = 'expirado', updated_at = NOW(), version = version + 1
                WHERE propietario_tipo = 'invitado'
                  AND propietario_ref_hash = %s
                  AND estado = 'activo'
                  AND expira_at <= NOW()
                """,
                (owner.owner_hash,),
            )

        cur.execute(
            """
            SELECT *
            FROM core.online_carritos
            WHERE propietario_tipo = %s
              AND propietario_ref_hash = %s
              AND estado = 'activo'
            ORDER BY carrito_id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (owner.db_type, owner.owner_hash),
        )
        cart = cur.fetchone()
        if cart and owner.owner_type == "customer":
            cur.execute(
                """
                SELECT ultima_actividad_at < NOW() - (%s * INTERVAL '1 day') AS abandoned
                FROM core.online_carritos
                WHERE carrito_id = %s
                """,
                (self.config.customer_abandonment_days, cart["carrito_id"]),
            )
            if bool(cur.fetchone()["abandoned"]):
                cur.execute(
                    """
                    UPDATE core.online_carritos
                    SET estado = 'abandonado', updated_at = NOW(), version = version + 1
                    WHERE carrito_id = %s
                    """,
                    (cart["carrito_id"],),
                )
                self._record_event(
                    cur,
                    entity_type="carrito",
                    entity_id=int(cart["carrito_id"]),
                    event_type="cart_abandoned",
                    owner=owner,
                )
                cart = None

        if cart:
            return cart

        if owner.owner_type == "customer":
            cur.execute(
                """
                SELECT *
                FROM core.online_carritos
                WHERE propietario_tipo = 'cliente'
                  AND propietario_ref_hash = %s
                  AND estado = 'abandonado'
                ORDER BY ultima_actividad_at DESC, carrito_id DESC
                LIMIT 1
                FOR UPDATE
                """,
                (owner.owner_hash,),
            )
            abandoned = cur.fetchone()
            if abandoned:
                cur.execute(
                    """
                    UPDATE core.online_carritos
                    SET estado = 'activo', ultima_actividad_at = NOW(),
                        updated_at = NOW(), version = version + 1
                    WHERE carrito_id = %s
                    RETURNING *
                    """,
                    (abandoned["carrito_id"],),
                )
                cart = cur.fetchone()
                self._record_event(
                    cur,
                    entity_type="carrito",
                    entity_id=int(cart["carrito_id"]),
                    event_type="cart_reactivated",
                    owner=owner,
                )
                return cart

        if not create:
            return None

        cur.execute(
            """
            INSERT INTO core.online_carritos (
                propietario_tipo, propietario_ref_hash, expira_at
            ) VALUES (
                %s,
                %s,
                CASE WHEN %s = 'invitado'
                     THEN NOW() + (%s * INTERVAL '1 day')
                     ELSE NULL END
            )
            RETURNING *
            """,
            (
                owner.db_type,
                owner.owner_hash,
                owner.db_type,
                self.config.guest_lifetime_days,
            ),
        )
        cart = cur.fetchone()
        self._record_event(
            cur,
            entity_type="carrito",
            entity_id=int(cart["carrito_id"]),
            event_type="cart_created",
            owner=owner,
        )
        return cart

    @staticmethod
    def _touch_cart(cur, cart_id: int) -> None:
        cur.execute(
            """
            UPDATE core.online_carritos
            SET ultima_actividad_at = NOW(), updated_at = NOW(), version = version + 1
            WHERE carrito_id = %s
            """,
            (cart_id,),
        )

    def _safe_image(self, raw_url: str | None) -> str | None:
        if not raw_url or not self.config.catalog_config:
            return None
        try:
            return normalize_public_image_url(raw_url, self.config.catalog_config)
        except UnsafeImageUrl:
            return None

    @staticmethod
    def _availability_by_product(cur, product_ids: list[int]) -> dict[int, int]:
        if not product_ids:
            return {}
        cur.execute(
            """
            SELECT inventory.producto_id,
                   COALESCE(SUM(
                       CASE WHEN inventory.disponible_venta = TRUE
                            THEN GREATEST(inventory.stock - inventory.stock_reservado, 0)
                            ELSE 0 END
                   ), 0)::INTEGER AS total_available
            FROM core.catalogo_inventario_sucursal inventory
            JOIN core.sucursales branch ON branch.sucursal_id = inventory.sucursal_id
            WHERE inventory.producto_id = ANY(%s)
              AND branch.activa = TRUE
            GROUP BY inventory.producto_id
            """,
            (product_ids,),
        )
        return {
            int(row["producto_id"]): int(row["total_available"])
            for row in cur.fetchall()
        }

    def _cart_snapshot(
        self, cur, owner: CommerceOwner, cart: dict[str, Any] | None
    ) -> dict[str, Any]:
        if not cart:
            return {
                "schemaVersion": COMMERCE_SCHEMA_VERSION,
                "ownerType": owner.owner_type,
                "cartId": None,
                "state": "active",
                "version": 0,
                "items": [],
                "itemCount": 0,
                "subtotal": "0.00",
                "currency": "MXN",
                "readyForFutureCheckout": False,
            }
        cur.execute(
            """
            SELECT
                item.*,
                product.sku AS current_sku,
                product.slug AS current_slug,
                product.nombre AS current_name,
                product.descripcion AS current_description,
                product.categoria,
                product.tipo_producto,
                product.precio AS current_price,
                product.moneda,
                product.controla_stock,
                product.activo AS product_active,
                product.publicado_online,
                product.updated_at AS product_updated_at,
                COALESCE(config.comprable_online, FALSE) AS comprable_online,
                config.cantidad_maxima_por_linea,
                image.url AS image_url,
                image.alt_text AS image_alt
            FROM core.online_carrito_items item
            JOIN core.catalogo_productos product
              ON product.producto_id = item.producto_id
            LEFT JOIN core.online_producto_configuracion config
              ON config.producto_id = product.producto_id
            LEFT JOIN LATERAL (
                SELECT url, alt_text
                FROM core.catalogo_producto_imagenes
                WHERE producto_id = product.producto_id AND activo = TRUE
                ORDER BY es_principal DESC, display_order, producto_imagen_id
                LIMIT 1
            ) image ON TRUE
            WHERE item.carrito_id = %s AND item.activo = TRUE
            ORDER BY item.created_at, item.carrito_item_id
            """,
            (cart["carrito_id"],),
        )
        rows = list(cur.fetchall())
        availability = self._availability_by_product(
            cur, [int(row["producto_id"]) for row in rows]
        )
        items = []
        subtotal = Decimal("0")
        item_count = 0
        all_valid = bool(rows)
        for row in rows:
            product_id = int(row["producto_id"])
            quantity = int(row["cantidad"])
            current_price = Decimal(row["current_price"] or 0).quantize(Decimal("0.01"))
            observed_price = Decimal(row["precio_observado"]).quantize(Decimal("0.01"))
            recognized_price = Decimal(row["precio_reconocido"]).quantize(Decimal("0.01"))
            total_available = availability.get(product_id, 0)
            maximum = (
                int(row["cantidad_maxima_por_linea"])
                if row["cantidad_maxima_por_linea"] is not None
                else None
            )
            product = {
                "activo": row["product_active"],
                "publicado_online": row["publicado_online"],
                "comprable_online": row["comprable_online"],
                "tipo_producto": row["tipo_producto"],
                "categoria": row["categoria"],
                "sku": row["current_sku"],
                "slug": row["current_slug"],
                "precio": row["current_price"],
            }
            issues: list[str] = []
            if not row["product_active"]:
                issues.append("inactive")
            if not row["publicado_online"]:
                issues.append("unpublished")
            if row["product_active"] and row["publicado_online"] and not self._product_can_purchase(product):
                issues.append("purchase_disabled")
            if row["controla_stock"] and total_available <= 0:
                issues.append("unavailable")
            if row["controla_stock"] and quantity > total_available:
                issues.append("quantity_exceeds_total_availability")
            if maximum is not None and quantity > maximum:
                issues.append("requires_review")
            price_changed = recognized_price != current_price
            if price_changed:
                issues.append("price_changed")
            if row["requiere_revision"] and "requires_review" not in issues:
                issues.append("requires_review")

            priority = (
                "inactive",
                "unpublished",
                "purchase_disabled",
                "unavailable",
                "quantity_exceeds_total_availability",
                "price_changed",
                "requires_review",
            )
            status = next((candidate for candidate in priority if candidate in issues), "valid")
            line_total = current_price * quantity
            subtotal += line_total
            item_count += quantity
            if status != "valid":
                all_valid = False
            items.append(
                {
                    "itemId": str(row["carrito_item_id"]),
                    "productId": str(product_id),
                    "sku": str(row["current_sku"] or row["sku_snapshot"]),
                    "slug": str(row["current_slug"] or row["slug_snapshot"]),
                    "name": str(row["current_name"] or row["nombre_snapshot"]),
                    "description": row["current_description"],
                    "category": row["categoria"],
                    "quantity": quantity,
                    "configuration": row["configuracion"] or {},
                    "status": status,
                    "issues": issues,
                    "requiresReview": bool(issues),
                    "previouslyObservedPrice": f"{observed_price:.2f}",
                    "currentPrice": f"{current_price:.2f}",
                    "priceChanged": price_changed,
                    "priceAcknowledged": not price_changed,
                    "lineTotal": f"{line_total:.2f}",
                    "currency": str(row["moneda"]).strip(),
                    "totalOnlineAvailability": total_available,
                    "maximumQuantityPerLine": maximum,
                    "availabilityIsInformational": True,
                    "image": (
                        {
                            "url": self._safe_image(row["image_url"]),
                            "altText": row["image_alt"] or row["current_name"],
                        }
                        if self._safe_image(row["image_url"])
                        else None
                    ),
                    "updatedAt": row["updated_at"],
                }
            )
        return _json_safe(
            {
                "schemaVersion": COMMERCE_SCHEMA_VERSION,
                "ownerType": owner.owner_type,
                "cartId": str(cart["carrito_id"]),
                "state": str(cart["estado"]),
                "version": int(cart["version"]),
                "items": items,
                "itemCount": item_count,
                "subtotal": f"{subtotal:.2f}",
                "currency": str(cart["moneda"]).strip(),
                "readyForFutureCheckout": all_valid,
                "availabilityNotice": (
                    "La disponibilidad total es informativa. La sucursal de entrega "
                    "y sus existencias se confirmarán en una fase posterior."
                ),
            }
        )

    def _favorites_snapshot(self, cur, owner: CommerceOwner) -> dict[str, Any]:
        if owner.owner_type == "guest":
            cur.execute(
                """
                UPDATE core.online_favoritos
                SET activo = FALSE, removed_at = NOW(), updated_at = NOW()
                WHERE propietario_tipo = 'invitado'
                  AND propietario_ref_hash = %s
                  AND activo = TRUE
                  AND expira_at <= NOW()
                """,
                (owner.owner_hash,),
            )
        cur.execute(
            """
            SELECT favorite.*, product.activo AS product_active,
                   product.publicado_online, product.precio, product.moneda,
                   product.descripcion, product.categoria,
                   COALESCE(config.permite_favorito, TRUE) AS permite_favorito,
                   image.url AS image_url, image.alt_text AS image_alt
            FROM core.online_favoritos favorite
            JOIN core.catalogo_productos product
              ON product.producto_id = favorite.producto_id
            LEFT JOIN core.online_producto_configuracion config
              ON config.producto_id = product.producto_id
            LEFT JOIN LATERAL (
                SELECT url, alt_text
                FROM core.catalogo_producto_imagenes
                WHERE producto_id = product.producto_id AND activo = TRUE
                ORDER BY es_principal DESC, display_order, producto_imagen_id
                LIMIT 1
            ) image ON TRUE
            WHERE favorite.propietario_tipo = %s
              AND favorite.propietario_ref_hash = %s
              AND favorite.activo = TRUE
            ORDER BY favorite.created_at DESC, favorite.favorito_id DESC
            """,
            (owner.db_type, owner.owner_hash),
        )
        favorites = []
        for row in cur.fetchall():
            available = bool(
                row["product_active"]
                and row["publicado_online"]
                and row["permite_favorito"]
            )
            favorites.append(
                _json_safe(
                    {
                        "favoriteId": str(row["favorito_id"]),
                        "productId": str(row["producto_id"]),
                        "sku": row["sku_snapshot"],
                        "slug": row["slug_snapshot"],
                        "name": row["nombre_snapshot"],
                        "likedAt": row["created_at"],
                        "available": available,
                        "unavailableReason": (
                            None
                            if available
                            else "Este producto ya no está activo o publicado."
                        ),
                        "description": row["descripcion"] if available else None,
                        "category": row["categoria"] if available else None,
                        "price": f"{Decimal(row['precio'] or 0):.2f}" if available else None,
                        "currency": str(row["moneda"]).strip() if available else None,
                        "image": (
                            {
                                "url": self._safe_image(row["image_url"]),
                                "altText": row["image_alt"] or row["nombre_snapshot"],
                            }
                            if available and self._safe_image(row["image_url"])
                            else None
                        ),
                    }
                )
            )
        return {
            "schemaVersion": COMMERCE_SCHEMA_VERSION,
            "ownerType": owner.owner_type,
            "favorites": favorites,
            "count": len(favorites),
        }

    def _idempotency_begin(
        self,
        cur,
        *,
        scope: str,
        key: str,
        owner: CommerceOwner,
        request_payload: dict[str, Any],
    ) -> tuple[int | None, dict[str, Any] | None]:
        clean_key = key.strip()
        if not clean_key or len(clean_key) > 200:
            raise CommerceRuleError(400, "Idempotency-Key is required and must be valid.")
        key_hash = _sha256(clean_key)
        request_hash = _sha256(_canonical_json(request_payload))
        cur.execute(
            """
            INSERT INTO core.online_idempotencia (
                alcance, clave_hash, propietario_ref_hash, solicitud_hash, expira_at
            ) VALUES (
                %s, %s, %s, %s, NOW() + (%s * INTERVAL '1 hour')
            )
            ON CONFLICT (alcance, clave_hash) DO NOTHING
            RETURNING idempotencia_id
            """,
            (
                scope,
                key_hash,
                owner.owner_hash,
                request_hash,
                self.config.idempotency_lifetime_hours,
            ),
        )
        inserted = cur.fetchone()
        if inserted:
            return int(inserted["idempotencia_id"]), None

        cur.execute(
            """
            SELECT *
            FROM core.online_idempotencia
            WHERE alcance = %s AND clave_hash = %s
            FOR UPDATE
            """,
            (scope, key_hash),
        )
        existing = cur.fetchone()
        if (
            existing["propietario_ref_hash"] != owner.owner_hash
            or existing["solicitud_hash"] != request_hash
        ):
            raise CommerceRuleError(409, "Idempotency-Key was already used differently.")
        if existing["estado"] == "completado" and existing["respuesta"] is not None:
            return None, existing["respuesta"]
        raise CommerceRuleError(409, "The same request is already being processed.")

    @staticmethod
    def _idempotency_finish(
        cur, idempotency_id: int | None, result: dict[str, Any], resource_id: int | None
    ) -> None:
        if idempotency_id is None:
            return
        cur.execute(
            """
            UPDATE core.online_idempotencia
            SET estado = 'completado', recurso_id = %s, codigo_respuesta = 200,
                respuesta = %s::jsonb, updated_at = NOW()
            WHERE idempotencia_id = %s
            """,
            (resource_id, _canonical_json(_json_safe(result)), idempotency_id),
        )

    def _mutate(
        self,
        *,
        owner: CommerceOwner,
        scope: str,
        key: str,
        request_payload: dict[str, Any],
        operation: Callable[[Any], tuple[dict[str, Any], int | None]],
    ) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                idempotency_id, cached = self._idempotency_begin(
                    cur,
                    scope=scope,
                    key=key,
                    owner=owner,
                    request_payload=request_payload,
                )
                if cached is not None:
                    return cached
                result, resource_id = operation(cur)
                self._idempotency_finish(cur, idempotency_id, result, resource_id)
            conn.commit()
            return result

    def get_cart(self, owner: CommerceOwner) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cart = self._resolve_cart(cur, owner)
                result = self._cart_snapshot(cur, owner, cart)
            conn.commit()
            return result

    def add_cart_item(
        self, owner: CommerceOwner, data: AddCartItemRequest, key: str
    ) -> dict[str, Any]:
        if data.configuration:
            raise CommerceRuleError(
                400, "Optical or other product configuration is not supported in Phase 1F-A."
            )
        payload = data.model_dump()

        def operation(cur):
            product = self._product_row(cur, data.productId)
            if product is None:
                raise CommerceRuleError(404, "Product does not exist.")
            if not self._product_can_purchase(product):
                raise CommerceRuleError(409, "Product is not eligible for the authoritative cart.")
            cart = self._resolve_cart(cur, owner)
            configuration_hash = _sha256(_canonical_json(data.configuration))
            cur.execute(
                """
                SELECT *
                FROM core.online_carrito_items
                WHERE carrito_id = %s AND producto_id = %s
                  AND configuracion_hash = %s AND activo = TRUE
                FOR UPDATE
                """,
                (cart["carrito_id"], data.productId, configuration_hash),
            )
            item = cur.fetchone()
            if item:
                new_quantity = int(item["cantidad"]) + data.quantity
                cur.execute(
                    """
                    UPDATE core.online_carrito_items
                    SET cantidad = %s, updated_at = NOW()
                    WHERE carrito_item_id = %s
                    RETURNING carrito_item_id
                    """,
                    (new_quantity, item["carrito_item_id"]),
                )
                item_id = int(cur.fetchone()["carrito_item_id"])
            else:
                product_updated_at = product["updated_at"] or datetime.now(timezone.utc)
                price = Decimal(product["precio"]).quantize(Decimal("0.01"))
                cur.execute(
                    """
                    INSERT INTO core.online_carrito_items (
                        carrito_id, producto_id, sku_snapshot, slug_snapshot,
                        nombre_snapshot, cantidad, configuracion, configuracion_hash,
                        precio_observado, precio_reconocido,
                        producto_updated_at_observado
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s
                    )
                    RETURNING carrito_item_id
                    """,
                    (
                        cart["carrito_id"],
                        data.productId,
                        product["sku"],
                        product["slug"],
                        product["nombre"],
                        data.quantity,
                        _canonical_json(data.configuration),
                        configuration_hash,
                        price,
                        price,
                        product_updated_at,
                    ),
                )
                item_id = int(cur.fetchone()["carrito_item_id"])
            self._touch_cart(cur, int(cart["carrito_id"]))
            self._record_event(
                cur,
                entity_type="carrito_item",
                entity_id=item_id,
                event_type="item_added",
                owner=owner,
                metadata={"quantityAdded": data.quantity},
            )
            cur.execute(
                "SELECT * FROM core.online_carritos WHERE carrito_id = %s",
                (cart["carrito_id"],),
            )
            current_cart = cur.fetchone()
            return self._cart_snapshot(cur, owner, current_cart), item_id

        return self._mutate(
            owner=owner,
            scope="cart_item_add",
            key=key,
            request_payload=payload,
            operation=operation,
        )

    def update_cart_item(
        self, owner: CommerceOwner, item_id: int, quantity: int, key: str
    ) -> dict[str, Any]:
        def operation(cur):
            cart = self._resolve_cart(cur, owner)
            cur.execute(
                """
                SELECT carrito_item_id
                FROM core.online_carrito_items
                WHERE carrito_item_id = %s AND carrito_id = %s AND activo = TRUE
                FOR UPDATE
                """,
                (item_id, cart["carrito_id"]),
            )
            if cur.fetchone() is None:
                raise CommerceRuleError(404, "Cart item does not exist.")
            cur.execute(
                """
                UPDATE core.online_carrito_items
                SET cantidad = %s, requiere_revision = FALSE, updated_at = NOW()
                WHERE carrito_item_id = %s
                """,
                (quantity, item_id),
            )
            self._touch_cart(cur, int(cart["carrito_id"]))
            self._record_event(
                cur,
                entity_type="carrito_item",
                entity_id=item_id,
                event_type="item_quantity_changed",
                owner=owner,
                metadata={"quantity": quantity},
            )
            cur.execute(
                "SELECT * FROM core.online_carritos WHERE carrito_id = %s",
                (cart["carrito_id"],),
            )
            return self._cart_snapshot(cur, owner, cur.fetchone()), item_id

        return self._mutate(
            owner=owner,
            scope="cart_item_update",
            key=key,
            request_payload={"itemId": item_id, "quantity": quantity},
            operation=operation,
        )

    def remove_cart_item(
        self, owner: CommerceOwner, item_id: int, key: str
    ) -> dict[str, Any]:
        def operation(cur):
            cart = self._resolve_cart(cur, owner)
            cur.execute(
                """
                UPDATE core.online_carrito_items
                SET activo = FALSE, removed_at = NOW(), updated_at = NOW()
                WHERE carrito_item_id = %s AND carrito_id = %s AND activo = TRUE
                RETURNING carrito_item_id
                """,
                (item_id, cart["carrito_id"]),
            )
            if cur.fetchone() is None:
                raise CommerceRuleError(404, "Cart item does not exist.")
            self._touch_cart(cur, int(cart["carrito_id"]))
            self._record_event(
                cur,
                entity_type="carrito_item",
                entity_id=item_id,
                event_type="item_removed",
                owner=owner,
            )
            cur.execute(
                "SELECT * FROM core.online_carritos WHERE carrito_id = %s",
                (cart["carrito_id"],),
            )
            return self._cart_snapshot(cur, owner, cur.fetchone()), item_id

        return self._mutate(
            owner=owner,
            scope="cart_item_remove",
            key=key,
            request_payload={"itemId": item_id},
            operation=operation,
        )

    def clear_cart(self, owner: CommerceOwner, key: str) -> dict[str, Any]:
        def operation(cur):
            cart = self._resolve_cart(cur, owner)
            cur.execute(
                """
                UPDATE core.online_carrito_items
                SET activo = FALSE, removed_at = NOW(), updated_at = NOW()
                WHERE carrito_id = %s AND activo = TRUE
                """,
                (cart["carrito_id"],),
            )
            self._touch_cart(cur, int(cart["carrito_id"]))
            self._record_event(
                cur,
                entity_type="carrito",
                entity_id=int(cart["carrito_id"]),
                event_type="cart_cleared",
                owner=owner,
            )
            cur.execute(
                "SELECT * FROM core.online_carritos WHERE carrito_id = %s",
                (cart["carrito_id"],),
            )
            return self._cart_snapshot(cur, owner, cur.fetchone()), int(cart["carrito_id"])

        return self._mutate(
            owner=owner,
            scope="cart_clear",
            key=key,
            request_payload={},
            operation=operation,
        )

    def acknowledge_price(
        self, owner: CommerceOwner, item_id: int, key: str
    ) -> dict[str, Any]:
        def operation(cur):
            cart = self._resolve_cart(cur, owner)
            cur.execute(
                """
                SELECT item.carrito_item_id, product.precio
                FROM core.online_carrito_items item
                JOIN core.catalogo_productos product
                  ON product.producto_id = item.producto_id
                WHERE item.carrito_item_id = %s AND item.carrito_id = %s
                  AND item.activo = TRUE
                FOR UPDATE OF item
                """,
                (item_id, cart["carrito_id"]),
            )
            item = cur.fetchone()
            if item is None:
                raise CommerceRuleError(404, "Cart item does not exist.")
            cur.execute(
                """
                UPDATE core.online_carrito_items
                SET precio_reconocido = %s, precio_reconocido_at = NOW(), updated_at = NOW()
                WHERE carrito_item_id = %s
                """,
                (item["precio"], item_id),
            )
            self._touch_cart(cur, int(cart["carrito_id"]))
            self._record_event(
                cur,
                entity_type="carrito_item",
                entity_id=item_id,
                event_type="price_acknowledged",
                owner=owner,
                metadata={"price": f"{Decimal(item['precio']):.2f}"},
            )
            cur.execute(
                "SELECT * FROM core.online_carritos WHERE carrito_id = %s",
                (cart["carrito_id"],),
            )
            return self._cart_snapshot(cur, owner, cur.fetchone()), item_id

        return self._mutate(
            owner=owner,
            scope="cart_price_acknowledge",
            key=key,
            request_payload={"itemId": item_id},
            operation=operation,
        )

    def get_favorites(self, owner: CommerceOwner) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                result = self._favorites_snapshot(cur, owner)
            conn.commit()
            return result

    def add_favorite(
        self, owner: CommerceOwner, product_id: int, key: str
    ) -> dict[str, Any]:
        def operation(cur):
            product = self._product_row(cur, product_id)
            if product is None:
                raise CommerceRuleError(404, "Product does not exist.")
            if not self._product_can_favorite(product):
                raise CommerceRuleError(409, "Product is not eligible for favorites.")
            cur.execute(
                """
                SELECT favorito_id
                FROM core.online_favoritos
                WHERE propietario_tipo = %s AND propietario_ref_hash = %s
                  AND producto_id = %s AND activo = TRUE
                FOR UPDATE
                """,
                (owner.db_type, owner.owner_hash, product_id),
            )
            existing = cur.fetchone()
            if existing:
                favorite_id = int(existing["favorito_id"])
            else:
                cur.execute(
                    """
                    INSERT INTO core.online_favoritos (
                        propietario_tipo, propietario_ref_hash, producto_id,
                        sku_snapshot, slug_snapshot, nombre_snapshot, expira_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        CASE WHEN %s = 'invitado'
                             THEN NOW() + (%s * INTERVAL '1 day')
                             ELSE NULL END
                    )
                    RETURNING favorito_id
                    """,
                    (
                        owner.db_type,
                        owner.owner_hash,
                        product_id,
                        product["sku"],
                        product["slug"],
                        product["nombre"],
                        owner.db_type,
                        self.config.guest_lifetime_days,
                    ),
                )
                favorite_id = int(cur.fetchone()["favorito_id"])
                self._record_event(
                    cur,
                    entity_type="favorito",
                    entity_id=favorite_id,
                    event_type="favorite_added",
                    owner=owner,
                )
            return self._favorites_snapshot(cur, owner), favorite_id

        return self._mutate(
            owner=owner,
            scope="favorite_add",
            key=key,
            request_payload={"productId": product_id},
            operation=operation,
        )

    def remove_favorite(
        self, owner: CommerceOwner, product_id: int, key: str
    ) -> dict[str, Any]:
        def operation(cur):
            cur.execute(
                """
                UPDATE core.online_favoritos
                SET activo = FALSE, removed_at = NOW(), updated_at = NOW()
                WHERE propietario_tipo = %s AND propietario_ref_hash = %s
                  AND producto_id = %s AND activo = TRUE
                RETURNING favorito_id
                """,
                (owner.db_type, owner.owner_hash, product_id),
            )
            row = cur.fetchone()
            if row is None:
                raise CommerceRuleError(404, "Favorite does not exist.")
            favorite_id = int(row["favorito_id"])
            self._record_event(
                cur,
                entity_type="favorito",
                entity_id=favorite_id,
                event_type="favorite_removed",
                owner=owner,
            )
            return self._favorites_snapshot(cur, owner), favorite_id

        return self._mutate(
            owner=owner,
            scope="favorite_remove",
            key=key,
            request_payload={"productId": product_id},
            operation=operation,
        )

    def clear_favorites(self, owner: CommerceOwner, key: str) -> dict[str, Any]:
        def operation(cur):
            cur.execute(
                """
                UPDATE core.online_favoritos
                SET activo = FALSE, removed_at = NOW(), updated_at = NOW()
                WHERE propietario_tipo = %s AND propietario_ref_hash = %s
                  AND activo = TRUE
                """,
                (owner.db_type, owner.owner_hash),
            )
            self._record_event(
                cur,
                entity_type="sesion",
                entity_id=None,
                event_type="favorites_cleared",
                owner=owner,
            )
            return self._favorites_snapshot(cur, owner), None

        return self._mutate(
            owner=owner,
            scope="favorites_clear",
            key=key,
            request_payload={},
            operation=operation,
        )

    def merge_guest(
        self, customer: CommerceOwner, guest_hash: str, key: str
    ) -> dict[str, Any]:
        if customer.owner_type != "customer":
            raise CommerceRuleError(403, "Only a customer account can receive a guest merge.")
        if not _valid_owner_hash(guest_hash):
            raise CommerceRuleError(400, "Guest identity hash is invalid.")
        guest = CommerceOwner("guest", guest_hash)

        def operation(cur):
            target_cart = self._resolve_cart(cur, customer)
            cur.execute(
                """
                SELECT *
                FROM core.online_carritos
                WHERE propietario_tipo = 'invitado'
                  AND propietario_ref_hash = %s
                  AND estado IN ('activo', 'fusionado')
                ORDER BY carrito_id DESC
                LIMIT 1
                FOR UPDATE
                """,
                (guest_hash,),
            )
            source_cart = cur.fetchone()
            merged_item_count = 0
            if source_cart and source_cart["estado"] == "activo":
                cur.execute(
                    """
                    SELECT *
                    FROM core.online_carrito_items
                    WHERE carrito_id = %s AND activo = TRUE
                    ORDER BY carrito_item_id
                    FOR UPDATE
                    """,
                    (source_cart["carrito_id"],),
                )
                for source_item in cur.fetchall():
                    cur.execute(
                        """
                        SELECT carrito_item_id, cantidad
                        FROM core.online_carrito_items
                        WHERE carrito_id = %s AND producto_id = %s
                          AND configuracion_hash = %s AND activo = TRUE
                        FOR UPDATE
                        """,
                        (
                            target_cart["carrito_id"],
                            source_item["producto_id"],
                            source_item["configuracion_hash"],
                        ),
                    )
                    target_item = cur.fetchone()
                    if target_item:
                        cur.execute(
                            """
                            UPDATE core.online_carrito_items
                            SET cantidad = cantidad + %s, requiere_revision = TRUE,
                                updated_at = NOW()
                            WHERE carrito_item_id = %s
                            """,
                            (source_item["cantidad"], target_item["carrito_item_id"]),
                        )
                    else:
                        cur.execute(
                            """
                            INSERT INTO core.online_carrito_items (
                                carrito_id, producto_id, sku_snapshot, slug_snapshot,
                                nombre_snapshot, cantidad, configuracion, configuracion_hash,
                                precio_observado, precio_reconocido,
                                producto_updated_at_observado, precio_reconocido_at,
                                requiere_revision
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, TRUE
                            )
                            """,
                            (
                                target_cart["carrito_id"],
                                source_item["producto_id"],
                                source_item["sku_snapshot"],
                                source_item["slug_snapshot"],
                                source_item["nombre_snapshot"],
                                source_item["cantidad"],
                                _canonical_json(source_item["configuracion"] or {}),
                                source_item["configuracion_hash"],
                                source_item["precio_observado"],
                                source_item["precio_reconocido"],
                                source_item["producto_updated_at_observado"],
                                source_item["precio_reconocido_at"],
                            ),
                        )
                    merged_item_count += 1
                cur.execute(
                    """
                    UPDATE core.online_carritos
                    SET estado = 'fusionado', fusionado_en_carrito_id = %s,
                        updated_at = NOW(), version = version + 1
                    WHERE carrito_id = %s
                    """,
                    (target_cart["carrito_id"], source_cart["carrito_id"]),
                )
                self._touch_cart(cur, int(target_cart["carrito_id"]))

            cur.execute(
                """
                SELECT *
                FROM core.online_favoritos
                WHERE propietario_tipo = 'invitado'
                  AND propietario_ref_hash = %s
                  AND activo = TRUE
                  AND expira_at > NOW()
                ORDER BY favorito_id
                FOR UPDATE
                """,
                (guest_hash,),
            )
            source_favorites = list(cur.fetchall())
            for favorite in source_favorites:
                cur.execute(
                    """
                    INSERT INTO core.online_favoritos (
                        propietario_tipo, propietario_ref_hash, producto_id,
                        sku_snapshot, slug_snapshot, nombre_snapshot, expira_at
                    )
                    SELECT 'cliente', %s, %s, %s, %s, %s, NULL
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM core.online_favoritos
                        WHERE propietario_tipo = 'cliente'
                          AND propietario_ref_hash = %s
                          AND producto_id = %s
                          AND activo = TRUE
                    )
                    """,
                    (
                        customer.owner_hash,
                        favorite["producto_id"],
                        favorite["sku_snapshot"],
                        favorite["slug_snapshot"],
                        favorite["nombre_snapshot"],
                        customer.owner_hash,
                        favorite["producto_id"],
                    ),
                )
            if source_favorites:
                cur.execute(
                    """
                    UPDATE core.online_favoritos
                    SET activo = FALSE, removed_at = NOW(), updated_at = NOW()
                    WHERE propietario_tipo = 'invitado'
                      AND propietario_ref_hash = %s AND activo = TRUE
                    """,
                    (guest_hash,),
                )

            self._record_event(
                cur,
                entity_type="sesion",
                entity_id=None,
                event_type="guest_merged",
                owner=customer,
                metadata={
                    "sourceGuestHashPrefix": guest_hash[:8],
                    "cartItemsMerged": merged_item_count,
                    "favoritesMerged": len(source_favorites),
                },
            )
            cur.execute(
                "SELECT * FROM core.online_carritos WHERE carrito_id = %s",
                (target_cart["carrito_id"],),
            )
            result = {
                "schemaVersion": COMMERCE_SCHEMA_VERSION,
                "merged": True,
                "cart": self._cart_snapshot(cur, customer, cur.fetchone()),
                "favorites": self._favorites_snapshot(cur, customer),
            }
            return result, int(target_cart["carrito_id"])

        return self._mutate(
            owner=customer,
            scope="guest_account_merge",
            key=key,
            request_payload={"guestOwnerHash": guest_hash},
            operation=operation,
        )

    def health(self) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY")
                cur.execute(
                    """
                    SELECT COUNT(*) AS count
                    FROM information_schema.tables
                    WHERE table_schema = 'core'
                      AND table_name = ANY(%s)
                    """,
                    ([
                        "online_producto_configuracion",
                        "online_carritos",
                        "online_carrito_items",
                        "online_favoritos",
                        "online_comercio_eventos",
                        "online_idempotencia",
                    ],),
                )
                if int(cur.fetchone()["count"]) != 6:
                    raise CommerceRuleError(503, "Commerce schema is not ready.")
        return {"status": "ok", "schemaVersion": COMMERCE_SCHEMA_VERSION}


def create_online_commerce_router(
    db_conninfo: str,
    *,
    config: CommerceConfig | None = None,
    repository: CommerceRepository | None = None,
) -> APIRouter:
    config = config or CommerceConfig.from_env(db_conninfo)
    repository = repository or CommerceRepository(config)
    router = APIRouter(prefix="/storefront/commerce/v1", tags=["Online commerce"])
    bearer = HTTPBearer(auto_error=False)

    def require_commerce_access(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    ) -> None:
        if not config.enabled:
            raise HTTPException(status_code=503, detail="Online commerce is disabled.")
        if not config.bearer_token:
            raise HTTPException(status_code=503, detail="Online commerce is not configured.")
        if not commerce_credentials_valid(credentials, config.bearer_token):
            raise HTTPException(
                status_code=401,
                detail="Invalid commerce credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def owner(
        owner_type: str = Header(alias="X-OLM-Owner-Type"),
        owner_hash: str = Header(alias="X-OLM-Owner-Hash"),
    ) -> CommerceOwner:
        normalized_type = owner_type.strip().lower()
        normalized_hash = owner_hash.strip().lower()
        if normalized_type not in {"guest", "customer"} or not _valid_owner_hash(
            normalized_hash
        ):
            raise HTTPException(status_code=400, detail="Commerce owner is invalid.")
        return CommerceOwner(normalized_type, normalized_hash)  # type: ignore[arg-type]

    def run(action: Callable[[], dict[str, Any]]) -> dict[str, Any]:
        try:
            return action()
        except CommerceRuleError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail)
        except psycopg.Error:
            raise HTTPException(status_code=503, detail="Commerce temporarily unavailable.")

    dependencies = [Depends(require_commerce_access)]

    @router.get("/health", dependencies=dependencies)
    def health():
        return run(repository.health)

    @router.get("/cart", dependencies=dependencies)
    def get_cart(commerce_owner: CommerceOwner = Depends(owner)):
        return run(lambda: repository.get_cart(commerce_owner))

    @router.post("/cart/items", dependencies=dependencies)
    def add_item(
        data: AddCartItemRequest,
        commerce_owner: CommerceOwner = Depends(owner),
        idempotency_key: str = Header(alias="Idempotency-Key"),
    ):
        return run(lambda: repository.add_cart_item(commerce_owner, data, idempotency_key))

    @router.patch("/cart/items/{item_id}", dependencies=dependencies)
    def update_item(
        item_id: int,
        data: UpdateCartItemRequest,
        commerce_owner: CommerceOwner = Depends(owner),
        idempotency_key: str = Header(alias="Idempotency-Key"),
    ):
        return run(
            lambda: repository.update_cart_item(
                commerce_owner, item_id, data.quantity, idempotency_key
            )
        )

    @router.delete("/cart/items/{item_id}", dependencies=dependencies)
    def remove_item(
        item_id: int,
        commerce_owner: CommerceOwner = Depends(owner),
        idempotency_key: str = Header(alias="Idempotency-Key"),
    ):
        return run(
            lambda: repository.remove_cart_item(
                commerce_owner, item_id, idempotency_key
            )
        )

    @router.delete("/cart/items", dependencies=dependencies)
    def clear_cart(
        commerce_owner: CommerceOwner = Depends(owner),
        idempotency_key: str = Header(alias="Idempotency-Key"),
    ):
        return run(lambda: repository.clear_cart(commerce_owner, idempotency_key))

    @router.post("/cart/items/{item_id}/acknowledge-price", dependencies=dependencies)
    def acknowledge_price(
        item_id: int,
        commerce_owner: CommerceOwner = Depends(owner),
        idempotency_key: str = Header(alias="Idempotency-Key"),
    ):
        return run(
            lambda: repository.acknowledge_price(
                commerce_owner, item_id, idempotency_key
            )
        )

    @router.get("/favorites", dependencies=dependencies)
    def get_favorites(commerce_owner: CommerceOwner = Depends(owner)):
        return run(lambda: repository.get_favorites(commerce_owner))

    @router.put("/favorites/{product_id}", dependencies=dependencies)
    def add_favorite(
        product_id: int,
        commerce_owner: CommerceOwner = Depends(owner),
        idempotency_key: str = Header(alias="Idempotency-Key"),
    ):
        return run(
            lambda: repository.add_favorite(
                commerce_owner, product_id, idempotency_key
            )
        )

    @router.delete("/favorites/{product_id}", dependencies=dependencies)
    def remove_favorite(
        product_id: int,
        commerce_owner: CommerceOwner = Depends(owner),
        idempotency_key: str = Header(alias="Idempotency-Key"),
    ):
        return run(
            lambda: repository.remove_favorite(
                commerce_owner, product_id, idempotency_key
            )
        )

    @router.delete("/favorites", dependencies=dependencies)
    def clear_favorites(
        commerce_owner: CommerceOwner = Depends(owner),
        idempotency_key: str = Header(alias="Idempotency-Key"),
    ):
        return run(lambda: repository.clear_favorites(commerce_owner, idempotency_key))

    @router.post("/merge", dependencies=dependencies)
    def merge(
        data: MergeRequest,
        commerce_owner: CommerceOwner = Depends(owner),
        idempotency_key: str = Header(alias="Idempotency-Key"),
    ):
        return run(
            lambda: repository.merge_guest(
                commerce_owner, data.guestOwnerHash.lower(), idempotency_key
            )
        )

    return router
