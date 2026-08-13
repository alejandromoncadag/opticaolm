"""Phase 1G-G internal administration for optical prices and estimated costs."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
import psycopg
from psycopg.rows import dict_row

from optical_preview import ALLOWED_DESIGN_SKUS, ALLOWED_TREATMENT_SKUS


ALLOWED_COMPONENT_SKUS = set(ALLOWED_DESIGN_SKUS + ALLOWED_TREATMENT_SKUS)
MONEY_MAX = Decimal("9999999999.99")


def phase1gg_enabled() -> bool:
    return os.getenv("PHASE_1GG_ENABLED", "false").strip().lower() in {
        "1", "true", "yes", "on",
    }


@dataclass(frozen=True)
class OpticalCatalogAdminConfig:
    db_conninfo: str
    enabled: bool

    @classmethod
    def from_env(cls, db_conninfo: str) -> "OpticalCatalogAdminConfig":
        return cls(db_conninfo=db_conninfo, enabled=phase1gg_enabled())


class OpticalComponentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: str = Field(min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$")
    ajuste_venta: Decimal | None = None
    costo_laboratorio_estimado: Decimal | None = None
    costo_confirmado: bool | None = None
    costo_confirmado_referencia: str | None = Field(default=None, max_length=250)
    costo_vigente_desde: date | None = None
    activo: bool | None = None
    motivo: str | None = Field(default=None, max_length=500)


class OpticalVariantUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: str = Field(min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$")
    ajuste_venta_override: Decimal | None = None
    costo_laboratorio_estimado: Decimal | None = None
    costo_confirmado: bool | None = None
    costo_confirmado_referencia: str | None = Field(default=None, max_length=250)
    costo_vigente_desde: date | None = None
    activo: bool | None = None
    motivo: str | None = Field(default=None, max_length=500)


def _money(value: Any) -> str | None:
    return None if value is None else f"{Decimal(value):.2f}"


def _validate_money(value: Decimal | None, label: str, *, nullable: bool) -> Decimal | None:
    if value is None:
        if nullable:
            return None
        raise HTTPException(status_code=400, detail=f"{label} es requerido.")
    try:
        normalized = Decimal(value)
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{label} no es válido.")
    if normalized < 0 or normalized > MONEY_MAX:
        raise HTTPException(status_code=400, detail=f"{label} está fuera del rango permitido.")
    if normalized != normalized.quantize(Decimal("0.01")):
        raise HTTPException(status_code=400, detail=f"{label} permite máximo dos decimales.")
    return normalized.quantize(Decimal("0.01"))


def _clean_text(value: str | None) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None


def _revision(kind: str, row: dict[str, Any]) -> str:
    fields = (
        ("producto_id", "sku", "precio", "costo_unitario", "costo_confirmado", "activo")
        if kind == "producto"
        else ("variante_id", "producto_id", "codigo", "precio_ajuste_override", "costo_unitario", "costo_confirmado", "activo")
    )
    payload = {key: str(row.get(key)) if row.get(key) is not None else None for key in fields}
    payload["updated_at"] = str(row.get("updated_at") or row.get("created_at"))
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _product_payload(row: dict[str, Any], variants: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "producto_id": int(row["producto_id"]),
        "sku": row["sku"],
        "nombre": row["nombre"],
        "subcategoria": row["subcategoria"],
        "ajuste_venta": _money(row["precio"]),
        "costo_laboratorio_estimado": _money(row["costo_unitario"]),
        "costo_confirmado": bool(row["costo_confirmado"]),
        "costo_confirmado_at": row["costo_confirmado_at"],
        "costo_confirmado_by": row["costo_confirmado_by"],
        "costo_confirmado_referencia": row["costo_confirmado_referencia"],
        "costo_vigente_desde": row["costo_vigente_desde"],
        "comportamiento_abasto_default": row["comportamiento_abasto_default"],
        "unidad_medida": row["unidad_medida"],
        "activo": bool(row["activo"]),
        "revision": _revision("producto", row),
        "variantes": [_variant_payload(item) for item in variants],
    }


def _variant_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "variante_id": int(row["variante_id"]),
        "producto_id": int(row["producto_id"]),
        "codigo": row["codigo"],
        "nombre": row["nombre"],
        "ajuste_venta_override": _money(row["precio_ajuste_override"]),
        "costo_laboratorio_estimado": _money(row["costo_unitario"]),
        "costo_confirmado": bool(row["costo_confirmado"]),
        "costo_confirmado_at": row["costo_confirmado_at"],
        "costo_confirmado_by": row["costo_confirmado_by"],
        "costo_confirmado_referencia": row["costo_confirmado_referencia"],
        "costo_vigente_desde": row["costo_vigente_desde"],
        "activo": bool(row["activo"]),
        "revision": _revision("variante", row),
    }


PRODUCT_SELECT = """
    SELECT producto_id, sku, nombre, categoria, subcategoria, tipo_producto,
           modalidad_precio, precio, costo_unitario, costo_confirmado,
           costo_confirmado_at, costo_confirmado_by,
           costo_confirmado_referencia, costo_vigente_desde,
           comportamiento_abasto_default, unidad_medida, activo,
           created_at, updated_at
    FROM core.catalogo_productos
