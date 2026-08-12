"""Phase 1F-B1 manual shipping quotes, pickup, and checkout previews.

This module never reserves or deducts inventory and never creates an order,
payment, sale, shipment, label, or tracking number.
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
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator
import psycopg
from psycopg.rows import dict_row

from online_commerce import CommerceOwner, _valid_owner_hash
from online_optical_drafts import release_expired_optical_reservations
from shipping_packages import (
    PackageRuleError,
    PackagingConfiguration,
    ProductShippingMeasurement,
    SingleCombinedPackageCalculator,
)


FULFILLMENT_SCHEMA_VERSION = "1.0"
STATUS_TO_API = {
    "pendiente": "pending",
    "cotizada": "quoted",
    "seleccionada": "selected",
    "expirada": "expired",
    "no_disponible": "unavailable",
    "cancelada": "cancelled",
}
STATUS_FROM_API = {value: key for key, value in STATUS_TO_API.items()}
RESERVATION_STATUS_TO_API = {
    "activa": "active",
    "liberada": "released",
    "expirada": "expired",
    "cancelada": "cancelled",
}
ORDER_STATUS_TO_API = {
    "pendiente_pago": "pending_payment",
}
PAYMENT_STATUS_TO_API = {
    "pendiente": "pending",
    "checkout_creado": "checkout_created",
    "fallido": "failed",
    "cancelado": "canceled",
    "expirado": "expired",
    "pagado": "paid",
}


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    return default if value is None else value.strip().lower() in {"1", "true", "yes", "on"}


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _hash(value: Any) -> str:
    return hashlib.sha256(_canonical(value).encode("utf-8")).hexdigest()


def _safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_safe(item) for item in value]
    return value


class FulfillmentRuleError(RuntimeError):
    def __init__(self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.detail = {"code": code, "message": message, "details": details or {}}


@dataclass(frozen=True)
class FulfillmentConfig:
    db_conninfo: str
    bearer_token: str
    enabled: bool
    reservations_enabled: bool = False
    orders_enabled: bool = False
    payment_sessions_enabled: bool = False

    @classmethod
    def from_env(cls, db_conninfo: str) -> "FulfillmentConfig":
        return cls(
            db_conninfo=db_conninfo,
            bearer_token=os.getenv("ONLINE_COMMERCE_BEARER_TOKEN", "").strip(),
            enabled=_env_bool("PHASE_1FB1_ENABLED", False),
            reservations_enabled=_env_bool("PHASE_1FB2_ENABLED", False),
            orders_enabled=_env_bool("PHASE_1FC1_ENABLED", False),
            payment_sessions_enabled=_env_bool("PHASE_1FC2A_ENABLED", False),
        )


class ContactInput(BaseModel):
    fullName: str = Field(min_length=2, max_length=200)
    email: str = Field(min_length=3, max_length=254)
    phone: str = Field(min_length=7, max_length=30)

    @field_validator("fullName", "email", "phone")
    @classmethod
    def clean_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value is required")
        return value


class AddressInput(BaseModel):
    street: str = Field(min_length=1, max_length=200)
    exteriorNumber: str = Field(min_length=1, max_length=40)
    interiorNumber: str | None = Field(default=None, max_length=40)
    neighborhood: str = Field(min_length=1, max_length=150)
    postalCode: str = Field(min_length=5, max_length=10)
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=1, max_length=120)
    country: str = Field(min_length=1, max_length=80)
    references: str | None = Field(default=None, max_length=500)

    @field_validator("street", "exteriorNumber", "neighborhood", "postalCode", "city", "state", "country")
    @classmethod
    def clean_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value is required")
        return value

    @field_validator("country")
    @classmethod
    def mexico_only(cls, value: str) -> str:
        normalized = value.strip().lower().replace("é", "e")
        if normalized not in {"mexico", "mx"}:
            raise ValueError("Phase 1F-B1 shipping territory is Mexico only")
        return "México"


class CreateFulfillmentRequest(BaseModel):
    method: Literal["shipping", "pickup"]
    contact: ContactInput
    address: AddressInput | None = None
    pickupBranchId: int | None = Field(default=None, gt=0)


class SelectOptionRequest(BaseModel):
    optionId: str = Field(min_length=36, max_length=36)


class ManualQuoteInput(BaseModel):
    branchId: int = Field(gt=0)
    carrierCode: str = Field(min_length=1, max_length=50)
    otherCarrierName: str | None = Field(default=None, max_length=120)
    serviceLevel: str = Field(min_length=1, max_length=160)
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    minimumDeliveryDays: int = Field(ge=0, le=365)
    maximumDeliveryDays: int = Field(ge=0, le=365)
    expiresAt: datetime | None = None
    zeroAuthorizationReason: str | None = Field(default=None, max_length=500)

    @field_validator("carrierCode", "serviceLevel")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()


class ProductShippingInput(BaseModel):
    weightGrams: int | None = Field(default=None, gt=0)
    lengthMm: int | None = Field(default=None, gt=0)
    widthMm: int | None = Field(default=None, gt=0)
    heightMm: int | None = Field(default=None, gt=0)
    requiresIndividualPackage: bool = False
    compatibilityGroup: str = Field(default="general", min_length=1, max_length=100)
    active: bool = False


class CategoryShippingInput(ProductShippingInput):
    pass


class PackagingConfigInput(BaseModel):
    active: bool
    packagingWeightGrams: int | None = Field(default=None, gt=0)
    paddingLengthMm: int | None = Field(default=None, ge=0)
    paddingWidthMm: int | None = Field(default=None, ge=0)
    paddingHeightMm: int | None = Field(default=None, ge=0)
    maximumWeightGrams: int | None = Field(default=None, gt=0)
    maximumLengthMm: int | None = Field(default=None, gt=0)
    maximumWidthMm: int | None = Field(default=None, gt=0)
    maximumHeightMm: int | None = Field(default=None, gt=0)
    costWeight: Decimal = Field(default=Decimal("0.60"), ge=0, le=1)
    speedWeight: Decimal = Field(default=Decimal("0.40"), ge=0, le=1)
    requestLifetimeHours: int = Field(default=48, gt=0, le=720)
    quoteLifetimeHours: int = Field(default=24, gt=0, le=168)


class CarrierUpdateInput(BaseModel):
    active: bool
    name: str = Field(min_length=1, max_length=120)


class FulfillmentRepository:
    def __init__(self, config: FulfillmentConfig, connect: Callable[..., Any] = psycopg.connect):
        self.config = config
        self._connect = connect
        self._calculator = SingleCombinedPackageCalculator()

    def _connection(self):
        return self._connect(self.config.db_conninfo, row_factory=dict_row)

    @staticmethod
    def _expire(cur) -> None:
        cur.execute(
            """
            UPDATE core.online_opciones_cotizacion_envio
            SET activa = FALSE, invalidada_at = NOW(), motivo_invalidez = 'expired'
            WHERE activa = TRUE AND expira_at <= NOW()
            """
        )
        cur.execute(
            """
            UPDATE core.online_solicitudes_cotizacion_envio request
            SET estado = 'expirada', updated_at = NOW()
            WHERE request.estado IN ('pendiente', 'cotizada')
              AND request.expira_at <= NOW()
              AND NOT EXISTS (
                  SELECT 1 FROM core.online_opciones_cotizacion_envio option
                  WHERE option.solicitud_id = request.solicitud_id
                    AND option.activa = TRUE AND option.expira_at > NOW()
              )
            """
        )

    @staticmethod
    def _event(
        cur,
        *,
        request_id: int | None,
        option_id: int | None = None,
        event_type: str,
        actor_type: str,
        owner_hash: str | None = None,
        staff: dict[str, Any] | None = None,
        before: str | None = None,
        after: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        cur.execute(
            """
            INSERT INTO core.online_cotizacion_envio_eventos (
                solicitud_id, opcion_id, evento_tipo, actor_tipo, actor_ref_hash,
                usuario_id, username_snapshot, rol_snapshot,
                estado_anterior, estado_nuevo, metadata
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            (
                request_id,
                option_id,
                event_type,
                actor_type,
                owner_hash,
                staff.get("usuario_id") if staff else None,
                staff.get("username") if staff else None,
                staff.get("rol") if staff else None,
                before,
                after,
                _canonical(metadata or {}),
            ),
        )

    @staticmethod
    def _cart(cur, owner: CommerceOwner) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        cur.execute(
            """
            SELECT * FROM core.online_carritos
            WHERE propietario_tipo = %s AND propietario_ref_hash = %s AND estado = 'activo'
            ORDER BY carrito_id DESC LIMIT 1 FOR UPDATE
            """,
            (owner.db_type, owner.owner_hash),
        )
        cart = cur.fetchone()
        if not cart:
            raise FulfillmentRuleError(409, "CART_EMPTY", "The authoritative cart is empty.")
        cur.execute(
            """
            SELECT item.carrito_item_id, item.producto_id, item.cantidad,
                   item.configuracion_hash, item.precio_reconocido, item.requiere_revision,
                   product.sku, product.nombre, product.categoria, product.precio,
                   product.moneda, product.controla_stock, product.activo,
                   product.publicado_online, product.tipo_producto, product.updated_at,
                   COALESCE(online.comprable_online, FALSE) AS comprable_online
            FROM core.online_carrito_items item
            JOIN core.catalogo_productos product ON product.producto_id = item.producto_id
            LEFT JOIN core.online_producto_configuracion online ON online.producto_id = product.producto_id
            WHERE item.carrito_id = %s AND item.activo = TRUE
            ORDER BY item.carrito_item_id
            """,
            (cart["carrito_id"],),
        )
        items = list(cur.fetchall())
        if not items:
            raise FulfillmentRuleError(409, "CART_EMPTY", "The authoritative cart is empty.")
        for item in items:
            if not (
                item["activo"] and item["publicado_online"] and item["comprable_online"]
                and item["tipo_producto"] == "producto_fisico"
                and not item["requiere_revision"]
                and Decimal(item["precio_reconocido"]) == Decimal(item["precio"])
            ):
                raise FulfillmentRuleError(
                    409,
                    "CART_REQUIRES_REVIEW",
                    "The cart changed or contains an unavailable item. Review it before continuing.",
                    {"productId": str(item["producto_id"])},
                )
        return cart, items

    @staticmethod
    def _cart_snapshot(cart: dict[str, Any], items: list[dict[str, Any]]) -> tuple[dict[str, Any], str]:
        snapshot = {
            "cartId": str(cart["carrito_id"]),
            "version": int(cart["version"]),
            "currency": str(cart["moneda"]).strip(),
            "items": [
                {
                    "itemId": str(item["carrito_item_id"]),
                    "productId": str(item["producto_id"]),
                    "sku": item["sku"],
                    "name": item["nombre"],
                    "quantity": int(item["cantidad"]),
                    "unitPrice": f"{Decimal(item['precio']):.2f}",
                    "currency": str(item["moneda"]).strip(),
                    "controlsStock": bool(item["controla_stock"]),
                    "configurationHash": item["configuracion_hash"],
                    "productUpdatedAt": item["updated_at"],
                }
                for item in items
            ],
        }
        return _safe(snapshot), _hash(snapshot)

    def _packages(self, cur, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        cur.execute("SELECT * FROM core.envio_configuracion_empaque WHERE configuracion_id = 1")
        config = cur.fetchone()
        required = (
            "peso_empaque_gramos", "margen_largo_mm", "margen_ancho_mm", "margen_alto_mm",
            "peso_maximo_gramos", "largo_maximo_mm", "ancho_maximo_mm", "alto_maximo_mm",
        )
        if not config or not config["activa"] or any(config[name] is None for name in required):
            raise FulfillmentRuleError(
                422,
                "PACKAGING_CONFIGURATION_MISSING",
                "Shipping packaging has not been configured by an administrator.",
            )

        measurements: list[ProductShippingMeasurement] = []
        missing: list[str] = []
        for item in items:
            cur.execute(
                """
                SELECT product.*, category.peso_gramos AS fallback_peso,
                       category.largo_mm AS fallback_largo,
                       category.ancho_mm AS fallback_ancho,
                       category.alto_mm AS fallback_alto,
                       category.requiere_paquete_individual AS fallback_individual,
                       category.grupo_compatibilidad AS fallback_group,
                       category.activo AS fallback_activo
                FROM (SELECT 1) seed
                LEFT JOIN core.catalogo_producto_envio product
                  ON product.producto_id = %s
                LEFT JOIN core.envio_categoria_fallbacks category ON category.categoria = %s
                """,
                (item["producto_id"], item["categoria"]),
            )
            shipping = cur.fetchone()
            if shipping and shipping["activo"]:
                values = (
                    shipping["peso_gramos"], shipping["largo_mm"], shipping["ancho_mm"],
                    shipping["alto_mm"], shipping["requiere_paquete_individual"],
                    shipping["grupo_compatibilidad"], "product",
                )
            elif shipping and shipping["fallback_activo"]:
                values = (
                    shipping["fallback_peso"], shipping["fallback_largo"], shipping["fallback_ancho"],
                    shipping["fallback_alto"], shipping["fallback_individual"],
                    shipping["fallback_group"], "category",
                )
            else:
                missing.append(str(item["producto_id"]))
                continue
            measurements.append(
                ProductShippingMeasurement(
                    product_id=int(item["producto_id"]), quantity=int(item["cantidad"]),
                    weight_grams=int(values[0]), length_mm=int(values[1]), width_mm=int(values[2]),
                    height_mm=int(values[3]), requires_individual_package=bool(values[4]),
                    compatibility_group=str(values[5]), source=str(values[6]),
                )
            )
        if missing:
            raise FulfillmentRuleError(
                422,
                "SHIPPING_MEASUREMENTS_MISSING",
                "One or more products have no approved shipping measurements.",
                {"productIds": missing},
            )
        try:
            return self._calculator.calculate(
                measurements,
                PackagingConfiguration(
                    packaging_weight_grams=int(config["peso_empaque_gramos"]),
                    padding_length_mm=int(config["margen_largo_mm"]),
                    padding_width_mm=int(config["margen_ancho_mm"]),
                    padding_height_mm=int(config["margen_alto_mm"]),
                    maximum_weight_grams=int(config["peso_maximo_gramos"]),
                    maximum_length_mm=int(config["largo_maximo_mm"]),
                    maximum_width_mm=int(config["ancho_maximo_mm"]),
                    maximum_height_mm=int(config["alto_maximo_mm"]),
                ),
            )
        except PackageRuleError as exc:
            raise FulfillmentRuleError(422, exc.code, exc.message, exc.details) from exc

    @staticmethod
    def _eligible_branches(cur, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        controlled = [item for item in items if item["controla_stock"]]
        cur.execute(
            """
            SELECT sucursal_id, nombre, codigo, ciudad, estado, calle, numero,
                   colonia, cp, municipio, pais
            FROM core.sucursales WHERE activa = TRUE ORDER BY sucursal_id
            """
        )
        eligible = []
        for branch in cur.fetchall():
            availability = []
            valid = True
            for item in controlled:
                cur.execute(
                    """
                    SELECT stock, stock_reservado, disponible_venta,
                           GREATEST(stock - stock_reservado, 0) AS disponible
                    FROM core.catalogo_inventario_sucursal
                    WHERE sucursal_id = %s AND producto_id = %s
                    """,
                    (branch["sucursal_id"], item["producto_id"]),
                )
                inventory = cur.fetchone()
                available = int(inventory["disponible"]) if inventory and inventory["disponible_venta"] else 0
                valid = valid and available >= int(item["cantidad"])
                availability.append(
                    {"productId": str(item["producto_id"]), "requested": int(item["cantidad"]), "available": available}
                )
            if valid:
                eligible.append({"branch": _safe(branch), "availability": availability})
        return eligible

    @staticmethod
    def _revalidate_branch(cur, branch_id: int, cart_snapshot: dict[str, Any]) -> bool:
        cur.execute("SELECT activa FROM core.sucursales WHERE sucursal_id = %s", (branch_id,))
        branch = cur.fetchone()
        if not branch or not branch["activa"]:
            return False
        for item in cart_snapshot["items"]:
            if not item["controlsStock"]:
                continue
            cur.execute(
                """
                SELECT disponible_venta, stock - stock_reservado AS disponible
                FROM core.catalogo_inventario_sucursal
                WHERE sucursal_id = %s AND producto_id = %s
                """,
                (branch_id, int(item["productId"])),
            )
            inventory = cur.fetchone()
            if not inventory or not inventory["disponible_venta"] or int(inventory["disponible"]) < item["quantity"]:
                return False
        return True

    @staticmethod
    def _score_options(rows: list[dict[str, Any]], cost_weight: Decimal, speed_weight: Decimal) -> dict[str, str] | None:
        if not rows:
            return None
        min_cost, max_cost = min(Decimal(row["monto"]) for row in rows), max(Decimal(row["monto"]) for row in rows)
        min_days, max_days = min(int(row["entrega_max_dias"]) for row in rows), max(int(row["entrega_max_dias"]) for row in rows)
        def score(row: dict[str, Any]) -> Decimal:
            cost = Decimal("0") if max_cost == min_cost else (Decimal(row["monto"]) - min_cost) / (max_cost - min_cost)
            speed = Decimal("0") if max_days == min_days else Decimal(int(row["entrega_max_dias"]) - min_days) / Decimal(max_days - min_days)
            return cost_weight * cost + speed_weight * speed
        cheapest = min(rows, key=lambda row: (Decimal(row["monto"]), int(row["entrega_max_dias"])))
        fastest = min(rows, key=lambda row: (int(row["entrega_max_dias"]), Decimal(row["monto"])))
        recommended = min(rows, key=lambda row: (score(row), Decimal(row["monto"])))
        return {
            "cheapestOptionId": str(cheapest["opcion_public_id"]),
            "fastestOptionId": str(fastest["opcion_public_id"]),
            "recommendedOptionId": str(recommended["opcion_public_id"]),
        }

    @staticmethod
    def _option_payload(option: dict[str, Any]) -> dict[str, Any]:
        return _safe(
            {
                "optionId": str(option["opcion_public_id"]),
                "branchId": str(option["sucursal_id"]),
                "branchName": option["branch_name"],
                "carrierCode": option["transportista_codigo_snapshot"],
                "carrierName": option["transportista_nombre_snapshot"],
                "serviceLevel": option["nivel_servicio_snapshot"],
                "amount": f"{Decimal(option['monto']):.2f}",
                "currency": str(option["moneda"]).strip(),
                "minimumDeliveryDays": option["entrega_min_dias"],
                "maximumDeliveryDays": option["entrega_max_dias"],
                "quoteIdentifier": option["quote_identifier"],
                "calculatedAt": option["calculada_at"],
                "expiresAt": option["expira_at"],
            }
        )

    def _request_payload(self, cur, row: dict[str, Any]) -> dict[str, Any]:
        cur.execute(
            """
            SELECT option.*, branch.nombre AS branch_name
            FROM core.online_opciones_cotizacion_envio option
            JOIN core.sucursales branch ON branch.sucursal_id = option.sucursal_id
            WHERE option.solicitud_id = %s AND option.activa = TRUE AND option.expira_at > NOW()
            ORDER BY option.monto, option.entrega_max_dias, option.opcion_id
            """,
            (row["solicitud_id"],),
        )
        options = list(cur.fetchall())
        cur.execute(
            """
            SELECT option.opcion_public_id
            FROM core.online_cotizacion_selecciones selection
            JOIN core.online_opciones_cotizacion_envio option
              ON option.opcion_id = selection.opcion_id
            WHERE selection.solicitud_id = %s
            """,
            (row["solicitud_id"],),
        )
        selected = cur.fetchone()
        cur.execute("SELECT costo_weight, speed_weight FROM core.envio_configuracion_empaque WHERE configuracion_id = 1")
        weights = cur.fetchone() or {"costo_weight": Decimal("0.60"), "speed_weight": Decimal("0.40")}
        labels = self._score_options(options, Decimal(weights["costo_weight"]), Decimal(weights["speed_weight"]))
        return _safe(
            {
                "schemaVersion": FULFILLMENT_SCHEMA_VERSION,
                "requestId": str(row["solicitud_public_id"]),
                "method": "shipping" if row["metodo_entrega"] == "envio" else "pickup",
                "status": STATUS_TO_API[row["estado"]],
                "contact": row["contacto_snapshot"],
                "address": row["direccion_snapshot"],
                "packages": row["paquetes_snapshot"],
                "expiresAt": row["expira_at"],
                "createdAt": row["created_at"],
                "selectedOptionId": (
                    str(selected["opcion_public_id"]) if selected else None
                ),
                "options": [self._option_payload(option) for option in options],
                "ranking": labels,
                "reservation": self._request_reservation_payload(cur, row["solicitud_id"]),
            }
        )

    def _request_reservation_payload(self, cur, request_id: int) -> dict[str, Any] | None:
        cur.execute(
            """
            SELECT reservation.*, request.solicitud_public_id,
                   option.opcion_public_id, branch.nombre AS branch_name,
                   config.vigencia_minutos AS lifetime_minutes
            FROM core.online_reservas reservation
            JOIN core.online_solicitudes_cotizacion_envio request
              ON request.solicitud_id = reservation.solicitud_id
            JOIN core.online_cotizacion_selecciones selection
              ON selection.seleccion_id = reservation.seleccion_id
            JOIN core.online_opciones_cotizacion_envio option
              ON option.opcion_id = selection.opcion_id
            JOIN core.sucursales branch ON branch.sucursal_id = reservation.sucursal_id
            CROSS JOIN core.online_reserva_configuracion config
            WHERE reservation.solicitud_id = %s
            ORDER BY reservation.created_at DESC
            LIMIT 1
            """,
            (request_id,),
        )
        reservation = cur.fetchone()
        if not reservation:
            return None
        return self._reservation_payload(cur, reservation)

    def create_request(self, owner: CommerceOwner, data: CreateFulfillmentRequest, key: str) -> dict[str, Any]:
        if data.method == "shipping" and data.address is None:
            raise FulfillmentRuleError(422, "ADDRESS_REQUIRED", "A complete Mexican shipping address is required.")
        if data.method == "pickup" and data.pickupBranchId is None:
            raise FulfillmentRuleError(422, "PICKUP_BRANCH_REQUIRED", "Select a pickup branch.")
        with self._connection() as conn:
            with conn.cursor() as cur:
                self._expire(cur)
                idempotency_id, cached = self._idempotency_begin(cur, owner, "fulfillment_request", key, data.model_dump(mode="json"))
                if cached is not None:
                    return cached
                cart, items = self._cart(cur, owner)
                cart_snapshot, fingerprint = self._cart_snapshot(cart, items)
                packages = self._packages(cur, items) if data.method == "shipping" else []
                branches = self._eligible_branches(cur, items)
                if data.method == "shipping":
                    branches = [entry for entry in branches if entry["branch"].get("cp")]
                else:
                    branches = [entry for entry in branches if int(entry["branch"]["sucursal_id"]) == data.pickupBranchId]
                if not branches:
                    raise FulfillmentRuleError(409, "NO_SINGLE_BRANCH_FULFILLMENT", "No active branch can fulfill the complete cart.")
                cur.execute("SELECT solicitud_vigencia_horas FROM core.envio_configuracion_empaque WHERE configuracion_id = 1")
                lifetime = int(cur.fetchone()["solicitud_vigencia_horas"])
                cur.execute(
                    """
                    INSERT INTO core.online_solicitudes_cotizacion_envio (
                        propietario_tipo, propietario_ref_hash, carrito_id, carrito_fingerprint,
                        metodo_entrega, estado, direccion_snapshot, contacto_snapshot,
                        carrito_snapshot, paquetes_snapshot, expira_at
                    ) VALUES (%s, %s, %s, %s, %s, 'pendiente', %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb,
                              NOW() + (%s * INTERVAL '1 hour')) RETURNING *
                    """,
                    (
                        owner.db_type, owner.owner_hash, cart["carrito_id"], fingerprint,
                        "envio" if data.method == "shipping" else "recoger_sucursal",
                        _canonical(data.address.model_dump()) if data.address else None,
                        _canonical(data.contact.model_dump()), _canonical(cart_snapshot),
                        _canonical(packages), lifetime,
                    ),
                )
                request = cur.fetchone()
                for entry in branches:
                    cur.execute(
                        """
                        INSERT INTO core.online_solicitud_sucursales_elegibles
                            (solicitud_id, sucursal_id, sucursal_snapshot, disponibilidad_snapshot)
                        VALUES (%s, %s, %s::jsonb, %s::jsonb)
                        """,
                        (request["solicitud_id"], entry["branch"]["sucursal_id"], _canonical(entry["branch"]), _canonical(entry["availability"])),
                    )
                self._event(cur, request_id=request["solicitud_id"], event_type="request_created", actor_type=owner.db_type, owner_hash=owner.owner_hash, after="pendiente")
                if data.method == "pickup":
                    branch = branches[0]["branch"]
                    quote_identifier = f"pickup-{request['solicitud_public_id']}"
                    cur.execute(
                        """
                        INSERT INTO core.online_opciones_cotizacion_envio (
                            solicitud_id, sucursal_id, transportista_codigo_snapshot,
                            transportista_nombre_snapshot, nivel_servicio_snapshot, monto,
                            entrega_min_dias, entrega_max_dias, quote_identifier, expira_at,
                            ingresada_por_rol
                        ) VALUES (%s, %s, 'pickup', %s, 'Recoger en sucursal', 0, 0, 0, %s, %s, 'sistema')
                        RETURNING opcion_id
                        """,
                        (request["solicitud_id"], branch["sucursal_id"], branch["nombre"], quote_identifier, request["expira_at"]),
                    )
                    option_id = int(cur.fetchone()["opcion_id"])
                    cur.execute("UPDATE core.online_solicitudes_cotizacion_envio SET estado = 'cotizada', updated_at = NOW() WHERE solicitud_id = %s RETURNING *", (request["solicitud_id"],))
                    request = cur.fetchone()
                    self._event(cur, request_id=request["solicitud_id"], option_id=option_id, event_type="pickup_option_created", actor_type="sistema", before="pendiente", after="cotizada")
                result = self._request_payload(cur, request)
                self._idempotency_finish(cur, idempotency_id, result, int(request["solicitud_id"]))
            conn.commit()
            return result

    @staticmethod
    def _idempotency_begin(cur, owner: CommerceOwner, scope: str, key: str, payload: dict[str, Any]):
        clean = key.strip()
        if not clean or len(clean) > 200:
            raise FulfillmentRuleError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.")
        key_hash, request_hash = hashlib.sha256(clean.encode()).hexdigest(), _hash(payload)
        cur.execute(
            """
            INSERT INTO core.online_idempotencia
                (alcance, clave_hash, propietario_ref_hash, solicitud_hash, expira_at)
            VALUES (%s, %s, %s, %s, NOW() + INTERVAL '24 hours')
            ON CONFLICT (alcance, clave_hash) DO NOTHING RETURNING idempotencia_id
            """,
            (scope, key_hash, owner.owner_hash, request_hash),
        )
        inserted = cur.fetchone()
        if inserted:
            return int(inserted["idempotencia_id"]), None
        cur.execute("SELECT * FROM core.online_idempotencia WHERE alcance = %s AND clave_hash = %s FOR UPDATE", (scope, key_hash))
        existing = cur.fetchone()
        if existing["propietario_ref_hash"] != owner.owner_hash or existing["solicitud_hash"] != request_hash:
            raise FulfillmentRuleError(409, "IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used differently.")
        if existing["estado"] == "completado" and existing["respuesta"] is not None:
            return None, existing["respuesta"]
        raise FulfillmentRuleError(409, "REQUEST_IN_PROGRESS", "The same request is already being processed.")

    @staticmethod
    def _idempotency_finish(cur, row_id: int | None, result: dict[str, Any], resource_id: int):
        if row_id is not None:
            cur.execute(
                """UPDATE core.online_idempotencia SET estado = 'completado', recurso_id = %s,
                   codigo_respuesta = 200, respuesta = %s::jsonb, updated_at = NOW()
                   WHERE idempotencia_id = %s""",
                (resource_id, _canonical(result), row_id),
            )

    def list_requests(self, owner: CommerceOwner) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                self._expire(cur)
                cur.execute(
                    """SELECT * FROM core.online_solicitudes_cotizacion_envio
                       WHERE propietario_tipo = %s AND propietario_ref_hash = %s
                       ORDER BY created_at DESC""",
                    (owner.db_type, owner.owner_hash),
                )
                requests = [self._request_payload(cur, row) for row in cur.fetchall()]
            conn.commit()
        return {"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "requests": requests}

    def pickup_branches(self) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT sucursal_id, nombre, ciudad, estado
                       FROM core.sucursales WHERE activa = TRUE ORDER BY sucursal_id"""
                )
                branches = [
                    {
                        "branchId": str(row["sucursal_id"]),
                        "name": row["nombre"],
                        "city": row["ciudad"],
                        "state": row["estado"],
                    }
                    for row in cur.fetchall()
                ]
        return {"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "branches": branches}

    def get_request(self, owner: CommerceOwner, public_id: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                self._expire(cur)
                cur.execute(
                    """SELECT * FROM core.online_solicitudes_cotizacion_envio
                       WHERE solicitud_public_id = %s AND propietario_tipo = %s AND propietario_ref_hash = %s""",
                    (public_id, owner.db_type, owner.owner_hash),
                )
                row = cur.fetchone()
                if not row:
                    raise FulfillmentRuleError(404, "REQUEST_NOT_FOUND", "Shipping request was not found.")
                result = self._request_payload(cur, row)
            conn.commit()
        return result

    def select_option(self, owner: CommerceOwner, public_id: str, option_public_id: str, key: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                self._expire(cur)
                idempotency_id, cached = self._idempotency_begin(cur, owner, "fulfillment_select", key, {"requestId": public_id, "optionId": option_public_id})
                if cached is not None:
                    return cached
                cur.execute(
                    """SELECT * FROM core.online_solicitudes_cotizacion_envio
                       WHERE solicitud_public_id = %s AND propietario_tipo = %s AND propietario_ref_hash = %s FOR UPDATE""",
                    (public_id, owner.db_type, owner.owner_hash),
                )
                request = cur.fetchone()
                if not request:
                    raise FulfillmentRuleError(404, "REQUEST_NOT_FOUND", "Shipping request was not found.")
                cur.execute("SELECT * FROM core.online_cotizacion_selecciones WHERE solicitud_id = %s", (request["solicitud_id"],))
                existing = cur.fetchone()
                if existing:
                    cur.execute("SELECT opcion_public_id FROM core.online_opciones_cotizacion_envio WHERE opcion_id = %s", (existing["opcion_id"],))
                    if str(cur.fetchone()["opcion_public_id"]) == option_public_id:
                        result = self._preview_payload(cur, request)
                        self._idempotency_finish(cur, idempotency_id, result, int(existing["seleccion_id"]))
                        conn.commit()
                        return result
                if request["estado"] not in {"cotizada", "pendiente", "seleccionada"} or request["expira_at"] <= datetime.now(timezone.utc):
                    raise FulfillmentRuleError(409, "REQUEST_NOT_SELECTABLE", "This request can no longer accept a selection.")
                cur.execute(
                    """SELECT option.*, branch.nombre AS branch_name
                       FROM core.online_opciones_cotizacion_envio option
                       JOIN core.sucursales branch ON branch.sucursal_id = option.sucursal_id
                       WHERE option.opcion_public_id = %s AND option.solicitud_id = %s
                         AND option.activa = TRUE AND option.expira_at > NOW()
                       FOR UPDATE OF option""",
                    (option_public_id, request["solicitud_id"]),
                )
                option = cur.fetchone()
                if not option:
                    raise FulfillmentRuleError(409, "QUOTE_EXPIRED_OR_INVALID", "The shipping option is expired or invalid.")
                if not self._revalidate_branch(cur, int(option["sucursal_id"]), request["carrito_snapshot"]):
                    cur.execute("UPDATE core.online_opciones_cotizacion_envio SET activa = FALSE, invalidada_at = NOW(), motivo_invalidez = 'stock_changed' WHERE opcion_id = %s", (option["opcion_id"],))
                    cur.execute("UPDATE core.online_solicitudes_cotizacion_envio SET estado = 'no_disponible', updated_at = NOW() WHERE solicitud_id = %s", (request["solicitud_id"],))
                    self._event(cur, request_id=request["solicitud_id"], option_id=option["opcion_id"], event_type="quote_invalidated_stock", actor_type="sistema", before=request["estado"], after="no_disponible")
                    conn.commit()
                    raise FulfillmentRuleError(409, "STOCK_CHANGED_RECALCULATE", "Branch stock changed. Create a new validated request.")
                option_snapshot = _safe(dict(option))
                if existing:
                    cur.execute(
                        """UPDATE core.online_cotizacion_selecciones
                           SET opcion_id = %s, opcion_snapshot = %s::jsonb, selected_at = NOW()
                           WHERE seleccion_id = %s RETURNING seleccion_id""",
                        (option["opcion_id"], _canonical(option_snapshot), existing["seleccion_id"]),
                    )
                else:
                    cur.execute(
                        """INSERT INTO core.online_cotizacion_selecciones (solicitud_id, opcion_id, opcion_snapshot)
                           VALUES (%s, %s, %s::jsonb) RETURNING seleccion_id""",
                        (request["solicitud_id"], option["opcion_id"], _canonical(option_snapshot)),
                    )
                selection_id = int(cur.fetchone()["seleccion_id"])
                previous_status = request["estado"]
                cur.execute("UPDATE core.online_solicitudes_cotizacion_envio SET estado = 'seleccionada', selected_at = NOW(), updated_at = NOW() WHERE solicitud_id = %s RETURNING *", (request["solicitud_id"],))
                request = cur.fetchone()
                self._event(
                    cur,
                    request_id=request["solicitud_id"],
                    option_id=option["opcion_id"],
                    event_type="option_reselected" if existing else "option_selected",
                    actor_type=owner.db_type,
                    owner_hash=owner.owner_hash,
                    before=previous_status,
                    after="seleccionada",
                )
                result = self._create_preview(cur, request, selection_id, option)
                self._idempotency_finish(cur, idempotency_id, result, selection_id)
            conn.commit()
            return result

    def _create_preview(self, cur, request: dict[str, Any], selection_id: int, option: dict[str, Any]) -> dict[str, Any]:
        cart, items = self._cart(cur, CommerceOwner("guest" if request["propietario_tipo"] == "invitado" else "customer", request["propietario_ref_hash"]))
        current_snapshot, fingerprint = self._cart_snapshot(cart, items)
        if fingerprint != request["carrito_fingerprint"]:
            raise FulfillmentRuleError(409, "CART_CHANGED", "The cart changed. Create a new shipping request.")
        subtotal = sum(Decimal(item["precio"]) * int(item["cantidad"]) for item in items)
        shipping = Decimal(option["monto"])
        preview = {
            "label": "Checkout preview - not an order or invoice",
            "requestId": str(request["solicitud_public_id"]),
            "cart": current_snapshot,
            "fulfillment": self._option_payload(option),
            "subtotal": f"{subtotal:.2f}", "shipping": f"{shipping:.2f}",
            "total": f"{subtotal + shipping:.2f}", "currency": "MXN",
            "reservationCreated": False, "orderCreated": False,
        }
        cur.execute(
            """INSERT INTO core.online_checkout_previews (
                   solicitud_id, seleccion_id, propietario_tipo, propietario_ref_hash,
                   carrito_fingerprint, subtotal, envio, total, preview_snapshot, expira_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
               ON CONFLICT (solicitud_id) DO UPDATE
               SET seleccion_id = EXCLUDED.seleccion_id,
                   carrito_fingerprint = EXCLUDED.carrito_fingerprint,
                   subtotal = EXCLUDED.subtotal,
                   envio = EXCLUDED.envio,
                   total = EXCLUDED.total,
                   moneda = EXCLUDED.moneda,
                   preview_snapshot = EXCLUDED.preview_snapshot,
                   expira_at = EXCLUDED.expira_at,
                   updated_at = NOW()
               RETURNING preview_public_id, created_at, expira_at""",
            (request["solicitud_id"], selection_id, request["propietario_tipo"], request["propietario_ref_hash"], fingerprint, subtotal, shipping, subtotal + shipping, _canonical(preview), option["expira_at"]),
        )
        saved = cur.fetchone()
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "previewId": str(saved["preview_public_id"]), **preview, "createdAt": saved["created_at"], "expiresAt": saved["expira_at"]})

    def _preview_payload(self, cur, request: dict[str, Any]) -> dict[str, Any]:
        cur.execute("SELECT * FROM core.online_checkout_previews WHERE solicitud_id = %s", (request["solicitud_id"],))
        row = cur.fetchone()
        if not row:
            raise FulfillmentRuleError(404, "PREVIEW_NOT_FOUND", "Checkout preview was not found.")
        cur.execute(
            """
            SELECT option.*, branch.nombre AS branch_name
            FROM core.online_cotizacion_selecciones selection
            JOIN core.online_opciones_cotizacion_envio option
              ON option.opcion_id = selection.opcion_id
            JOIN core.sucursales branch ON branch.sucursal_id = option.sucursal_id
            WHERE selection.solicitud_id = %s
            """,
            (request["solicitud_id"],),
        )
        option = cur.fetchone()
        payload = dict(row["preview_snapshot"])
        if option:
            payload["fulfillment"] = self._option_payload(option)
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "previewId": str(row["preview_public_id"]), **payload, "createdAt": row["created_at"], "expiresAt": row["expira_at"]})

    def get_preview(self, owner: CommerceOwner, public_id: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT request.* FROM core.online_solicitudes_cotizacion_envio request
                       WHERE request.solicitud_public_id = %s AND request.propietario_tipo = %s
                         AND request.propietario_ref_hash = %s""",
                    (public_id, owner.db_type, owner.owner_hash),
                )
                request = cur.fetchone()
                if not request:
                    raise FulfillmentRuleError(404, "REQUEST_NOT_FOUND", "Shipping request was not found.")
                return self._preview_payload(cur, request)

    @staticmethod
    def _reservation_payload(cur, reservation: dict[str, Any]) -> dict[str, Any]:
        cur.execute(
            """
            SELECT reserva_linea_id, producto_id, sucursal_id, carrito_item_id,
                   configuracion_hash, sku_snapshot, nombre_snapshot, cantidad
            FROM core.online_reserva_lineas
            WHERE reserva_id = %s
            ORDER BY reserva_linea_id
            """,
            (reservation["reserva_id"],),
        )
        lines = [
            {
                "lineId": str(row["reserva_linea_id"]),
                "productId": str(row["producto_id"]),
                "branchId": str(row["sucursal_id"]),
                "cartItemId": str(row["carrito_item_id"]) if row["carrito_item_id"] else None,
                "configurationHash": row["configuracion_hash"],
                "sku": row["sku_snapshot"],
                "name": row["nombre_snapshot"],
                "quantity": int(row["cantidad"]),
            }
            for row in cur.fetchall()
        ]
        return _safe(
            {
                "schemaVersion": FULFILLMENT_SCHEMA_VERSION,
                "reservationId": str(reservation["reserva_public_id"]),
                "requestId": str(reservation["solicitud_public_id"]),
                "selectedOptionId": str(reservation["opcion_public_id"]),
                "branchId": str(reservation["sucursal_id"]),
                "branchName": reservation["branch_name"],
                "status": RESERVATION_STATUS_TO_API[reservation["estado"]],
                "createdAt": reservation["created_at"],
                "expiresAt": reservation["expires_at"],
                "releasedAt": reservation["released_at"],
                "lifetimeMinutes": int(reservation["lifetime_minutes"]),
                "lines": lines,
                "stockReserved": True,
                "orderCreated": False,
                "paymentCreated": False,
                "saleCreated": False,
                "shipmentCreated": False,
            }
        )

    @staticmethod
    def _reservation_query() -> str:
        return """
            SELECT reservation.*, request.solicitud_public_id,
                   option.opcion_public_id, branch.nombre AS branch_name,
                   config.vigencia_minutos AS lifetime_minutes
            FROM core.online_reservas reservation
            JOIN core.online_solicitudes_cotizacion_envio request
              ON request.solicitud_id = reservation.solicitud_id
            JOIN core.online_cotizacion_selecciones selection
              ON selection.seleccion_id = reservation.seleccion_id
            JOIN core.online_opciones_cotizacion_envio option
              ON option.opcion_id = selection.opcion_id
            JOIN core.sucursales branch
              ON branch.sucursal_id = reservation.sucursal_id
            CROSS JOIN core.online_reserva_configuracion config
            WHERE reservation.reserva_id = %s
        """

    def _release_reservation(self, cur, reservation: dict[str, Any], *, status: str, actor_type: str, owner_hash: str | None = None, staff: dict[str, Any] | None = None) -> None:
        cur.execute(
            """
            SELECT producto_id, sucursal_id, cantidad
            FROM core.online_reserva_lineas
            WHERE reserva_id = %s
            ORDER BY sucursal_id, producto_id, reserva_linea_id
            FOR UPDATE
            """,
            (reservation["reserva_id"],),
        )
        lines = list(cur.fetchall())
        for line in lines:
            cur.execute(
                """
                SELECT stock, stock_reservado
                FROM core.catalogo_inventario_sucursal
                WHERE producto_id = %s AND sucursal_id = %s
                FOR UPDATE
                """,
                (line["producto_id"], line["sucursal_id"]),
            )
            inventory = cur.fetchone()
            if not inventory or int(inventory["stock_reservado"]) < int(line["cantidad"]):
                raise FulfillmentRuleError(
                    409,
                    "RESERVATION_INVENTORY_CORRUPTION",
                    "The reservation cannot be released because reserved inventory is inconsistent.",
                )
            cur.execute(
                """
                UPDATE core.catalogo_inventario_sucursal
                SET stock_reservado = stock_reservado - %s,
                    version = version + 1,
                    updated_at = NOW()
                WHERE producto_id = %s AND sucursal_id = %s
                """,
                (line["cantidad"], line["producto_id"], line["sucursal_id"]),
            )
        cur.execute(
            """
            UPDATE core.online_reservas
            SET estado = %s, released_at = NOW(), updated_at = NOW()
            WHERE reserva_id = %s AND estado = 'activa'
            RETURNING reserva_id
            """,
            (status, reservation["reserva_id"]),
        )
        if cur.fetchone():
            cur.execute(
                """
                INSERT INTO core.online_reserva_eventos (
                    reserva_id, evento_tipo, actor_tipo, actor_ref_hash,
                    usuario_id, metadata
                ) VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    reservation["reserva_id"],
                    "reservation_expired" if status == "expirada" else "reservation_released",
                    actor_type,
                    owner_hash,
                    staff["usuario_id"] if staff else None,
                    _canonical({"branchId": str(reservation["sucursal_id"])}),
                ),
            )

    def _release_expired_reservations(self, cur, *, limit: int = 100) -> int:
        cur.execute(
            """
            SELECT reserva_id
            FROM core.online_reservas
            WHERE estado = 'activa' AND expires_at <= clock_timestamp()
            ORDER BY expires_at, reserva_id
            LIMIT %s
            FOR UPDATE SKIP LOCKED
            """,
            (max(1, min(limit, 1000)),),
        )
        reservation_ids = [int(row["reserva_id"]) for row in cur.fetchall()]
        released = 0
        for reservation_id in reservation_ids:
            cur.execute(self._reservation_query() + " FOR UPDATE", (reservation_id,))
            reservation = cur.fetchone()
            if reservation and reservation["estado"] == "activa" and reservation["expires_at"] <= datetime.now(timezone.utc):
                self._release_reservation(cur, reservation, status="expirada", actor_type="sistema")
                released += 1
        return released

    def create_reservation(self, owner: CommerceOwner, public_id: str, key: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                idempotency_id, cached = self._idempotency_begin(
                    cur, owner, "fulfillment_reservation_create", key, {"requestId": public_id}
                )
                if cached is not None:
                    conn.commit()
                    return cached
                self._release_expired_reservations(cur)
                cur.execute(
                    """
                    SELECT *
                    FROM core.online_solicitudes_cotizacion_envio
                    WHERE solicitud_public_id = %s
                      AND propietario_tipo = %s
                      AND propietario_ref_hash = %s
                    FOR UPDATE
                    """,
                    (public_id, owner.db_type, owner.owner_hash),
                )
                request = cur.fetchone()
                if not request:
                    raise FulfillmentRuleError(404, "REQUEST_NOT_FOUND", "Shipping request was not found.")
                if request["estado"] != "seleccionada" or request["expira_at"] <= datetime.now(timezone.utc):
                    raise FulfillmentRuleError(409, "REQUEST_NOT_RESERVABLE", "Select a valid checkout option before reserving inventory.")
                cur.execute(
                    """
                    SELECT reservation.reserva_id
                    FROM core.online_reservas reservation
                    WHERE reservation.solicitud_id = %s AND reservation.estado = 'activa'
                    FOR UPDATE
                    """,
                    (request["solicitud_id"],),
                )
                existing_id = cur.fetchone()
                if existing_id:
                    cur.execute(self._reservation_query(), (existing_id["reserva_id"],))
                    result = self._reservation_payload(cur, cur.fetchone())
                    self._idempotency_finish(cur, idempotency_id, result, int(existing_id["reserva_id"]))
                    conn.commit()
                    return result
                cur.execute(
                    """
                    SELECT selection.seleccion_id, option.*, branch.nombre AS branch_name
                    FROM core.online_cotizacion_selecciones selection
                    JOIN core.online_opciones_cotizacion_envio option
                      ON option.opcion_id = selection.opcion_id
                    JOIN core.sucursales branch ON branch.sucursal_id = option.sucursal_id
                    WHERE selection.solicitud_id = %s
                      AND option.activa = TRUE
                      AND option.expira_at > NOW()
                    FOR UPDATE OF selection, option
                    """,
                    (request["solicitud_id"],),
                )
                option = cur.fetchone()
                if not option:
                    raise FulfillmentRuleError(409, "QUOTE_EXPIRED_OR_INVALID", "The selected checkout option is no longer valid.")
                cur.execute(
                    """
                    SELECT 1 FROM core.online_checkout_previews
                    WHERE solicitud_id = %s AND expira_at > NOW()
                    """,
                    (request["solicitud_id"],),
                )
                if not cur.fetchone():
                    raise FulfillmentRuleError(409, "PREVIEW_EXPIRED", "The checkout preview has expired. Recalculate shipping options.")
                cart, items = self._cart(cur, owner)
                snapshot, fingerprint = self._cart_snapshot(cart, items)
                if fingerprint != request["carrito_fingerprint"]:
                    raise FulfillmentRuleError(409, "CART_CHANGED", "The cart changed. Create a new shipping request.")
                cur.execute(
                    "SELECT activa, vigencia_minutos FROM core.online_reserva_configuracion WHERE configuracion_id = 1"
                )
                config = cur.fetchone()
                if not config or not config["activa"]:
                    raise FulfillmentRuleError(503, "PHASE_1FB2_DISABLED", "Inventory reservations are disabled.")
                now = datetime.now(timezone.utc)
                expires_at = min(
                    now.timestamp() + int(config["vigencia_minutos"]) * 60,
                    request["expira_at"].timestamp(),
                    option["expira_at"].timestamp(),
                )
                expires = datetime.fromtimestamp(expires_at, tz=timezone.utc)
                if expires <= now:
                    raise FulfillmentRuleError(409, "RESERVATION_WINDOW_EXPIRED", "The reservation window has expired.")
                controlled = [item for item in items if item["controla_stock"]]
                inventory_rows: list[tuple[dict[str, Any], dict[str, Any]]] = []
                for item in sorted(controlled, key=lambda value: (int(option["sucursal_id"]), int(value["producto_id"]), int(value["carrito_item_id"]))):
                    cur.execute(
                        """
                        SELECT stock, stock_reservado, disponible_venta
                        FROM core.catalogo_inventario_sucursal
                        WHERE producto_id = %s AND sucursal_id = %s
                        FOR UPDATE
                        """,
                        (item["producto_id"], option["sucursal_id"]),
                    )
                    inventory = cur.fetchone()
                    available = int(inventory["stock"] - inventory["stock_reservado"]) if inventory and inventory["disponible_venta"] else 0
                    if not inventory or not inventory["disponible_venta"] or available < int(item["cantidad"]):
                        raise FulfillmentRuleError(409, "INSUFFICIENT_AVAILABLE_STOCK", "The selected branch cannot reserve the complete cart.", {"productId": str(item["producto_id"]), "available": available})
                    inventory_rows.append((item, inventory))
                cur.execute(
                    """
                    INSERT INTO core.online_reservas (
                        solicitud_id, seleccion_id, propietario_tipo, propietario_ref_hash,
                        carrito_fingerprint, sucursal_id, expires_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING reserva_id
                    """,
                    (request["solicitud_id"], option["seleccion_id"], request["propietario_tipo"], request["propietario_ref_hash"], fingerprint, option["sucursal_id"], expires),
                )
                reservation_id = int(cur.fetchone()["reserva_id"])
                for item, _inventory in inventory_rows:
                    cur.execute(
                        """
                        INSERT INTO core.online_reserva_lineas (
                            reserva_id, producto_id, sucursal_id, carrito_item_id,
                            configuracion_hash, sku_snapshot, nombre_snapshot, cantidad
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (reservation_id, item["producto_id"], option["sucursal_id"], item["carrito_item_id"], item["configuracion_hash"], item["sku"], item["nombre"], item["cantidad"]),
                    )
                    cur.execute(
                        """
                        UPDATE core.catalogo_inventario_sucursal
                        SET stock_reservado = stock_reservado + %s,
                            version = version + 1,
                            updated_at = NOW()
                        WHERE producto_id = %s AND sucursal_id = %s
                        """,
                        (item["cantidad"], item["producto_id"], option["sucursal_id"]),
                    )
                cur.execute(
                    """
                    INSERT INTO core.online_reserva_eventos (reserva_id, evento_tipo, actor_tipo, actor_ref_hash, metadata)
                    VALUES (%s, 'reservation_created', %s, %s, %s::jsonb)
                    """,
                    (reservation_id, owner.db_type, owner.owner_hash, _canonical({"requestId": public_id, "lineCount": len(inventory_rows)})),
                )
                cur.execute(self._reservation_query(), (reservation_id,))
                result = self._reservation_payload(cur, cur.fetchone())
                self._idempotency_finish(cur, idempotency_id, result, reservation_id)
            conn.commit()
            return result

    def get_reservation(self, owner: CommerceOwner, public_id: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                self._release_expired_reservations(cur)
                cur.execute(
                    self._reservation_query().replace("WHERE reservation.reserva_id = %s", "WHERE request.solicitud_public_id = %s AND request.propietario_tipo = %s AND request.propietario_ref_hash = %s ORDER BY reservation.created_at DESC LIMIT 1"),
                    (public_id, owner.db_type, owner.owner_hash),
                )
                reservation = cur.fetchone()
                if not reservation:
                    raise FulfillmentRuleError(404, "RESERVATION_NOT_FOUND", "No reservation exists for this checkout request.")
                result = self._reservation_payload(cur, reservation)
            conn.commit()
            return result

    def release_reservation(self, owner: CommerceOwner, public_id: str, key: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                idempotency_id, cached = self._idempotency_begin(
                    cur, owner, "fulfillment_reservation_release", key, {"requestId": public_id}
                )
                if cached is not None:
                    conn.commit()
                    return cached
                self._release_expired_reservations(cur)
                cur.execute(
                    self._reservation_query().replace("WHERE reservation.reserva_id = %s", "WHERE request.solicitud_public_id = %s AND request.propietario_tipo = %s AND request.propietario_ref_hash = %s ORDER BY reservation.created_at DESC LIMIT 1 FOR UPDATE"),
                    (public_id, owner.db_type, owner.owner_hash),
                )
                reservation = cur.fetchone()
                if not reservation:
                    raise FulfillmentRuleError(404, "RESERVATION_NOT_FOUND", "No reservation exists for this checkout request.")
                if reservation["estado"] == "activa":
                    self._release_reservation(cur, reservation, status="liberada", actor_type=owner.db_type, owner_hash=owner.owner_hash)
                    cur.execute(self._reservation_query(), (reservation["reserva_id"],))
                    reservation = cur.fetchone()
                result = self._reservation_payload(cur, reservation)
                self._idempotency_finish(cur, idempotency_id, result, int(reservation["reserva_id"]))
            conn.commit()
            return result

    @staticmethod
    def _order_payload(cur, order: dict[str, Any]) -> dict[str, Any]:
        cur.execute(
            """
            SELECT orden_linea_id, producto_id, sucursal_id, carrito_item_id,
                   configuracion_hash, sku_snapshot, nombre_snapshot,
                   cantidad, precio_unitario, importe_linea
            FROM core.online_orden_lineas
            WHERE orden_id = %s
            ORDER BY orden_linea_id
            """,
            (order["orden_id"],),
        )
        lines = [
            {
                "lineId": str(row["orden_linea_id"]),
                "productId": str(row["producto_id"]),
                "branchId": str(row["sucursal_id"]),
                "cartItemId": str(row["carrito_item_id"]) if row["carrito_item_id"] else None,
                "configurationHash": row["configuracion_hash"],
                "sku": row["sku_snapshot"],
                "name": row["nombre_snapshot"],
                "quantity": int(row["cantidad"]),
                "unitPrice": f"{Decimal(row['precio_unitario']):.2f}",
                "lineTotal": f"{Decimal(row['importe_linea']):.2f}",
            }
            for row in cur.fetchall()
        ]
        return _safe(
            {
                "schemaVersion": FULFILLMENT_SCHEMA_VERSION,
                "orderId": str(order["orden_public_id"]),
                "requestId": str(order["solicitud_public_id"]),
                "reservationId": str(order["reserva_public_id"]),
                "status": ORDER_STATUS_TO_API[order["estado"]],
                "fulfillmentMethod": "shipping" if order["metodo_entrega"] == "envio" else "pickup",
                "branchId": str(order["sucursal_id"]),
                "branch": order["sucursal_snapshot"],
                "contact": order["contacto_snapshot"],
                "address": order["direccion_snapshot"],
                "shippingQuote": order["cotizacion_snapshot"],
                "lines": lines,
                "subtotal": f"{Decimal(order['subtotal']):.2f}",
                "shipping": f"{Decimal(order['envio']):.2f}",
                "total": f"{Decimal(order['total']):.2f}",
                "currency": str(order["moneda"]).strip(),
                "createdAt": order["created_at"],
                "updatedAt": order["updated_at"],
                "paymentCreated": False,
                "saleCreated": False,
                "shipmentCreated": False,
                "inventoryDeducted": False,
            }
        )

    @staticmethod
    def _order_query() -> str:
        return """
            SELECT order_row.*, request.solicitud_public_id,
                   reservation.reserva_public_id
            FROM core.online_ordenes order_row
            JOIN core.online_solicitudes_cotizacion_envio request
              ON request.solicitud_id = order_row.solicitud_id
            JOIN core.online_reservas reservation
              ON reservation.reserva_id = order_row.reserva_id
            WHERE order_row.orden_id = %s
        """

    def create_order(self, owner: CommerceOwner, public_id: str, key: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                idempotency_id, cached = self._idempotency_begin(
                    cur, owner, "fulfillment_order_create", key, {"requestId": public_id}
                )
                if cached is not None:
                    conn.commit()
                    return cached
                self._release_expired_reservations(cur)
                cur.execute(
                    """
                    SELECT *
                    FROM core.online_solicitudes_cotizacion_envio
                    WHERE solicitud_public_id = %s
                      AND propietario_tipo = %s
                      AND propietario_ref_hash = %s
                    FOR UPDATE
                    """,
                    (public_id, owner.db_type, owner.owner_hash),
                )
                request = cur.fetchone()
                if not request:
                    raise FulfillmentRuleError(404, "REQUEST_NOT_FOUND", "Shipping request was not found.")
                if request["estado"] != "seleccionada":
                    raise FulfillmentRuleError(409, "REQUEST_NOT_ORDERABLE", "Select a valid checkout option before creating an order.")

                cur.execute(
                    """
                    SELECT reservation.*, request.solicitud_public_id,
                           option.opcion_public_id, option.activa AS option_active,
                           option.expira_at AS option_expires_at,
                           option.monto AS option_amount,
                           option.moneda, option.transportista_codigo_snapshot,
                           option.transportista_nombre_snapshot,
                           option.nivel_servicio_snapshot, option.quote_identifier,
                           branch.nombre AS branch_name
                    FROM core.online_reservas reservation
                    JOIN core.online_cotizacion_selecciones selection
                      ON selection.seleccion_id = reservation.seleccion_id
                    JOIN core.online_opciones_cotizacion_envio option
                      ON option.opcion_id = selection.opcion_id
                    JOIN core.sucursales branch
                      ON branch.sucursal_id = reservation.sucursal_id
                    JOIN core.online_solicitudes_cotizacion_envio request
                      ON request.solicitud_id = reservation.solicitud_id
                    WHERE reservation.solicitud_id = %s
                      AND reservation.propietario_tipo = %s
                      AND reservation.propietario_ref_hash = %s
                    FOR UPDATE OF reservation, selection, option
                    """,
                    (request["solicitud_id"], owner.db_type, owner.owner_hash),
                )
                reservation = cur.fetchone()
                if not reservation:
                    raise FulfillmentRuleError(409, "RESERVATION_REQUIRED", "An active inventory reservation is required before creating an order.")
                if reservation["estado"] != "activa" or reservation["expires_at"] <= datetime.now(timezone.utc):
                    raise FulfillmentRuleError(409, "RESERVATION_EXPIRED", "The inventory reservation has expired. Reserve the cart again.")
                if not reservation["option_active"] or reservation["option_expires_at"] <= datetime.now(timezone.utc):
                    raise FulfillmentRuleError(409, "QUOTE_EXPIRED_OR_INVALID", "The selected checkout option is no longer valid.")

                cur.execute(
                    """
                    SELECT preview.*, selection.opcion_id
                    FROM core.online_checkout_previews preview
                    JOIN core.online_cotizacion_selecciones selection
                      ON selection.seleccion_id = preview.seleccion_id
                    WHERE preview.solicitud_id = %s
                    FOR UPDATE OF preview
                    """,
                    (request["solicitud_id"],),
                )
                preview = cur.fetchone()
                if not preview or preview["expira_at"] <= datetime.now(timezone.utc):
                    raise FulfillmentRuleError(409, "PREVIEW_EXPIRED", "The checkout preview has expired. Recalculate it before creating an order.")
                if preview["seleccion_id"] != reservation["seleccion_id"] or preview["carrito_fingerprint"] != reservation["carrito_fingerprint"]:
                    raise FulfillmentRuleError(409, "CHECKOUT_SNAPSHOT_MISMATCH", "The reservation and checkout preview no longer match.")

                cart_snapshot = request["carrito_snapshot"]
                cur.execute(
                    """
                    SELECT producto_id, sucursal_id, SUM(cantidad)::int AS quantity
                    FROM core.online_reserva_lineas
                    WHERE reserva_id = %s
                    GROUP BY producto_id, sucursal_id
                    ORDER BY sucursal_id, producto_id
                    """,
                    (reservation["reserva_id"],),
                )
                reserved_lines = list(cur.fetchall())
                for line in reserved_lines:
                    cur.execute(
                        """
                        SELECT stock, stock_reservado
                        FROM core.catalogo_inventario_sucursal
                        WHERE producto_id = %s AND sucursal_id = %s
                        FOR UPDATE
                        """,
                        (line["producto_id"], line["sucursal_id"]),
                    )
                    inventory = cur.fetchone()
                    if not inventory:
                        raise FulfillmentRuleError(409, "RESERVATION_INVENTORY_MISMATCH", "Reserved inventory no longer exists.")
                    cur.execute("SELECT to_regclass('core.online_inventario_reservas_activas') AS relation")
                    if cur.fetchone()["relation"] is not None:
                        cur.execute(
                            """
                            SELECT COALESCE(SUM(cantidad), 0)::int AS quantity
                            FROM core.online_inventario_reservas_activas
                            WHERE producto_id = %s AND sucursal_id = %s
                            """,
                            (line["producto_id"], line["sucursal_id"]),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT COALESCE(SUM(lines.cantidad), 0)::int AS quantity
                            FROM core.online_reserva_lineas lines
                            JOIN core.online_reservas reservations
                              ON reservations.reserva_id = lines.reserva_id
                            WHERE reservations.estado = 'activa'
                              AND lines.producto_id = %s AND lines.sucursal_id = %s
                            """,
                            (line["producto_id"], line["sucursal_id"]),
                        )
                    aggregate = int(cur.fetchone()["quantity"])
                    if int(inventory["stock_reservado"]) != aggregate or aggregate < int(line["quantity"]):
                        raise FulfillmentRuleError(409, "RESERVATION_INVENTORY_MISMATCH", "Reserved inventory no longer matches the reservation lines.")

                cur.execute(
                    """
                    SELECT order_row.*
                    FROM core.online_ordenes order_row
                    WHERE order_row.reserva_id = %s
                    FOR UPDATE
                    """,
                    (reservation["reserva_id"],),
                )
                existing = cur.fetchone()
                if existing:
                    cur.execute(self._order_query(), (existing["orden_id"],))
                    result = self._order_payload(cur, cur.fetchone())
                    self._idempotency_finish(cur, idempotency_id, result, int(existing["orden_id"]))
                    conn.commit()
                    return result

                cur.execute("SELECT sucursal_id, nombre, ciudad, estado, cp, pais FROM core.sucursales WHERE sucursal_id = %s", (reservation["sucursal_id"],))
                branch = cur.fetchone()
                if not branch:
                    raise FulfillmentRuleError(409, "BRANCH_NOT_FOUND", "The fulfillment branch is no longer available.")
                selected_option = dict(reservation)
                quote_snapshot = None if request["metodo_entrega"] == "recoger_sucursal" else _safe({
                    "optionId": str(reservation["opcion_public_id"]),
                    "carrierName": reservation["transportista_nombre_snapshot"],
                    "carrierCode": reservation["transportista_codigo_snapshot"],
                    "serviceLevel": reservation["nivel_servicio_snapshot"],
                    "amount": f"{Decimal(reservation['option_amount']):.2f}",
                    "currency": str(reservation["moneda"]).strip(),
                    "quoteIdentifier": reservation["quote_identifier"],
                    "expiresAt": reservation["option_expires_at"],
                })
                subtotal = sum(Decimal(item["unitPrice"]) * int(item["quantity"]) for item in cart_snapshot["items"])
                shipping = Decimal("0") if quote_snapshot is None else Decimal(reservation["option_amount"])
                total = subtotal + shipping
                cur.execute(
                    """
                    INSERT INTO core.online_ordenes (
                        reserva_id, solicitud_id, preview_id, propietario_tipo, propietario_ref_hash,
                        metodo_entrega, sucursal_id, sucursal_snapshot, contacto_snapshot,
                        direccion_snapshot, cotizacion_snapshot, carrito_fingerprint,
                        subtotal, envio, total
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s, %s)
                    RETURNING orden_id
                    """,
                    (
                        reservation["reserva_id"], request["solicitud_id"], preview["preview_id"],
                        owner.db_type, owner.owner_hash, request["metodo_entrega"],
                        reservation["sucursal_id"], _canonical(_safe(dict(branch))),
                        _canonical(request["contacto_snapshot"]),
                        _canonical(request["direccion_snapshot"]) if request["direccion_snapshot"] is not None else None,
                        _canonical(quote_snapshot) if quote_snapshot is not None else None,
                        reservation["carrito_fingerprint"], subtotal, shipping, total,
                    ),
                )
                order_id = int(cur.fetchone()["orden_id"])
                for item in cart_snapshot["items"]:
                    unit_price = Decimal(item["unitPrice"])
                    quantity = int(item["quantity"])
                    cur.execute(
                        """
                        INSERT INTO core.online_orden_lineas (
                            orden_id, producto_id, sucursal_id, carrito_item_id,
                            configuracion_hash, sku_snapshot, nombre_snapshot,
                            cantidad, precio_unitario, importe_linea
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            order_id, int(item["productId"]), reservation["sucursal_id"], int(item["itemId"]),
                            item["configurationHash"], item["sku"], item["name"],
                            quantity, unit_price, unit_price * quantity,
                        ),
                    )
                cur.execute(
                    """
                    INSERT INTO core.online_orden_eventos (
                        orden_id, evento_tipo, actor_tipo, actor_ref_hash, metadata
                    ) VALUES (%s, 'order_created', %s, %s, %s::jsonb)
                    ON CONFLICT (orden_id, evento_tipo) WHERE evento_tipo = 'order_created' DO NOTHING
                    """,
                    (order_id, owner.db_type, owner.owner_hash, _canonical({"status": "pendiente_pago", "inventoryDeducted": False})),
                )
                cur.execute(self._order_query(), (order_id,))
                result = self._order_payload(cur, cur.fetchone())
                self._idempotency_finish(cur, idempotency_id, result, order_id)
            conn.commit()
            return result

    def get_order(self, owner: CommerceOwner, public_id: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    self._order_query().replace(
                        "WHERE order_row.orden_id = %s",
                        "WHERE request.solicitud_public_id = %s AND order_row.propietario_tipo = %s AND order_row.propietario_ref_hash = %s",
                    ),
                    (public_id, owner.db_type, owner.owner_hash),
                )
                order = cur.fetchone()
                if not order:
                    raise FulfillmentRuleError(404, "ORDER_NOT_FOUND", "Online order was not found.")
                result = self._order_payload(cur, order)
            conn.commit()
            return result

    def create_payment_session(self, owner: CommerceOwner, request_id: str, key: str) -> dict[str, Any]:
        return PaymentSessionRepositoryMixin.create_payment_session(self, owner, request_id, key)

    def get_payment_session(self, owner: CommerceOwner, request_id: str) -> dict[str, Any]:
        return PaymentSessionRepositoryMixin.get_payment_session(self, owner, request_id)

    @staticmethod
    def _payment_session_query() -> str:
        return PaymentSessionRepositoryMixin._payment_session_query()

    @staticmethod
    def _payment_payload(cur, session: dict[str, Any]) -> dict[str, Any]:
        return PaymentSessionRepositoryMixin._payment_payload(cur, session)


class PaymentSessionRepositoryMixin:
    """Provider-neutral payment-session persistence; it never contacts a provider."""

    @staticmethod
    def _payment_payload(cur, session: dict[str, Any]) -> dict[str, Any]:
        cur.execute(
            """
            SELECT intento_id, numero_intento, estado, proveedor_intento_ref,
                   codigo_error, mensaje_error, created_at, updated_at
            FROM core.online_pago_intentos
            WHERE sesion_id = %s
            ORDER BY numero_intento
            """,
            (session["sesion_id"],),
        )
        attempts = [
            {
                "attemptId": str(row["intento_id"]),
                "number": int(row["numero_intento"]),
                "status": PAYMENT_STATUS_TO_API[row["estado"]],
                "providerAttemptRef": row["proveedor_intento_ref"],
                "errorCode": row["codigo_error"],
                "errorMessage": row["mensaje_error"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
            for row in cur.fetchall()
        ]
        return _safe(
            {
                "schemaVersion": FULFILLMENT_SCHEMA_VERSION,
                "paymentSessionId": str(session["sesion_public_id"]),
                "orderId": str(session["orden_public_id"]),
                "requestId": str(session["solicitud_public_id"]),
                "provider": session["proveedor"],
                "status": PAYMENT_STATUS_TO_API[session["estado"]],
                "amount": f"{Decimal(session['monto']):.2f}",
                "currency": str(session["moneda"]).strip(),
                "providerSessionRef": session["proveedor_sesion_ref"],
                "checkoutUrl": session["checkout_url"],
                "expiresAt": session["expira_at"],
                "createdAt": session["created_at"],
                "updatedAt": session["updated_at"],
                "attempts": attempts,
                "paymentCreated": False,
                "chargeCreated": False,
                "orderMarkedPaid": False,
            }
        )

    @staticmethod
    def _payment_session_query() -> str:
        return """
            SELECT payment.*, order_row.orden_public_id,
                   request.solicitud_public_id
            FROM core.online_pago_sesiones payment
            JOIN core.online_ordenes order_row
              ON order_row.orden_id = payment.orden_id
            JOIN core.online_solicitudes_cotizacion_envio request
              ON request.solicitud_id = order_row.solicitud_id
        """

    def create_payment_session(self, owner: CommerceOwner, request_id: str, key: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                idempotency_id, cached = self._idempotency_begin(
                    cur, owner, "fulfillment_payment_session_create", key, {"requestId": request_id}
                )
                if cached is not None:
                    conn.commit()
                    return cached
                cur.execute(
                    """
                    SELECT order_row.*, request.solicitud_public_id
                    FROM core.online_ordenes order_row
                    JOIN core.online_solicitudes_cotizacion_envio request
                      ON request.solicitud_id = order_row.solicitud_id
                    WHERE request.solicitud_public_id = %s
                      AND order_row.propietario_tipo = %s
                      AND order_row.propietario_ref_hash = %s
                      AND order_row.estado = 'pendiente_pago'
                    FOR UPDATE OF order_row
                    """,
                    (request_id, owner.db_type, owner.owner_hash),
                )
                order = cur.fetchone()
                if not order:
                    raise FulfillmentRuleError(404, "PENDING_ORDER_NOT_FOUND", "A pending-payment order was not found.")
                cur.execute(
                    self._payment_session_query()
                    + " WHERE payment.orden_id = %s AND payment.proveedor = 'conekta' FOR UPDATE",
                    (order["orden_id"],),
                )
                session = cur.fetchone()
                if not session:
                    cur.execute(
                        """
                        INSERT INTO core.online_pago_sesiones
                            (orden_id, proveedor, estado, monto, moneda, expira_at)
                        VALUES (%s, 'conekta', 'pendiente', %s, %s, NOW() + INTERVAL '30 minutes')
                        RETURNING sesion_id
                        """,
                        (order["orden_id"], order["total"], order["moneda"]),
                    )
                    session_id = int(cur.fetchone()["sesion_id"])
                    cur.execute(
                        """
                        INSERT INTO core.online_pago_intentos (sesion_id, numero_intento, estado)
                        VALUES (%s, 1, 'pendiente')
                        """,
                        (session_id,),
                    )
                    cur.execute(
                        """
                        INSERT INTO core.online_pago_eventos (sesion_id, evento_tipo, actor_tipo, metadata)
                        VALUES (%s, 'payment_session_created', %s, %s::jsonb)
                        """,
                        (session_id, owner.db_type, _canonical({"provider": "conekta", "simulation": True})),
                    )
                    cur.execute(self._payment_session_query() + " WHERE payment.sesion_id = %s", (session_id,))
                    session = cur.fetchone()
                result = self._payment_payload(cur, session)
                self._idempotency_finish(cur, idempotency_id, result, int(session["sesion_id"]))
            conn.commit()
            return result

    def list_payment_sessions(self, user: dict[str, Any], status: str | None = None) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user)
                query = self._payment_session_query()
                params: tuple[Any, ...] = ()
                if status:
                    query += " WHERE payment.estado = %s"
                    params = (status,)
                query += " ORDER BY payment.created_at DESC LIMIT 500"
                cur.execute(query, params)
                sessions = [self._payment_payload(cur, row) for row in cur.fetchall()]
            conn.commit()
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "paymentSessions": sessions, "viewer": staff})

    def list_payment_sessions_for_order(self, user: dict[str, Any], order_id: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user)
                cur.execute(
                    self._payment_session_query() + " WHERE order_row.orden_public_id = %s ORDER BY payment.created_at DESC",
                    (order_id,),
                )
                sessions = [self._payment_payload(cur, row) for row in cur.fetchall()]
            conn.commit()
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "paymentSessions": sessions, "viewer": staff})

    def get_payment_session_admin(self, user: dict[str, Any], session_id: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user)
                cur.execute(self._payment_session_query() + " WHERE payment.sesion_public_id = %s", (session_id,))
                session = cur.fetchone()
                if not session:
                    raise FulfillmentRuleError(404, "PAYMENT_SESSION_NOT_FOUND", "Payment session was not found.")
                result = self._payment_payload(cur, session)
            conn.commit()
        return _safe({**result, "viewer": staff})

    def get_payment_session(self, owner: CommerceOwner, request_id: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    self._payment_session_query()
                    + """
                    WHERE request.solicitud_public_id = %s
                      AND order_row.propietario_tipo = %s
                      AND order_row.propietario_ref_hash = %s
                    ORDER BY payment.created_at DESC LIMIT 1
                    """,
                    (request_id, owner.db_type, owner.owner_hash),
                )
                session = cur.fetchone()
                if not session:
                    raise FulfillmentRuleError(404, "PAYMENT_SESSION_NOT_FOUND", "No payment session exists for this order.")
                result = self._payment_payload(cur, session)
            conn.commit()
            return result


class FulfillmentAdminRepository(PaymentSessionRepositoryMixin):
    def __init__(self, config: FulfillmentConfig, connect: Callable[..., Any] = psycopg.connect):
        self.config = config
        self._connect = connect
        self._customer = FulfillmentRepository(config, connect)

    def _connection(self):
        return self._connect(self.config.db_conninfo, row_factory=dict_row)

    @staticmethod
    def _staff(cur, user: dict[str, Any], admin_only: bool = False) -> dict[str, Any]:
        allowed = {"admin"} if admin_only else {"admin", "recepcion"}
        if user.get("rol") not in allowed:
            raise FulfillmentRuleError(403, "FORBIDDEN", "You do not have access to online shipping administration.")
        cur.execute("SELECT usuario_id, username, rol FROM core.usuarios WHERE username = %s AND activo = TRUE", (user.get("username"),))
        staff = cur.fetchone()
        if not staff:
            raise FulfillmentRuleError(401, "STAFF_NOT_FOUND", "The staff account is not active.")
        return dict(staff)

    def list_requests(self, user: dict[str, Any], status: str | None = None) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user)
                self._customer._expire(cur)
                status_filter = STATUS_FROM_API.get(status, status) if status else None
                query = """SELECT request.*, cart.item_count FROM core.online_solicitudes_cotizacion_envio request
                           LEFT JOIN LATERAL (
                               SELECT COALESCE(SUM((item->>'quantity')::int), 0) AS item_count
                               FROM jsonb_array_elements(request.carrito_snapshot->'items') item
                           ) cart ON TRUE"""
                parameters: tuple[Any, ...] = ()
                if status_filter:
                    query += " WHERE request.estado = %s"
                    parameters = (status_filter,)
                query += " ORDER BY request.created_at DESC"
                cur.execute(query, parameters)
                requests = [
                    {"requestId": str(row["solicitud_public_id"]), "method": "shipping" if row["metodo_entrega"] == "envio" else "pickup", "status": STATUS_TO_API[row["estado"]], "contact": row["contacto_snapshot"], "itemCount": int(row["item_count"]), "expiresAt": row["expira_at"], "createdAt": row["created_at"]}
                    for row in cur.fetchall()
                ]
            conn.commit()
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "requests": requests, "viewer": staff})

    def get_request(self, user: dict[str, Any], public_id: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                self._staff(cur, user)
                self._customer._expire(cur)
                cur.execute("SELECT * FROM core.online_solicitudes_cotizacion_envio WHERE solicitud_public_id = %s", (public_id,))
                request = cur.fetchone()
                if not request:
                    raise FulfillmentRuleError(404, "REQUEST_NOT_FOUND", "Shipping request was not found.")
                payload = self._customer._request_payload(cur, request)
                cur.execute("SELECT sucursal_id, sucursal_snapshot, disponibilidad_snapshot, elegible, motivo_invalidez FROM core.online_solicitud_sucursales_elegibles WHERE solicitud_id = %s ORDER BY sucursal_id", (request["solicitud_id"],))
                payload["eligibleBranches"] = _safe(list(cur.fetchall()))
            conn.commit()
        return payload

    def list_reservations(self, user: dict[str, Any], status: str | None = None) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user)
                self._customer._release_expired_reservations(cur)
                params: tuple[Any, ...] = ()
                query = """
                    SELECT reservation.*, request.solicitud_public_id,
                           option.opcion_public_id, branch.nombre AS branch_name,
                           config.vigencia_minutos AS lifetime_minutes
                    FROM core.online_reservas reservation
                    JOIN core.online_solicitudes_cotizacion_envio request
                      ON request.solicitud_id = reservation.solicitud_id
                    JOIN core.online_cotizacion_selecciones selection
                      ON selection.seleccion_id = reservation.seleccion_id
                    JOIN core.online_opciones_cotizacion_envio option
                      ON option.opcion_id = selection.opcion_id
                    JOIN core.sucursales branch ON branch.sucursal_id = reservation.sucursal_id
                    CROSS JOIN core.online_reserva_configuracion config
                """
                if status:
                    query += " WHERE reservation.estado = %s"
                    params = (status,)
                query += " ORDER BY reservation.created_at DESC LIMIT 500"
                cur.execute(query, params)
                reservations = []
                for row in cur.fetchall():
                    payload = self._customer._reservation_payload(cur, row)
                    payload["ownerType"] = row["propietario_tipo"]
                    payload["lineCount"] = len(payload["lines"])
                    payload["quantity"] = sum(line["quantity"] for line in payload["lines"])
                    reservations.append(payload)
            conn.commit()
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "reservations": reservations, "viewer": staff})

    def release_expired_reservations(self, user: dict[str, Any]) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user, admin_only=True)
                normal_released = self._customer._release_expired_reservations(cur, limit=1000)
                optical_released = release_expired_optical_reservations(cur, limit=1000)
                released = normal_released + optical_released
            conn.commit()
        return _safe({
            "schemaVersion": FULFILLMENT_SCHEMA_VERSION,
            "releasedCount": released,
            "normalReservationsReleased": normal_released,
            "opticalDraftReservationsReleased": optical_released,
            "viewer": staff,
        })

    def list_orders(self, user: dict[str, Any], status: str | None = None) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user)
                query = """
                    SELECT order_row.*, request.solicitud_public_id,
                           reservation.reserva_public_id
                    FROM core.online_ordenes order_row
                    JOIN core.online_solicitudes_cotizacion_envio request
                      ON request.solicitud_id = order_row.solicitud_id
                    JOIN core.online_reservas reservation
                      ON reservation.reserva_id = order_row.reserva_id
                """
                params: tuple[Any, ...] = ()
                if status:
                    query += " WHERE order_row.estado = %s"
                    params = (status,)
                query += " ORDER BY order_row.created_at DESC LIMIT 500"
                cur.execute(query, params)
                orders = [self._customer._order_payload(cur, row) for row in cur.fetchall()]
            conn.commit()
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "orders": orders, "viewer": staff})

    def get_order(self, user: dict[str, Any], public_id: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user)
                cur.execute(
                    self._customer._order_query().replace(
                        "WHERE order_row.orden_id = %s",
                        "WHERE order_row.orden_public_id = %s",
                    ),
                    (public_id,),
                )
                order = cur.fetchone()
                if not order:
                    raise FulfillmentRuleError(404, "ORDER_NOT_FOUND", "Online order was not found.")
                result = self._customer._order_payload(cur, order)
            conn.commit()
        return _safe({**result, "viewer": staff})

    def add_quote(self, user: dict[str, Any], public_id: str, data: ManualQuoteInput) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user)
                cur.execute("SELECT * FROM core.online_solicitudes_cotizacion_envio WHERE solicitud_public_id = %s FOR UPDATE", (public_id,))
                request = cur.fetchone()
                if not request or request["metodo_entrega"] != "envio":
                    raise FulfillmentRuleError(404, "SHIPPING_REQUEST_NOT_FOUND", "Manual shipping request was not found.")
                if request["estado"] not in {"pendiente", "cotizada"} or request["expira_at"] <= datetime.now(timezone.utc):
                    raise FulfillmentRuleError(409, "REQUEST_NOT_QUOTABLE", "This request can no longer receive quotes.")
                cur.execute("SELECT elegible FROM core.online_solicitud_sucursales_elegibles WHERE solicitud_id = %s AND sucursal_id = %s", (request["solicitud_id"], data.branchId))
                eligible = cur.fetchone()
                if not eligible or not eligible["elegible"] or not self._customer._revalidate_branch(cur, data.branchId, request["carrito_snapshot"]):
                    raise FulfillmentRuleError(409, "BRANCH_NO_LONGER_ELIGIBLE", "The branch cannot fulfill the complete cart.")
                cur.execute("SELECT * FROM core.envio_transportistas WHERE codigo = %s AND activo = TRUE", (data.carrierCode.lower(),))
                carrier = cur.fetchone()
                if not carrier:
                    raise FulfillmentRuleError(422, "CARRIER_INVALID", "Select an active controlled carrier.")
                display = data.otherCarrierName.strip() if data.otherCarrierName else carrier["nombre"]
                if carrier["requiere_nombre_personalizado"] and not data.otherCarrierName:
                    raise FulfillmentRuleError(422, "OTHER_CARRIER_NAME_REQUIRED", "Enter the carrier display name.")
                if data.maximumDeliveryDays < data.minimumDeliveryDays:
                    raise FulfillmentRuleError(422, "DELIVERY_RANGE_INVALID", "Maximum delivery days cannot be earlier than minimum days.")
                zero_reason = None
                zero_admin_id = None
                zero_at = None
                if data.amount == 0:
                    if staff["rol"] != "admin" or not data.zeroAuthorizationReason or not data.zeroAuthorizationReason.strip():
                        raise FulfillmentRuleError(403, "ZERO_SHIPPING_ADMIN_REQUIRED", "Only an administrator may authorize zero-cost shipping with a reason.")
                    zero_reason, zero_admin_id, zero_at = data.zeroAuthorizationReason.strip(), staff["usuario_id"], datetime.now(timezone.utc)
                cur.execute("SELECT cotizacion_vigencia_horas FROM core.envio_configuracion_empaque WHERE configuracion_id = 1")
                hours = int(cur.fetchone()["cotizacion_vigencia_horas"])
                default_expiration = datetime.now(timezone.utc).timestamp() + hours * 3600
                expiration = data.expiresAt or datetime.fromtimestamp(default_expiration, tz=timezone.utc)
                if expiration <= datetime.now(timezone.utc) or expiration.timestamp() > default_expiration + 1:
                    raise FulfillmentRuleError(422, "QUOTE_EXPIRATION_INVALID", "Expiration must be future and no later than the configured quote lifetime.")
                quote_id = f"manual-{uuid4()}"
                cur.execute(
                    """INSERT INTO core.online_opciones_cotizacion_envio (
                           solicitud_id, sucursal_id, transportista_id,
                           transportista_codigo_snapshot, transportista_nombre_snapshot,
                           nivel_servicio_snapshot, monto, entrega_min_dias, entrega_max_dias,
                           quote_identifier, expira_at, ingresada_por_usuario_id, ingresada_por_rol,
                           autorizacion_cero_razon, autorizada_cero_por_usuario_id, autorizada_cero_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING opcion_id""",
                    (request["solicitud_id"], data.branchId, carrier["transportista_id"], carrier["codigo"], display, data.serviceLevel, data.amount, data.minimumDeliveryDays, data.maximumDeliveryDays, quote_id, expiration, staff["usuario_id"], staff["rol"], zero_reason, zero_admin_id, zero_at),
                )
                option_id = int(cur.fetchone()["opcion_id"])
                before = request["estado"]
                if before == "pendiente":
                    cur.execute("UPDATE core.online_solicitudes_cotizacion_envio SET estado = 'cotizada', updated_at = NOW() WHERE solicitud_id = %s RETURNING *", (request["solicitud_id"],))
                    request = cur.fetchone()
                self._customer._event(cur, request_id=request["solicitud_id"], option_id=option_id, event_type="manual_quote_created", actor_type="staff", staff=staff, before=before, after=request["estado"], metadata={"quoteIdentifier": quote_id})
                if data.amount == 0:
                    self._customer._event(cur, request_id=request["solicitud_id"], option_id=option_id, event_type="zero_shipping_authorized", actor_type="staff", staff=staff, metadata={"reason": zero_reason})
                result = self._customer._request_payload(cur, request)
            conn.commit()
        return result

    def configuration(self, user: dict[str, Any]) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                self._staff(cur, user)
                cur.execute("SELECT * FROM core.envio_configuracion_empaque WHERE configuracion_id = 1")
                package = cur.fetchone()
                cur.execute("SELECT * FROM core.envio_transportistas ORDER BY transportista_id")
                carriers = list(cur.fetchall())
                cur.execute("SELECT * FROM core.envio_categoria_fallbacks ORDER BY categoria")
                categories = list(cur.fetchall())
                cur.execute(
                    """SELECT shipping.*, product.sku, product.nombre, product.categoria
                       FROM core.catalogo_producto_envio shipping
                       JOIN core.catalogo_productos product USING (producto_id)
                       ORDER BY product.sku"""
                )
                products = list(cur.fetchall())
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "packaging": package, "carriers": carriers, "categoryFallbacks": categories, "productShipping": products})

    @staticmethod
    def _complete_measurements(data: ProductShippingInput) -> bool:
        return all(value is not None for value in (data.weightGrams, data.lengthMm, data.widthMm, data.heightMm))

    def update_product(self, user: dict[str, Any], product_id: int, data: ProductShippingInput) -> dict[str, Any]:
        if data.active and not self._complete_measurements(data):
            raise FulfillmentRuleError(422, "MEASUREMENTS_REQUIRED", "All four approved measurements are required before activation.")
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user, admin_only=True)
                cur.execute(
                    """INSERT INTO core.catalogo_producto_envio (
                           producto_id, peso_gramos, largo_mm, ancho_mm, alto_mm,
                           requiere_paquete_individual, grupo_compatibilidad, activo,
                           updated_by_usuario_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT (producto_id) DO UPDATE SET
                           peso_gramos=EXCLUDED.peso_gramos, largo_mm=EXCLUDED.largo_mm,
                           ancho_mm=EXCLUDED.ancho_mm, alto_mm=EXCLUDED.alto_mm,
                           requiere_paquete_individual=EXCLUDED.requiere_paquete_individual,
                           grupo_compatibilidad=EXCLUDED.grupo_compatibilidad,
                           activo=EXCLUDED.activo,
                           updated_by_usuario_id=EXCLUDED.updated_by_usuario_id,
                           updated_at=NOW()
                       RETURNING *""",
                    (product_id, data.weightGrams, data.lengthMm, data.widthMm, data.heightMm, data.requiresIndividualPackage, data.compatibilityGroup.strip(), data.active, staff["usuario_id"]),
                )
                row = cur.fetchone()
                if not row:
                    raise FulfillmentRuleError(404, "PRODUCT_NOT_FOUND", "Product shipping configuration was not found.")
                self._customer._event(cur, request_id=None, event_type="product_shipping_updated", actor_type="staff", staff=staff, metadata={"productId": product_id, "values": _safe(row)})
            conn.commit()
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "product": row})

    def update_category(self, user: dict[str, Any], category: str, data: CategoryShippingInput) -> dict[str, Any]:
        if data.active and not self._complete_measurements(data):
            raise FulfillmentRuleError(422, "MEASUREMENTS_REQUIRED", "All four approved measurements are required before activation.")
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user, admin_only=True)
                cur.execute("UPDATE core.envio_categoria_fallbacks SET peso_gramos=%s, largo_mm=%s, ancho_mm=%s, alto_mm=%s, requiere_paquete_individual=%s, grupo_compatibilidad=%s, activo=%s, updated_by_usuario_id=%s, updated_at=NOW() WHERE categoria=%s RETURNING *", (data.weightGrams, data.lengthMm, data.widthMm, data.heightMm, data.requiresIndividualPackage, data.compatibilityGroup.strip(), data.active, staff["usuario_id"], category))
                row = cur.fetchone()
                if not row:
                    raise FulfillmentRuleError(404, "CATEGORY_NOT_FOUND", "Category fallback was not found.")
                self._customer._event(cur, request_id=None, event_type="category_shipping_updated", actor_type="staff", staff=staff, metadata={"category": category, "values": _safe(row)})
            conn.commit()
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "categoryFallback": row})

    def update_packaging(self, user: dict[str, Any], data: PackagingConfigInput) -> dict[str, Any]:
        values = (data.packagingWeightGrams, data.paddingLengthMm, data.paddingWidthMm, data.paddingHeightMm, data.maximumWeightGrams, data.maximumLengthMm, data.maximumWidthMm, data.maximumHeightMm)
        if data.active and any(value is None for value in values):
            raise FulfillmentRuleError(422, "PACKAGING_VALUES_REQUIRED", "All real packaging values and limits are required before activation.")
        if data.costWeight + data.speedWeight != 1:
            raise FulfillmentRuleError(422, "RECOMMENDATION_WEIGHTS_INVALID", "Cost and speed weights must total 1.00.")
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user, admin_only=True)
                cur.execute("UPDATE core.envio_configuracion_empaque SET activa=%s, peso_empaque_gramos=%s, margen_largo_mm=%s, margen_ancho_mm=%s, margen_alto_mm=%s, peso_maximo_gramos=%s, largo_maximo_mm=%s, ancho_maximo_mm=%s, alto_maximo_mm=%s, costo_weight=%s, speed_weight=%s, solicitud_vigencia_horas=%s, cotizacion_vigencia_horas=%s, updated_by_usuario_id=%s, updated_at=NOW() WHERE configuracion_id=1 RETURNING *", (data.active, *values, data.costWeight, data.speedWeight, data.requestLifetimeHours, data.quoteLifetimeHours, staff["usuario_id"]))
                row = cur.fetchone()
                self._customer._event(cur, request_id=None, event_type="packaging_configuration_updated", actor_type="staff", staff=staff, metadata={"values": _safe(row)})
            conn.commit()
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "packaging": row})

    def update_carrier(self, user: dict[str, Any], code: str, data: CarrierUpdateInput) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                staff = self._staff(cur, user, admin_only=True)
                cur.execute("UPDATE core.envio_transportistas SET nombre=%s, activo=%s, updated_at=NOW() WHERE codigo=%s RETURNING *", (data.name.strip(), data.active, code.lower()))
                row = cur.fetchone()
                if not row:
                    raise FulfillmentRuleError(404, "CARRIER_NOT_FOUND", "Carrier was not found.")
                self._customer._event(cur, request_id=None, event_type="carrier_configuration_updated", actor_type="staff", staff=staff, metadata={"carrier": _safe(row)})
            conn.commit()
        return _safe({"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "carrier": row})


def _run(action: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    try:
        return action()
    except FulfillmentRuleError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    except psycopg.Error:
        raise HTTPException(status_code=503, detail={"code": "FULFILLMENT_UNAVAILABLE", "message": "Fulfillment is temporarily unavailable.", "details": {}})


def create_storefront_fulfillment_router(db_conninfo: str, config: FulfillmentConfig | None = None, repository: FulfillmentRepository | None = None) -> APIRouter:
    config = config or FulfillmentConfig.from_env(db_conninfo)
    repository = repository or FulfillmentRepository(config)
    router = APIRouter(prefix="/storefront/fulfillment/v1", tags=["Online fulfillment"])
    bearer = HTTPBearer(auto_error=False)

    def access(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if not config.enabled:
            raise HTTPException(status_code=503, detail={"code": "PHASE_1FB1_DISABLED", "message": "Phase 1F-B1 is disabled.", "details": {}})
        if not credentials or credentials.scheme.lower() != "bearer" or not config.bearer_token or not secrets.compare_digest(credentials.credentials, config.bearer_token):
            raise HTTPException(status_code=401, detail="Invalid fulfillment credentials.")

    def reservation_access(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        access(credentials)
        if not config.reservations_enabled:
            raise HTTPException(status_code=503, detail={"code": "PHASE_1FB2_DISABLED", "message": "Inventory reservations are disabled.", "details": {}})

    def order_access(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        reservation_access(credentials)
        if not config.orders_enabled:
            raise HTTPException(status_code=503, detail={"code": "PHASE_1FC1_DISABLED", "message": "Online pending-payment orders are disabled.", "details": {}})

    def payment_access(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        order_access(credentials)
        if not config.payment_sessions_enabled:
            raise HTTPException(status_code=503, detail={"code": "PHASE_1FC2A_DISABLED", "message": "Online payment sessions are disabled.", "details": {}})

    def owner(owner_type: str = Header(alias="X-OLM-Owner-Type"), owner_hash: str = Header(alias="X-OLM-Owner-Hash")) -> CommerceOwner:
        normalized_type, normalized_hash = owner_type.strip().lower(), owner_hash.strip().lower()
        if normalized_type not in {"guest", "customer"} or not _valid_owner_hash(normalized_hash):
            raise HTTPException(status_code=400, detail="Fulfillment owner is invalid.")
        return CommerceOwner(normalized_type, normalized_hash)  # type: ignore[arg-type]

    dependencies = [Depends(access)]

    @router.get("/health", dependencies=dependencies)
    def health():
        return {"schemaVersion": FULFILLMENT_SCHEMA_VERSION, "status": "ok", "reservationsEnabled": config.reservations_enabled, "ordersEnabled": config.orders_enabled, "paymentSessionsEnabled": config.payment_sessions_enabled}

    @router.post("/requests", dependencies=dependencies)
    def create(data: CreateFulfillmentRequest, commerce_owner: CommerceOwner = Depends(owner), idempotency_key: str = Header(alias="Idempotency-Key")):
        return _run(lambda: repository.create_request(commerce_owner, data, idempotency_key))

    @router.get("/requests", dependencies=dependencies)
    def list_requests(commerce_owner: CommerceOwner = Depends(owner)):
        return _run(lambda: repository.list_requests(commerce_owner))

    @router.get("/pickup-branches", dependencies=dependencies)
    def pickup_branches():
        return _run(repository.pickup_branches)

    @router.get("/requests/{request_id}", dependencies=dependencies)
    def detail(request_id: str, commerce_owner: CommerceOwner = Depends(owner)):
        return _run(lambda: repository.get_request(commerce_owner, request_id))

    @router.post("/requests/{request_id}/select", dependencies=dependencies)
    def select(request_id: str, data: SelectOptionRequest, commerce_owner: CommerceOwner = Depends(owner), idempotency_key: str = Header(alias="Idempotency-Key")):
        return _run(lambda: repository.select_option(commerce_owner, request_id, data.optionId, idempotency_key))

    @router.get("/requests/{request_id}/preview", dependencies=dependencies)
    def preview(request_id: str, commerce_owner: CommerceOwner = Depends(owner)):
        return _run(lambda: repository.get_preview(commerce_owner, request_id))

    @router.post("/requests/{request_id}/reservation", dependencies=[Depends(reservation_access)])
    def reserve(request_id: str, commerce_owner: CommerceOwner = Depends(owner), idempotency_key: str = Header(alias="Idempotency-Key")):
        return _run(lambda: repository.create_reservation(commerce_owner, request_id, idempotency_key))

    @router.get("/requests/{request_id}/reservation", dependencies=[Depends(reservation_access)])
    def reservation(request_id: str, commerce_owner: CommerceOwner = Depends(owner)):
        return _run(lambda: repository.get_reservation(commerce_owner, request_id))

    @router.post("/requests/{request_id}/reservation/release", dependencies=[Depends(reservation_access)])
    def release_reservation(request_id: str, commerce_owner: CommerceOwner = Depends(owner), idempotency_key: str = Header(alias="Idempotency-Key")):
        return _run(lambda: repository.release_reservation(commerce_owner, request_id, idempotency_key))

    @router.post("/requests/{request_id}/order", dependencies=[Depends(order_access)])
    def order(request_id: str, commerce_owner: CommerceOwner = Depends(owner), idempotency_key: str = Header(alias="Idempotency-Key")):
        return _run(lambda: repository.create_order(commerce_owner, request_id, idempotency_key))

    @router.get("/requests/{request_id}/order", dependencies=[Depends(order_access)])
    def order_detail(request_id: str, commerce_owner: CommerceOwner = Depends(owner)):
        return _run(lambda: repository.get_order(commerce_owner, request_id))

    @router.post("/requests/{request_id}/payment-session", dependencies=[Depends(payment_access)])
    def payment_session(request_id: str, commerce_owner: CommerceOwner = Depends(owner), idempotency_key: str = Header(alias="Idempotency-Key")):
        return _run(lambda: repository.create_payment_session(commerce_owner, request_id, idempotency_key))

    @router.get("/requests/{request_id}/payment-session", dependencies=[Depends(payment_access)])
    def payment_session_detail(request_id: str, commerce_owner: CommerceOwner = Depends(owner)):
        return _run(lambda: repository.get_payment_session(commerce_owner, request_id))

    return router


def create_admin_fulfillment_router(db_conninfo: str, current_user_dependency: Callable[..., Any], config: FulfillmentConfig | None = None, repository: FulfillmentAdminRepository | None = None) -> APIRouter:
    config = config or FulfillmentConfig.from_env(db_conninfo)
    repository = repository or FulfillmentAdminRepository(config)
    router = APIRouter(prefix="/online-fulfillment/admin/v1", tags=["Online fulfillment admin"])

    def enabled():
        if not config.enabled:
            raise HTTPException(status_code=503, detail={"code": "PHASE_1FB1_DISABLED", "message": "Phase 1F-B1 is disabled.", "details": {}})

    def reservations_enabled():
        enabled()
        if not config.reservations_enabled:
            raise HTTPException(status_code=503, detail={"code": "PHASE_1FB2_DISABLED", "message": "Inventory reservations are disabled.", "details": {}})

    def orders_enabled():
        reservations_enabled()
        if not config.orders_enabled:
            raise HTTPException(status_code=503, detail={"code": "PHASE_1FC1_DISABLED", "message": "Online pending-payment orders are disabled.", "details": {}})

    def payment_sessions_enabled():
        orders_enabled()
        if not config.payment_sessions_enabled:
            raise HTTPException(status_code=503, detail={"code": "PHASE_1FC2A_DISABLED", "message": "Online payment sessions are disabled.", "details": {}})

    dependencies = [Depends(enabled)]

    @router.get("/requests", dependencies=dependencies)
    def requests(status: str | None = None, user=Depends(current_user_dependency)):
        return _run(lambda: repository.list_requests(user, status))

    @router.get("/requests/{request_id}", dependencies=dependencies)
    def request_detail(request_id: str, user=Depends(current_user_dependency)):
        return _run(lambda: repository.get_request(user, request_id))

    @router.post("/requests/{request_id}/quotes", dependencies=dependencies)
    def quote(request_id: str, data: ManualQuoteInput, user=Depends(current_user_dependency)):
        return _run(lambda: repository.add_quote(user, request_id, data))

    @router.get("/configuration", dependencies=dependencies)
    def configuration(user=Depends(current_user_dependency)):
        return _run(lambda: repository.configuration(user))

    @router.get("/reservations", dependencies=[Depends(reservations_enabled)])
    def reservations(status: str | None = None, user=Depends(current_user_dependency)):
        return _run(lambda: repository.list_reservations(user, status))

    @router.post("/reservations/release-expired", dependencies=[Depends(reservations_enabled)])
    def release_expired(user=Depends(current_user_dependency)):
        return _run(lambda: repository.release_expired_reservations(user))

    @router.get("/orders", dependencies=[Depends(orders_enabled)])
    def orders(status: str | None = None, user=Depends(current_user_dependency)):
        return _run(lambda: repository.list_orders(user, status))

    @router.get("/orders/{order_id}", dependencies=[Depends(orders_enabled)])
    def order_detail(order_id: str, user=Depends(current_user_dependency)):
        return _run(lambda: repository.get_order(user, order_id))

    @router.get("/payment-sessions", dependencies=[Depends(payment_sessions_enabled)])
    def payment_sessions(status: str | None = None, user=Depends(current_user_dependency)):
        return _run(lambda: repository.list_payment_sessions(user, status))

    @router.get("/orders/{order_id}/payment-sessions", dependencies=[Depends(payment_sessions_enabled)])
    def order_payment_sessions(order_id: str, user=Depends(current_user_dependency)):
        return _run(lambda: repository.list_payment_sessions_for_order(user, order_id))

    @router.get("/payment-sessions/{session_id}", dependencies=[Depends(payment_sessions_enabled)])
    def payment_session_detail(session_id: str, user=Depends(current_user_dependency)):
        return _run(lambda: repository.get_payment_session_admin(user, session_id))

    @router.put("/products/{product_id}", dependencies=dependencies)
    def product(product_id: int, data: ProductShippingInput, user=Depends(current_user_dependency)):
        return _run(lambda: repository.update_product(user, product_id, data))

    @router.put("/categories/{category}", dependencies=dependencies)
    def category(category: str, data: CategoryShippingInput, user=Depends(current_user_dependency)):
        return _run(lambda: repository.update_category(user, category, data))

    @router.put("/configuration/packaging", dependencies=dependencies)
    def packaging(data: PackagingConfigInput, user=Depends(current_user_dependency)):
        return _run(lambda: repository.update_packaging(user, data))

    @router.put("/carriers/{code}", dependencies=dependencies)
    def carrier(code: str, data: CarrierUpdateInput, user=Depends(current_user_dependency)):
        return _run(lambda: repository.update_carrier(user, code, data))

    return router
