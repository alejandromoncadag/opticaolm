from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware

from jose import jwt, JWTError
from passlib.hash import argon2

from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, timedelta, timezone, date, time
from zoneinfo import ZoneInfo
import json
from calendar import monthrange
import secrets
import re
import time as time_module
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

import psycopg
import os
from dotenv import load_dotenv


load_dotenv()



app = FastAPI(
    title="Óptica OLM API",
    description="API para gestionar pacientes y consultas (México).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONNINFO = "host=localhost port=5432 dbname=eyecare user=alejandromoncadag"

# ===== Auth config =====
JWT_SECRET = os.getenv("JWT_SECRET", "CAMBIA_ESTE_SECRET_EN_PROD")
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = 60 * 24  # 1 día

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def ensure_historia_schema():
    # Migra columnas nuevas de forma idempotente al iniciar API.
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                ALTER TABLE core.historias_clinicas
                ADD COLUMN IF NOT EXISTS paciente_fecha_nacimiento date,
                ADD COLUMN IF NOT EXISTS paciente_edad integer,
                ADD COLUMN IF NOT EXISTS paciente_primer_nombre text,
                ADD COLUMN IF NOT EXISTS paciente_segundo_nombre text,
                ADD COLUMN IF NOT EXISTS paciente_apellido_paterno text,
                ADD COLUMN IF NOT EXISTS paciente_apellido_materno text,
                ADD COLUMN IF NOT EXISTS paciente_telefono text,
                ADD COLUMN IF NOT EXISTS paciente_correo text,
                ADD COLUMN IF NOT EXISTS puesto_laboral text,
                ADD COLUMN IF NOT EXISTS antecedentes_generales text,
                ADD COLUMN IF NOT EXISTS antecedentes_familiares text,
                ADD COLUMN IF NOT EXISTS antecedentes_otro text,
                ADD COLUMN IF NOT EXISTS alergias text,
                ADD COLUMN IF NOT EXISTS enfermedades text,
                ADD COLUMN IF NOT EXISTS cirugias text,
                ADD COLUMN IF NOT EXISTS avsinrixoi text,
                ADD COLUMN IF NOT EXISTS doctor_atencion text;
                """
            )
        conn.commit()


def ensure_ventas_schema():
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.ventas (
                    venta_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL REFERENCES core.sucursales(sucursal_id),
                    paciente_id integer NOT NULL REFERENCES core.pacientes(paciente_id),
                    fecha_hora timestamptz NOT NULL DEFAULT NOW(),
                    compra text NOT NULL,
                    monto_total numeric(12,2) NOT NULL CHECK (monto_total >= 0),
                    metodo_pago text NOT NULL DEFAULT 'efectivo',
                    adelanto_aplica boolean NOT NULL DEFAULT false,
                    adelanto_monto numeric(12,2) NULL CHECK (adelanto_monto >= 0),
                    adelanto_metodo text NULL,
                    como_nos_conocio text NULL,
                    notas text NULL,
                    created_by text NOT NULL,
                    updated_at timestamptz NULL,
                    activo boolean NOT NULL DEFAULT true
                );
                """
            )
            cur.execute(
                """
                ALTER TABLE core.ventas
                ADD COLUMN IF NOT EXISTS metodo_pago text NOT NULL DEFAULT 'efectivo',
                ADD COLUMN IF NOT EXISTS adelanto_aplica boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS adelanto_monto numeric(12,2) NULL,
                ADD COLUMN IF NOT EXISTS adelanto_metodo text NULL,
                ADD COLUMN IF NOT EXISTS como_nos_conocio text NULL;
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_ventas_sucursal_fecha ON core.ventas (sucursal_id, fecha_hora DESC);"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_ventas_paciente ON core.ventas (paciente_id);"
            )
        conn.commit()


def ensure_consultas_schema():
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                ALTER TABLE core.consultas
                ADD COLUMN IF NOT EXISTS como_nos_conocio text NULL,
                ADD COLUMN IF NOT EXISTS agenda_event_id text NULL;
                """
            )
        conn.commit()


