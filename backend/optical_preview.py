"""Phase 1G-B read-only authoritative optical configuration previews."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field
import psycopg
from psycopg.rows import dict_row

from public_catalog import PublicCatalogConfig, catalog_credentials_valid
from online_product_policy import is_configurable_optical_product


OPTICAL_PREVIEW_SCHEMA_VERSION = "1.0"
ALLOWED_DESIGN_SKUS = (
    "DEMO-LENS-MONO",
    "DEMO-LENS-BIFO",
    "DEMO-LENS-PROG",
    "DEMO-LENS-NONRX",
)
ALLOWED_TREATMENT_SKUS = (
    "DEMO-TRT-AR",
    "DEMO-TRT-PHOTO",
    "DEMO-TRT-BLUE",
    "DEMO-TRT-TINT",
)


def _money(value: Any) -> str:
    return f"{Decimal(value or 0):.2f}"


class OpticalVariant(BaseModel):
    variantId: str
    code: str
    name: str
    displayAdjustment: str | None = None


class OpticalOption(BaseModel):
    productId: str | None
    sku: str | None
    name: str
    description: str
    displayAdjustment: str
    requiresVariant: bool = False
    variants: list[OpticalVariant] = Field(default_factory=list)


class OpticalFrameSummary(BaseModel):
    productId: str
    sku: str
    slug: str
    name: str
    price: str
    currency: str


class OpticalOptionsResponse(BaseModel):
    schemaVersion: str = OPTICAL_PREVIEW_SCHEMA_VERSION
    generatedAt: datetime
    currency: str
    frame: OpticalFrameSummary
    lensDesigns: list[OpticalOption]
    treatments: list[OpticalOption]


class OpticalPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    frameProductId: int = Field(gt=0)
    lensDesignProductId: int = Field(gt=0)
    treatmentProductId: int | None = Field(default=None, gt=0)
    treatmentVariantId: int | None = Field(default=None, gt=0)


class OpticalPreviewComponent(BaseModel):
    productId: str
    sku: str
    name: str
    adjustment: str


class OpticalPreviewVariant(BaseModel):
    variantId: str
    code: str
    name: str


class OpticalPreviewResponse(BaseModel):
    schemaVersion: str = OPTICAL_PREVIEW_SCHEMA_VERSION
    previewFingerprint: str
    generatedAt: datetime
    currency: str
    frame: OpticalFrameSummary
    lensDesign: OpticalPreviewComponent
    treatment: OpticalPreviewComponent | None
    variant: OpticalPreviewVariant | None
    subtotal: str
    configuredTotal: str
    binding: bool = False


@dataclass(frozen=True)
class OpticalPreviewRepository:
    config: PublicCatalogConfig
    connect: Callable[..., Any] = psycopg.connect

    def _connection(self):
        return self.connect(self.config.db_conninfo, row_factory=dict_row)

    @staticmethod
    def _product(
        cur, product_id: int, *, for_share: bool = False
    ) -> dict[str, Any] | None:
        cur.execute(
            """
            SELECT producto_id, sku, slug, nombre, descripcion, categoria,
                   subcategoria, tipo_producto, modalidad_precio, precio,
                   moneda, controla_stock, activo, publicado_online,
                   comportamiento_abasto_default, unidad_medida,
                   created_at, updated_at
            FROM core.catalogo_productos
            WHERE producto_id = %s
            """ + (" FOR SHARE" if for_share else ""),
            (product_id,),
        )
        return cur.fetchone()

    @staticmethod
    def _validate_frame(frame: dict[str, Any] | None) -> dict[str, Any]:
        if frame is None:
            raise HTTPException(status_code=404, detail="Optical frame not found.")
        valid = is_configurable_optical_product(frame)
        if not valid:
            raise HTTPException(status_code=400, detail="Product is not an eligible optical frame.")
        return frame

    @staticmethod
    def _validate_component(
        component: dict[str, Any] | None, *, subtype: str, label: str
    ) -> dict[str, Any]:
        if component is None:
            raise HTTPException(status_code=404, detail=f"{label} not found.")
        valid = (
            component["categoria"] == "micas"
            and component["subcategoria"] == subtype
            and component["tipo_producto"] == "componente_mica"
            and component["modalidad_precio"] == "ajuste_venta"
        )
        if not valid:
            raise HTTPException(status_code=400, detail=f"Invalid {label.lower()} component.")
        if component["activo"] is not True:
            raise HTTPException(status_code=400, detail=f"{label} is inactive.")
        allowed = ALLOWED_DESIGN_SKUS if subtype == "diseno" else ALLOWED_TREATMENT_SKUS
        if component["sku"] not in allowed:
            raise HTTPException(status_code=400, detail=f"{label} is not available for optical preview.")
        return component

    @staticmethod
    def _variants(
        cur, treatment_id: int, *, for_share: bool = False
    ) -> list[dict[str, Any]]:
        cur.execute(
            """
            SELECT variante_id, producto_id, codigo, nombre,
                   precio_ajuste_override, activo, created_at, updated_at
            FROM core.catalogo_producto_variantes
            WHERE producto_id = %s AND activo = TRUE
            ORDER BY orden, variante_id
            """ + (" FOR SHARE" if for_share else ""),
            (treatment_id,),
        )
        return list(cur.fetchall())

    @staticmethod
    def _frame_payload(frame: dict[str, Any]) -> OpticalFrameSummary:
        return OpticalFrameSummary(
            productId=str(frame["producto_id"]),
            sku=str(frame["sku"]),
            slug=str(frame["slug"]),
            name=str(frame["nombre"]),
            price=_money(frame["precio"]),
            currency=str(frame["moneda"]).strip(),
        )

    def options(self, frame_product_id: int) -> OpticalOptionsResponse:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY")
                frame = self._validate_frame(self._product(cur, frame_product_id))
                cur.execute(
                    """
                    SELECT producto_id, sku, nombre, descripcion, subcategoria,
                           precio, moneda
                    FROM core.catalogo_productos
                    WHERE categoria = 'micas'
                      AND tipo_producto = 'componente_mica'
                      AND modalidad_precio = 'ajuste_venta'
                      AND subcategoria IN ('diseno', 'tratamiento')
                      AND sku = ANY(%s::text[])
                      AND activo = TRUE
                    ORDER BY orden_catalogo, producto_id
                    """,
                    (list(ALLOWED_DESIGN_SKUS + ALLOWED_TREATMENT_SKUS),),
                )
                rows = list(cur.fetchall())
                currencies = {str(frame["moneda"]).strip()}
                currencies.update(str(row["moneda"]).strip() for row in rows)
                if len(currencies) != 1:
                    raise HTTPException(status_code=409, detail="Optical catalog currencies do not match.")

                designs: list[OpticalOption] = []
                treatments: list[OpticalOption] = [
                    OpticalOption(
                        productId=None,
                        sku=None,
                        name="Sin tratamiento",
                        description="Sin tratamiento adicional.",
                        displayAdjustment="0.00",
                    )
                ]
                for row in rows:
                    if row["subcategoria"] == "diseno":
                        designs.append(
                            OpticalOption(
                                productId=str(row["producto_id"]),
                                sku=str(row["sku"]),
                                name=str(row["nombre"]).replace("DEMO — ", ""),
                                description=str(row["descripcion"]),
                                displayAdjustment=_money(row["precio"]),
                            )
                        )
                        continue
                    variants = self._variants(cur, int(row["producto_id"]))
                    treatments.append(
                        OpticalOption(
                            productId=str(row["producto_id"]),
                            sku=str(row["sku"]),
                            name=str(row["nombre"]).replace("DEMO — ", ""),
                            description=str(row["descripcion"]),
                            displayAdjustment=_money(row["precio"]),
                            requiresVariant=bool(variants),
                            variants=[
                                OpticalVariant(
                                    variantId=str(variant["variante_id"]),
                                    code=str(variant["codigo"]),
                                    name=str(variant["nombre"]),
                                    displayAdjustment=(
                                        _money(variant["precio_ajuste_override"])
                                        if variant["precio_ajuste_override"] is not None
                                        else None
                                    ),
                                )
                                for variant in variants
                            ],
                        )
                    )
        return OpticalOptionsResponse(
            generatedAt=datetime.now(timezone.utc),
            currency=currencies.pop(),
            frame=self._frame_payload(frame),
            lensDesigns=designs,
            treatments=treatments,
        )

    def preview_in_transaction(
        self,
        cur,
        data: OpticalPreviewRequest,
        *,
        lock_catalog: bool = False,
    ) -> OpticalPreviewResponse:
        frame = self._validate_frame(
            self._product(cur, data.frameProductId, for_share=lock_catalog)
        )
        design = self._validate_component(
            self._product(
                cur, data.lensDesignProductId, for_share=lock_catalog
            ),
            subtype="diseno",
            label="Lens design",
        )
        treatment = None
        variants: list[dict[str, Any]] = []
        if data.treatmentProductId is not None:
            treatment = self._validate_component(
                self._product(
                    cur, data.treatmentProductId, for_share=lock_catalog
                ),
                subtype="tratamiento",
                label="Treatment",
            )
            variants = self._variants(
                cur,
                int(treatment["producto_id"]),
                for_share=lock_catalog,
            )

        selected_variant = None
        if variants and data.treatmentVariantId is None:
            raise HTTPException(
                status_code=400,
                detail="Selected treatment requires a variant.",
            )
        if data.treatmentVariantId is not None:
            if treatment is None or not variants:
                raise HTTPException(
                    status_code=400,
                    detail="Selected treatment does not accept a variant.",
                )
            selected_variant = next(
                (
                    variant
                    for variant in variants
                    if int(variant["variante_id"])
                    == data.treatmentVariantId
                ),
                None,
            )
            if selected_variant is None:
                raise HTTPException(
                    status_code=400,
                    detail="Variant does not belong to selected treatment.",
                )

        components = [frame, design] + ([treatment] if treatment else [])
        currencies = {str(item["moneda"]).strip() for item in components}
        if len(currencies) != 1:
            raise HTTPException(
                status_code=409,
                detail="Optical configuration currencies do not match.",
            )
        currency = next(iter(currencies))
        treatment_adjustment = Decimal("0.00")
        if treatment is not None:
            treatment_adjustment = Decimal(treatment["precio"])
            if (
                selected_variant
                and selected_variant["precio_ajuste_override"] is not None
            ):
                treatment_adjustment = Decimal(
                    selected_variant["precio_ajuste_override"]
                )
        total = (
            Decimal(frame["precio"])
            + Decimal(design["precio"])
            + treatment_adjustment
        ).quantize(Decimal("0.01"))
        fingerprint_state = {
            "frame": [
                frame["producto_id"],
                _money(frame["precio"]),
                str(frame["updated_at"] or frame["created_at"]),
            ],
            "design": [
                design["producto_id"],
                _money(design["precio"]),
                str(design["updated_at"] or design["created_at"]),
            ],
            "treatment": (
                [
                    treatment["producto_id"],
                    _money(treatment_adjustment),
                    str(treatment["updated_at"] or treatment["created_at"]),
                ]
                if treatment
                else None
            ),
            "variant": (
                [
                    selected_variant["variante_id"],
                    str(
                        selected_variant["updated_at"]
                        or selected_variant["created_at"]
                    ),
                ]
                if selected_variant
                else None
            ),
            "currency": currency,
        }
        fingerprint = hashlib.sha256(
            json.dumps(
                fingerprint_state,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()

        return OpticalPreviewResponse(
            previewFingerprint=fingerprint,
            generatedAt=datetime.now(timezone.utc),
            currency=currency,
            frame=self._frame_payload(frame),
            lensDesign=OpticalPreviewComponent(
                productId=str(design["producto_id"]),
                sku=str(design["sku"]),
                name=str(design["nombre"]).replace("DEMO — ", ""),
                adjustment=_money(design["precio"]),
            ),
            treatment=(
                OpticalPreviewComponent(
                    productId=str(treatment["producto_id"]),
                    sku=str(treatment["sku"]),
                    name=str(treatment["nombre"]).replace("DEMO — ", ""),
                    adjustment=_money(treatment_adjustment),
                )
                if treatment else None
            ),
            variant=(
                OpticalPreviewVariant(
                    variantId=str(selected_variant["variante_id"]),
                    code=str(selected_variant["codigo"]),
                    name=str(selected_variant["nombre"]),
                )
                if selected_variant else None
            ),
            subtotal=_money(total),
            configuredTotal=_money(total),
        )

    def preview(self, data: OpticalPreviewRequest) -> OpticalPreviewResponse:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY")
                return self.preview_in_transaction(cur, data)


def create_optical_preview_router(
    db_conninfo: str,
    *,
    config: PublicCatalogConfig | None = None,
    repository: OpticalPreviewRepository | None = None,
) -> APIRouter:
    config = config or PublicCatalogConfig.from_env(db_conninfo)
    repository = repository or OpticalPreviewRepository(config)
    router = APIRouter(prefix="/storefront/optical/v1", tags=["Optical preview"])
    bearer = HTTPBearer(auto_error=False)

    def require_token(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    ) -> None:
        if not config.bearer_token:
            raise HTTPException(status_code=503, detail="Optical preview is not configured.")
        if not catalog_credentials_valid(credentials, config.bearer_token):
            raise HTTPException(
                status_code=401,
                detail="Invalid optical preview credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    @router.get(
        "/options",
        response_model=OpticalOptionsResponse,
        dependencies=[Depends(require_token)],
    )
    def options(frame_product_id: int = Query(gt=0)):
        return repository.options(frame_product_id)

    @router.post(
        "/preview",
        response_model=OpticalPreviewResponse,
        dependencies=[Depends(require_token)],
    )
    def preview(data: OpticalPreviewRequest):
        return repository.preview(data)

    return router