"""

VARIANT_SELECT = """
    SELECT variante_id, producto_id, codigo, nombre, precio_ajuste_override,
           costo_unitario, costo_confirmado, costo_confirmado_at,
           costo_confirmado_by, costo_confirmado_referencia,
           costo_vigente_desde, activo, orden, created_at, updated_at
    FROM core.catalogo_producto_variantes
"""


class OpticalCatalogAdminRepository:
    def __init__(
        self,
        config: OpticalCatalogAdminConfig,
        *,
        connect: Callable[..., Any] = psycopg.connect,
    ) -> None:
        self.config = config
        self.connect = connect

    def _connection(self):
        return self.connect(self.config.db_conninfo, row_factory=dict_row)

    def list_components(self) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    PRODUCT_SELECT
                    + " WHERE categoria='micas' AND tipo_producto='componente_mica'"
                      " AND modalidad_precio='ajuste_venta' AND sku=ANY(%s::text[])"
                      " ORDER BY subcategoria, orden_catalogo, producto_id",
                    (sorted(ALLOWED_COMPONENT_SKUS),),
                )
                products = list(cur.fetchall())
                ids = [int(row["producto_id"]) for row in products]
                variants_by_product: dict[int, list[dict[str, Any]]] = {key: [] for key in ids}
                if ids:
                    cur.execute(
                        VARIANT_SELECT
                        + " WHERE producto_id=ANY(%s::bigint[]) ORDER BY producto_id, orden, variante_id",
                        (ids,),
                    )
                    for variant in cur.fetchall():
                        variants_by_product[int(variant["producto_id"])].append(variant)
        return {
            "componentes": [
                _product_payload(row, variants_by_product[int(row["producto_id"])])
                for row in products
            ]
        }

    @staticmethod
    def _assert_component(row: dict[str, Any] | None) -> dict[str, Any]:
        if row is None:
            raise HTTPException(status_code=404, detail="Componente óptico no encontrado.")
        if not (
            row["sku"] in ALLOWED_COMPONENT_SKUS
            and row["categoria"] == "micas"
            and row["subcategoria"] in {"diseno", "tratamiento"}
            and row["tipo_producto"] == "componente_mica"
            and row["modalidad_precio"] == "ajuste_venta"
        ):
            raise HTTPException(status_code=400, detail="El registro no es un componente óptico administrable.")
        return row

    @staticmethod
    def _audit(
        cur,
        *,
        product_id: int,
        variant_id: int | None,
        previous: dict[str, Any],
        new: dict[str, Any],
        reason: str | None,
        username: str,
    ) -> None:
        cur.execute(
            """INSERT INTO core.catalogo_optico_precio_costo_auditoria
               (producto_id,variante_id,valores_anteriores,valores_nuevos,motivo,admin_username)
               VALUES (%s,%s,%s::jsonb,%s::jsonb,%s,%s)""",
            (
                product_id, variant_id,
                json.dumps(previous, default=str, ensure_ascii=False),
                json.dumps(new, default=str, ensure_ascii=False),
                reason, username,
            ),
        )

    @staticmethod
    def _state(row: dict[str, Any], *, variant: bool) -> dict[str, Any]:
        return {
            "ajuste_venta": _money(row["precio_ajuste_override"] if variant else row["precio"]),
            "costo_laboratorio_estimado": _money(row["costo_unitario"]),
            "costo_confirmado": bool(row["costo_confirmado"]),
            "costo_confirmado_at": row["costo_confirmado_at"],
            "costo_confirmado_by": row["costo_confirmado_by"],
            "costo_confirmado_referencia": row["costo_confirmado_referencia"],
            "costo_vigente_desde": row["costo_vigente_desde"],
            "activo": bool(row["activo"]),
        }

    @staticmethod
    def _resolve_common(
        row: dict[str, Any], data: OpticalComponentUpdate | OpticalVariantUpdate,
    ) -> tuple[Decimal | None, bool, datetime | None, str | None, str | None, date | None, bool]:
        fields = data.model_fields_set
        cost = row["costo_unitario"]
        if "costo_laboratorio_estimado" in fields:
            cost = _validate_money(data.costo_laboratorio_estimado, "Costo estimado", nullable=True)
        confirmed = bool(row["costo_confirmado"])
        if data.costo_confirmado is not None:
            confirmed = data.costo_confirmado
        cost_changed = cost != row["costo_unitario"]
        if cost_changed and bool(row["costo_confirmado"]) and "costo_confirmado" not in fields:
            raise HTTPException(
                status_code=400,
                detail="Confirma explícitamente el nuevo costo o márcalo como no confirmado.",
            )
        if confirmed and cost is None:
            raise HTTPException(status_code=400, detail="Un costo confirmado requiere un importe estimado.")

        confirmed_at = row["costo_confirmado_at"]
        confirmed_by = row["costo_confirmado_by"]
        reference = row["costo_confirmado_referencia"]
        effective_from = row["costo_vigente_desde"]
        if "costo_confirmado_referencia" in fields:
            reference = _clean_text(data.costo_confirmado_referencia)
        if "costo_vigente_desde" in fields:
            effective_from = data.costo_vigente_desde
        if not confirmed:
            confirmed_at = None
            confirmed_by = None
            reference = None
            effective_from = None
        active = bool(row["activo"]) if data.activo is None else data.activo
        return cost, confirmed, confirmed_at, confirmed_by, reference, effective_from, active

    def update_component(self, product_id: int, data: OpticalComponentUpdate, username: str) -> dict[str, Any]:
        mutable = data.model_fields_set - {"expected_revision", "motivo"}
        if not mutable:
            raise HTTPException(status_code=400, detail="No hay cambios para guardar.")
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(PRODUCT_SELECT + " WHERE producto_id=%s FOR UPDATE", (product_id,))
                row = self._assert_component(cur.fetchone())
                if _revision("producto", row) != data.expected_revision:
                    raise HTTPException(status_code=409, detail="El componente cambió. Recarga antes de guardar.")
                previous = self._state(row, variant=False)
                price = row["precio"]
                if "ajuste_venta" in data.model_fields_set:
                    price = _validate_money(data.ajuste_venta, "Ajuste de venta", nullable=False)
                cost, confirmed, confirmed_at, confirmed_by, reference, effective_from, active = self._resolve_common(row, data)
                if confirmed and (
                    not row["costo_confirmado"]
                    or cost != row["costo_unitario"]
                    or "costo_confirmado_referencia" in data.model_fields_set
                    or "costo_vigente_desde" in data.model_fields_set
                ):
                    confirmed_at = datetime.now().astimezone()
                    confirmed_by = username
                cur.execute(
                    """UPDATE core.catalogo_productos
                       SET precio=%s,costo_unitario=%s,costo_confirmado=%s,
                           costo_confirmado_at=%s,costo_confirmado_by=%s,
                           costo_confirmado_referencia=%s,costo_vigente_desde=%s,
                           activo=%s,updated_at=NOW()
                       WHERE producto_id=%s""",
                    (price, cost, confirmed, confirmed_at, confirmed_by, reference,
                     effective_from, active, product_id),
                )
                cur.execute(PRODUCT_SELECT + " WHERE producto_id=%s", (product_id,))
                updated = cur.fetchone()
                new = self._state(updated, variant=False)
                self._audit(
                    cur, product_id=product_id, variant_id=None, previous=previous,
                    new=new, reason=_clean_text(data.motivo), username=username,
                )
            conn.commit()
        return _product_payload(updated, [])

    def update_variant(self, variant_id: int, data: OpticalVariantUpdate, username: str) -> dict[str, Any]:
        mutable = data.model_fields_set - {"expected_revision", "motivo"}
        if not mutable:
            raise HTTPException(status_code=400, detail="No hay cambios para guardar.")
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(VARIANT_SELECT + " WHERE variante_id=%s FOR UPDATE", (variant_id,))
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Variante óptica no encontrada.")
                cur.execute(PRODUCT_SELECT + " WHERE producto_id=%s FOR SHARE", (row["producto_id"],))
                parent = self._assert_component(cur.fetchone())
                if parent["subcategoria"] != "tratamiento":
                    raise HTTPException(status_code=400, detail="La variante no pertenece a un tratamiento óptico.")
                if _revision("variante", row) != data.expected_revision:
                    raise HTTPException(status_code=409, detail="La variante cambió. Recarga antes de guardar.")
                previous = self._state(row, variant=True)
                price = row["precio_ajuste_override"]
                if "ajuste_venta_override" in data.model_fields_set:
                    price = _validate_money(data.ajuste_venta_override, "Ajuste de variante", nullable=True)
                cost, confirmed, confirmed_at, confirmed_by, reference, effective_from, active = self._resolve_common(row, data)
                if active and not parent["activo"]:
                    raise HTTPException(status_code=400, detail="No puedes activar una variante de un tratamiento inactivo.")
                if confirmed and (
                    not row["costo_confirmado"]
                    or cost != row["costo_unitario"]
                    or "costo_confirmado_referencia" in data.model_fields_set
                    or "costo_vigente_desde" in data.model_fields_set
                ):
                    confirmed_at = datetime.now().astimezone()
                    confirmed_by = username
                cur.execute(
                    """UPDATE core.catalogo_producto_variantes
                       SET precio_ajuste_override=%s,costo_unitario=%s,costo_confirmado=%s,
                           costo_confirmado_at=%s,costo_confirmado_by=%s,
                           costo_confirmado_referencia=%s,costo_vigente_desde=%s,
                           activo=%s,updated_at=NOW()
                       WHERE variante_id=%s""",
                    (price, cost, confirmed, confirmed_at, confirmed_by, reference,
                     effective_from, active, variant_id),
                )
                cur.execute(VARIANT_SELECT + " WHERE variante_id=%s", (variant_id,))
                updated = cur.fetchone()
                new = self._state(updated, variant=True)
                self._audit(
                    cur, product_id=int(row["producto_id"]), variant_id=variant_id,
                    previous=previous, new=new, reason=_clean_text(data.motivo),
                    username=username,
                )
            conn.commit()
        return _variant_payload(updated)


def create_optical_catalog_admin_router(
    db_conninfo: str,
    get_current_user: Callable[..., Any],
    *,
    config: OpticalCatalogAdminConfig | None = None,
    repository: OpticalCatalogAdminRepository | None = None,
) -> APIRouter:
    config = config or OpticalCatalogAdminConfig.from_env(db_conninfo)
    repository = repository or OpticalCatalogAdminRepository(config)
    router = APIRouter(prefix="/catalogo/optica", tags=["Optical catalog administration"])

    def enabled() -> None:
        if not config.enabled:
            raise HTTPException(status_code=503, detail="La administración de precios ópticos no está habilitada.")

    def role(user: dict[str, Any], allowed: set[str]) -> None:
        if user.get("rol") not in allowed:
            raise HTTPException(status_code=403, detail="No tienes permisos para esta operación.")

    @router.get("/precios-costos", dependencies=[Depends(enabled)])
    def list_prices(user=Depends(get_current_user)):
        role(user, {"admin", "contador"})
        return repository.list_components()

    @router.patch("/componentes/{producto_id}", dependencies=[Depends(enabled)])
    def update_component(
        producto_id: int,
        data: OpticalComponentUpdate,
        user=Depends(get_current_user),
    ):
        role(user, {"admin"})
        return repository.update_component(producto_id, data, str(user["username"]))

    @router.patch("/variantes/{variante_id}", dependencies=[Depends(enabled)])
    def update_variant(
        variante_id: int,
        data: OpticalVariantUpdate,
        user=Depends(get_current_user),
    ):
        role(user, {"admin"})
        return repository.update_variant(variante_id, data, str(user["username"]))

    return router