def ensure_pacientes_schema():
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                ALTER TABLE core.pacientes
                ADD COLUMN IF NOT EXISTS como_nos_conocio text NULL;
                """
            )
        conn.commit()


class PacienteCreate(BaseModel):
    sucursal_id: int | None = 1
    primer_nombre: str
    segundo_nombre: str | None = None
    apellido_paterno: str
    apellido_materno: str | None = None
    fecha_nacimiento: str | None = None
    sexo: str | None = None
    telefono: str | None = None
    correo: str | None = None
    como_nos_conocio: str | None = None

class ConsultaCreate(BaseModel):
    paciente_id: int
    sucursal_id: int | None = 1
    tipo_consulta: str | None = None
    doctor_primer_nombre: str | None = None
    doctor_apellido_paterno: str | None = None
    motivo: str | None = None
    diagnostico: str | None = None
    plan: str | None = None
    notas: str | None = None
    como_nos_conocio: str | None = None
    agendar_en_calendario: bool | None = False
    agenda_inicio: str | None = None
    agenda_fin: str | None = None


class VentaCreate(BaseModel):
    paciente_id: int
    sucursal_id: int | None = 1
    compra: str
    monto_total: float
    metodo_pago: str
    adelanto_aplica: bool | None = False
    adelanto_monto: float | None = None
    adelanto_metodo: str | None = None
    como_nos_conocio: str | None = None
    notas: str | None = None

class Sucursal(BaseModel):
    sucursal_id: int
    nombre: str
    codigo: str | None = None
    ciudad: str | None = None
    estado: str | None = None
    activa: bool

class LoginIn(BaseModel):
    username: str
    password: str

class HistoriaClinicaBase(BaseModel):
    od_esfera: Optional[float] = None
    od_cilindro: Optional[float] = None
    od_eje: Optional[int] = None
    od_add: Optional[float] = None

    oi_esfera: Optional[float] = None
    oi_cilindro: Optional[float] = None
    oi_eje: Optional[int] = None
    oi_add: Optional[float] = None

    dp: Optional[float] = None

    queratometria_od: Optional[float] = None
    queratometria_oi: Optional[float] = None

    presion_od: Optional[float] = None
    presion_oi: Optional[float] = None

    # Snapshot del paciente al momento de registrar historia
    paciente_fecha_nacimiento: Optional[date] = None
    paciente_edad: Optional[int] = None
    paciente_primer_nombre: Optional[str] = None
    paciente_segundo_nombre: Optional[str] = None
    paciente_apellido_paterno: Optional[str] = None
    paciente_apellido_materno: Optional[str] = None
    paciente_telefono: Optional[str] = None
    paciente_correo: Optional[str] = None
    puesto_laboral: Optional[str] = None
    doctor_atencion: Optional[str] = None

    # Nuevos campos clínicos
    historia: Optional[str] = None
    antecedentes: Optional[str] = None
    antecedentes_generales: Optional[str] = None
    antecedentes_familiares: Optional[str] = None
    antecedentes_otro: Optional[str] = None
    alergias: Optional[str] = None
    enfermedades: Optional[str] = None
    cirugias: Optional[str] = None
    fumador_tabaco: Optional[bool] = None
    fumador_marihuana: Optional[bool] = None
    consumidor_alcohol: Optional[bool] = None
    diabetes: Optional[bool] = None
    tipo_diabetes: Optional[str] = None
    deportista: Optional[bool] = None

    ppc: Optional[float] = None
    lejos: Optional[float] = None
    cerca: Optional[float] = None
    tension: Optional[float] = None
    mmhg: Optional[float] = None
    di: Optional[float] = None

    avsinrxod: Optional[str] = None
    avsinrixoi: Optional[str] = None
    avsinrxoi: Optional[str] = None
    capvisualod: Optional[str] = None
    capvisualoi: Optional[str] = None
    avrxantod: Optional[str] = None
    avrxantoi: Optional[str] = None
    queraod: Optional[str] = None
    queraoi: Optional[str] = None
    retinosod: Optional[str] = None
    retinosoi: Optional[str] = None
    subjeoi: Optional[str] = None
    adicionod: Optional[float] = None
    adicionoi: Optional[float] = None
    papila: Optional[str] = None
    biomicroscopia: Optional[str] = None

    diagnostico_general: Optional[str] = None
    observaciones: Optional[str] = None


class HistoriaClinicaCreate(HistoriaClinicaBase):
    paciente_id: int


class HistoriaClinicaOut(HistoriaClinicaBase):
    historia_id: int
    paciente_id: int
    sucursal_id: int
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]
    activo: bool

class HistoriaClinicaUpdate(HistoriaClinicaBase):
    pass

COMO_NOS_CONOCIO_VALUES = {"instagram", "fb", "google", "linkedin", "linkedln", "referencia"}
COMO_NOS_CONOCIO_CANONICAL = {"linkedln": "linkedin"}


def normalize_como_nos_conocio(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip().lower()
    if not v:
        return None
    if v not in COMO_NOS_CONOCIO_VALUES:
        raise HTTPException(
            status_code=400,
            detail="como_nos_conocio inválido. Usa: instagram, fb, google, linkedin o referencia.",
        )
    return COMO_NOS_CONOCIO_CANONICAL.get(v, v)


def _looks_like_email(value: str | None) -> bool:
    if not value:
        return False
    v = value.strip()
    if not v or "@" not in v:
        return False
    local, _, domain = v.partition("@")
    return bool(local and "." in domain)


def normalize_patient_phone(value: str | None) -> str | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None

    if raw.startswith("+"):
        m = re.match(r"^\+(\d{1,4})\s*(.*)$", raw)
        if not m:
            raise HTTPException(status_code=400, detail="Teléfono inválido. Usa código país + número.")
        country_code = m.group(1)
        local_digits = re.sub(r"\D", "", m.group(2))
        if len(local_digits) != 10:
            raise HTTPException(status_code=400, detail="Teléfono debe tener exactamente 10 dígitos.")
        return f"+{country_code} {local_digits}"

    digits = re.sub(r"\D", "", raw)
    if len(digits) != 10:
        raise HTTPException(status_code=400, detail="Teléfono debe tener exactamente 10 dígitos.")
    return digits


REQUIRED_HISTORIA_FIELDS = {
    "od_esfera","od_cilindro","od_eje","od_add",
    "oi_esfera","oi_cilindro","oi_eje","oi_add",
    "dp","queratometria_od","queratometria_oi","presion_od","presion_oi",
    "historia","antecedentes",
    "fumador_tabaco","fumador_marihuana","consumidor_alcohol","diabetes","deportista",
    "ppc","lejos","cerca","tension","mmhg","di",
    "avsinrxod","avsinrixoi","capvisualod","capvisualoi","avrxantod","avrxantoi",
    "queraod","queraoi","retinosod","retinosoi","subjeoi","adicionod","adicionoi",
    "papila","biomicroscopia","diagnostico_general","observaciones",
    "doctor_atencion",
}


def is_missing_value(v):
    if v is None:
        return True
    if isinstance(v, str) and not v.strip():
        return True
    return False


def validate_historia_required(data: dict):
    missing = [k for k in REQUIRED_HISTORIA_FIELDS if is_missing_value(data.get(k))]
    if data.get("diabetes") is True and is_missing_value(data.get("tipo_diabetes")):
        missing.append("tipo_diabetes")
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan campos obligatorios en historia clínica: {', '.join(sorted(set(missing)))}",
        )
















@app.on_event("startup")
def startup_migrations():
    ensure_historia_schema()
    ensure_ventas_schema()
    ensure_consultas_schema()
    ensure_pacientes_schema()
    _load_google_calendar_env_cache()


@app.get("/health", summary="Salud del sistema")
def health():
    return {"ok": True}


@app.post("/login", summary="Login (devuelve JWT)")
def login(data: LoginIn):
    # 1) buscar usuario activo
    sql = """
    SELECT username, password_hash, rol, sucursal_id, activo, password_changed_at
    FROM core.usuarios
    WHERE username = %s;
    """
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (data.username,))
            row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=401, detail="Credenciales inválidas.")

    username, password_hash, rol, sucursal_id, activo, pwd_changed_at = row

    if not activo:
        raise HTTPException(status_code=401, detail="Usuario inactivo.")

    # 2) verificar password con Argon2
    if not argon2.verify(data.password, password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas.")

    # 3) crear JWT
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=JWT_EXPIRE_MIN)

    payload = {
        "sub": username,
        "rol": rol,
        "sucursal_id": sucursal_id,  # None para admin
        "pwd_at": int(pwd_changed_at.timestamp()),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

    return {"access_token": token, "token_type": "bearer"}





def decode_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado.")

def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    username = payload.get("sub")
    rol = payload.get("rol")
    pwd_at = payload.get("pwd_at")

    if not username or not rol:
        raise HTTPException(status_code=401, detail="Token inválido.")

    # Validar que el usuario siga activo y que no le cambiaron password
    sql = """
    SELECT rol, sucursal_id, activo, password_changed_at
    FROM core.usuarios
    WHERE username = %s;
    """
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (username,))
            row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=401, detail="Usuario no existe.")
    db_rol, db_sucursal_id, activo, pwd_changed_at = row

    if not activo:
        raise HTTPException(status_code=401, detail="Usuario inactivo.")

    if int(pwd_changed_at.timestamp()) != int(pwd_at):
        raise HTTPException(status_code=401, detail="Sesión expirada. Vuelve a iniciar sesión.")

    return {"username": username, "rol": db_rol, "sucursal_id": db_sucursal_id}



from typing import Iterable, Optional

def force_sucursal(user, sucursal_id: Optional[int]) -> Optional[int]:
    """
    recepcion/doctor: sucursal forzada desde el usuario (token/DB).
    admin: puede mandar sucursal_id por query/body.
    """
    if user["rol"] in ("recepcion", "doctor"):
        if user.get("sucursal_id") is None:
            raise HTTPException(status_code=400, detail="Usuario sin sucursal asignada.")
        return user["sucursal_id"]
    return sucursal_id  # admin

def require_roles(user, allowed: Iterable[str]):
    if user["rol"] not in allowed:
        raise HTTPException(status_code=403, detail="No tienes permisos para esta acción.")


def _calendar_feature_enabled() -> bool:
    return os.getenv("ENABLE_GOOGLE_CALENDAR", "false").strip().lower() in {"1", "true", "yes", "on"}


OAUTH_STATE_TTL_SEC = 60 * 15
_OAUTH_STATE_PENDING: dict[str, dict[str, Any]] = {}
_GOOGLE_ENV_CACHE_LOADED = False
_GOOGLE_OAUTH_REFRESH_TOKENS_BY_SUCURSAL: dict[str, str] = {}
_GOOGLE_CALENDAR_IDS_BY_SUCURSAL: dict[str, str] = {}
_GOOGLE_OAUTH_REFRESH_TOKEN_FALLBACK: str = ""


def _load_google_calendar_env_cache() -> dict[str, Any]:
    global _GOOGLE_ENV_CACHE_LOADED
    global _GOOGLE_OAUTH_REFRESH_TOKENS_BY_SUCURSAL
    global _GOOGLE_CALENDAR_IDS_BY_SUCURSAL
    global _GOOGLE_OAUTH_REFRESH_TOKEN_FALLBACK

    refresh_tokens_map: dict[str, str] = {}
    raw_tokens = os.getenv("GOOGLE_OAUTH_REFRESH_TOKENS", "").strip()
    if raw_tokens:
        try:
            parsed_tokens = json.loads(raw_tokens)
            if not isinstance(parsed_tokens, dict):
                raise ValueError("GOOGLE_OAUTH_REFRESH_TOKENS debe ser JSON object.")
            refresh_tokens_map = {
                str(k): str(v).strip()
                for k, v in parsed_tokens.items()
                if str(v).strip() != ""
            }
        except Exception as e:
            raise RuntimeError(f"GOOGLE_OAUTH_REFRESH_TOKENS inválido: {e}")

    calendar_ids_map: dict[str, str] = {}
    raw_cal_ids = os.getenv("GOOGLE_CALENDAR_IDS", "").strip()
    if raw_cal_ids:
        try:
            parsed_cal = json.loads(raw_cal_ids)
            if not isinstance(parsed_cal, dict):
                raise ValueError("GOOGLE_CALENDAR_IDS debe ser JSON object.")
            calendar_ids_map = {
                str(k): str(v).strip()
                for k, v in parsed_cal.items()
                if str(v).strip() != ""
            }
        except Exception as e:
            raise RuntimeError(f"GOOGLE_CALENDAR_IDS inválido: {e}")

    _GOOGLE_OAUTH_REFRESH_TOKENS_BY_SUCURSAL = refresh_tokens_map
    _GOOGLE_CALENDAR_IDS_BY_SUCURSAL = calendar_ids_map
    _GOOGLE_OAUTH_REFRESH_TOKEN_FALLBACK = os.getenv("GOOGLE_OAUTH_REFRESH_TOKEN", "").strip()
    _GOOGLE_ENV_CACHE_LOADED = True
    return {
        "refresh_tokens_count": len(refresh_tokens_map),
        "calendar_ids_count": len(calendar_ids_map),
        "has_fallback_refresh_token": bool(_GOOGLE_OAUTH_REFRESH_TOKEN_FALLBACK),
    }


def _ensure_google_env_cache_loaded() -> None:
    if _GOOGLE_ENV_CACHE_LOADED:
        return
    try:
        _load_google_calendar_env_cache()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def _refresh_token_for_sucursal(sucursal_id: int | None) -> str:
    _ensure_google_env_cache_loaded()
    if sucursal_id is not None:
        mapped = _GOOGLE_OAUTH_REFRESH_TOKENS_BY_SUCURSAL.get(str(sucursal_id), "").strip()
        if mapped:
            return mapped
    return _GOOGLE_OAUTH_REFRESH_TOKEN_FALLBACK


def _cleanup_oauth_state() -> None:
    now = int(time_module.time())
    stale = [
        nonce
        for nonce, data in _OAUTH_STATE_PENDING.items()
        if now - int(data.get("created_at", 0)) > OAUTH_STATE_TTL_SEC
    ]
    for nonce in stale:
        _OAUTH_STATE_PENDING.pop(nonce, None)


def _build_oauth_state(sucursal_id: int) -> str:
    _cleanup_oauth_state()
    nonce = secrets.token_urlsafe(18)
    payload = {
        "sucursal_id": int(sucursal_id),
        "nonce": nonce,
        "created_at": int(time_module.time()),
    }
    _OAUTH_STATE_PENDING[nonce] = payload
    return json.dumps(payload, separators=(",", ":"))


def _consume_and_validate_oauth_state(raw_state: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw_state)
    except Exception:
        raise HTTPException(status_code=400, detail="state OAuth inválido.")

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="state OAuth inválido.")

    nonce = str(payload.get("nonce") or "").strip()
    sucursal_id = payload.get("sucursal_id")
    created_at = payload.get("created_at")
    if not nonce or sucursal_id is None or created_at is None:
        raise HTTPException(status_code=400, detail="state OAuth incompleto.")

    pending = _OAUTH_STATE_PENDING.pop(nonce, None)
    if not pending:
        raise HTTPException(status_code=400, detail="state OAuth expirado o ya utilizado.")

    if int(pending.get("sucursal_id")) != int(sucursal_id):
        raise HTTPException(status_code=400, detail="state OAuth inconsistente.")

    age = int(time_module.time()) - int(pending.get("created_at", 0))
    if age > OAUTH_STATE_TTL_SEC:
        raise HTTPException(status_code=400, detail="state OAuth expirado.")

    return {
        "sucursal_id": int(sucursal_id),
        "nonce": nonce,
        "created_at": int(created_at),
    }


def _google_oauth_config() -> dict[str, str]:
    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
    token_uri = os.getenv("GOOGLE_OAUTH_TOKEN_URI", "https://oauth2.googleapis.com/token").strip()
    redirect_uri = os.getenv("GOOGLE_OAUTH_REDIRECT_URI", "http://127.0.0.1:8000/oauth2/callback").strip()

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=400,
            detail="Falta configurar GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET.",
        )
    if not redirect_uri:
        raise HTTPException(status_code=400, detail="Falta configurar GOOGLE_OAUTH_REDIRECT_URI.")

    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "token_uri": token_uri,
        "redirect_uri": redirect_uri,
    }


def _raise_google_calendar_error(exc: Exception) -> None:
    msg = str(exc)
    low = msg.lower()
    if "invalid_grant" in low:
        raise HTTPException(
            status_code=400,
            detail=(
                "Google rechazó el refresh_token (invalid_grant). "
                "Vuelve a autorizar esa sucursal con /oauth2/start y /oauth2/callback."
            ),
        )
    if "unauthorized_client" in low:
        raise HTTPException(
            status_code=400,
            detail=(
                "OAuth client no autorizado para este flujo (unauthorized_client). "
                "Revisa tipo de cliente, redirect URI y consentimiento."
            ),
        )
    if "accessnotconfigured" in low or "calendar api has not been used" in low:
        raise HTTPException(
            status_code=400,
            detail=(
                "Google Calendar API no está habilitada en tu proyecto de Google Cloud. "
                "Actívala en APIs & Services > Library (Calendar API) y espera unos minutos."
            ),
        )
    if "not found" in low or "404" in low:
        raise HTTPException(
            status_code=400,
            detail="No se encontró el calendario configurado para esta sucursal o no hay acceso.",
        )
    if "forbidden" in low or "insufficient" in low or "permission" in low or "403" in low:
        raise HTTPException(
            status_code=400,
            detail="No hay permisos para acceder al Google Calendar configurado.",
        )
    raise HTTPException(status_code=400, detail=f"Error de Google Calendar: {msg}")


@app.get("/oauth2/start", summary="Iniciar OAuth Google Calendar por sucursal")
def oauth2_start(sucursal_id: int, user=Depends(get_current_user)):
    require_roles(user, ("admin",))
    if sucursal_id <= 0:
        raise HTTPException(status_code=400, detail="sucursal_id inválido.")

    conf = _google_oauth_config()
    scope = "https://www.googleapis.com/auth/calendar"
    state = _build_oauth_state(sucursal_id)
    params = {
        "response_type": "code",
        "client_id": conf["client_id"],
        "redirect_uri": conf["redirect_uri"],
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {
        "ok": True,
        "sucursal_id": sucursal_id,
        "auth_url": auth_url,
        "state_payload": json.loads(state),
        "nota": "Abre auth_url en navegador, autoriza con la cuenta de esa sucursal y Google redirigirá a /oauth2/callback.",
    }


@app.get("/oauth2/callback", summary="Callback OAuth Google Calendar")
def oauth2_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        raise HTTPException(status_code=400, detail=f"Google devolvió error OAuth: {error}")
    if not code:
        raise HTTPException(status_code=400, detail="Falta query param code en callback.")
    if not state:
        raise HTTPException(status_code=400, detail="Falta query param state en callback.")

    state_data = _consume_and_validate_oauth_state(state)
    sucursal_id = int(state_data["sucursal_id"])
    conf = _google_oauth_config()

    token_payload = urlencode(
        {
            "code": code,
            "client_id": conf["client_id"],
            "client_secret": conf["client_secret"],
            "redirect_uri": conf["redirect_uri"],
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")

    req = Request(
        conf["token_uri"],
        data=token_payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urlopen(req, timeout=25) as resp:
            token_data = json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=400, detail=f"No se pudo intercambiar code por tokens: {body or str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo intercambiar code por tokens: {e}")

    refresh_token = token_data.get("refresh_token")
    access_token = token_data.get("access_token")

    _ensure_google_env_cache_loaded()
    existing_tokens: dict[str, str] = dict(_GOOGLE_OAUTH_REFRESH_TOKENS_BY_SUCURSAL)

    if refresh_token:
        normalized = str(refresh_token).strip()
        existing_tokens[str(sucursal_id)] = normalized
        _GOOGLE_OAUTH_REFRESH_TOKENS_BY_SUCURSAL[str(sucursal_id)] = normalized

    env_value = f"GOOGLE_OAUTH_REFRESH_TOKENS={json.dumps(existing_tokens, ensure_ascii=False)}"

    warning = None
    if not refresh_token:
        warning = (
            "Google no devolvió refresh_token. Repite el flujo con access_type=offline y prompt=consent, "
            "o revoca el acceso previo y vuelve a autorizar."
        )

    return {
        "ok": True,
        "sucursal_id": sucursal_id,
        "refresh_token": refresh_token,
        "access_token_preview": f"{str(access_token)[:20]}..." if access_token else None,
        "expires_in": token_data.get("expires_in"),
        "scope": token_data.get("scope"),
        "token_type": token_data.get("token_type"),
        "env_value": env_value,
        "warning": warning,
        "state_payload": state_data,
    }


def _get_google_calendar_service(sucursal_id: int | None = None):
    try:
        from google.oauth2 import service_account
        from google.oauth2 import credentials as oauth2_credentials
        from google.auth.transport.requests import Request as GoogleAuthRequest
        from googleapiclient.discovery import build
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Faltan librerías de Google Calendar. Instala: google-api-python-client google-auth.",
        )

    scopes = ["https://www.googleapis.com/auth/calendar"]
    oauth_client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip()
    oauth_client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
    oauth_token_uri = os.getenv("GOOGLE_OAUTH_TOKEN_URI", "https://oauth2.googleapis.com/token").strip()
    oauth_refresh_token = _refresh_token_for_sucursal(sucursal_id)

    # Preferir OAuth si está configurado (útil cuando no hay service account/key).
    if oauth_client_id and oauth_client_secret and oauth_refresh_token:
        try:
            creds = oauth2_credentials.Credentials(
                token=None,
                refresh_token=oauth_refresh_token,
                token_uri=oauth_token_uri,
                client_id=oauth_client_id,
                client_secret=oauth_client_secret,
                scopes=scopes,
            )
            creds.refresh(GoogleAuthRequest())
            return build("calendar", "v3", credentials=creds, cache_discovery=False)
        except Exception as e:
            _raise_google_calendar_error(e)

    creds_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "").strip()
    creds_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    try:
        if creds_json:
            creds = service_account.Credentials.from_service_account_info(json.loads(creds_json), scopes=scopes)
            return build("calendar", "v3", credentials=creds, cache_discovery=False)
        if creds_file and os.path.isfile(creds_file) and os.path.getsize(creds_file) > 0:
            creds = service_account.Credentials.from_service_account_file(creds_file, scopes=scopes)
            return build("calendar", "v3", credentials=creds, cache_discovery=False)
    except Exception as e:
        _raise_google_calendar_error(e)

    raise HTTPException(
        status_code=400,
        detail=(
            "Configura OAuth (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN)"
            " o service account (GOOGLE_SERVICE_ACCOUNT_FILE / GOOGLE_SERVICE_ACCOUNT_JSON)."
        ),
    )


def _calendar_id_for_sucursal(sucursal_id: int) -> str:
    _ensure_google_env_cache_loaded()
    cal_id = _GOOGLE_CALENDAR_IDS_BY_SUCURSAL.get(str(sucursal_id))
    if not cal_id:
        raise HTTPException(status_code=400, detail=f"No hay calendar configurado para sucursal {sucursal_id}.")
    return str(cal_id)


@app.get("/agenda/test", summary="Crear evento de prueba en Google Calendar por sucursal")
def agenda_test(sucursal_id: int, user=Depends(get_current_user)):
    require_roles(user, ("admin",))
    if sucursal_id <= 0:
        raise HTTPException(status_code=400, detail="sucursal_id inválido.")

    tz_name = _timezone_for_sucursal(sucursal_id)
    tz = ZoneInfo(tz_name)
    calendar_id = _calendar_id_for_sucursal(sucursal_id)
    service = _get_google_calendar_service(sucursal_id=sucursal_id)

    start_dt = datetime.now(tz).replace(second=0, microsecond=0) + timedelta(minutes=2)
    end_dt = start_dt + timedelta(minutes=15)
    summary = f"TEST OLM {sucursal_id} {int(time_module.time())}"
    body = {
        "summary": summary,
        "description": "Evento de prueba creado por /agenda/test",
        "start": {"dateTime": start_dt.isoformat(), "timeZone": tz_name},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": tz_name},
    }

    try:
        created = service.events().insert(calendarId=calendar_id, body=body).execute()
    except Exception as e:
        _raise_google_calendar_error(e)

    return {
        "ok": True,
        "sucursal_id": sucursal_id,
        "calendar_id": calendar_id,
        "event_id": str(created.get("id", "")),
        "event_link": created.get("htmlLink"),
        "summary": summary,
        "timezone": tz_name,
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat(),
    }


def _timezone_for_sucursal(sucursal_id: int) -> str:
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(LOWER(estado), ''), COALESCE(LOWER(ciudad), '')
                FROM core.sucursales
                WHERE sucursal_id = %s
                LIMIT 1
                """,
                (sucursal_id,),
            )
            row = cur.fetchone()

    if not row:
        return "America/Mexico_City"

    estado, ciudad = row
    if "quintana roo" in estado or "playa del carmen" in ciudad:
        return "America/Cancun"
    return "America/Mexico_City"


