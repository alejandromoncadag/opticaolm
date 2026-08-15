"""Guest checkout email verification and canonical patient resolution.

This module deliberately creates only a person/customer profile. It never
creates clinical history, prescriptions, diagnoses, examinations, or notes.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import unicodedata
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

from online_commerce import CommerceOwner, _valid_owner_hash


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_email(value: str) -> str:
    return value.strip().lower()


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 12 and digits.startswith("52"):
        digits = digits[2:]
    if len(digits) == 13 and digits.startswith("521"):
        digits = digits[3:]
    return digits


def name_tokens(value: str) -> list[str]:
    plain = unicodedata.normalize("NFKD", value)
    plain = "".join(c for c in plain if not unicodedata.combining(c)).lower()
    return [x for x in re.findall(r"[a-z0-9]+", plain) if len(x) > 1]


def compatible_name(full_name: str, patient: dict[str, Any]) -> bool:
    supplied = name_tokens(full_name)
    given = name_tokens(" ".join(filter(None, [patient.get("primer_nombre"), patient.get("segundo_nombre")])) )
    surnames = name_tokens(" ".join(filter(None, [patient.get("apellido_paterno"), patient.get("apellido_materno")])) )
    return bool(supplied and given and surnames and supplied[0] == given[0] and set(supplied[1:]) & set(surnames))


def split_name(full_name: str) -> tuple[str, str]:
    tokens = [x for x in full_name.strip().split() if x]
    if len(tokens) < 2:
        raise ValueError("A first name and at least one surname are required.")
    # Do not infer sex, birth data, or additional surname structure. Preserve
    # the complete supplied string in the legacy display field.
    return tokens[0], tokens[-1]


class CheckoutIdentityError(RuntimeError):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.detail = {"code": code, "message": message}


class GuestVerificationStart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)


class GuestVerificationConfirm(BaseModel):
    model_config = ConfigDict(extra="forbid")
    verificationId: str = Field(min_length=30, max_length=50)
    code: str = Field(min_length=6, max_length=12)


class CheckoutIdentityRepository:
    def __init__(self, connect, config):
        self.connect = connect
        self.config = config

    def _connection(self):
        from psycopg.rows import dict_row
        return self.connect(self.config.db_conninfo, row_factory=dict_row)

    @staticmethod
    def _email_verified(cur, owner: CommerceOwner, email: str) -> bool:
        email_hash = _sha(normalize_email(email))
        if owner.owner_type == "customer":
            cur.execute(
                """SELECT 1 FROM core.online_cliente_paciente_links
                   WHERE cuenta_ref_hash=%s AND estado='activo'
                     AND correo_verificado_hash=%s LIMIT 1""",
                (owner.owner_hash, email_hash),
            )
            return cur.fetchone() is not None
        cur.execute(
            """SELECT 1 FROM core.online_guest_email_verifications
               WHERE propietario_ref_hash=%s AND correo_hash=%s
                 AND verified_at IS NOT NULL
                 AND verified_at > NOW()-INTERVAL '30 days'
               ORDER BY verified_at DESC LIMIT 1""",
            (owner.owner_hash, email_hash),
        )
        return cur.fetchone() is not None

    def start_guest_verification(self, owner: CommerceOwner, email: str) -> dict[str, Any]:
        if owner.owner_type != "guest":
            raise CheckoutIdentityError(400, "GUEST_ONLY", "Guest email verification is only available to guests.")
        normalized = normalize_email(email)
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise CheckoutIdentityError(400, "EMAIL_INVALID", "A valid email is required.")
        code = f"{secrets.randbelow(1_000_000):06d}"
        with self._connection() as conn, conn.cursor() as cur:
            cur.execute(
                """UPDATE core.online_guest_email_verifications
                   SET expires_at=NOW()-INTERVAL '1 second', cancelled_at=NOW()
                   WHERE propietario_ref_hash=%s AND correo_hash=%s AND verified_at IS NULL""",
                (owner.owner_hash, _sha(normalized)),
            )
            cur.execute(
                """INSERT INTO core.online_guest_email_verifications
                   (propietario_ref_hash, correo_hash, codigo_hash)
                   VALUES (%s,%s,%s) RETURNING verification_public_id, expires_at""",
                (owner.owner_hash, _sha(normalized), _sha(code)),
            )
            row = cur.fetchone()
            conn.commit()
        result = {"schemaVersion": "1.0", "verificationId": str(row["verification_public_id"]), "expiresAt": row["expires_at"], "status": "pending"}
        # Development-only convenience; production responses never contain a code.
        if os.getenv("EMAIL_VERIFICATION_DEV_LINKS", "false").strip().lower() in {"1", "true", "yes", "on"}:
            result["devCode"] = code
        return result

    def confirm_guest_verification(self, owner: CommerceOwner, data: GuestVerificationConfirm) -> dict[str, Any]:
        if owner.owner_type != "guest":
            raise CheckoutIdentityError(400, "GUEST_ONLY", "Guest email verification is only available to guests.")
        with self._connection() as conn, conn.cursor() as cur:
            cur.execute(
                """SELECT * FROM core.online_guest_email_verifications
                   WHERE verification_public_id=%s AND propietario_ref_hash=%s FOR UPDATE""",
                (data.verificationId, owner.owner_hash),
            )
            row = cur.fetchone()
            if not row or row["verified_at"] is not None or row["expires_at"] <= datetime.now(timezone.utc):
                raise CheckoutIdentityError(410, "VERIFICATION_EXPIRED", "The verification code has expired.")
            if int(row["attempts"]) >= 10:
                raise CheckoutIdentityError(429, "VERIFICATION_RATE_LIMITED", "Too many verification attempts.")
            cur.execute("UPDATE core.online_guest_email_verifications SET attempts=attempts+1 WHERE verification_id=%s", (row["verification_id"],))
            if not hmac.compare_digest(str(row["codigo_hash"]), _sha(data.code.strip())):
                conn.commit()
                raise CheckoutIdentityError(400, "VERIFICATION_CODE_INVALID", "The verification code is invalid.")
            cur.execute("UPDATE core.online_guest_email_verifications SET verified_at=NOW() WHERE verification_id=%s", (row["verification_id"],))
            conn.commit()
        return {"schemaVersion": "1.0", "status": "verified", "verificationId": data.verificationId}

    def resolve_order_identity(self, cur, *, order_id: int, owner: CommerceOwner, contact: dict[str, Any], branch_id: int, authenticated_email_verified: bool = False) -> dict[str, Any]:
        email = normalize_email(str(contact.get("email") or ""))
        phone = normalize_phone(str(contact.get("phone") or ""))
        full_name = str(contact.get("fullName") or "").strip()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(phone) != 10:
            raise CheckoutIdentityError(422, "IDENTITY_INPUT_INVALID", "Full name, email and a valid 10-digit phone are required.")
        try:
            first_name, surname = split_name(full_name)
        except ValueError as exc:
            raise CheckoutIdentityError(422, "IDENTITY_NAME_INVALID", str(exc)) from exc
        if owner.owner_type == "guest" and not self._email_verified(cur, owner, email):
            raise CheckoutIdentityError(428, "EMAIL_VERIFICATION_REQUIRED", "Verify the guest email before continuing.")
        if owner.owner_type == "customer" and not authenticated_email_verified:
            cur.execute("SELECT 1 FROM core.online_cliente_paciente_links WHERE cuenta_ref_hash=%s AND estado='activo' LIMIT 1", (owner.owner_hash,))
            if cur.fetchone() is None:
                raise CheckoutIdentityError(428, "EMAIL_VERIFICATION_REQUIRED", "A verified account email is required.")
        fingerprint = _sha(f"{email}|{phone}|{_canonical(name_tokens(full_name))}")
        # Serialize all resolutions for the same normalized identity before
        # matching or creating a patient.
        cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (fingerprint,))
        snapshot = dict(contact)
        snapshot["email"] = email
        snapshot["phone"] = phone
        cur.execute("SELECT * FROM core.online_identidad_checkout WHERE orden_id=%s FOR UPDATE", (order_id,))
        existing = cur.fetchone()
        if existing and existing["estado"] == "resuelto":
            return {"status": "resuelto", "paciente_id": int(existing["paciente_id"]), "result": existing["resultado"]}
        cur.execute(
            """SELECT paciente_id, primer_nombre, segundo_nombre, apellido_paterno,
                      apellido_materno, telefono, correo
               FROM core.pacientes WHERE activo=TRUE AND
                 (LOWER(BTRIM(COALESCE(correo,'')))=%s OR
                  RIGHT(REGEXP_REPLACE(COALESCE(telefono,''),'\\D','','g'),10)=%s)
               ORDER BY paciente_id FOR UPDATE""",
            (email, phone),
        )
        candidates = list(cur.fetchall())
        exact = [p for p in candidates if normalize_email(p["correo"] or "") == email and normalize_phone(p["telefono"] or "") == phone and compatible_name(full_name, p)]
        if len(exact) == 1:
            patient_id, result, state, reason = int(exact[0]["paciente_id"]), "coincidencia_exacta", "resuelto", None
        elif len(exact) > 1 or candidates:
            patient_id, result, state, reason = None, "revision_manual", "requiere_revision", "conflicting_or_multiple_candidates"
        else:
            cur.execute(
                """INSERT INTO core.pacientes
                   (sucursal_id, nombre, primer_nombre, apellido_paterno, telefono, correo, activo, creado_en, actualizado_en)
                   VALUES (%s,%s,%s,%s,%s,%s,TRUE,NOW(),NOW())
                   RETURNING paciente_id""",
                (branch_id, full_name, first_name, surname, phone, email),
            )
            patient_id, result, state, reason = int(cur.fetchone()["paciente_id"]), "paciente_creado", "resuelto", None
        if patient_id and owner.owner_type == "customer":
            cur.execute(
                """SELECT cuenta_ref_hash FROM core.online_cliente_paciente_links
                   WHERE paciente_id=%s AND estado='activo' FOR UPDATE""",
                (patient_id,),
            )
            patient_link = cur.fetchone()
            if patient_link and patient_link["cuenta_ref_hash"] != owner.owner_hash:
                patient_id, result, state, reason = None, "revision_manual", "requiere_revision", "patient_already_linked_to_another_account"
            elif not patient_link:
                cur.execute(
                    """INSERT INTO core.online_cliente_paciente_links
                       (cuenta_ref_hash, paciente_id, correo_verificado_hash,
                        telefono_verificado_hash, metodo_vinculacion)
                       VALUES (%s,%s,%s,%s,'checkout_identity')""",
                    (owner.owner_hash, patient_id, _sha(email), _sha(phone)),
                )
        cur.execute(
            """INSERT INTO core.online_identidad_checkout
               (orden_id, propietario_tipo, propietario_ref_hash, correo_hash,
                telefono_hash, nombre_hash, identidad_fingerprint, estado, resultado,
                paciente_id, identidad_snapshot, requiere_revision_motivo, resuelta_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s)
               ON CONFLICT (orden_id) DO UPDATE SET estado=EXCLUDED.estado,
                 resultado=EXCLUDED.resultado, paciente_id=EXCLUDED.paciente_id,
                 identidad_snapshot=EXCLUDED.identidad_snapshot,
                 requiere_revision_motivo=EXCLUDED.requiere_revision_motivo,
                 resuelta_at=EXCLUDED.resuelta_at, updated_at=NOW()""",
            (order_id, owner.db_type, owner.owner_hash, _sha(email), _sha(phone), _sha(_canonical(name_tokens(full_name))), fingerprint, state, result, patient_id, _canonical(snapshot), reason, datetime.now(timezone.utc) if patient_id else None),
        )
        cur.execute("UPDATE core.online_ordenes SET paciente_id=%s, identidad_estado=%s, identidad_resuelta_at=%s, updated_at=NOW() WHERE orden_id=%s", (patient_id, state, datetime.now(timezone.utc) if patient_id else None, order_id))
        return {"status": state, "paciente_id": patient_id, "result": result, "reason": reason}


def verify_authenticated_identity_assertion(owner: CommerceOwner, email: str, assertion: str, bearer_token: str) -> bool:
    """Validate an assertion generated by the trusted OLM server route."""
    if owner.owner_type != "customer" or not assertion or not bearer_token:
        return False
    try:
        timestamp, supplied = assertion.split(":", 1)
        issued = int(timestamp)
    except (ValueError, TypeError):
        return False
    if abs(int(time.time()) - issued) > 300:
        return False
    payload = f"{owner.owner_hash}|{normalize_email(email)}|{timestamp}"
    expected = hmac.new(bearer_token.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, supplied)


def create_checkout_identity_router(db_conninfo: str, config, connect):
    router = APIRouter(prefix="/storefront/identity/v1", tags=["Checkout identity"])
    bearer = HTTPBearer(auto_error=False)
    repository = CheckoutIdentityRepository(connect, config)

    def access(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if os.getenv("PHASE_1GE_ENABLED", "false").strip().lower() not in {"1", "true", "yes", "on"}:
            raise HTTPException(503, {"code": "PHASE_1GE_DISABLED", "message": "Checkout identity is disabled."})
        import secrets as _secrets
        if not credentials or credentials.scheme.lower() != "bearer" or not config.bearer_token or not _secrets.compare_digest(credentials.credentials, config.bearer_token):
            raise HTTPException(401, "Invalid identity credentials.")

    def guest_owner(owner_type: str = Header(alias="X-OLM-Owner-Type"), owner_hash: str = Header(alias="X-OLM-Owner-Hash")):
        owner_type, owner_hash = owner_type.strip().lower(), owner_hash.strip().lower()
        if owner_type != "guest" or not _valid_owner_hash(owner_hash):
            raise HTTPException(400, "A valid guest owner is required.")
        return CommerceOwner("guest", owner_hash)

    def run(fn):
        try:
            return fn()
        except CheckoutIdentityError as exc:
            raise HTTPException(exc.status, exc.detail) from exc

    @router.post("/guest-email/start", dependencies=[Depends(access)])
    def start(data: GuestVerificationStart, owner: CommerceOwner = Depends(guest_owner)):
        return run(lambda: repository.start_guest_verification(owner, data.email))

    @router.post("/guest-email/confirm", dependencies=[Depends(access)])
    def confirm(data: GuestVerificationConfirm, owner: CommerceOwner = Depends(guest_owner)):
        return run(lambda: repository.confirm_guest_verification(owner, data))

    return router
