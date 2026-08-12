"""Phase 1G-C optical-specific drafts and temporary frame reservations.

This module intentionally creates no cart item, order, payment, sale, patient,
prescription, laboratory order, production order, or inventory movement.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import hmac
import json
import os
from typing import Any, Callable, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field
import psycopg
from psycopg.rows import dict_row

from online_commerce import CommerceOwner, _valid_owner_hash
from optical_preview import (
    OPTICAL_PREVIEW_SCHEMA_VERSION,
    OpticalPreviewRepository,
    OpticalPreviewRequest,
    OpticalPreviewResponse,
)
from public_catalog import PublicCatalogConfig, catalog_credentials_valid


OPTICAL_DRAFT_SCHEMA_VERSION = "1.0"
TERMINAL_STATES = {"cancelado", "expirado"}


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


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    return default if raw is None else raw.strip().lower() in {"1", "true", "yes", "on"}


class OpticalDraftRuleError(RuntimeError):
    def __init__(self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.detail = {"code": code, "message": message, "details": details or {}}


class CreateOpticalDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    frameProductId: int = Field(gt=0)
    lensDesignProductId: int = Field(gt=0)
    treatmentProductId: int | None = Field(default=None, gt=0)
    treatmentVariantId: int | None = Field(default=None, gt=0)
    previewFingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    prescriptionMethod: Literal["later", "exam"]
    branchId: int = Field(gt=0)
    intendedUse: Literal[
        "lejos", "cerca", "intermedio", "multifocal", "sin_graduacion", "otro"
    ] | None = None


@dataclass(frozen=True)
class OpticalDraftConfig:
    db_conninfo: str
    bearer_token: str
    enabled: bool

    @classmethod
    def from_env(cls, db_conninfo: str) -> "OpticalDraftConfig":
        return cls(
            db_conninfo=db_conninfo,
            bearer_token=os.getenv("PUBLIC_CATALOG_BEARER_TOKEN", "").strip(),
            enabled=_env_bool("PHASE_1GC_ENABLED", False),
        )


def _event(
    cur,
    *,
    draft_id: int,
    reservation_id: int | None,
    event_type: str,
    actor_type: str,
    owner_hash: str | None,
    metadata: dict[str, Any] | None = None,
) -> None:
    cur.execute(
        """
        INSERT INTO core.online_borrador_optico_eventos
            (borrador_id, reserva_id, evento_tipo, actor_tipo,
             actor_ref_hash, metadata)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        ON CONFLICT DO NOTHING
        """,
        (draft_id, reservation_id, event_type, actor_type, owner_hash, _canonical(metadata or {})),
    )


def release_expired_optical_reservations(cur, *, limit: int = 100) -> int:
    """Release expired optical frame holds inside the caller's transaction."""
    cur.execute("SELECT to_regclass('core.online_reservas_opticas_borrador') AS relation")
    if cur.fetchone()["relation"] is None:
        return 0
    cur.execute(
        """
        SELECT reserva_id
        FROM core.online_reservas_opticas_borrador
        WHERE estado = 'activa' AND expires_at <= clock_timestamp()
        ORDER BY expires_at, reserva_id
        LIMIT %s
        FOR UPDATE SKIP LOCKED
        """,
        (max(1, min(limit, 1000)),),
    )
    ids = [int(row["reserva_id"]) for row in cur.fetchall()]
    released = 0
    for reservation_id in ids:
        cur.execute(
            """
            SELECT reservation.*, draft.estado AS draft_state
            FROM core.online_reservas_opticas_borrador reservation
            JOIN core.online_borradores_opticos draft
              ON draft.borrador_id = reservation.borrador_id
            WHERE reservation.reserva_id = %s
            FOR UPDATE OF reservation, draft
            """,
            (reservation_id,),
        )
        reservation = cur.fetchone()
        if not reservation or reservation["estado"] != "activa":
            continue
        cur.execute(
            """
            SELECT stock_reservado
            FROM core.catalogo_inventario_sucursal
            WHERE producto_id = %s AND sucursal_id = %s
            FOR UPDATE
            """,
            (reservation["armazon_producto_id"], reservation["sucursal_id"]),
        )
        inventory = cur.fetchone()
        if not inventory or int(inventory["stock_reservado"]) < 1:
            raise OpticalDraftRuleError(
                409, "OPTICAL_RESERVATION_INTEGRITY_ERROR",
                "Reserved frame inventory does not match the optical draft reservation.",
            )
        cur.execute(
            """
            UPDATE core.catalogo_inventario_sucursal
            SET stock_reservado = stock_reservado - 1,
                version = version + 1, updated_at = NOW()
            WHERE producto_id = %s AND sucursal_id = %s
              AND stock_reservado >= 1
            """,
            (reservation["armazon_producto_id"], reservation["sucursal_id"]),
        )
        if cur.rowcount != 1:
            raise OpticalDraftRuleError(409, "OPTICAL_RESERVATION_INTEGRITY_ERROR", "Frame hold could not be released safely.")
        cur.execute(
            """
            UPDATE core.online_reservas_opticas_borrador
            SET estado = 'expirada', released_at = NOW(), updated_at = NOW()
            WHERE reserva_id = %s AND estado = 'activa'
            """,
            (reservation_id,),
        )
        cur.execute(
            """
            UPDATE core.online_borradores_opticos
            SET estado = 'expirado', expirado_at = NOW(), updated_at = NOW()
            WHERE borrador_id = %s AND estado NOT IN ('cancelado', 'expirado')
            """,
            (reservation["borrador_id"],),
        )
        _event(
            cur, draft_id=int(reservation["borrador_id"]), reservation_id=reservation_id,
            event_type="reservation_expired", actor_type="sistema", owner_hash=None,
            metadata={"releasedFrameQuantity": 1},
        )
        released += 1
    return released