def _parse_dt_in_tz(value: str, tz_name: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Fecha/hora inválida: {value}")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(tz_name))
    return dt


def _fetch_busy_intervals(
    calendar_id: str,
    tz_name: str,
    start_dt: datetime,
    end_dt: datetime,
    sucursal_id: int | None = None,
) -> list[tuple[datetime, datetime]]:
    service = _get_google_calendar_service(sucursal_id=sucursal_id)
    try:
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=start_dt.astimezone(timezone.utc).isoformat(),
            timeMax=end_dt.astimezone(timezone.utc).isoformat(),
            singleEvents=True,
            orderBy="startTime",
        ).execute()
    except Exception as e:
        _raise_google_calendar_error(e)
    items = events_result.get("items", [])
    busy: list[tuple[datetime, datetime]] = []

    for ev in items:
        start_raw = ev.get("start", {}).get("dateTime")
        end_raw = ev.get("end", {}).get("dateTime")
        if not start_raw or not end_raw:
            continue
        s = datetime.fromisoformat(start_raw)
        e = datetime.fromisoformat(end_raw)
        if s.tzinfo is None:
            s = s.replace(tzinfo=ZoneInfo(tz_name))
        if e.tzinfo is None:
            e = e.replace(tzinfo=ZoneInfo(tz_name))
        busy.append((s, e))

    return busy


def _has_overlap(start_dt: datetime, end_dt: datetime, busy: list[tuple[datetime, datetime]]) -> bool:
    for b_start, b_end in busy:
        if start_dt < b_end and end_dt > b_start:
            return True
    return False


def _build_slots_for_day(sucursal_id: int, fecha: date, duracion_min: int = 30) -> dict[str, Any]:
    tz_name = _timezone_for_sucursal(sucursal_id)
    tz = ZoneInfo(tz_name)

    start_hour = int(os.getenv("AGENDA_START_HOUR", "10"))
    end_hour = int(os.getenv("AGENDA_END_HOUR", "20"))
    step_min = int(os.getenv("AGENDA_STEP_MIN", "30"))
    workdays_raw = os.getenv("AGENDA_WORKDAYS", "0,1,2,3,4,5")  # Monday=0 ... Sunday=6
    try:
        workdays = {int(x.strip()) for x in workdays_raw.split(",") if x.strip() != ""}
    except Exception:
        workdays = {0, 1, 2, 3, 4, 5}

    if fecha.weekday() not in workdays:
        return {
            "timezone": tz_name,
            "fecha": str(fecha),
            "slots": [],
            "cerrado": True,
            "motivo": "Sucursal cerrada ese día.",
            "calendar_sync": False,
        }

    day_start = datetime.combine(fecha, time(hour=start_hour, minute=0), tzinfo=tz)
    day_end = datetime.combine(fecha, time(hour=end_hour, minute=0), tzinfo=tz)
    now_local = datetime.now(tz)
    is_today = fecha == now_local.date()

    busy: list[tuple[datetime, datetime]] = []
    calendar_sync = False
    if _calendar_feature_enabled():
        cal_id = _calendar_id_for_sucursal(sucursal_id)
        busy = _fetch_busy_intervals(cal_id, tz_name, day_start, day_end, sucursal_id=sucursal_id)
        calendar_sync = True

    slots = []
    current = day_start
    while current + timedelta(minutes=duracion_min) <= day_end:
        slot_end = current + timedelta(minutes=duracion_min)
        # Si es el día actual, no ofrecer horarios que ya iniciaron.
        if is_today and current <= now_local:
            current += timedelta(minutes=step_min)
            continue
        if not _has_overlap(current, slot_end, busy):
            slots.append(
                {
                    "inicio": current.isoformat(),
                    "fin": slot_end.isoformat(),
                    "label": f"{current.strftime('%H:%M')} - {slot_end.strftime('%H:%M')}",
                }
            )
        current += timedelta(minutes=step_min)

    return {"timezone": tz_name, "fecha": str(fecha), "slots": slots, "calendar_sync": calendar_sync}


