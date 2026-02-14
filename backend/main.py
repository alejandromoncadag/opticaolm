from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware

from jose import jwt, JWTError
from passlib.hash import argon2

from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone

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
    allow_origins=["http://localhost:5173"],
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
                ADD COLUMN IF NOT EXISTS avsinrixoi text,
                ADD COLUMN IF NOT EXISTS doctor_atencion text;
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
    paciente_fecha_nacimiento: Optional[str] = None
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
           fecha_nacimiento, sexo, telefono, correo,
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
            "ocupacion": r[9],
            "alergias": r[10],
            "fumador_tabaco": r[11],
            "consumidor_alcohol": r[12],
            "fumador_marihuana": r[13],
            "creado_en": r[14].isoformat() if r[14] else None,
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
    

    sql = """
    INSERT INTO core.pacientes (
      sucursal_id, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
      fecha_nacimiento, sexo, telefono, correo
    )
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
                    p.correo
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
      correo = %s
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

    where = ["activo = true"]
    params = []

    if sucursal_id is not None:
        where.append("sucursal_id = %s")
        params.append(sucursal_id)

    # Filtro por fecha:
    # - Sin filtros => solo hoy
    # - Rango (fecha_desde/fecha_hasta)
    # - Mes+anio
    # - Solo anio
    if mes is not None and (mes < 1 or mes > 12):
        raise HTTPException(status_code=400, detail="Mes inválido. Debe ser entre 1 y 12.")

    if fecha_desde and fecha_hasta:
        where.append("DATE(fecha_hora) BETWEEN %s AND %s")
        params.extend([fecha_desde, fecha_hasta])
    elif fecha_desde:
        where.append("DATE(fecha_hora) >= %s")
        params.append(fecha_desde)
    elif fecha_hasta:
        where.append("DATE(fecha_hora) <= %s")
        params.append(fecha_hasta)
    elif anio is not None and mes is not None:
        where.append("EXTRACT(YEAR FROM fecha_hora) = %s")
        where.append("EXTRACT(MONTH FROM fecha_hora) = %s")
        params.extend([anio, mes])
    elif anio is not None:
        where.append("EXTRACT(YEAR FROM fecha_hora) = %s")
        params.append(anio)
    else:
        where.append("DATE(fecha_hora) = CURRENT_DATE")

    where_sql = "WHERE " + " AND ".join(where)

    sql = f"""
    SELECT
      consulta_id, fecha_hora, tipo_consulta,
      doctor_primer_nombre, doctor_apellido_paterno,
      motivo, diagnostico, plan, notas,
      paciente_id, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
      sucursal_id, sucursal_nombre
    FROM core.v_consultas_forma
    {where_sql}
    ORDER BY fecha_hora DESC, consulta_id DESC
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
              consulta_id, fecha_hora, tipo_consulta,
              doctor_primer_nombre, doctor_apellido_paterno,
              motivo, diagnostico, plan, notas,
              paciente_id, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
              sucursal_id, sucursal_nombre
            FROM core.v_consultas_forma
            WHERE paciente_id = %s AND sucursal_id = %s AND activo = true
            ORDER BY consulta_id DESC
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

    require_roles(user, ("admin", "doctor"))
    c.sucursal_id = force_sucursal(user, c.sucursal_id)

    if user["rol"] == "admin" and c.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

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

                sql = """
                INSERT INTO core.consultas (
                  paciente_id, sucursal_id, tipo_consulta,
                  doctor_primer_nombre, doctor_apellido_paterno,
                  motivo, diagnostico, plan, notas
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
                    ),
                )
                new_id = cur.fetchone()[0]

            conn.commit()

        return {"consulta_id": new_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))





@app.delete("/consultas/{consulta_id}", summary="Eliminar consulta (soft delete)")
def eliminar_consulta(consulta_id: int, sucursal_id: int, user=Depends(get_current_user)):

    require_roles(user, ("admin", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    if user["rol"] == "admin" and sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

    sql = """
    UPDATE core.consultas
    SET activo = false
    WHERE consulta_id = %s
      AND sucursal_id = %s
      AND activo = true
    RETURNING consulta_id;
    """

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (consulta_id, sucursal_id))
                row = cur.fetchone()
            conn.commit()

        if row is None:
            raise HTTPException(status_code=404, detail="Consulta no existe en esa sucursal o ya estaba eliminada.")

        return {"deleted_consulta_id": row[0], "soft_deleted": True}

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
    




    
