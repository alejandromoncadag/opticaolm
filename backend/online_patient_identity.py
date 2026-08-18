"""Phase 1G-E verified-account patient linking and saved-prescription access.

Only server-to-server callers may use the storefront router. Public responses
contain no patient IDs, clinical values, owner hashes, or matching details.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
import hashlib
import hmac
import json
import os
import re
import unicodedata
from typing import Any, Callable

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field
import psycopg
from psycopg.rows import dict_row

from online_commerce import _valid_owner_hash
from public_catalog import catalog_credentials_valid


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    return default if value is None else value.strip().lower() in {"1", "true", "yes", "on"}


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 12 and digits.startswith("52"):
        digits = digits[2:]
    if len(digits) == 13 and digits.startswith("521"):
        digits = digits[3:]
    return digits


def _name_tokens(value: str) -> list[str]:
    plain = unicodedata.normalize("NFKD", value)
    plain = "".join(char for char in plain if not unicodedata.combining(char)).lower()
    return [token for token in re.findall(r"[a-z0-9]+", plain) if len(token) > 1]


def _compatible_name(full_name: str, patient: dict[str, Any]) -> bool:
    supplied = _name_tokens(full_name)
    given = _name_tokens(" ".join(filter(None, [patient.get("primer_nombre"), patient.get("segundo_nombre")])))
    surnames = _name_tokens(" ".join(filter(None, [patient.get("apellido_paterno"), patient.get("apellido_materno")])))
    if not supplied or not given or not surnames:
        return False
    return supplied[0] == given[0] and bool(set(supplied[1:]) & set(surnames))


class IdentityRuleError(RuntimeError):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.detail = {"code": code, "message": message}


class CandidateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    phone: str = Field(min_length=7, max_length=40)
    fullName: str = Field(min_length=2, max_length=160)
    emailVerifiedAt: datetime


class ConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    linkAttemptId: str = Field(min_length=30, max_length=50)


class PrescriptionSelectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prescriptionRef: str = Field(min_length=30, max_length=50)


UPLOAD_MAX_BYTES = 10 * 1024 * 1024
UPLOAD_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


def _validate_prescription_upload(content_type: str, filename: str, content: bytes) -> tuple[str, str]:
    mime = content_type.strip().lower().split(";", 1)[0]
    if mime not in UPLOAD_TYPES:
        raise IdentityRuleError(415, "PRESCRIPTION_FILE_TYPE_INVALID", "Solo se aceptan archivos PDF, JPG, PNG o WEBP.")
    if not content or len(content) > UPLOAD_MAX_BYTES:
        raise IdentityRuleError(413, "PRESCRIPTION_FILE_TOO_LARGE", "La receta debe pesar 10 MB o menos.")
    filename = (filename or "receta").replace("\\", "/").rsplit("/", 1)[-1].strip()[:255] or "receta"
    signatures = {
        "application/pdf": content.startswith(b"%PDF-"),
        "image/jpeg": content.startswith(bytes((0xFF, 0xD8, 0xFF))),
        "image/png": content.startswith(bytes((0x89,)) + b"PNG\r\n\x1a\n"),
        "image/webp": len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP",
    }
    if not signatures[mime]:
        raise IdentityRuleError(415, "PRESCRIPTION_FILE_SIGNATURE_INVALID", "El contenido del archivo no coincide con su formato.")
    return mime, filename


class PrescriptionApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prescripcionId: int = Field(gt=0)
    validaHasta: date | None = None


class PrescriptionRevokeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    motivo: str = Field(min_length=3, max_length=1000)


@dataclass(frozen=True)
class IdentityConfig:
    db_conninfo: str
    bearer_token: str
    enabled: bool

    @classmethod
    def from_env(cls, db_conninfo: str) -> "IdentityConfig":
        return cls(
            db_conninfo,
            os.getenv("ONLINE_IDENTITY_BEARER_TOKEN", "").strip(),
            _env_bool("PHASE_1GE_ENABLED", False),
        )


class IdentityRepository:
    def __init__(self, config: IdentityConfig, connect: Callable[..., Any] = psycopg.connect):
        self.config = config
        self.connect = connect

    def _connection(self):
        return self.connect(self.config.db_conninfo, row_factory=dict_row)

    @staticmethod
    def _event(cur, event_type: str, account_hash: str | None, **values: Any) -> None:
        cur.execute(
            """INSERT INTO core.online_identidad_eventos
               (evento_tipo, actor_tipo, cuenta_ref_hash, link_id, intento_id,
                borrador_id, acceso_id, actor_usuario_id, metadata)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)""",
            (event_type, values.get("actor_type", "cliente"), account_hash,
             values.get("link_id"), values.get("attempt_id"), values.get("draft_id"),
             values.get("access_id"), values.get("actor_user_id"),
             _canonical(values.get("metadata") or {})),
        )

    @staticmethod
    def _active_link(cur, account_hash: str, *, lock: bool = False):
        cur.execute(
            """SELECT * FROM core.online_cliente_paciente_links
               WHERE cuenta_ref_hash=%s AND estado='activo'
               ORDER BY link_id DESC LIMIT 1""" + (" FOR UPDATE" if lock else ""),
            (account_hash,),
        )
        return cur.fetchone()

    @staticmethod
    def _idempotency(cur, account_hash: str, scope: str, key: str, payload: dict[str, Any]):
        clean = key.strip()
        if not clean or len(clean) > 200:
            raise IdentityRuleError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.")
        key_hash, request_hash = _sha(clean), _sha(_canonical(payload))
        cur.execute(
            """INSERT INTO core.online_idempotencia
               (alcance, clave_hash, propietario_ref_hash, solicitud_hash, expira_at)
               VALUES (%s,%s,%s,%s,NOW()+INTERVAL '24 hours')
               ON CONFLICT (alcance, clave_hash) DO NOTHING RETURNING idempotencia_id""",
            (scope, key_hash, account_hash, request_hash),
        )
        inserted = cur.fetchone()
        if inserted:
            return int(inserted["idempotencia_id"]), None
        cur.execute("SELECT * FROM core.online_idempotencia WHERE alcance=%s AND clave_hash=%s FOR UPDATE", (scope, key_hash))
        existing = cur.fetchone()
        if not existing or not hmac.compare_digest(str(existing["propietario_ref_hash"]), account_hash) or existing["solicitud_hash"] != request_hash:
            raise IdentityRuleError(409, "IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used differently.")
        if existing["estado"] == "completado" and existing["respuesta"] is not None:
            return None, existing["respuesta"]
        raise IdentityRuleError(409, "REQUEST_IN_PROGRESS", "The same request is already being processed.")

    @staticmethod
    def _finish(cur, idem_id: int | None, result: dict[str, Any], resource_id: int | None = None):
        if idem_id is not None:
            cur.execute(
                """UPDATE core.online_idempotencia SET estado='completado', recurso_id=%s,
                   codigo_respuesta=200, respuesta=%s::jsonb, updated_at=NOW()
                   WHERE idempotencia_id=%s""",
                (resource_id, _canonical(result), idem_id),
            )

    def current(self, account_hash: str) -> dict[str, Any]:
        with self._connection() as conn, conn.cursor() as cur:
            link = self._active_link(cur, account_hash)
            return {"schemaVersion": "1.0", "status": "linked" if link else "not_linked"}

    def candidate_check(self, account_hash: str, data: CandidateRequest) -> dict[str, Any]:
        email, phone = _normalize_email(data.email), _normalize_phone(data.phone)
        if (data.emailVerifiedAt.tzinfo is None or data.emailVerifiedAt > datetime.now(timezone.utc)
                or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(phone) != 10):
            raise IdentityRuleError(400, "IDENTITY_INPUT_INVALID", "Verified email and a valid phone are required.")
        with self._connection() as conn:
            with conn.cursor() as cur:
                if self._active_link(cur, account_hash):
                    return {"schemaVersion": "1.0", "status": "already_linked"}
                cur.execute(
                    """SELECT COUNT(*) AS count
                       FROM core.online_cliente_paciente_link_intentos
                       WHERE cuenta_ref_hash=%s AND created_at>NOW()-INTERVAL '1 hour'""",
                    (account_hash,),
                )
                if int(cur.fetchone()["count"]) >= 10:
                    raise IdentityRuleError(429, "MATCH_RATE_LIMITED", "Try the patient-link check again later.")
                cur.execute(
                    """SELECT paciente_id, primer_nombre, segundo_nombre,
                              apellido_paterno, apellido_materno, telefono, correo
                       FROM core.pacientes
                       WHERE activo=TRUE AND (
                         LOWER(BTRIM(COALESCE(correo,'')))=%s
                         OR RIGHT(REGEXP_REPLACE(COALESCE(telefono,''),'\\D','','g'),10)=%s
                       ) LIMIT 25""",
                    (email, phone),
                )
                candidates = cur.fetchall()
                exact = [row for row in candidates if _normalize_email(row["correo"] or "") == email
                         and _normalize_phone(row["telefono"] or "") == phone
                         and _compatible_name(data.fullName, row)]
                if len(candidates) == 1 and len(exact) == 1:
                    result, patient_id, public_status = "coincidencia_exacta", exact[0]["paciente_id"], "match_available"
                elif not candidates:
                    result, patient_id, public_status = "sin_coincidencia", None, "no_match"
                else:
                    result, patient_id, public_status = "revision_manual", None, "manual_review"
                cur.execute(
                    """INSERT INTO core.online_cliente_paciente_link_intentos
                       (cuenta_ref_hash,correo_hash,telefono_hash,nombre_hash,
                        paciente_candidato_id,resultado)
                       VALUES (%s,%s,%s,%s,%s,%s) RETURNING intento_id,intento_public_id""",
                    (account_hash, _sha(email), _sha(phone), _sha(" ".join(_name_tokens(data.fullName))), patient_id, result),
                )
                attempt = cur.fetchone()
                self._event(cur, "patient_match_checked", account_hash, attempt_id=attempt["intento_id"], metadata={"result": result})
                response = {"schemaVersion": "1.0", "status": public_status}
                if public_status == "match_available":
                    response["linkAttemptId"] = str(attempt["intento_public_id"])
            conn.commit()
        return response

    def confirm(self, account_hash: str, data: ConfirmRequest, key: str) -> dict[str, Any]:
        payload = data.model_dump(mode="json")
        with self._connection() as conn:
            with conn.cursor() as cur:
                idem_id, cached = self._idempotency(cur, account_hash, "patient_link_confirm", key, payload)
                if cached is not None:
                    conn.commit(); return cached
                existing = self._active_link(cur, account_hash, lock=True)
                if existing:
                    result = {"schemaVersion": "1.0", "status": "linked"}
                    self._finish(cur, idem_id, result, int(existing["link_id"])); conn.commit(); return result
                cur.execute(
                    """SELECT * FROM core.online_cliente_paciente_link_intentos
                       WHERE intento_public_id=%s AND cuenta_ref_hash=%s FOR UPDATE""",
                    (data.linkAttemptId, account_hash),
                )
                attempt = cur.fetchone()
                if not attempt or attempt["estado"] != "pendiente" or attempt["resultado"] != "coincidencia_exacta" or attempt["expires_at"] <= datetime.now(timezone.utc):
                    raise IdentityRuleError(409, "LINK_ATTEMPT_INVALID", "The link confirmation is no longer available.")
                cur.execute("SELECT link_id FROM core.online_cliente_paciente_links WHERE paciente_id=%s AND estado='activo' FOR UPDATE", (attempt["paciente_candidato_id"],))
                if cur.fetchone():
                    raise IdentityRuleError(409, "MANUAL_REVIEW_REQUIRED", "This request requires manual review.")
                cur.execute(
                    """INSERT INTO core.online_cliente_paciente_links
                       (cuenta_ref_hash,paciente_id,correo_verificado_hash,
                        telefono_verificado_hash,intento_id)
                       VALUES (%s,%s,%s,%s,%s) RETURNING link_id""",
                    (account_hash, attempt["paciente_candidato_id"], attempt["correo_hash"], attempt["telefono_hash"], attempt["intento_id"]),
                )
                link_id = int(cur.fetchone()["link_id"])
                cur.execute("UPDATE core.online_cliente_paciente_link_intentos SET estado='confirmado', confirmado_at=NOW() WHERE intento_id=%s", (attempt["intento_id"],))
                self._event(cur, "patient_link_confirmed", account_hash, link_id=link_id, attempt_id=attempt["intento_id"])
                result = {"schemaVersion": "1.0", "status": "linked"}
                self._finish(cur, idem_id, result, link_id)
            conn.commit()
        return result

    def revoke(self, account_hash: str, key: str) -> dict[str, Any]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                idem_id, cached = self._idempotency(cur, account_hash, "patient_link_revoke", key, {})
                if cached is not None: conn.commit(); return cached
                link = self._active_link(cur, account_hash, lock=True)
                if link:
                    cur.execute("UPDATE core.online_cliente_paciente_links SET estado='revocado',revocado_at=NOW(),updated_at=NOW() WHERE link_id=%s", (link["link_id"],))
                    self._event(cur, "patient_link_revoked", account_hash, link_id=link["link_id"])
                result = {"schemaVersion": "1.0", "status": "not_linked"}
                self._finish(cur, idem_id, result, int(link["link_id"]) if link else None)
            conn.commit()
        return result

    def prescriptions(self, account_hash: str) -> dict[str, Any]:
        with self._connection() as conn, conn.cursor() as cur:
            link = self._active_link(cur, account_hash)
            if not link:
                return {"schemaVersion": "1.0", "linkStatus": "not_linked", "prescriptions": []}
            cur.execute(
                """SELECT access.acceso_public_id, prescription.fecha_prescripcion,
                          access.valida_hasta
                   FROM core.prescripcion_optica_acceso_online access
                   JOIN core.prescripciones_opticas prescription
                     ON prescription.prescripcion_id=access.prescripcion_id
                   WHERE access.paciente_id=%s AND prescription.paciente_id=%s
                     AND prescription.paciente_id=access.paciente_id
                     AND access.estado='aprobada' AND prescription.activo=TRUE
                     AND access.valida_desde<=CURRENT_DATE
                     AND (access.valida_hasta IS NULL OR access.valida_hasta>=CURRENT_DATE)
                   ORDER BY prescription.fecha_prescripcion DESC NULLS LAST, access.acceso_id DESC""",
                (link["paciente_id"], link["paciente_id"]),
            )
            items = [{"prescriptionRef": str(row["acceso_public_id"]),
                      "date": row["fecha_prescripcion"].isoformat() if row["fecha_prescripcion"] else None,
                      "validUntil": row["valida_hasta"].isoformat() if row["valida_hasta"] else None,
                      "label": "Receta óptica aprobada"} for row in cur.fetchall()]
            return {"schemaVersion": "1.0", "linkStatus": "linked", "prescriptions": items}

    def select_prescription(self, account_hash: str, draft_public_id: str, data: PrescriptionSelectionRequest, key: str) -> dict[str, Any]:
        payload = {"draftPublicId": draft_public_id, **data.model_dump(mode="json")}
        with self._connection() as conn:
            with conn.cursor() as cur:
                idem_id, cached = self._idempotency(cur, account_hash, "optical_saved_prescription", key, payload)
                if cached is not None: conn.commit(); return cached
                link = self._active_link(cur, account_hash, lock=True)
                if not link:
                    raise IdentityRuleError(409, "PATIENT_LINK_REQUIRED", "A verified patient link is required.")
                cur.execute(
                    """SELECT draft.borrador_id,draft.estado,draft.estado_pago,config.uso_visual,
                              design.sku AS design_sku
                       FROM core.online_borradores_opticos draft
                       JOIN core.online_configuraciones_opticas_borrador config USING (borrador_id)
                       JOIN core.catalogo_productos design
                         ON design.producto_id=config.diseno_producto_id
                       WHERE draft.borrador_public_id=%s AND draft.propietario_tipo='cliente'
                         AND draft.propietario_ref_hash=%s FOR UPDATE OF draft""",
                    (draft_public_id, account_hash),
                )
                draft = cur.fetchone()
                if not draft:
                    raise IdentityRuleError(404, "OPTICAL_DRAFT_NOT_FOUND", "Optical draft was not found.")
                cur.execute(
                    """SELECT trabajo_id,estado_produccion,estado_pago AS job_payment
                       FROM core.trabajos_opticos WHERE online_borrador_id=%s FOR UPDATE""",
                    (draft["borrador_id"],),
                )
                job = cur.fetchone()
                if draft["estado"] in {"cancelado", "expirado"} or (job and job["estado_produccion"] in {"cancelado", "entregado"}):
                    raise IdentityRuleError(409, "OPTICAL_DRAFT_INACTIVE", "This optical draft can no longer be updated.")
                if draft["uso_visual"] == "sin_graduacion":
                    raise IdentityRuleError(409, "PRESCRIPTION_NOT_REQUIRED", "This configuration does not require a prescription.")
                cur.execute(
                    """SELECT access.*, prescription.fecha_prescripcion,
                              prescription.od_esfera,prescription.od_cilindro,
                              prescription.od_adicion,prescription.oi_esfera,
                              prescription.oi_cilindro,prescription.oi_adicion
                       FROM core.prescripcion_optica_acceso_online access
                       JOIN core.prescripciones_opticas prescription
                         ON prescription.prescripcion_id=access.prescripcion_id
                       WHERE access.acceso_public_id=%s AND access.paciente_id=%s
                         AND prescription.paciente_id=%s AND access.estado='aprobada'
                         AND prescription.activo=TRUE AND access.valida_desde<=CURRENT_DATE
                         AND (access.valida_hasta IS NULL OR access.valida_hasta>=CURRENT_DATE)
                       FOR UPDATE OF access""",
                    (data.prescriptionRef, link["paciente_id"], link["paciente_id"]),
                )
                access = cur.fetchone()
                if not access:
                    raise IdentityRuleError(409, "PRESCRIPTION_NOT_AVAILABLE", "The selected prescription is not available.")
                has_power = any(access[field] not in {None, ""} for field in ("od_esfera", "od_cilindro", "oi_esfera", "oi_cilindro"))
                needs_addition = str(draft["design_sku"]).upper() in {"DEMO-LENS-BIFO", "DEMO-LENS-PROG"}
                has_addition = any(access[field] not in {None, ""} for field in ("od_adicion", "oi_adicion"))
                if not has_power or (needs_addition and not has_addition):
                    raise IdentityRuleError(409, "PRESCRIPTION_INCOMPATIBLE", "The selected prescription is not compatible with this lens design.")
                cur.execute(
                    """INSERT INTO core.online_borrador_optico_prescripciones
                       (borrador_id,link_id,acceso_id,prescripcion_id,fecha_prescripcion_snapshot)
                       VALUES (%s,%s,%s,%s,%s)
                       ON CONFLICT (borrador_id) DO UPDATE SET link_id=EXCLUDED.link_id,
                         acceso_id=EXCLUDED.acceso_id,prescripcion_id=EXCLUDED.prescripcion_id,
                         fecha_prescripcion_snapshot=EXCLUDED.fecha_prescripcion_snapshot,
                         updated_at=NOW()""",
                    (draft["borrador_id"], link["link_id"], access["acceso_id"], access["prescripcion_id"], access["fecha_prescripcion"]),
                )
                cur.execute("UPDATE core.online_borradores_opticos SET prescription_status='provided',estado='listo_para_pago',updated_at=NOW() WHERE borrador_id=%s", (draft["borrador_id"],))
                if job:
                    cur.execute("UPDATE core.trabajos_opticos SET estado_receta='proporcionada',metodo_receta='guardada',version=version+1,updated_at=NOW() WHERE trabajo_id=%s", (job["trabajo_id"],))
                self._event(cur, "saved_prescription_selected", account_hash, link_id=link["link_id"], draft_id=draft["borrador_id"], access_id=access["acceso_id"])
                result = {"schemaVersion": "1.0", "draftPublicId": draft_public_id,
                          "prescriptionStatus": "provided", "draftStatus": "listo_para_pago",
                          "paymentStatus": draft["estado_pago"], "productionReady": False,
                          "paymentRequired": True}
                self._finish(cur, idem_id, result, int(draft["borrador_id"]))
            conn.commit()
        return result

    def upload_prescription(self, account_hash: str, draft_public_id: str, content_type: str,
                            filename: str, content: bytes, key: str) -> dict[str, Any]:
        mime, safe_filename = _validate_prescription_upload(content_type, filename, content)
        payload = {"draftPublicId": draft_public_id, "mimeType": mime,
                   "filename": safe_filename, "contentSha256": _sha(content.hex())}
        with self._connection() as conn:
            with conn.cursor() as cur:
                idem_id, cached = self._idempotency(cur, account_hash, "optical_prescription_upload", key, payload)
                if cached is not None:
                    conn.commit(); return cached
                cur.execute(
                    """SELECT draft.borrador_id,draft.estado,draft.prescription_status,
                              config.uso_visual
                       FROM core.online_borradores_opticos draft
                       JOIN core.online_configuraciones_opticas_borrador config USING (borrador_id)
                       WHERE draft.borrador_public_id=%s AND draft.propietario_tipo='cliente'
                         AND draft.propietario_ref_hash=%s FOR UPDATE OF draft""",
                    (draft_public_id, account_hash),
                )
                draft = cur.fetchone()
                if not draft:
                    raise IdentityRuleError(404, "OPTICAL_DRAFT_NOT_FOUND", "Optical draft was not found.")
                if draft["estado"] in {"cancelado", "expirado"}:
                    raise IdentityRuleError(409, "OPTICAL_DRAFT_INACTIVE", "Este pedido óptico ya no está disponible.")
                if draft["uso_visual"] == "sin_graduacion":
                    raise IdentityRuleError(409, "PRESCRIPTION_NOT_REQUIRED", "Esta configuración no requiere receta.")
                cur.execute(
                    """INSERT INTO core.online_borrador_optico_receta_archivos
                       (borrador_id,cuenta_ref_hash,nombre_original,mime_type,tamano_bytes,contenido)
                       VALUES (%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (borrador_id) DO UPDATE SET
                         cuenta_ref_hash=EXCLUDED.cuenta_ref_hash,
                         nombre_original=EXCLUDED.nombre_original,
                         mime_type=EXCLUDED.mime_type,
                         tamano_bytes=EXCLUDED.tamano_bytes,
                         contenido=EXCLUDED.contenido,
                         estado='recibida_pendiente_validacion', updated_at=NOW()
                       RETURNING archivo_id""",
                    (draft["borrador_id"], account_hash, safe_filename, mime, len(content), content),
                )
                upload_id = int(cur.fetchone()["archivo_id"])
                cur.execute(
                    """UPDATE core.online_borradores_opticos
                       SET prescription_method='upload', prescription_status='received_pending_validation',
                           estado='pendiente_receta', updated_at=NOW()
                       WHERE borrador_id=%s""", (draft["borrador_id"],),
                )
                self._event(cur, "prescription_uploaded", account_hash, draft_id=draft["borrador_id"],
                            metadata={"mimeType": mime, "size": len(content)})
                result = {"schemaVersion": "1.0", "draftPublicId": draft_public_id,
                          "prescriptionStatus": "received_pending_validation",
                          "statusLabel": "Receta recibida, pendiente de validación"}
                self._finish(cur, idem_id, result, upload_id)
            conn.commit()
        return result

    def claim_drafts(self, account_hash: str, guest_hash: str, key: str, draft_public_id: str | None = None) -> dict[str, Any]:
        if not _valid_owner_hash(guest_hash) or hmac.compare_digest(account_hash, guest_hash):
            raise IdentityRuleError(400, "GUEST_OWNER_INVALID", "Guest ownership is invalid.")
        payload = {"guest": _sha(guest_hash), "draftPublicId": draft_public_id}
        with self._connection() as conn:
            with conn.cursor() as cur:
                idem_id, cached = self._idempotency(cur, account_hash, "optical_draft_claim", key, payload)
                if cached is not None: conn.commit(); return cached
                params: list[Any] = [guest_hash]
                clause = ""
                if draft_public_id:
                    clause = " AND borrador_public_id=%s"; params.append(draft_public_id)
                cur.execute(
                    """SELECT borrador_id,borrador_public_id FROM core.online_borradores_opticos
                       WHERE propietario_tipo='invitado' AND propietario_ref_hash=%s
                         AND estado NOT IN ('cancelado','expirado')""" + clause + " FOR UPDATE",
                    params,
                )
                drafts = cur.fetchall()
                for draft in drafts:
                    cur.execute("UPDATE core.online_borradores_opticos SET propietario_tipo='cliente',propietario_ref_hash=%s,updated_at=NOW() WHERE borrador_id=%s", (account_hash, draft["borrador_id"]))
                    self._event(cur, "optical_draft_claimed", account_hash, draft_id=draft["borrador_id"], metadata={"previousOwnerType": "invitado"})
                result = {"schemaVersion": "1.0", "claimed": len(drafts),
                          "draftPublicIds": [str(row["borrador_public_id"]) for row in drafts]}
                self._finish(cur, idem_id, result, int(drafts[0]["borrador_id"]) if drafts else None)
            conn.commit()
        return result


def create_online_identity_router(db_conninfo: str, *, config: IdentityConfig | None = None, repository: IdentityRepository | None = None) -> APIRouter:
    cfg = config or IdentityConfig.from_env(db_conninfo)
    repo = repository or IdentityRepository(cfg)
    router = APIRouter(prefix="/storefront/identity/v1", tags=["Storefront identity"])
    bearer = HTTPBearer(auto_error=False)

    def access(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if not cfg.enabled: raise HTTPException(503, "Storefront identity is disabled.")
        if not cfg.bearer_token: raise HTTPException(503, "Storefront identity is not configured.")
        if not catalog_credentials_valid(credentials, cfg.bearer_token):
            raise HTTPException(401, "Invalid storefront identity credentials.", headers={"WWW-Authenticate": "Bearer"})

    def account(account_hash: str = Header(alias="X-OLM-Account-Hash"), verified: str = Header(alias="X-OLM-Email-Verified")) -> str:
        value = account_hash.strip().lower()
        if not _valid_owner_hash(value) or verified.strip().lower() != "true":
            raise HTTPException(403, "A verified account is required.")
        return value

    def run(action):
        try: return action()
        except IdentityRuleError as exc: raise HTTPException(exc.status, exc.detail) from exc
        except psycopg.Error as exc: raise HTTPException(503, "Storefront identity is temporarily unavailable.") from exc

    deps = [Depends(access)]

    @router.get("/patient-links/current", dependencies=deps)
    def current(account_hash: str = Depends(account)): return run(lambda: repo.current(account_hash))

    @router.post("/patient-links/candidate-check", dependencies=deps)
    def check(data: CandidateRequest, account_hash: str = Depends(account)): return run(lambda: repo.candidate_check(account_hash, data))

    @router.post("/patient-links/confirm", dependencies=deps)
    def confirm(data: ConfirmRequest, account_hash: str = Depends(account), key: str = Header(alias="Idempotency-Key")): return run(lambda: repo.confirm(account_hash, data, key))

    @router.post("/patient-links/revoke", dependencies=deps)
    def revoke(account_hash: str = Depends(account), key: str = Header(alias="Idempotency-Key")): return run(lambda: repo.revoke(account_hash, key))

    @router.get("/prescriptions", dependencies=deps)
    def prescriptions(account_hash: str = Depends(account)): return run(lambda: repo.prescriptions(account_hash))

    @router.post("/optical-drafts/claim", dependencies=deps)
    def claim(account_hash: str = Depends(account), guest_hash: str = Header(alias="X-OLM-Guest-Owner-Hash"), key: str = Header(alias="Idempotency-Key")): return run(lambda: repo.claim_drafts(account_hash, guest_hash, key))

    @router.post("/optical-drafts/{draft_public_id}/claim", dependencies=deps)
    def claim_one(draft_public_id: str, account_hash: str = Depends(account), guest_hash: str = Header(alias="X-OLM-Guest-Owner-Hash"), key: str = Header(alias="Idempotency-Key")): return run(lambda: repo.claim_drafts(account_hash, guest_hash, key, draft_public_id))

    @router.post("/optical-drafts/{draft_public_id}/prescription", dependencies=deps)
    def select(draft_public_id: str, data: PrescriptionSelectionRequest, account_hash: str = Depends(account), key: str = Header(alias="Idempotency-Key")): return run(lambda: repo.select_prescription(account_hash, draft_public_id, data, key))

    @router.post("/optical-drafts/{draft_public_id}/prescription-upload", dependencies=deps)
    async def upload(draft_public_id: str, request: Request, account_hash: str = Depends(account),
                     key: str = Header(alias="Idempotency-Key")):
        content_length = request.headers.get("content-length")
        if content_length and (not content_length.isdigit() or int(content_length) > UPLOAD_MAX_BYTES):
            raise HTTPException(413, "La receta debe pesar 10 MB o menos.")
        chunks: list[bytes] = []
        total = 0
        async for chunk in request.stream():
            total += len(chunk)
            if total > UPLOAD_MAX_BYTES:
                raise HTTPException(413, "La receta debe pesar 10 MB o menos.")
            chunks.append(chunk)
        content = b"".join(chunks)
        return run(lambda: repo.upload_prescription(
            account_hash, draft_public_id, request.headers.get("content-type", ""),
            request.headers.get("x-filename", "receta"), content, key,
        ))

    return router


def create_prescription_access_admin_router(db_conninfo: str, get_current_user: Callable[..., dict[str, Any]]) -> APIRouter:
    router = APIRouter(prefix="/operaciones/optica/prescripciones-online", tags=["Online prescription access"])

    def admin(user: dict[str, Any] = Depends(get_current_user)):
        if not _env_bool("PHASE_1GE_ENABLED", False):
            raise HTTPException(503, "El acceso de recetas en línea está deshabilitado.")
        if user.get("rol") != "admin": raise HTTPException(403, "No tienes permisos para esta operación.")
        return user

    def actor(cur, user):
        cur.execute("SELECT usuario_id FROM core.usuarios WHERE username=%s AND activo=TRUE", (user["username"],))
        row = cur.fetchone()
        if not row: raise HTTPException(401, "Usuario interno no disponible.")
        return int(row[0])

    @router.post("")
    def approve(data: PrescriptionApprovalRequest, user=Depends(admin)):
        with psycopg.connect(db_conninfo) as conn, conn.cursor() as cur:
            user_id = actor(cur, user)
            cur.execute("SELECT paciente_id,activo FROM core.prescripciones_opticas WHERE prescripcion_id=%s FOR UPDATE", (data.prescripcionId,))
            prescription = cur.fetchone()
            if not prescription or not prescription[1]: raise HTTPException(404, "Prescripción activa no encontrada.")
            cur.execute(
                """INSERT INTO core.prescripcion_optica_acceso_online
                   (prescripcion_id,paciente_id,valida_hasta,aprobada_por)
                   VALUES (%s,%s,%s,%s)
                   ON CONFLICT (prescripcion_id) DO UPDATE SET estado='aprobada',
                     valida_desde=CURRENT_DATE,valida_hasta=EXCLUDED.valida_hasta,
                     aprobada_por=EXCLUDED.aprobada_por,aprobada_at=NOW(),
                     revocada_por=NULL,revocada_at=NULL,motivo_revocacion=NULL,updated_at=NOW()
                   RETURNING acceso_public_id,acceso_id""",
                (data.prescripcionId, prescription[0], data.validaHasta, user_id),
            )
            access = cur.fetchone()
            cur.execute("INSERT INTO core.online_identidad_eventos (evento_tipo,actor_tipo,acceso_id,actor_usuario_id,metadata) VALUES ('prescription_access_approved','staff',%s,%s,'{}')", (access[1], user_id))
            conn.commit()
            return {"status": "approved", "prescriptionRef": str(access[0])}

    @router.patch("/{prescription_ref}/revoke")
    def revoke(prescription_ref: str, data: PrescriptionRevokeRequest, user=Depends(admin)):
        with psycopg.connect(db_conninfo) as conn, conn.cursor() as cur:
            user_id = actor(cur, user)
            cur.execute("UPDATE core.prescripcion_optica_acceso_online SET estado='revocada',revocada_por=%s,revocada_at=NOW(),motivo_revocacion=%s,updated_at=NOW() WHERE acceso_public_id=%s AND estado='aprobada' RETURNING acceso_id", (user_id, data.motivo, prescription_ref))
            row = cur.fetchone()
            if not row: raise HTTPException(404, "Acceso de receta no encontrado.")
            cur.execute("INSERT INTO core.online_identidad_eventos (evento_tipo,actor_tipo,acceso_id,actor_usuario_id,metadata) VALUES ('prescription_access_revoked','staff',%s,%s,%s::jsonb)", (row[0], user_id, _canonical({"reason": data.motivo})))
            conn.commit()
            return {"status": "revoked"}

    return router