def _create_calendar_event_for_consulta(
    sucursal_id: int,
    start_dt: datetime,
    end_dt: datetime,
    paciente_id: int,
    paciente_nombre: str,
    paciente_correo: str | None,
    tipo_consulta: str | None,
    doctor_nombre: str | None,
) -> str:
    tz_name = _timezone_for_sucursal(sucursal_id)
    cal_id = _calendar_id_for_sucursal(sucursal_id)
    service = _get_google_calendar_service(sucursal_id=sucursal_id)

    body = {
        "summary": f"Consulta {tipo_consulta or 'general'} - {paciente_nombre}",
        "description": f"Paciente ID: {paciente_id}\nDoctor: {doctor_nombre or ''}",
        "start": {"dateTime": start_dt.isoformat(), "timeZone": tz_name},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": tz_name},
    }
    if _looks_like_email(paciente_correo):
        body["attendees"] = [{"email": str(paciente_correo).strip()}]

    try:
        created = service.events().insert(calendarId=cal_id, body=body, sendUpdates="all").execute()
    except Exception as e:
        _raise_google_calendar_error(e)
    return str(created.get("id", ""))


def _delete_calendar_event_for_consulta(
    sucursal_id: int,
    event_id: str,
) -> None:
    if not event_id or not str(event_id).strip():
        return
    cal_id = _calendar_id_for_sucursal(sucursal_id)
    service = _get_google_calendar_service(sucursal_id=sucursal_id)
    try:
        service.events().delete(calendarId=cal_id, eventId=str(event_id).strip(), sendUpdates="all").execute()
    except Exception as e:
        msg = str(e).lower()
        # Si ya no existe en Google Calendar, lo tratamos como borrado exitoso.
        if "404" in msg or "not found" in msg:
            return
        _raise_google_calendar_error(e)


def _validate_in_business_hours(sucursal_id: int, start_dt: datetime, end_dt: datetime):
    tz_name = _timezone_for_sucursal(sucursal_id)
    tz = ZoneInfo(tz_name)
    local_start = start_dt.astimezone(tz)
    local_end = end_dt.astimezone(tz)

    start_hour = int(os.getenv("AGENDA_START_HOUR", "10"))
    end_hour = int(os.getenv("AGENDA_END_HOUR", "20"))
    workdays_raw = os.getenv("AGENDA_WORKDAYS", "0,1,2,3,4,5")
    try:
        workdays = {int(x.strip()) for x in workdays_raw.split(",") if x.strip() != ""}
    except Exception:
        workdays = {0, 1, 2, 3, 4, 5}

    if local_start.weekday() not in workdays:
        raise HTTPException(status_code=400, detail="No se puede agendar: sucursal cerrada ese día.")
    if local_end <= local_start:
        raise HTTPException(status_code=400, detail="agenda_fin debe ser mayor que agenda_inicio.")
    if local_end.date() != local_start.date():
        raise HTTPException(status_code=400, detail="La consulta no puede cruzar al siguiente día.")

    business_start = datetime.combine(local_start.date(), time(hour=start_hour, minute=0), tzinfo=tz)
    business_end = datetime.combine(local_start.date(), time(hour=end_hour, minute=0), tzinfo=tz)

    if local_start < business_start or local_start >= business_end:
        raise HTTPException(status_code=400, detail="Hora de inicio fuera del horario laboral.")
    if local_end > business_end:
        raise HTTPException(status_code=400, detail="Hora de fin fuera del horario laboral.")








@app.get("/me", summary="Usuario actual (debug)")
def me(user=Depends(get_current_user)):
    return user






@app.get("/pacientes", summary="Listar pacientes")
def listar_pacientes(
    limit: int = 50,
    sucursal_id: int | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    anio: int | None = None,
    mes: int | None = None,
    user=Depends(get_current_user),
):

    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    # Por defecto se listan solo pacientes creados hoy.
    where = ["activo = true"]
    params = []

    if sucursal_id is not None:
        where.append("sucursal_id = %s")
        params.append(sucursal_id)

    if mes is not None and (mes < 1 or mes > 12):
        raise HTTPException(status_code=400, detail="Mes inválido. Debe ser entre 1 y 12.")

    if fecha_desde and fecha_hasta:
        where.append("DATE(creado_en) BETWEEN %s AND %s")
        params.extend([fecha_desde, fecha_hasta])
    elif fecha_desde:
        where.append("DATE(creado_en) >= %s")
        params.append(fecha_desde)
    elif fecha_hasta:
        where.append("DATE(creado_en) <= %s")
        params.append(fecha_hasta)
    elif anio is not None and mes is not None:
        where.append("EXTRACT(YEAR FROM creado_en) = %s")
        where.append("EXTRACT(MONTH FROM creado_en) = %s")
        params.extend([anio, mes])
    elif anio is not None:
        where.append("EXTRACT(YEAR FROM creado_en) = %s")
        params.append(anio)
    else:
        where.append("DATE(creado_en) = CURRENT_DATE")

    where_sql = "WHERE " + " AND ".join(where)

    sql = f"""
    SELECT paciente_id, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
           fecha_nacimiento, sexo, telefono, correo, como_nos_conocio,
           ocupacion, alergias, fumador_cigarro, consumidor_alcohol, consumidor_marihuana,
           creado_en
    FROM core.pacientes
    {where_sql}
    ORDER BY creado_en DESC, paciente_id DESC
    LIMIT %s;
    """
    params.append(limit)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    return [
        {
            "paciente_id": r[0],
            "primer_nombre": r[1],
            "segundo_nombre": r[2],
            "apellido_paterno": r[3],
            "apellido_materno": r[4],
            "fecha_nacimiento": str(r[5]) if r[5] else None,
            "sexo": r[6],
            "telefono": r[7],
            "correo": r[8],
            "como_nos_conocio": r[9],
            "ocupacion": r[10],
            "alergias": r[11],
            "fumador_tabaco": r[12],
            "consumidor_alcohol": r[13],
            "fumador_marihuana": r[14],
            "creado_en": r[15].isoformat() if r[15] else None,
        }
        for r in rows
    ]


@app.get("/pacientes/buscar", summary="Buscar pacientes para crear consulta")
def buscar_pacientes(
    q: str,
    limit: int = 50,
    sucursal_id: int | None = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    if not q or not q.strip():
        return []
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit inválido (1-200).")

    q_like = f"%{q.strip()}%"
    where = ["p.activo = true"]
    params: list[Any] = []

    if sucursal_id is not None:
        where.append("p.sucursal_id = %s")
        params.append(sucursal_id)

    where.append(
        """(
            CAST(p.paciente_id AS TEXT) ILIKE %s
            OR p.primer_nombre ILIKE %s
            OR COALESCE(p.segundo_nombre, '') ILIKE %s
            OR p.apellido_paterno ILIKE %s
            OR COALESCE(p.apellido_materno, '') ILIKE %s
            OR COALESCE(p.telefono, '') ILIKE %s
            OR COALESCE(p.correo, '') ILIKE %s
            OR CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno) ILIKE %s
        )"""
    )
    params.extend([q_like, q_like, q_like, q_like, q_like, q_like, q_like, q_like])

    sql = f"""
    SELECT
      p.paciente_id, p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno,
      p.fecha_nacimiento, p.sexo, p.telefono, p.correo
    FROM core.pacientes p
    WHERE {" AND ".join(where)}
    ORDER BY p.creado_en DESC, p.paciente_id DESC
    LIMIT %s;
    """
    params.append(limit)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    return [
        {
            "paciente_id": r[0],
            "primer_nombre": r[1],
            "segundo_nombre": r[2],
            "apellido_paterno": r[3],
            "apellido_materno": r[4],
            "fecha_nacimiento": str(r[5]) if r[5] else None,
            "sexo": r[6],
            "telefono": r[7],
            "correo": r[8],
        }
        for r in rows
    ]


@app.get("/sucursales", summary="Listar sucursales")
def listar_sucursales():
    sql = """
    SELECT sucursal_id, nombre, codigo, ciudad, estado, activa
    FROM core.sucursales
    WHERE activa = true
    ORDER BY sucursal_id;
    """
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    return [
        {
            "sucursal_id": r[0],
            "nombre": r[1],
            "codigo": r[2],
            "ciudad": r[3],
            "estado": r[4],
            "activa": r[5],
        }
        for r in rows
    ]



@app.post("/pacientes", summary="Crear paciente")
def crear_paciente(p: PacienteCreate, user=Depends(get_current_user)):

    require_roles(user, ("admin", "recepcion"))
    p.sucursal_id = force_sucursal(user, p.sucursal_id)

    if user["rol"] == "admin" and p.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    p.como_nos_conocio = normalize_como_nos_conocio(p.como_nos_conocio)
    p.telefono = normalize_patient_phone(p.telefono)
    if not p.telefono:
        raise HTTPException(status_code=400, detail="Teléfono es obligatorio y debe tener 10 dígitos.")
    

    sql = """
    INSERT INTO core.pacientes (
      sucursal_id, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
      fecha_nacimiento, sexo, telefono, correo, como_nos_conocio
    )
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    RETURNING paciente_id;
    """
    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:


                #  1) VALIDAR SUCURSAL (AQUI)
                cur.execute(
                    "SELECT activa FROM core.sucursales WHERE sucursal_id = %s",
                    (p.sucursal_id,),
                )
                row = cur.fetchone()

                if row is None:
                    raise HTTPException(status_code=400, detail="Sucursal no existe.")
                if row[0] is not True:
                    raise HTTPException(status_code=400, detail="Sucursal inactiva.")

                # ✅ 2) INSERT NORMAL (LO QUE YA TENÍAS)
                cur.execute(sql, (
                    p.sucursal_id,
                    p.primer_nombre,
                    p.segundo_nombre,
                    p.apellido_paterno,
                    p.apellido_materno,
                    p.fecha_nacimiento,
                    p.sexo,
                    p.telefono,
                    p.correo,
                    p.como_nos_conocio
                ))
                new_id = cur.fetchone()[0]

            conn.commit()

        return {"paciente_id": new_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))