@dataclass(frozen=True)
class OpticalDraftRepository:
    config: OpticalDraftConfig
    preview_repository: OpticalPreviewRepository
    connect: Callable[..., Any] = psycopg.connect

    def _connection(self):
        return self.connect(self.config.db_conninfo, row_factory=dict_row)

    @staticmethod
    def _idempotency_begin(cur, owner: CommerceOwner, scope: str, key: str, payload: dict[str, Any]):
        clean = key.strip()
        if not clean or len(clean) > 200:
            raise OpticalDraftRuleError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.")
        key_hash, request_hash = hashlib.sha256(clean.encode()).hexdigest(), _hash(payload)
        cur.execute(
            """
            INSERT INTO core.online_idempotencia
                (alcance, clave_hash, propietario_ref_hash, solicitud_hash, expira_at)
            VALUES (%s, %s, %s, %s, NOW() + INTERVAL '24 hours')
            ON CONFLICT (alcance, clave_hash) DO NOTHING
            RETURNING idempotencia_id
            """,
            (scope, key_hash, owner.owner_hash, request_hash),
        )
        inserted = cur.fetchone()
        if inserted:
            return int(inserted["idempotencia_id"]), None
        cur.execute(
            "SELECT * FROM core.online_idempotencia WHERE alcance = %s AND clave_hash = %s FOR UPDATE",
            (scope, key_hash),
        )
        existing = cur.fetchone()
        if not existing or not hmac.compare_digest(str(existing["propietario_ref_hash"]), owner.owner_hash) or existing["solicitud_hash"] != request_hash:
            raise OpticalDraftRuleError(409, "IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used differently.")
        if existing["estado"] == "completado" and existing["respuesta"] is not None:
            return None, existing["respuesta"]
        raise OpticalDraftRuleError(409, "REQUEST_IN_PROGRESS", "The same request is already being processed.")

    @staticmethod
    def _idempotency_finish(cur, row_id: int | None, result: dict[str, Any], resource_id: int) -> None:
        if row_id is not None:
            cur.execute(
                """
                UPDATE core.online_idempotencia
                SET estado = 'completado', recurso_id = %s, codigo_respuesta = 200,
                    respuesta = %s::jsonb, updated_at = NOW()
                WHERE idempotencia_id = %s
                """,
                (resource_id, _canonical(result), row_id),
            )

    @staticmethod
    def _draft_payload(cur, draft_id: int) -> dict[str, Any]:
        cur.execute(
            """
            SELECT draft.*, branch.nombre AS branch_name, branch.codigo AS branch_code,
                   config.configuracion_public_id, config.snapshot_comercial,
                   config.uso_visual, reservation.reserva_public_id,
                   reservation.estado AS reservation_state,
                   reservation.expires_at, reservation.released_at
            FROM core.online_borradores_opticos draft
            JOIN core.sucursales branch ON branch.sucursal_id = draft.sucursal_id
            JOIN core.online_configuraciones_opticas_borrador config
              ON config.borrador_id = draft.borrador_id
            JOIN core.online_reservas_opticas_borrador reservation
              ON reservation.borrador_id = draft.borrador_id
            WHERE draft.borrador_id = %s
            """,
            (draft_id,),
        )
        row = cur.fetchone()
        snapshot = row["snapshot_comercial"]
        return _safe({
            "schemaVersion": OPTICAL_DRAFT_SCHEMA_VERSION,
            "draftPublicId": row["borrador_public_id"],
            "configurationPublicId": row["configuracion_public_id"],
            "reservationPublicId": row["reserva_public_id"],
            "status": row["estado"],
            "paymentStatus": row["estado_pago"],
            "prescriptionMethod": row["prescription_method"],
            "prescriptionStatus": row["prescription_status"],
            "intendedUse": row["uso_visual"],
            "branch": {"code": row["branch_code"], "name": row["branch_name"]},
            "configuration": snapshot,
            "currency": row["moneda"].strip(),
            "configuredTotal": row["total_configurado_snapshot"],
            "previewFingerprint": row["preview_fingerprint"],
            "reservation": {
                "status": row["reservation_state"],
                "expiresAt": row["expires_at"],
                "releasedAt": row["released_at"],
                "reservedFrameQuantity": 1 if row["reservation_state"] == "activa" else 0,
            },
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "paymentCreated": False,
            "saleCreated": False,
        })

    def create(self, owner: CommerceOwner, data: CreateOpticalDraftRequest, key: str) -> dict[str, Any]:
        request_payload = data.model_dump(mode="json")
        with self._connection() as conn:
            with conn.cursor() as cur:
                release_expired_optical_reservations(cur)
                idem_id, cached = self._idempotency_begin(cur, owner, "optical_draft_create", key, request_payload)
                if cached is not None:
                    conn.commit()
                    return cached

                preview_request = OpticalPreviewRequest(
                    frameProductId=data.frameProductId,
                    lensDesignProductId=data.lensDesignProductId,
                    treatmentProductId=data.treatmentProductId,
                    treatmentVariantId=data.treatmentVariantId,
                )
                try:
                    preview = self.preview_repository.preview_in_transaction(cur, preview_request, lock_catalog=True)
                except HTTPException as exc:
                    raise OpticalDraftRuleError(exc.status_code, "OPTICAL_CONFIGURATION_INVALID", str(exc.detail)) from exc
                if not hmac.compare_digest(preview.previewFingerprint, data.previewFingerprint):
                    raise OpticalDraftRuleError(
                        409, "OPTICAL_PREVIEW_STALE", "The optical preview changed. Review the current authoritative price before continuing.",
                        {"currentPreview": preview.model_dump(mode="json")},
                    )

                cur.execute(
                    "SELECT sucursal_id, nombre, codigo FROM core.sucursales WHERE sucursal_id = %s AND activa = TRUE",
                    (data.branchId,),
                )
                branch = cur.fetchone()
                if not branch:
                    raise OpticalDraftRuleError(404, "BRANCH_NOT_FOUND", "Selected branch is not active.")
                cur.execute(
                    """
                    SELECT stock, stock_reservado, disponible_venta
                    FROM core.catalogo_inventario_sucursal
                    WHERE producto_id = %s AND sucursal_id = %s
                    FOR UPDATE
                    """,
                    (data.frameProductId, data.branchId),
                )
                inventory = cur.fetchone()
                available = int(inventory["stock"] - inventory["stock_reservado"]) if inventory and inventory["disponible_venta"] else 0
                if available < 1:
                    raise OpticalDraftRuleError(409, "FRAME_OUT_OF_STOCK", "The frame is not available at the selected branch.")
                cur.execute(
                    "SELECT activa, vigencia_minutos FROM core.online_reserva_configuracion WHERE configuracion_id = 1 FOR SHARE"
                )
                reservation_config = cur.fetchone()
                if not reservation_config or not reservation_config["activa"]:
                    raise OpticalDraftRuleError(503, "OPTICAL_RESERVATIONS_DISABLED", "Temporary frame reservations are disabled.")

                design_row = self.preview_repository._product(cur, data.lensDesignProductId)
                treatment_row = self.preview_repository._product(cur, data.treatmentProductId) if data.treatmentProductId else None
                captured_at = datetime.now(timezone.utc)
                snapshot = {
                    "schemaVersion": OPTICAL_PREVIEW_SCHEMA_VERSION,
                    "capturedAt": captured_at.isoformat(),
                    "frame": preview.frame.model_dump(mode="json"),
                    "lensDesign": preview.lensDesign.model_dump(mode="json"),
                    "treatment": preview.treatment.model_dump(mode="json") if preview.treatment else None,
                    "variant": preview.variant.model_dump(mode="json") if preview.variant else None,
                    "currency": preview.currency,
                    "configuredTotal": preview.configuredTotal,
                    "previewFingerprint": preview.previewFingerprint,
                }
                config_hash = _hash({
                    "snapshot": snapshot, "branchId": data.branchId,
                    "prescriptionMethod": data.prescriptionMethod,
                    "intendedUse": data.intendedUse,
                })
                cur.execute(
                    """
                    INSERT INTO core.online_borradores_opticos
                        (propietario_tipo, propietario_ref_hash, estado,
                         prescription_method, prescription_status, estado_pago,
                         sucursal_id, moneda, total_configurado_snapshot,
                         preview_fingerprint, preview_schema_version)
                    VALUES (%s, %s, 'pendiente_receta', %s, 'pending', 'sin_pago',
                            %s, %s, %s, %s, %s)
                    RETURNING borrador_id
                    """,
                    (owner.db_type, owner.owner_hash, data.prescriptionMethod, data.branchId,
                     preview.currency, Decimal(preview.configuredTotal), preview.previewFingerprint,
                     OPTICAL_PREVIEW_SCHEMA_VERSION),
                )
                draft_id = int(cur.fetchone()["borrador_id"])
                cur.execute(
                    """
                    INSERT INTO core.online_configuraciones_opticas_borrador
                        (borrador_id, armazon_producto_id, diseno_producto_id,
                         tratamiento_producto_id, variante_id, uso_visual,
                         comportamiento_abasto_diseno_snapshot,
                         comportamiento_abasto_tratamiento_snapshot,
                         configuracion_hash, snapshot_comercial)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                    RETURNING configuracion_id
                    """,
                    (draft_id, data.frameProductId, data.lensDesignProductId,
                     data.treatmentProductId, data.treatmentVariantId, data.intendedUse,
                     design_row["comportamiento_abasto_default"],
                     treatment_row["comportamiento_abasto_default"] if treatment_row else None,
                     config_hash, _canonical(snapshot)),
                )
                configuration_id = int(cur.fetchone()["configuracion_id"])
                cur.execute(
                    """
                    INSERT INTO core.online_reservas_opticas_borrador
                        (borrador_id, configuracion_id, armazon_producto_id,
                         sucursal_id, cantidad, configuracion_hash,
                         sku_snapshot, nombre_snapshot, expires_at)
                    VALUES (%s, %s, %s, %s, 1, %s, %s, %s,
                            NOW() + make_interval(mins => %s))
                    RETURNING reserva_id
                    """,
                    (draft_id, configuration_id, data.frameProductId, data.branchId,
                     config_hash, preview.frame.sku, preview.frame.name,
                     int(reservation_config["vigencia_minutos"])),
                )
                reservation_id = int(cur.fetchone()["reserva_id"])
                cur.execute(
                    """
                    UPDATE core.catalogo_inventario_sucursal
                    SET stock_reservado = stock_reservado + 1,
                        version = version + 1, updated_at = NOW()
                    WHERE producto_id = %s AND sucursal_id = %s
                      AND disponible_venta = TRUE
                      AND stock - stock_reservado >= 1
                    """,
                    (data.frameProductId, data.branchId),
                )
                if cur.rowcount != 1:
                    raise OpticalDraftRuleError(409, "FRAME_OUT_OF_STOCK", "The frame is no longer available at the selected branch.")
                _event(cur, draft_id=draft_id, reservation_id=reservation_id,
                       event_type="draft_created", actor_type=owner.db_type,
                       owner_hash=owner.owner_hash, metadata={"prescriptionMethod": data.prescriptionMethod})
                _event(cur, draft_id=draft_id, reservation_id=reservation_id,
                       event_type="reservation_created", actor_type=owner.db_type,
                       owner_hash=owner.owner_hash, metadata={"reservedFrameQuantity": 1})
                result = self._draft_payload(cur, draft_id)
                self._idempotency_finish(cur, idem_id, result, draft_id)
            conn.commit()
        return result

    def get(self, owner: CommerceOwner, public_id: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                release_expired_optical_reservations(cur)
                cur.execute(
                    """
                    SELECT borrador_id FROM core.online_borradores_opticos
                    WHERE borrador_public_id = %s AND propietario_tipo = %s
                      AND propietario_ref_hash = %s
                    """,
                    (public_id, owner.db_type, owner.owner_hash),
                )
                row = cur.fetchone()
                if not row:
                    raise OpticalDraftRuleError(404, "OPTICAL_DRAFT_NOT_FOUND", "Optical draft was not found.")
                result = self._draft_payload(cur, int(row["borrador_id"]))
            conn.commit()
        return result

    def cancel(self, owner: CommerceOwner, public_id: str, key: str) -> dict[str, Any]:
        payload = {"draftPublicId": public_id}
        with self._connection() as conn:
            with conn.cursor() as cur:
                release_expired_optical_reservations(cur)
                idem_id, cached = self._idempotency_begin(cur, owner, "optical_draft_cancel", key, payload)
                if cached is not None:
                    conn.commit()
                    return cached
                cur.execute(
                    """
                    SELECT draft.borrador_id, draft.estado, reservation.reserva_id,
                           reservation.estado AS reservation_state,
                           reservation.armazon_producto_id, reservation.sucursal_id
                    FROM core.online_borradores_opticos draft
                    JOIN core.online_reservas_opticas_borrador reservation
                      ON reservation.borrador_id = draft.borrador_id
                    WHERE draft.borrador_public_id = %s
                      AND draft.propietario_tipo = %s
                      AND draft.propietario_ref_hash = %s
                    FOR UPDATE OF draft, reservation
                    """,
                    (public_id, owner.db_type, owner.owner_hash),
                )
                row = cur.fetchone()
                if not row:
                    raise OpticalDraftRuleError(404, "OPTICAL_DRAFT_NOT_FOUND", "Optical draft was not found.")
                if row["reservation_state"] == "activa":
                    cur.execute(
                        """
                        SELECT stock_reservado FROM core.catalogo_inventario_sucursal
                        WHERE producto_id = %s AND sucursal_id = %s FOR UPDATE
                        """,
                        (row["armazon_producto_id"], row["sucursal_id"]),
                    )
                    inventory = cur.fetchone()
                    if not inventory or int(inventory["stock_reservado"]) < 1:
                        raise OpticalDraftRuleError(409, "OPTICAL_RESERVATION_INTEGRITY_ERROR", "Frame hold could not be released safely.")
                    cur.execute(
                        """
                        UPDATE core.catalogo_inventario_sucursal
                        SET stock_reservado = stock_reservado - 1,
                            version = version + 1, updated_at = NOW()
                        WHERE producto_id = %s AND sucursal_id = %s
                          AND stock_reservado >= 1
                        """,
                        (row["armazon_producto_id"], row["sucursal_id"]),
                    )
                    if cur.rowcount != 1:
                        raise OpticalDraftRuleError(409, "OPTICAL_RESERVATION_INTEGRITY_ERROR", "Frame hold could not be released safely.")
                    cur.execute(
                        """
                        UPDATE core.online_reservas_opticas_borrador
                        SET estado = 'cancelada', released_at = NOW(), updated_at = NOW()
                        WHERE reserva_id = %s AND estado = 'activa'
                        """,
                        (row["reserva_id"],),
                    )
                if row["estado"] not in TERMINAL_STATES:
                    cur.execute(
                        """
                        UPDATE core.online_borradores_opticos
                        SET estado = 'cancelado', cancelado_at = NOW(), updated_at = NOW()
                        WHERE borrador_id = %s
                        """,
                        (row["borrador_id"],),
                    )
                    _event(cur, draft_id=int(row["borrador_id"]), reservation_id=int(row["reserva_id"]),
                           event_type="draft_cancelled", actor_type=owner.db_type,
                           owner_hash=owner.owner_hash, metadata={"releasedFrameQuantity": 1 if row["reservation_state"] == "activa" else 0})
                result = self._draft_payload(cur, int(row["borrador_id"]))
                self._idempotency_finish(cur, idem_id, result, int(row["borrador_id"]))
            conn.commit()
        return result


def create_online_optical_drafts_router(
    db_conninfo: str,
    *,
    config: OpticalDraftConfig | None = None,
    repository: OpticalDraftRepository | None = None,
) -> APIRouter:
    config = config or OpticalDraftConfig.from_env(db_conninfo)
    if repository is None:
        preview_config = PublicCatalogConfig.from_env(db_conninfo)
        repository = OpticalDraftRepository(config, OpticalPreviewRepository(preview_config))
    router = APIRouter(prefix="/storefront/optical/v1/drafts", tags=["Optical drafts"])
    bearer = HTTPBearer(auto_error=False)

    def require_access(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> None:
        if not config.enabled:
            raise HTTPException(status_code=503, detail="Optical drafts are disabled.")
        if not config.bearer_token:
            raise HTTPException(status_code=503, detail="Optical drafts are not configured.")
        if not catalog_credentials_valid(credentials, config.bearer_token):
            raise HTTPException(status_code=401, detail="Invalid optical draft credentials.", headers={"WWW-Authenticate": "Bearer"})

    def owner(owner_type: str = Header(alias="X-OLM-Owner-Type"), owner_hash: str = Header(alias="X-OLM-Owner-Hash")) -> CommerceOwner:
        normalized_type, normalized_hash = owner_type.strip().lower(), owner_hash.strip().lower()
        if normalized_type not in {"guest", "customer"} or not _valid_owner_hash(normalized_hash):
            raise HTTPException(status_code=400, detail="Commerce owner is invalid.")
        return CommerceOwner(normalized_type, normalized_hash)  # type: ignore[arg-type]

    def run(action: Callable[[], dict[str, Any]]) -> dict[str, Any]:
        try:
            return action()
        except OpticalDraftRuleError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        except psycopg.Error as exc:
            raise HTTPException(status_code=503, detail="Optical drafts are temporarily unavailable.") from exc

    dependencies = [Depends(require_access)]

    @router.post("", dependencies=dependencies)
    def create_draft(data: CreateOpticalDraftRequest, commerce_owner: CommerceOwner = Depends(owner), idempotency_key: str = Header(alias="Idempotency-Key")):
        return run(lambda: repository.create(commerce_owner, data, idempotency_key))

    @router.get("/{draft_public_id}", dependencies=dependencies)
    def get_draft(draft_public_id: str, commerce_owner: CommerceOwner = Depends(owner)):
        return run(lambda: repository.get(commerce_owner, draft_public_id))

    @router.post("/{draft_public_id}/cancel", dependencies=dependencies)
    def cancel_draft(draft_public_id: str, commerce_owner: CommerceOwner = Depends(owner), idempotency_key: str = Header(alias="Idempotency-Key")):
        return run(lambda: repository.cancel(commerce_owner, draft_public_id, idempotency_key))

    return router