@app.put("/pacientes/{paciente_id}", summary="Actualizar paciente")
def actualizar_paciente(paciente_id: int, p: PacienteCreate, user=Depends(get_current_user)):

    require_roles(user, ("admin", "recepcion", "doctor"))
    p.sucursal_id = force_sucursal(user, p.sucursal_id)

    if user["rol"] == "admin" and p.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    p.como_nos_conocio = normalize_como_nos_conocio(p.como_nos_conocio)
    p.telefono = normalize_patient_phone(p.telefono)
    if not p.telefono:
        raise HTTPException(status_code=400, detail="Teléfono es obligatorio y debe tener 10 dígitos.")


    sql = """
    UPDATE core.pacientes
    SET
      primer_nombre = %s,
      segundo_nombre = %s,
      apellido_paterno = %s,
      apellido_materno = %s,
      fecha_nacimiento = %s,
      sexo = %s,
      telefono = %s,
      correo = %s,
      como_nos_conocio = %s
    WHERE paciente_id = %s
      AND sucursal_id = %s
      AND activo = true
    RETURNING paciente_id;
    """
    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:

        
                # validar sucursal (ya con la sucursal correcta)
                cur.execute(
                    "SELECT activa FROM core.sucursales WHERE sucursal_id = %s",
                    (p.sucursal_id,),
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=400, detail="Sucursal no existe.")
                if row[0] is not True:
                    raise HTTPException(status_code=400, detail="Sucursal inactiva.")

                # update (sin cambiar sucursal)
                cur.execute(
                    sql,
                    (
                        p.primer_nombre,
                        p.segundo_nombre,
                        p.apellido_paterno,
                        p.apellido_materno,
                        p.fecha_nacimiento,
                        p.sexo,
                        p.telefono,
                        p.correo,
                        p.como_nos_conocio,
                        paciente_id,
                        p.sucursal_id,
                    ),
                )
                out = cur.fetchone()

            conn.commit()

        if out is None:
            raise HTTPException(
                status_code=404,
                detail="Paciente no existe en esa sucursal o está inactivo.",
            )

        return {"paciente_id": out[0], "updated": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/pacientes/{paciente_id}/historia", summary="Editar historia clínica (solo doctor/admin)")
def update_historia(
    paciente_id: int,
    sucursal_id: int,
    h: HistoriaClinicaUpdate,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    data = h.dict(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No enviaste campos para actualizar.")

    allowed = {
        "od_esfera","od_cilindro","od_eje","od_add",
        "oi_esfera","oi_cilindro","oi_eje","oi_add",
        "dp","queratometria_od","queratometria_oi",
        "presion_od","presion_oi",
        "paciente_fecha_nacimiento","paciente_edad",
        "paciente_primer_nombre","paciente_segundo_nombre",
        "paciente_apellido_paterno","paciente_apellido_materno",
        "paciente_telefono","paciente_correo","puesto_laboral",
        "doctor_atencion",
        "historia","antecedentes",
        "antecedentes_generales","antecedentes_familiares","antecedentes_otro",
        "alergias","enfermedades","cirugias",
        "fumador_tabaco","fumador_marihuana","consumidor_alcohol","diabetes","tipo_diabetes","deportista",
        "ppc","lejos","cerca","tension","mmhg","di",
        "avsinrxod","avsinrixoi","avsinrxoi","capvisualod","capvisualoi","avrxantod","avrxantoi",
        "queraod","queraoi","retinosod","retinosoi","subjeoi","adicionod","adicionoi",
        "papila","biomicroscopia",
        "diagnostico_general","observaciones",
    }
    for k in list(data.keys()):
        if k not in allowed:
            data.pop(k, None)

    if not data:
        raise HTTPException(status_code=400, detail="Campos no válidos para actualizar.")

    # Estandarizamos al nombre canónico solicitado.
    if "avsinrxoi" in data and "avsinrixoi" not in data:
        data["avsinrixoi"] = data["avsinrxoi"]
    if "diabetes" in data and data.get("diabetes") is False and is_missing_value(data.get("tipo_diabetes")):
        data["tipo_diabetes"] = "no_aplica"

    validate_historia_required(data)

    set_parts = []
    params = []
    for k, v in data.items():
        set_parts.append(f"{k} = %s")
        params.append(v)

    sql = f"""
    UPDATE core.historias_clinicas
    SET {", ".join(set_parts)},
        updated_at = NOW()
    WHERE paciente_id = %s
      AND sucursal_id = %s
      AND activo = true
    RETURNING *;
    """
    params.extend([paciente_id, sucursal_id])

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Historia clínica no encontrada (o inactiva).")
            columns = [desc[0] for desc in cur.description]
            conn.commit()

    return dict(zip(columns, row))






@app.delete("/pacientes/{paciente_id}/historia", summary="Borrar historia clínica (soft delete) (solo admin)")
def delete_historia(
    paciente_id: int,
    sucursal_id: int,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin",))
    sucursal_id = force_sucursal(user, sucursal_id)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE core.historias_clinicas
                SET activo = false,
                    updated_at = NOW()
                WHERE paciente_id = %s
                  AND sucursal_id = %s
                  AND activo = true
                RETURNING historia_id;
                """,
                (paciente_id, sucursal_id),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Historia clínica no encontrada (o ya estaba inactiva).")
            conn.commit()

    return {"ok": True, "historia_id": row[0]}








@app.get("/agenda/disponibilidad", summary="Horarios disponibles por sucursal y día")
def agenda_disponibilidad(
    fecha: str,
    sucursal_id: int | None = None,
    duracion_min: int = 30,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)
    if sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if duracion_min <= 0 or duracion_min > 240:
        raise HTTPException(status_code=400, detail="duracion_min inválido.")
    try:
        day = datetime.fromisoformat(fecha).date()
    except Exception:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usa YYYY-MM-DD.")

    return _build_slots_for_day(sucursal_id, day, duracion_min)


@app.get("/ventas", summary="Listar ventas")
def listar_ventas(
    limit: int = 50,
    sucursal_id: int | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    anio: int | None = None,
    mes: int | None = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    where = ["v.activo = true"]
    params: list[Any] = []

    if sucursal_id is not None:
        where.append("v.sucursal_id = %s")
        params.append(sucursal_id)

    if mes is not None and (mes < 1 or mes > 12):
        raise HTTPException(status_code=400, detail="Mes inválido. Debe ser entre 1 y 12.")

    if fecha_desde and fecha_hasta:
        where.append("DATE(v.fecha_hora) BETWEEN %s AND %s")
        params.extend([fecha_desde, fecha_hasta])
    elif fecha_desde:
        where.append("DATE(v.fecha_hora) >= %s")
        params.append(fecha_desde)
    elif fecha_hasta:
        where.append("DATE(v.fecha_hora) <= %s")
        params.append(fecha_hasta)
    elif anio is not None and mes is not None:
        where.append("EXTRACT(YEAR FROM v.fecha_hora) = %s")
        where.append("EXTRACT(MONTH FROM v.fecha_hora) = %s")
        params.extend([anio, mes])
    elif anio is not None:
        where.append("EXTRACT(YEAR FROM v.fecha_hora) = %s")
        params.append(anio)
    else:
        where.append("DATE(v.fecha_hora) = CURRENT_DATE")

    sql = f"""
    SELECT
      v.venta_id,
      v.fecha_hora,
      v.compra,
      v.monto_total,
      v.metodo_pago,
      v.adelanto_aplica,
      v.adelanto_monto,
      v.adelanto_metodo,
      v.como_nos_conocio,
      v.notas,
      v.paciente_id,
      p.primer_nombre,
      p.segundo_nombre,
      p.apellido_paterno,
      p.apellido_materno,
      v.sucursal_id
    FROM core.ventas v
    JOIN core.pacientes p ON p.paciente_id = v.paciente_id
    WHERE {" AND ".join(where)}
    ORDER BY v.fecha_hora DESC, v.venta_id DESC
    LIMIT %s
    """
    params.append(limit)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    return [
        {
            "venta_id": r[0],
            "fecha_hora": str(r[1]) if r[1] else None,
            "compra": r[2],
            "monto_total": float(r[3]) if r[3] is not None else 0,
            "metodo_pago": r[4],
            "adelanto_aplica": bool(r[5]),
            "adelanto_monto": float(r[6]) if r[6] is not None else None,
            "adelanto_metodo": r[7],
            "como_nos_conocio": r[8],
            "notas": r[9],
            "paciente_id": r[10],
            "paciente_nombre": " ".join([x for x in [r[11], r[12], r[13], r[14]] if x]),
            "sucursal_id": r[15],
        }
        for r in rows
    ]


@app.post("/ventas", summary="Crear venta")
def crear_venta(v: VentaCreate, user=Depends(get_current_user)):
    require_roles(user, ("admin", "recepcion", "doctor"))
    v.sucursal_id = force_sucursal(user, v.sucursal_id)
    if user["rol"] == "admin" and v.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if not v.compra or not v.compra.strip():
        raise HTTPException(status_code=400, detail="Compra es obligatoria.")
    if v.monto_total is None or float(v.monto_total) <= 0:
        raise HTTPException(status_code=400, detail="Monto total debe ser mayor a 0.")
    v.como_nos_conocio = normalize_como_nos_conocio(v.como_nos_conocio)
    if (v.metodo_pago or "").strip() not in {"efectivo", "tarjeta_credito", "tarjeta_debito"}:
        raise HTTPException(status_code=400, detail="metodo_pago inválido.")
    if v.adelanto_aplica:
        if v.adelanto_monto is None or float(v.adelanto_monto) <= 0:
            raise HTTPException(status_code=400, detail="adelanto_monto debe ser mayor a 0.")
        if (v.adelanto_metodo or "").strip() not in {"efectivo", "tarjeta_credito", "tarjeta_debito"}:
            raise HTTPException(status_code=400, detail="adelanto_metodo inválido.")
    else:
        v.adelanto_monto = None
        v.adelanto_metodo = None

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT activa FROM core.sucursales WHERE sucursal_id = %s;", (v.sucursal_id,))
                srow = cur.fetchone()
                if srow is None:
                    raise HTTPException(status_code=400, detail="Sucursal no existe.")
                if srow[0] is not True:
                    raise HTTPException(status_code=400, detail="Sucursal inactiva.")

                cur.execute(
                    """
                    SELECT 1
                    FROM core.pacientes
                    WHERE paciente_id = %s
                      AND sucursal_id = %s
                      AND activo = true
                    """,
                    (v.paciente_id, v.sucursal_id),
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=400, detail="Paciente no existe/activo en esa sucursal.")

                cur.execute(
                    """
                    INSERT INTO core.ventas (
                      sucursal_id, paciente_id, compra, monto_total,
                      metodo_pago, adelanto_aplica, adelanto_monto, adelanto_metodo,
                      como_nos_conocio, notas, created_by
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING venta_id;
                    """,
                    (
                        v.sucursal_id,
                        v.paciente_id,
                        v.compra,
                        v.monto_total,
                        v.metodo_pago,
                        v.adelanto_aplica,
                        v.adelanto_monto,
                        v.adelanto_metodo,
                        v.como_nos_conocio,
                        v.notas,
                        user["username"],
                    ),
                )
                new_id = cur.fetchone()[0]
            conn.commit()
        return {"venta_id": new_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/ventas/{venta_id}", summary="Actualizar venta")
def actualizar_venta(venta_id: int, v: VentaCreate, user=Depends(get_current_user)):
    require_roles(user, ("admin", "recepcion", "doctor"))
    v.sucursal_id = force_sucursal(user, v.sucursal_id)
    if user["rol"] == "admin" and v.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if not v.compra or not v.compra.strip():
        raise HTTPException(status_code=400, detail="Compra es obligatoria.")
    if v.monto_total is None or float(v.monto_total) <= 0:
        raise HTTPException(status_code=400, detail="Monto total debe ser mayor a 0.")
    v.como_nos_conocio = normalize_como_nos_conocio(v.como_nos_conocio)
    if (v.metodo_pago or "").strip() not in {"efectivo", "tarjeta_credito", "tarjeta_debito"}:
        raise HTTPException(status_code=400, detail="metodo_pago inválido.")
    if v.adelanto_aplica:
        if v.adelanto_monto is None or float(v.adelanto_monto) <= 0:
            raise HTTPException(status_code=400, detail="adelanto_monto debe ser mayor a 0.")
        if (v.adelanto_metodo or "").strip() not in {"efectivo", "tarjeta_credito", "tarjeta_debito"}:
            raise HTTPException(status_code=400, detail="adelanto_metodo inválido.")
    else:
        v.adelanto_monto = None
        v.adelanto_metodo = None

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE core.ventas
                    SET paciente_id = %s,
                        compra = %s,
                        monto_total = %s,
                        metodo_pago = %s,
                        adelanto_aplica = %s,
                        adelanto_monto = %s,
                        adelanto_metodo = %s,
                        como_nos_conocio = %s,
                        notas = %s,
                        updated_at = NOW()
                    WHERE venta_id = %s
                      AND sucursal_id = %s
                      AND activo = true
                    RETURNING venta_id
                    """,
                    (
                        v.paciente_id,
                        v.compra,
                        v.monto_total,
                        v.metodo_pago,
                        v.adelanto_aplica,
                        v.adelanto_monto,
                        v.adelanto_metodo,
                        v.como_nos_conocio,
                        v.notas,
                        venta_id,
                        v.sucursal_id,
                    ),
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Venta no existe en esa sucursal o está inactiva.")
            conn.commit()
        return {"venta_id": row[0], "updated": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/ventas/{venta_id}", summary="Eliminar venta (soft delete)")
def eliminar_venta(venta_id: int, sucursal_id: int, user=Depends(get_current_user)):
    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)
    if user["rol"] == "admin" and sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE core.ventas
                SET activo = false, updated_at = NOW()
                WHERE venta_id = %s
                  AND sucursal_id = %s
                  AND activo = true
                RETURNING venta_id
                """,
                (venta_id, sucursal_id),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Venta no existe en esa sucursal o ya estaba eliminada.")
        conn.commit()
    return {"deleted_venta_id": row[0], "soft_deleted": True}


@app.get("/estadisticas/resumen", summary="Resumen estadístico por sucursal")
def estadisticas_resumen(
    sucursal_id: int | None = None,
    modo: str = "hoy",
    anio: int | None = None,
    mes: int | None = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)
    if user["rol"] == "admin" and sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

    modo = (modo or "hoy").strip().lower()
    hoy = date.today()

    if modo == "hoy":
        fecha_desde = hoy
        fecha_hasta = hoy
        periodo_label = f"Hoy ({hoy.isoformat()})"
    elif modo == "semana":
        fecha_desde = hoy - timedelta(days=hoy.weekday())
        fecha_hasta = hoy
        periodo_label = f"Semana actual ({fecha_desde.isoformat()} a {fecha_hasta.isoformat()})"
    elif modo == "mes":
        anio_val = anio or hoy.year
        mes_val = mes or hoy.month
        if mes_val < 1 or mes_val > 12:
            raise HTTPException(status_code=400, detail="Mes inválido. Debe ser entre 1 y 12.")
        ultimo_dia = monthrange(anio_val, mes_val)[1]
        fecha_desde = date(anio_val, mes_val, 1)
        fecha_hasta = date(anio_val, mes_val, ultimo_dia)
        periodo_label = f"Mes {mes_val:02d}/{anio_val}"
    elif modo == "anio":
        anio_val = anio or hoy.year
        fecha_desde = date(anio_val, 1, 1)
        fecha_hasta = date(anio_val, 12, 31)
        periodo_label = f"Año {anio_val}"
    else:
        raise HTTPException(status_code=400, detail="modo inválido. Usa: hoy, semana, mes o anio.")

    if fecha_hasta < fecha_desde:
        raise HTTPException(status_code=400, detail="Rango de fechas inválido.")

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (
                    WHERE LOWER(COALESCE(tipo_consulta, '')) LIKE '%%no_show%%'
                  )::int AS no_show
                FROM core.consultas
                WHERE activo = true
                  AND sucursal_id = %s
                  AND DATE(fecha_hora) BETWEEN %s AND %s;
                """,
                (sucursal_id, fecha_desde, fecha_hasta),
            )
            c_total, c_no_show = cur.fetchone()

            cur.execute(
                """
                SELECT
                  COUNT(*)::int AS total,
                  COALESCE(SUM(monto_total), 0)::numeric AS monto_total
                FROM core.ventas
                WHERE activo = true
                  AND sucursal_id = %s
                  AND DATE(fecha_hora) BETWEEN %s AND %s;
                """,
                (sucursal_id, fecha_desde, fecha_hasta),
            )
            v_total, v_monto_total = cur.fetchone()

            cur.execute(
                """
                SELECT DATE(fecha_hora) AS dia, COUNT(*)::int
                FROM core.consultas
                WHERE activo = true
                  AND sucursal_id = %s
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                GROUP BY DATE(fecha_hora)
                ORDER BY dia;
                """,
                (sucursal_id, fecha_desde, fecha_hasta),
            )
            consultas_dia_rows = cur.fetchall()

            cur.execute(
                """
                SELECT DATE(fecha_hora) AS dia, COUNT(*)::int
                FROM core.ventas
                WHERE activo = true
                  AND sucursal_id = %s
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                GROUP BY DATE(fecha_hora)
                ORDER BY dia;
                """,
                (sucursal_id, fecha_desde, fecha_hasta),
            )
            ventas_dia_rows = cur.fetchall()

            cur.execute(
                """
                SELECT
                  COALESCE(NULLIF(LOWER(TRIM(metodo_pago)), ''), 'sin_metodo') AS etiqueta,
                  COUNT(*)::int AS total
                FROM core.ventas
                WHERE activo = true
                  AND sucursal_id = %s
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                GROUP BY etiqueta
                ORDER BY total DESC, etiqueta ASC;
                """,
                (sucursal_id, fecha_desde, fecha_hasta),
            )
            ventas_metodo_rows = cur.fetchall()

            cur.execute(
                """
                SELECT
                  item AS etiqueta,
                  COUNT(*)::int AS total
                FROM (
                  SELECT LOWER(TRIM(x.item)) AS item
                  FROM core.consultas c
                  CROSS JOIN LATERAL regexp_split_to_table(COALESCE(c.tipo_consulta, ''), '\\|') AS x(item)
                  WHERE c.activo = true
                    AND c.sucursal_id = %s
                    AND DATE(c.fecha_hora) BETWEEN %s AND %s
                ) t
                WHERE item <> ''
                GROUP BY item
                ORDER BY total DESC, etiqueta ASC
                LIMIT 10;
                """,
                (sucursal_id, fecha_desde, fecha_hasta),
            )
            consultas_tipo_rows = cur.fetchall()

            cur.execute(
                """
                SELECT
                  CASE
                    WHEN POSITION('otro:' IN item) = 1 THEN 'otro'
                    ELSE item
                  END AS producto,
                  COUNT(*)::int AS total
                FROM (
                  SELECT LOWER(TRIM(x.item)) AS item
                  FROM core.ventas v
                  CROSS JOIN LATERAL regexp_split_to_table(COALESCE(v.compra, ''), '\\|') AS x(item)
                  WHERE v.activo = true
                    AND v.sucursal_id = %s
                    AND DATE(v.fecha_hora) BETWEEN %s AND %s
                ) t
                WHERE item <> ''
                GROUP BY producto
                ORDER BY total DESC, producto ASC
                LIMIT 10;
                """,
                (sucursal_id, fecha_desde, fecha_hasta),
            )
            productos_top_rows = cur.fetchall()

    def _series_map(rows: list[tuple[Any, int]]) -> dict[str, int]:
        return {str(r[0]): int(r[1]) for r in rows}

    consultas_map = _series_map(consultas_dia_rows)
    ventas_map = _series_map(ventas_dia_rows)

    base_days: list[str] = []
    d = fecha_desde
    while d <= fecha_hasta:
        base_days.append(str(d))
        d += timedelta(days=1)

    consultas_series = [{"dia": day, "total": int(consultas_map.get(day, 0))} for day in base_days]
    ventas_series = [{"dia": day, "total": int(ventas_map.get(day, 0))} for day in base_days]

    ventas_metodo = [{"etiqueta": str(r[0]), "total": int(r[1] or 0)} for r in ventas_metodo_rows]
    consultas_tipo = [{"etiqueta": str(r[0]), "total": int(r[1] or 0)} for r in consultas_tipo_rows]
    productos_top = [{"producto": str(r[0]), "total": int(r[1] or 0)} for r in productos_top_rows]

    return {
        "sucursal_id": sucursal_id,
        "periodo": {
            "modo": modo,
            "fecha_desde": str(fecha_desde),
            "fecha_hasta": str(fecha_hasta),
            "label": periodo_label,
        },
        "consultas": {
            "total": int(c_total or 0),
            "no_show": int(c_no_show or 0),
            "por_dia": consultas_series,
            "por_tipo": consultas_tipo,
        },
        "ventas": {
            "total": int(v_total or 0),
            "monto_total": float(v_monto_total or 0),
            "por_dia": ventas_series,
            "por_metodo_pago": ventas_metodo,
        },
        "productos_top": productos_top,
        "top_productos_mes": productos_top,
    }


@app.get("/consultas", summary="Listar consultas")
def listar_consultas(
    limit: int = 50,
    sucursal_id: int | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    anio: int | None = None,
    mes: int | None = None,
    user=Depends(get_current_user),
):

    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    where = ["v.activo = true", "c.activo = true"]
    params = []

    if sucursal_id is not None:
        where.append("v.sucursal_id = %s")
        params.append(sucursal_id)

    # Filtro por fecha:
    # - Sin filtros => solo hoy
    # - Rango (fecha_desde/fecha_hasta)
    # - Mes+anio
    # - Solo anio
    if mes is not None and (mes < 1 or mes > 12):
        raise HTTPException(status_code=400, detail="Mes inválido. Debe ser entre 1 y 12.")

    if fecha_desde and fecha_hasta:
        where.append("DATE(v.fecha_hora) BETWEEN %s AND %s")
        params.extend([fecha_desde, fecha_hasta])
    elif fecha_desde:
        where.append("DATE(v.fecha_hora) >= %s")
        params.append(fecha_desde)
    elif fecha_hasta:
        where.append("DATE(v.fecha_hora) <= %s")
        params.append(fecha_hasta)
    elif anio is not None and mes is not None:
        where.append("EXTRACT(YEAR FROM v.fecha_hora) = %s")
        where.append("EXTRACT(MONTH FROM v.fecha_hora) = %s")
        params.extend([anio, mes])
    elif anio is not None:
        where.append("EXTRACT(YEAR FROM v.fecha_hora) = %s")
        params.append(anio)
    else:
        where.append("DATE(v.fecha_hora) = CURRENT_DATE")

    where_sql = "WHERE " + " AND ".join(where)

    sql = f"""
    SELECT
      v.consulta_id, v.fecha_hora, v.tipo_consulta,
      v.doctor_primer_nombre, v.doctor_apellido_paterno,
      v.motivo, v.diagnostico, v.plan, v.notas,
      v.paciente_id, v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno,
      v.sucursal_id, v.sucursal_nombre,
      c.como_nos_conocio
    FROM core.v_consultas_forma v
    JOIN core.consultas c ON c.consulta_id = v.consulta_id
    {where_sql}
    ORDER BY v.fecha_hora DESC, v.consulta_id DESC
    LIMIT %s;
    """

    params.append(limit)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    return [
        {
            "consulta_id": r[0],
            "fecha_hora": str(r[1]) if r[1] else None,
            "tipo_consulta": r[2],
            "doctor_primer_nombre": r[3],
            "doctor_apellido_paterno": r[4],
            "motivo": r[5],
            "diagnostico": r[6],
            "plan": r[7],
            "notas": r[8],
            "paciente_id": r[9],
            "paciente_nombre": " ".join([x for x in [r[10], r[11], r[12], r[13]] if x]),
            "sucursal_id": r[14],
            "sucursal_nombre": r[15],
            "como_nos_conocio": r[16],
        }
        for r in rows
    ]


@app.get("/pacientes/{paciente_id}/consultas", summary="Historial de consultas por paciente (y sucursal)")
def historial_consultas_paciente(
    paciente_id: int,
    sucursal_id: int,
    limit: int = 200,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM core.pacientes WHERE paciente_id = %s AND sucursal_id = %s AND activo = true;",
                (paciente_id, sucursal_id),
            )
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="Paciente no existe en esta sucursal o está inactivo.")

            sql = """
            SELECT
              v.consulta_id, v.fecha_hora, v.tipo_consulta,
              v.doctor_primer_nombre, v.doctor_apellido_paterno,
              v.motivo, v.diagnostico, v.plan, v.notas,
              v.paciente_id, v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno,
              v.sucursal_id, v.sucursal_nombre,
              c.como_nos_conocio
            FROM core.v_consultas_forma v
            JOIN core.consultas c ON c.consulta_id = v.consulta_id
            WHERE v.paciente_id = %s AND v.sucursal_id = %s AND v.activo = true
            ORDER BY v.consulta_id DESC
            LIMIT %s;
            """
            cur.execute(sql, (paciente_id, sucursal_id, limit))
            rows = cur.fetchall()

    return [
        {
            "consulta_id": r[0],
            "fecha_hora": str(r[1]) if r[1] else None,
            "tipo_consulta": r[2],
            "doctor_primer_nombre": r[3],
            "doctor_apellido_paterno": r[4],
            "motivo": r[5],
            "diagnostico": r[6],
            "plan": r[7],
            "notas": r[8],
            "paciente_id": r[9],
            "paciente_nombre": " ".join([x for x in [r[10], r[11], r[12], r[13]] if x]),
            "sucursal_id": r[14],
            "sucursal_nombre": r[15],
            "como_nos_conocio": r[16],
        }
        for r in rows
    ]


@app.get("/pacientes/{paciente_id}/ventas", summary="Historial de ventas por paciente (y sucursal)")
def historial_ventas_paciente(
    paciente_id: int,
    sucursal_id: int,
    limit: int = 200,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM core.pacientes WHERE paciente_id = %s AND sucursal_id = %s AND activo = true;",
                (paciente_id, sucursal_id),
            )
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="Paciente no existe en esta sucursal o está inactivo.")

            cur.execute(
                """
                SELECT
                  v.venta_id,
                  v.fecha_hora,
                  v.compra,
                  v.monto_total,
                  v.metodo_pago,
                  v.adelanto_aplica,
                  v.adelanto_monto,
                  v.adelanto_metodo,
                  v.como_nos_conocio,
                  v.notas,
                  v.paciente_id,
                  p.primer_nombre,
                  p.segundo_nombre,
                  p.apellido_paterno,
                  p.apellido_materno,
                  v.sucursal_id
                FROM core.ventas v
                JOIN core.pacientes p ON p.paciente_id = v.paciente_id
                WHERE v.paciente_id = %s
                  AND v.sucursal_id = %s
                  AND v.activo = true
                ORDER BY v.fecha_hora DESC, v.venta_id DESC
                LIMIT %s;
                """,
                (paciente_id, sucursal_id, limit),
            )
            rows = cur.fetchall()

    return [
        {
            "venta_id": r[0],
            "fecha_hora": str(r[1]) if r[1] else None,
            "compra": r[2],
            "monto_total": float(r[3]) if r[3] is not None else 0,
            "metodo_pago": r[4],
            "adelanto_aplica": bool(r[5]),
            "adelanto_monto": float(r[6]) if r[6] is not None else None,
            "adelanto_metodo": r[7],
            "como_nos_conocio": r[8],
            "notas": r[9],
            "paciente_id": r[10],
            "paciente_nombre": " ".join([x for x in [r[11], r[12], r[13], r[14]] if x]),
            "sucursal_id": r[15],
        }
        for r in rows
    ]


@app.get("/pacientes/{paciente_id}/historia", response_model=HistoriaClinicaOut)
def get_historia_clinica(
    paciente_id: int,
    sucursal_id: Optional[int] = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "doctor"))

    sucursal_id = force_sucursal(user, sucursal_id)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT historia_id, paciente_id, sucursal_id,
                       od_esfera, od_cilindro, od_eje, od_add,
                       oi_esfera, oi_cilindro, oi_eje, oi_add,
                       dp,
                       queratometria_od, queratometria_oi,
                       presion_od, presion_oi,
                       paciente_fecha_nacimiento, paciente_edad,
                       paciente_primer_nombre, paciente_segundo_nombre,
                       paciente_apellido_paterno, paciente_apellido_materno,
                       paciente_telefono, paciente_correo, puesto_laboral,
                       historia, antecedentes,
                       antecedentes_generales, antecedentes_familiares, antecedentes_otro,
                       alergias, enfermedades, cirugias,
                       fumador_tabaco, fumador_marihuana, consumidor_alcohol, diabetes, tipo_diabetes, deportista,
                       ppc, lejos, cerca, tension, mmhg, di,
                       avsinrxod, avsinrixoi, avsinrxoi, capvisualod, capvisualoi, avrxantod, avrxantoi,
                       queraod, queraoi, retinosod, retinosoi, subjeoi, adicionod, adicionoi,
                       papila, biomicroscopia,
                       doctor_atencion,
                       diagnostico_general, observaciones,
                       created_by, created_at, updated_at, activo
                FROM core.historias_clinicas
                WHERE paciente_id = %s
                  AND sucursal_id = %s
                  AND activo = TRUE
                """,
                (paciente_id, sucursal_id),
            )

            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Historia clínica no encontrada.")

            columns = [desc[0] for desc in cur.description]
            return dict(zip(columns, row))



@app.post("/pacientes/{paciente_id}/historia", response_model=HistoriaClinicaOut)
def create_historia_clinica(
    paciente_id: int,
    data: HistoriaClinicaCreate,
    sucursal_id: Optional[int] = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:

            # verificar que paciente existe en esa sucursal
            cur.execute(
                """
                SELECT fecha_nacimiento, primer_nombre, segundo_nombre,
                       apellido_paterno, apellido_materno,
                       telefono, correo, ocupacion
                FROM core.pacientes
                WHERE paciente_id = %s
                  AND sucursal_id = %s
                  AND activo = TRUE
                """,
                (paciente_id, sucursal_id),
            )
            paciente_row = cur.fetchone()
            if paciente_row is None:
                raise HTTPException(status_code=404, detail="Paciente no válido en esta sucursal.")
            (
                paciente_fecha_nacimiento,
                paciente_primer_nombre,
                paciente_segundo_nombre,
                paciente_apellido_paterno,
                paciente_apellido_materno,
                paciente_telefono,
                paciente_correo,
                paciente_puesto_laboral,
            ) = paciente_row

            paciente_edad = None
            if paciente_fecha_nacimiento:
                try:
                    nacimiento = paciente_fecha_nacimiento
                    if isinstance(nacimiento, str):
                        nacimiento = datetime.fromisoformat(nacimiento).date()
                    today = datetime.now().date()
                    paciente_edad = today.year - nacimiento.year - (
                        (today.month, today.day) < (nacimiento.month, nacimiento.day)
                    )
                except Exception:
                    paciente_edad = None

            # verificar que NO exista ya historia clínica (porque es UNIQUE)
            cur.execute(
                """
                SELECT 1 FROM core.historias_clinicas
                WHERE paciente_id = %s
                  AND sucursal_id = %s
                  AND activo = TRUE
                """,
                (paciente_id, sucursal_id),
            )
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="El paciente ya tiene historia clínica.")

            # insertar
            cur.execute(
                """
                INSERT INTO core.historias_clinicas (
                    paciente_id, sucursal_id,
                    od_esfera, od_cilindro, od_eje, od_add,
                    oi_esfera, oi_cilindro, oi_eje, oi_add,
                    dp,
                    queratometria_od, queratometria_oi,
                    presion_od, presion_oi,
                    paciente_fecha_nacimiento, paciente_edad,
                    paciente_primer_nombre, paciente_segundo_nombre,
                    paciente_apellido_paterno, paciente_apellido_materno,
                    paciente_telefono, paciente_correo, puesto_laboral,
                    historia, antecedentes,
                    antecedentes_generales, antecedentes_familiares, antecedentes_otro,
                    alergias, enfermedades, cirugias,
                    fumador_tabaco, fumador_marihuana, consumidor_alcohol, diabetes, tipo_diabetes, deportista,
                    ppc, lejos, cerca, tension, mmhg, di,
                    avsinrxod, avsinrixoi, avsinrxoi, capvisualod, capvisualoi, avrxantod, avrxantoi,
                    queraod, queraoi, retinosod, retinosoi, subjeoi, adicionod, adicionoi,
                    papila, biomicroscopia,
                    doctor_atencion,
                    diagnostico_general, observaciones,
                    created_by
                )
                VALUES (
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s,
                    %s,
                    %s, %s,
                    %s
                )
                RETURNING *
                """,
                (
                    paciente_id, sucursal_id,
                    data.od_esfera, data.od_cilindro, data.od_eje, data.od_add,
                    data.oi_esfera, data.oi_cilindro, data.oi_eje, data.oi_add,
                    data.dp,
                    data.queratometria_od, data.queratometria_oi,
                    data.presion_od, data.presion_oi,
                    data.paciente_fecha_nacimiento or (str(paciente_fecha_nacimiento) if paciente_fecha_nacimiento else None),
                    data.paciente_edad if data.paciente_edad is not None else paciente_edad,
                    data.paciente_primer_nombre or paciente_primer_nombre,
                    data.paciente_segundo_nombre or paciente_segundo_nombre,
                    data.paciente_apellido_paterno or paciente_apellido_paterno,
                    data.paciente_apellido_materno or paciente_apellido_materno,
                    data.paciente_telefono or paciente_telefono,
                    data.paciente_correo or paciente_correo,
                    data.puesto_laboral or paciente_puesto_laboral,
                    data.historia, data.antecedentes,
                    data.antecedentes_generales, data.antecedentes_familiares, data.antecedentes_otro,
                    data.alergias, data.enfermedades, data.cirugias,
                    data.fumador_tabaco, data.fumador_marihuana, data.consumidor_alcohol, data.diabetes, data.tipo_diabetes, data.deportista,
                    data.ppc, data.lejos, data.cerca, data.tension, data.mmhg, data.di,
                    data.avsinrxod,
                    (data.avsinrixoi if data.avsinrixoi is not None else data.avsinrxoi),
                    (data.avsinrxoi if data.avsinrxoi is not None else data.avsinrixoi),
                    data.capvisualod, data.capvisualoi, data.avrxantod, data.avrxantoi,
                    data.queraod, data.queraoi, data.retinosod, data.retinosoi, data.subjeoi, data.adicionod, data.adicionoi,
                    data.papila, data.biomicroscopia,
                    data.doctor_atencion,
                    data.diagnostico_general, data.observaciones,
                    user["username"],
                ),
            )

            row = cur.fetchone()
            conn.commit()

            columns = [desc[0] for desc in cur.description]
            return dict(zip(columns, row))







@app.post("/consultas", summary="Crear consulta")
def crear_consulta(c: ConsultaCreate, user=Depends(get_current_user)):

    require_roles(user, ("admin", "doctor", "recepcion"))
    c.sucursal_id = force_sucursal(user, c.sucursal_id)

    if user["rol"] == "admin" and c.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    c.como_nos_conocio = normalize_como_nos_conocio(c.como_nos_conocio)

    agenda_event_id: str | None = None
    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:

                cur.execute(
                    "SELECT activa FROM core.sucursales WHERE sucursal_id = %s;",
                    (c.sucursal_id,),
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=400, detail="Sucursal no existe.")
                if row[0] is not True:
                    raise HTTPException(status_code=400, detail="Sucursal está inactiva.")

                cur.execute(
                    """
                    SELECT primer_nombre, segundo_nombre, apellido_paterno, apellido_materno, correo
                    FROM core.pacientes
                    WHERE paciente_id = %s
                      AND sucursal_id = %s
                      AND activo = true;
                    """,
                    (c.paciente_id, c.sucursal_id),
                )
                paciente_row = cur.fetchone()
                if paciente_row is None:
                    raise HTTPException(status_code=400, detail="Paciente no existe/activo en esa sucursal.")
                paciente_nombre = " ".join([x for x in paciente_row[:4] if x and str(x).strip()])
                paciente_correo = str(paciente_row[4]).strip() if paciente_row[4] else None

                agenda_start: datetime | None = None
                agenda_end: datetime | None = None
                calendar_enabled = _calendar_feature_enabled()
                if c.agendar_en_calendario and calendar_enabled:
                    if not c.agenda_inicio or not c.agenda_fin:
                        raise HTTPException(
                            status_code=400,
                            detail="Para agendar en calendario debes enviar agenda_inicio y agenda_fin.",
                        )
                    tz_name = _timezone_for_sucursal(c.sucursal_id)
                    agenda_start = _parse_dt_in_tz(c.agenda_inicio, tz_name)
                    agenda_end = _parse_dt_in_tz(c.agenda_fin, tz_name)
                    if agenda_end <= agenda_start:
                        raise HTTPException(status_code=400, detail="agenda_fin debe ser mayor que agenda_inicio.")
                    _validate_in_business_hours(c.sucursal_id, agenda_start, agenda_end)

                    cal_id = _calendar_id_for_sucursal(c.sucursal_id)
                    busy = _fetch_busy_intervals(
                        cal_id,
                        tz_name,
                        agenda_start,
                        agenda_end,
                        sucursal_id=c.sucursal_id,
                    )
                    if _has_overlap(agenda_start, agenda_end, busy):
                        raise HTTPException(
                            status_code=409,
                            detail="El horario seleccionado ya no está disponible en Google Calendar.",
                        )

                sql = """
                INSERT INTO core.consultas (
                  paciente_id, sucursal_id, tipo_consulta,
                  doctor_primer_nombre, doctor_apellido_paterno,
                  motivo, diagnostico, plan, notas, como_nos_conocio
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING consulta_id;
                """
                cur.execute(
                    sql,
                    (
                        c.paciente_id,
                        c.sucursal_id,
                        c.tipo_consulta,
                        c.doctor_primer_nombre,
                        c.doctor_apellido_paterno,
                        c.motivo,
                        c.diagnostico,
                        c.plan,
                        c.notas,
                        c.como_nos_conocio,
                    ),
                )
                new_id = cur.fetchone()[0]

                if c.agendar_en_calendario and calendar_enabled and agenda_start and agenda_end:
                    doctor_nombre = " ".join(
                        [
                            x
                            for x in [c.doctor_primer_nombre, c.doctor_apellido_paterno]
                            if x and str(x).strip()
                        ]
                    )
                    agenda_event_id = _create_calendar_event_for_consulta(
                        sucursal_id=c.sucursal_id,
                        start_dt=agenda_start,
                        end_dt=agenda_end,
                        paciente_id=c.paciente_id,
                        paciente_nombre=paciente_nombre,
                        paciente_correo=paciente_correo,
                        tipo_consulta=c.tipo_consulta,
                        doctor_nombre=doctor_nombre,
                    )
                    if agenda_event_id:
                        cur.execute(
                            """
                            UPDATE core.consultas
                            SET agenda_event_id = %s
                            WHERE consulta_id = %s
                              AND sucursal_id = %s
                            """,
                            (agenda_event_id, new_id, c.sucursal_id),
                        )

            conn.commit()

        return {"consulta_id": new_id, "agenda_event_id": agenda_event_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))





@app.delete("/consultas/{consulta_id}", summary="Eliminar consulta (soft delete)")
def eliminar_consulta(consulta_id: int, sucursal_id: int, user=Depends(get_current_user)):

    require_roles(user, ("admin", "doctor", "recepcion"))
    sucursal_id = force_sucursal(user, sucursal_id)

    if user["rol"] == "admin" and sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

    sql = """
    UPDATE core.consultas
    SET activo = false
    WHERE consulta_id = %s
      AND sucursal_id = %s
      AND activo = true
    RETURNING consulta_id, agenda_event_id;
    """

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (consulta_id, sucursal_id))
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Consulta no existe en esa sucursal o ya estaba eliminada.")
                agenda_event_id = row[1]
                if agenda_event_id:
                    _delete_calendar_event_for_consulta(
                        sucursal_id=sucursal_id,
                        event_id=str(agenda_event_id),
                    )
            conn.commit()

        return {"deleted_consulta_id": row[0], "soft_deleted": True, "calendar_event_deleted": bool(row[1])}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/consultas/{consulta_id}", summary="Actualizar consulta")
def actualizar_consulta(consulta_id: int, c: ConsultaCreate, user=Depends(get_current_user)):
    require_roles(user, ("admin", "doctor", "recepcion"))
    c.sucursal_id = force_sucursal(user, c.sucursal_id)

    if user["rol"] == "admin" and c.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    c.como_nos_conocio = normalize_como_nos_conocio(c.como_nos_conocio)

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT activa FROM core.sucursales WHERE sucursal_id = %s;",
                    (c.sucursal_id,),
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=400, detail="Sucursal no existe.")
                if row[0] is not True:
                    raise HTTPException(status_code=400, detail="Sucursal está inactiva.")

                cur.execute(
                    """
                    SELECT 1
                    FROM core.pacientes
                    WHERE paciente_id = %s
                      AND sucursal_id = %s
                      AND activo = true;
                    """,
                    (c.paciente_id, c.sucursal_id),
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=400, detail="Paciente no existe/activo en esa sucursal.")

                cur.execute(
                    """
                    UPDATE core.consultas
                    SET paciente_id = %s,
                        tipo_consulta = %s,
                        doctor_primer_nombre = %s,
                        doctor_apellido_paterno = %s,
                        motivo = %s,
                        diagnostico = %s,
                        plan = %s,
                        notas = %s,
                        como_nos_conocio = %s
                    WHERE consulta_id = %s
                      AND sucursal_id = %s
                      AND activo = true
                    RETURNING consulta_id;
                    """,
                    (
                        c.paciente_id,
                        c.tipo_consulta,
                        c.doctor_primer_nombre,
                        c.doctor_apellido_paterno,
                        c.motivo,
                        c.diagnostico,
                        c.plan,
                        c.notas,
                        c.como_nos_conocio,
                        consulta_id,
                        c.sucursal_id,
                    ),
                )
                updated = cur.fetchone()
                if updated is None:
                    raise HTTPException(status_code=404, detail="Consulta no existe en esa sucursal o está inactiva.")
            conn.commit()
        return {"consulta_id": updated[0], "updated": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    

    
@app.delete("/pacientes/{paciente_id}", summary="Eliminar paciente (soft delete)")
def eliminar_paciente(paciente_id: int, sucursal_id: int, user=Depends(get_current_user)):

    require_roles(user, ("admin",))
    sucursal_id = force_sucursal(user, sucursal_id)
    

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:

                # 1) verificar que no tenga consultas activas
                cur.execute(
                    """
                    SELECT 1
                    FROM core.consultas
                    WHERE paciente_id = %s
                      AND sucursal_id = %s
                      AND activo = true
                    LIMIT 1;
                    """,
                    (paciente_id, sucursal_id),
                )
                if cur.fetchone() is not None:
                    raise HTTPException(
                        status_code=409,
                        detail="No se puede eliminar: el paciente tiene consultas activas.",
                    )

                # 2) hacer soft delete del paciente
                cur.execute(
                    """
                    UPDATE core.pacientes
                    SET activo = false
                    WHERE paciente_id = %s
                      AND sucursal_id = %s
                      AND activo = true
                    RETURNING paciente_id;
                    """,
                    (paciente_id, sucursal_id),
                )
                row = cur.fetchone()

            conn.commit()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Paciente no existe en esa sucursal o ya estaba eliminado.",
            )

        return {"deleted_paciente_id": row[0], "soft_deleted": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    




    
