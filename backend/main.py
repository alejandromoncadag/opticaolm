from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from jose import jwt, JWTError
from passlib.hash import argon2

from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, timedelta, timezone, date, time
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo
import json
import csv
import io
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


def _resolve_cors_origins() -> list[str]:
    configured = os.getenv("FRONTEND_ORIGIN", "").strip()
    if configured:
        origins = [x.strip() for x in configured.split(",") if x.strip()]
        if origins:
            return origins

    # Defaults: local + Cloudflare Pages
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "https://opticaolm.pages.dev",
    ]


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

DB_CONNINFO = (
    DATABASE_URL
    if DATABASE_URL
    else os.getenv(
        "DB_CONNINFO",
        "host=localhost port=5432 dbname=eyecare user=alejandromoncadag",
    )
)

app = FastAPI(
    title="Óptica OLM API",
    description="API para gestionar pacientes y consultas (México).",
    version="0.1.0",
)

CORS_ORIGINS = _resolve_cors_origins()




CORS_ALLOW_CREDENTIALS = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"^https://[a-z0-9]+\.opticaolm\.pages\.dev$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)







# ===== Auth config =====
JWT_SECRET = os.getenv("JWT_SECRET", "CAMBIA_ESTE_SECRET_EN_PROD")
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = 60 * 24  # 1 día

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def ensure_historia_schema():
    # Migra columnas nuevas de forma idempotente al iniciar API.
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE SCHEMA IF NOT EXISTS core;")

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.historias_clinicas (
                    historia_clinica_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL,
                    paciente_id integer NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),

                    -- columnas base que YA usas en ALTERs/updates
                    created_at_tz timestamptz NULL,

                    -- columnas de graduación base (para que no fallen los ALTER TYPE)
                    od_esfera text NULL,
                    od_cilindro text NULL,
                    od_eje text NULL,
                    od_add text NULL,
                    oi_esfera text NULL,
                    oi_cilindro text NULL,
                    oi_eje text NULL,
                    oi_add text NULL,
                    dp text NULL,
                    queratometria_od text NULL,
                    queratometria_oi text NULL,
                    presion_od text NULL,
                    presion_oi text NULL,
                    ppc text NULL,
                    lejos text NULL,
                    cerca text NULL,
                    tension text NULL,
                    mmhg text NULL,
                    di text NULL,
                    adicionod text NULL,
                    adicionoi text NULL
                );
                """
            )



            cur.execute(
                """
                ALTER TABLE core.historias_clinicas
                ADD COLUMN IF NOT EXISTS puesto_laboral text,
                ADD COLUMN IF NOT EXISTS antecedentes_generales text,
                ADD COLUMN IF NOT EXISTS antecedentes_otro text,
                ADD COLUMN IF NOT EXISTS alergias text,
                ADD COLUMN IF NOT EXISTS enfermedades text,
                ADD COLUMN IF NOT EXISTS cirugias text,
                ADD COLUMN IF NOT EXISTS avsinrixoi text,
                ADD COLUMN IF NOT EXISTS subjeod text,
                ADD COLUMN IF NOT EXISTS horas_pantalla_dia text,
                ADD COLUMN IF NOT EXISTS conduccion_nocturna_horas text,
                ADD COLUMN IF NOT EXISTS exposicion_uv text,
                ADD COLUMN IF NOT EXISTS tabaquismo_estado text,
                ADD COLUMN IF NOT EXISTS tabaquismo_intensidad text,
                ADD COLUMN IF NOT EXISTS tabaquismo_anios text,
                ADD COLUMN IF NOT EXISTS tabaquismo_anios_desde_dejo text,
                ADD COLUMN IF NOT EXISTS alcohol_frecuencia text,
                ADD COLUMN IF NOT EXISTS marihuana_frecuencia text,
                ADD COLUMN IF NOT EXISTS marihuana_forma text,
                ADD COLUMN IF NOT EXISTS drogas_consumo text,
                ADD COLUMN IF NOT EXISTS drogas_tipos text,
                ADD COLUMN IF NOT EXISTS drogas_frecuencia text,
                ADD COLUMN IF NOT EXISTS deporte_frecuencia text,
                ADD COLUMN IF NOT EXISTS deporte_duracion text,
                ADD COLUMN IF NOT EXISTS deporte_tipos text,
                ADD COLUMN IF NOT EXISTS hipertension boolean,
                ADD COLUMN IF NOT EXISTS medicamentos text,
                ADD COLUMN IF NOT EXISTS diabetes_estado text,
                ADD COLUMN IF NOT EXISTS diabetes_control text,
                ADD COLUMN IF NOT EXISTS diabetes_anios text,
                ADD COLUMN IF NOT EXISTS diabetes_tratamiento text,
                ADD COLUMN IF NOT EXISTS usa_lentes boolean,
                ADD COLUMN IF NOT EXISTS tipo_lentes_actual text,
                ADD COLUMN IF NOT EXISTS tiempo_uso_lentes text,
                ADD COLUMN IF NOT EXISTS lentes_contacto_horas_dia text,
                ADD COLUMN IF NOT EXISTS sintomas text,
                ADD COLUMN IF NOT EXISTS doctor_atencion text,
                ADD COLUMN IF NOT EXISTS antecedentes_oculares_familiares text,
                ADD COLUMN IF NOT EXISTS antecedentes_oculares_familiares_otro text,
                ADD COLUMN IF NOT EXISTS recomendacion_tratamiento text,
                ADD COLUMN IF NOT EXISTS fotofobia_escala text,
                ADD COLUMN IF NOT EXISTS dolor_ocular_escala text,
                ADD COLUMN IF NOT EXISTS cefalea_frecuencia text,
                ADD COLUMN IF NOT EXISTS trabajo_cerca_horas_dia text,
                ADD COLUMN IF NOT EXISTS distancia_promedio_pantalla_cm text,
                ADD COLUMN IF NOT EXISTS iluminacion_trabajo text,
                ADD COLUMN IF NOT EXISTS flotadores_destellos text,
                ADD COLUMN IF NOT EXISTS flotadores_inicio_reciente boolean,
                ADD COLUMN IF NOT EXISTS flotadores_lateralidad text,
                ADD COLUMN IF NOT EXISTS uso_lentes_proteccion_uv text,
                ADD COLUMN IF NOT EXISTS uso_lentes_sol_frecuencia text,
                ADD COLUMN IF NOT EXISTS horas_exterior_dia text,
                ADD COLUMN IF NOT EXISTS nivel_educativo text,
                ADD COLUMN IF NOT EXISTS horas_lectura_dia text,
                ADD COLUMN IF NOT EXISTS horas_sueno_promedio text,
                ADD COLUMN IF NOT EXISTS estres_nivel text,
                ADD COLUMN IF NOT EXISTS peso_kg numeric(5,1),
                ADD COLUMN IF NOT EXISTS altura_cm integer,
                ADD COLUMN IF NOT EXISTS sintomas_al_despertar text,
                ADD COLUMN IF NOT EXISTS sintomas_al_despertar_otro text,
                ADD COLUMN IF NOT EXISTS convive_mascotas text,
                ADD COLUMN IF NOT EXISTS convive_mascotas_otro text,
                ADD COLUMN IF NOT EXISTS uso_aire_acondicionado_frecuencia text,
                ADD COLUMN IF NOT EXISTS uso_aire_acondicionado_horas_dia text,
                ADD COLUMN IF NOT EXISTS uso_calefaccion_frecuencia text,
                ADD COLUMN IF NOT EXISTS uso_calefaccion_horas_dia text,
                ADD COLUMN IF NOT EXISTS uso_pantalla_en_oscuridad text,
                ADD COLUMN IF NOT EXISTS cafeina_por_dia text,
                ADD COLUMN IF NOT EXISTS diagnostico_principal text,
                ADD COLUMN IF NOT EXISTS diagnostico_principal_otro text,
                ADD COLUMN IF NOT EXISTS diagnosticos_secundarios text,
                ADD COLUMN IF NOT EXISTS diagnosticos_secundarios_otro text,
                ADD COLUMN IF NOT EXISTS seguimiento_requerido boolean,
                ADD COLUMN IF NOT EXISTS seguimiento_tipo text,
                ADD COLUMN IF NOT EXISTS seguimiento_valor text;
                """
            )
            cur.execute(
                """
                ALTER TABLE core.historias_clinicas
                  DROP COLUMN IF EXISTS historia,
                  DROP COLUMN IF EXISTS antecedentes_familiares,
                  DROP COLUMN IF EXISTS observaciones;
                """
            )
            
            cur.execute(
                """
                UPDATE core.historias_clinicas
                SET created_at_tz = CASE
                    WHEN sucursal_id = 2 THEN (created_at AT TIME ZONE 'America/Cancun')
                    ELSE (created_at AT TIME ZONE 'America/Mexico_City')
                END
                WHERE created_at IS NOT NULL
                  AND created_at_tz IS NULL;
                """
            )
            cur.execute(
                """
                UPDATE core.historias_clinicas
                SET created_at_tz = NOW()
                WHERE created_at_tz IS NULL;
                """
            )
            cur.execute(
                """
                ALTER TABLE core.historias_clinicas
                  ALTER COLUMN created_at_tz SET DEFAULT NOW();
                """
            )
            cur.execute(
                """
                ALTER TABLE core.historias_clinicas
                  ALTER COLUMN created_at_tz SET NOT NULL;
                """
            )
        conn.commit()


def ensure_ventas_schema():
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            # 0) Asegurar schema
            cur.execute("CREATE SCHEMA IF NOT EXISTS core;")

            # 1) Asegurar sucursales (para que los FOREIGN KEY no fallen)
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.sucursales (
                    sucursal_id integer PRIMARY KEY,
                    nombre text NOT NULL
                );
                """
            )
            cur.execute(
                """
                INSERT INTO core.sucursales (sucursal_id, nombre)
                VALUES
                    (1, 'Edomex'),
                    (2, 'Playa')
                ON CONFLICT (sucursal_id) DO NOTHING;
                """
            )

            # 2) Asegurar pacientes (mínimo) para que ventas pueda referenciar
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.pacientes (
                    paciente_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL REFERENCES core.sucursales(sucursal_id),
                    nombre text NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW()
                );
                """
            )

            # 3) Crear ventas
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
                    notas text NULL,
                    created_by text NOT NULL,
                    updated_at timestamptz NULL,
                    activo boolean NOT NULL DEFAULT true
                );
                """
            )

            # 4) Migraciones idempotentes de columnas (por si ya existía tabla)
            cur.execute(
                """
                ALTER TABLE core.ventas
                ADD COLUMN IF NOT EXISTS metodo_pago text NOT NULL DEFAULT 'efectivo',
                ADD COLUMN IF NOT EXISTS adelanto_aplica boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS adelanto_monto numeric(12,2) NULL,
                ADD COLUMN IF NOT EXISTS adelanto_metodo text NULL;
                """
            )

            # 5) Índices
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_ventas_sucursal_fecha ON core.ventas (sucursal_id, fecha_hora DESC);"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_ventas_paciente ON core.ventas (paciente_id);"
            )

            # 6) Normalización histórica de opciones de compra (no rompe si tabla vacía)
            cur.execute(
                r"""
                UPDATE core.ventas
                SET compra = regexp_replace(compra, '(^|\|)armazon(\||$)', '\1armazon_solo\2', 'g')
                WHERE compra ~ '(^|\|)armazon(\||$)';
                """
            )
            cur.execute(
                r"""
                UPDATE core.ventas
                SET compra = regexp_replace(compra, '(^|\|)micas(\||$)', '\1micas_solas_sin_tratamiento\2', 'g')
                WHERE compra ~ '(^|\|)micas(\||$)';
                """
            )
            cur.execute(
                r"""
                UPDATE core.ventas
                SET compra = regexp_replace(compra, '(^|\|)lentes_contacto(\||$)', '\1lentes_de_contacto\2', 'g')
                WHERE compra ~ '(^|\|)lentes_contacto(\||$)';
                """
            )

        conn.commit()




def ensure_consultas_schema():
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:

            cur.execute("CREATE SCHEMA IF NOT EXISTS core;")

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.consultas (
                    consulta_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL REFERENCES core.sucursales(sucursal_id),
                    paciente_id integer NOT NULL REFERENCES core.pacientes(paciente_id),
                    fecha_hora timestamptz NOT NULL DEFAULT NOW(),
                    tipo_consulta text NOT NULL DEFAULT 'revision_general',
                    notas text NULL,
                    created_by text NULL,
                    updated_at timestamptz NULL,
                    activo boolean NOT NULL DEFAULT true
                );
                """
            )

            cur.execute(
                """
                ALTER TABLE core.consultas
                ADD COLUMN IF NOT EXISTS agenda_event_id text NULL,
                ADD COLUMN IF NOT EXISTS agenda_inicio timestamptz NULL,
                ADD COLUMN IF NOT EXISTS agenda_fin timestamptz NULL,
                ADD COLUMN IF NOT EXISTS etapa_consulta text NULL,
                ADD COLUMN IF NOT EXISTS motivo_consulta text NULL;
                """
            )

        conn.commit()


def ensure_pacientes_schema():
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                ALTER TABLE core.pacientes
                ADD COLUMN IF NOT EXISTS como_nos_conocio text NULL,
                ADD COLUMN IF NOT EXISTS calle text NULL,
                ADD COLUMN IF NOT EXISTS numero text NULL,
                ADD COLUMN IF NOT EXISTS colonia text NULL,
                ADD COLUMN IF NOT EXISTS municipio text NULL,
                ADD COLUMN IF NOT EXISTS pais text NULL;
                """
            )
        conn.commit()


def ensure_reporting_views():
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                ALTER TABLE core.ventas
                  DROP COLUMN IF EXISTS paciente_nombre,
                  DROP COLUMN IF EXISTS sucursal_nombre;

                ALTER TABLE core.consultas
                  DROP COLUMN IF EXISTS paciente_nombre,
                  DROP COLUMN IF EXISTS sucursal_nombre;

                ALTER TABLE core.pacientes
                  DROP COLUMN IF EXISTS nombre_completo;
                """
            )

            cur.execute(
                """
                CREATE OR REPLACE VIEW core.pacientes_detalle AS
                SELECT
                    p.*,
                    p.nombre AS nombre_completo
                FROM core.pacientes p;
                """
            )

            cur.execute(
                """
                CREATE OR REPLACE VIEW core.consultas_detalle AS
                SELECT
                    c.*,
                    p.nombre AS paciente_nombre,
                    s.nombre AS sucursal_nombre
                FROM core.consultas c
                LEFT JOIN core.pacientes p ON p.paciente_id = c.paciente_id
                LEFT JOIN core.sucursales s ON s.sucursal_id = c.sucursal_id;
                """
            )

            cur.execute(
                """
                CREATE OR REPLACE VIEW core.ventas_detalle AS
                SELECT
                    v.*,
                    p.nombre AS paciente_nombre,
                    s.nombre AS sucursal_nombre
                FROM core.ventas v
                LEFT JOIN core.pacientes p ON p.paciente_id = v.paciente_id
                LEFT JOIN core.sucursales s ON s.sucursal_id = v.sucursal_id;
                """
            )

        conn.commit()



def ensure_auth_schema():
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE SCHEMA IF NOT EXISTS core;")

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.usuarios (
                    usuario_id bigserial PRIMARY KEY,
                    username text UNIQUE NOT NULL,
                    password_hash text NOT NULL,
                    role text NOT NULL DEFAULT 'admin',
                    sucursal_id integer NULL,
                    activo boolean NOT NULL DEFAULT true,
                    created_at timestamptz NOT NULL DEFAULT NOW()
                );
                """
            )

            # Por si la tabla ya existía antes sin sucursal_id
            cur.execute(
                """
                ALTER TABLE core.usuarios
                ADD COLUMN IF NOT EXISTS sucursal_id integer NULL;
                """
            )

            cur.execute(
                """
                ALTER TABLE core.usuarios
                ADD COLUMN IF NOT EXISTS pwd_changed_at timestamptz NULL;
                """
            )

            admin_user = os.getenv("ADMIN_USER", "admin")
            admin_pass = os.getenv("ADMIN_PASS", "admin1234")
            admin_hash = argon2.hash(admin_pass)

            cur.execute(
                """
                INSERT INTO core.usuarios (username, password_hash, role, sucursal_id, activo)
                VALUES (%s, %s, 'admin', NULL, true)
                ON CONFLICT (username) DO UPDATE
                SET password_hash = EXCLUDED.password_hash,
                    role = EXCLUDED.role,
                    activo = true;
                """,
                (admin_user, admin_hash),
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
    calle: str | None = None
    numero: str | None = None
    colonia: str | None = None
    cp: str | None = None
    codigo_postal: str | None = None
    municipio: str | None = None
    estado: str | None = None
    estado_direccion: str | None = None
    pais: str | None = None

class ConsultaCreate(BaseModel):
    paciente_id: int
    sucursal_id: int | None = 1
    tipo_consulta: str | None = None
    etapa_consulta: str | None = None
    motivo_consulta: str | None = None
    doctor_primer_nombre: str | None = None
    doctor_apellido_paterno: str | None = None
    notas: str | None = None
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
    od_esfera: Optional[str] = None
    od_cilindro: Optional[str] = None
    od_eje: Optional[str] = None
    od_add: Optional[str] = None

    oi_esfera: Optional[str] = None
    oi_cilindro: Optional[str] = None
    oi_eje: Optional[str] = None
    oi_add: Optional[str] = None

    dp: Optional[str] = None

    queratometria_od: Optional[str] = None
    queratometria_oi: Optional[str] = None

    presion_od: Optional[str] = None
    presion_oi: Optional[str] = None

    # Snapshot del paciente al momento de registrar historia
    paciente_fecha_nacimiento: Optional[date] = None
    paciente_edad: Optional[int] = None
    paciente_primer_nombre: Optional[str] = None
    paciente_segundo_nombre: Optional[str] = None
    paciente_apellido_paterno: Optional[str] = None
    paciente_apellido_materno: Optional[str] = None
    paciente_telefono: Optional[str] = None
    paciente_correo: Optional[str] = None
    paciente_calle: Optional[str] = None
    paciente_numero: Optional[str] = None
    paciente_colonia: Optional[str] = None
    paciente_codigo_postal: Optional[str] = None
    paciente_municipio: Optional[str] = None
    paciente_estado: Optional[str] = None
    paciente_pais: Optional[str] = None
    puesto_laboral: Optional[str] = None
    doctor_atencion: Optional[str] = None

    # Nuevos campos clínicos
    antecedentes: Optional[str] = None
    antecedentes_generales: Optional[str] = None
    antecedentes_otro: Optional[str] = None
    antecedentes_oculares_familiares: Optional[str] = None
    antecedentes_oculares_familiares_otro: Optional[str] = None
    alergias: Optional[str] = None
    enfermedades: Optional[str] = None
    cirugias: Optional[str] = None
    fumador_tabaco: Optional[bool] = None
    fumador_marihuana: Optional[bool] = None
    consumidor_alcohol: Optional[bool] = None
    diabetes: Optional[bool] = None
    tipo_diabetes: Optional[str] = None
    deportista: Optional[bool] = None
    horas_pantalla_dia: Optional[str] = None
    conduccion_nocturna_horas: Optional[str] = None
    exposicion_uv: Optional[str] = None
    tabaquismo_estado: Optional[str] = None
    tabaquismo_intensidad: Optional[str] = None
    tabaquismo_anios: Optional[str] = None
    tabaquismo_anios_desde_dejo: Optional[str] = None
    alcohol_frecuencia: Optional[str] = None
    alcohol_copas: Optional[str] = None
    marihuana_frecuencia: Optional[str] = None
    marihuana_forma: Optional[str] = None
    drogas_consumo: Optional[str] = None
    drogas_tipos: Optional[str] = None
    drogas_frecuencia: Optional[str] = None
    deporte_frecuencia: Optional[str] = None
    deporte_duracion: Optional[str] = None
    deporte_tipos: Optional[str] = None
    hipertension: Optional[bool] = None
    medicamentos: Optional[str] = None
    diabetes_estado: Optional[str] = None
    diabetes_control: Optional[str] = None
    diabetes_anios: Optional[str] = None
    diabetes_tratamiento: Optional[str] = None
    usa_lentes: Optional[bool] = None
    tipo_lentes_actual: Optional[str] = None
    tiempo_uso_lentes: Optional[str] = None
    lentes_contacto_horas_dia: Optional[str] = None
    lentes_contacto_dias_semana: Optional[str] = None
    uso_lentes_proteccion_uv: Optional[str] = None
    uso_lentes_sol_frecuencia: Optional[str] = None
    sintomas: Optional[str] = None
    fotofobia_escala: Optional[str] = None
    dolor_ocular_escala: Optional[str] = None
    cefalea_frecuencia: Optional[str] = None
    trabajo_cerca_horas_dia: Optional[str] = None
    distancia_promedio_pantalla_cm: Optional[str] = None
    iluminacion_trabajo: Optional[str] = None
    flotadores_destellos: Optional[str] = None
    flotadores_inicio_reciente: Optional[bool] = None
    flotadores_lateralidad: Optional[str] = None
    horas_exterior_dia: Optional[str] = None
    nivel_educativo: Optional[str] = None
    horas_lectura_dia: Optional[str] = None
    horas_sueno_promedio: Optional[str] = None
    estres_nivel: Optional[str] = None
    peso_kg: Optional[float] = None
    altura_cm: Optional[int] = None
    sintomas_al_despertar: Optional[str] = None
    sintomas_al_despertar_otro: Optional[str] = None
    convive_mascotas: Optional[str] = None
    convive_mascotas_otro: Optional[str] = None
    uso_aire_acondicionado_frecuencia: Optional[str] = None
    uso_aire_acondicionado_horas_dia: Optional[str] = None
    uso_calefaccion_frecuencia: Optional[str] = None
    uso_calefaccion_horas_dia: Optional[str] = None
    uso_pantalla_en_oscuridad: Optional[str] = None
    cafeina_por_dia: Optional[str] = None

    ppc: Optional[str] = None
    lejos: Optional[str] = None
    cerca: Optional[str] = None
    tension: Optional[str] = None
    mmhg: Optional[str] = None
    di: Optional[str] = None

    avsinrxod: Optional[str] = None
    avsinrixoi: Optional[str] = None
    capvisualod: Optional[str] = None
    capvisualoi: Optional[str] = None
    avrxantod: Optional[str] = None
    avrxantoi: Optional[str] = None
    queraod: Optional[str] = None
    queraoi: Optional[str] = None
    retinosod: Optional[str] = None
    retinosoi: Optional[str] = None
    subjeod: Optional[str] = None
    subjeoi: Optional[str] = None
    adicionod: Optional[str] = None
    adicionoi: Optional[str] = None
    papila: Optional[str] = None
    biomicroscopia: Optional[str] = None

    diagnostico_general: Optional[str] = None
    diagnostico_principal: Optional[str] = None
    diagnostico_principal_otro: Optional[str] = None
    diagnosticos_secundarios: Optional[str] = None
    diagnosticos_secundarios_otro: Optional[str] = None
    recomendacion_tratamiento: Optional[str] = None
    seguimiento_requerido: Optional[bool] = None
    seguimiento_tipo: Optional[str] = None
    seguimiento_valor: Optional[str] = None


class HistoriaClinicaCreate(HistoriaClinicaBase):
    paciente_id: int


class HistoriaClinicaOut(HistoriaClinicaBase):
    historia_id: int
    paciente_id: int
    sucursal_id: int
    created_by: str
    created_at: datetime
    created_at_tz: Optional[datetime] = None
    updated_at: Optional[datetime]
    activo: bool

class HistoriaClinicaUpdate(HistoriaClinicaBase):
    pass


class HistoriaEstadoBatchIn(BaseModel):
    paciente_ids: list[int]

COMO_NOS_CONOCIO_VALUES = {"instagram", "fb", "google", "linkedin", "linkedln", "referencia"}
COMO_NOS_CONOCIO_CANONICAL = {"linkedln": "linkedin"}
CONSULTA_ETAPA_ALLOWED = {"primera_vez_en_clinica", "seguimiento"}
CONSULTA_MOTIVO_ALLOWED = {"revision_general", "graduacion_lentes", "lentes_contacto", "molestia", "otro"}
VENTA_COMPRA_ALLOWED = {
    "examen_de_la_vista",
    "armazon_solo",
    "micas_solas_sin_tratamiento",
    "micas_antirreflejante",
    "micas_fotocromaticas",
    "micas_antiblueray",
    "lentes_de_contacto",
    "armazon_con_micas_sin_tratamiento",
    "armazon_con_micas_antirreflejante",
    "armazon_con_micas_fotocromaticas",
    "armazon_con_micas_antiblueray",
    "estuche_para_armazon",
    "accesorios_y_refacciones",
    "lentes_de_sol_sin_graduacion",
    "lentes_de_sol_con_graduacion",
    "soluciones_y_cuidado",
    "otro",
}
VENTA_COMPRA_ALIASES = {
    "armazon": "armazon_solo",
    "micas": "micas_solas_sin_tratamiento",
    "lentes_contacto": "lentes_de_contacto",
}


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


def normalize_controlled_token(value: str | None) -> str | None:
    if value is None:
        return None
    v = str(value).strip().lower()
    if not v:
        return None
    v = re.sub(r"\s+", "_", v)
    v = re.sub(r"_+", "_", v)
    return v


def normalize_pipe_controlled_tokens(value: str | None) -> str | None:
    if value is None:
        return None
    parts = []
    for raw in str(value).split("|"):
        token = normalize_controlled_token(raw)
        if token:
            parts.append(token)
    if not parts:
        return None
    return "|".join(parts)


def split_pipe_tokens(value: str | None) -> list[str]:
    if value is None:
        return []
    tokens: list[str] = []
    for raw in str(value).split("|"):
        token = normalize_controlled_token(raw)
        if token:
            tokens.append(token)
    return tokens


def normalize_single_allowed_token(
    value: str | None,
    allowed: set[str],
    field_label: str,
    required: bool = False,
) -> str | None:
    token = normalize_controlled_token(value)
    if not token:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_label} es requerido.")
        return None
    if token not in allowed:
        raise HTTPException(status_code=400, detail=f"{field_label} inválido: {token}.")
    return token


def normalize_multi_allowed_tokens(
    value: str | None,
    allowed: set[str],
    field_label: str,
    required: bool = False,
) -> str | None:
    tokens = split_pipe_tokens(value)
    if not tokens:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_label} es requerido.")
        return None
    out: list[str] = []
    for token in tokens:
        if token not in allowed:
            raise HTTPException(status_code=400, detail=f"{field_label} inválido: {token}.")
        out.append(token)
    dedup = list(dict.fromkeys(out))
    if required and not dedup:
        raise HTTPException(status_code=400, detail=f"{field_label} es requerido.")
    return "|".join(dedup) if dedup else None


def extract_consulta_from_tipo(tipo_consulta: str | None) -> tuple[str | None, str | None]:
    tokens = split_pipe_tokens(tipo_consulta)
    if not tokens:
        return None, None
    etapa = next((t for t in tokens if t in CONSULTA_ETAPA_ALLOWED), None)
    motivos = [t for t in tokens if t in CONSULTA_MOTIVO_ALLOWED]
    motivos = list(dict.fromkeys(motivos))
    return etapa, "|".join(motivos) if motivos else None


def resolve_consulta_etapa_motivo_tipo(
    etapa_consulta: str | None,
    motivo_consulta: str | None,
    tipo_consulta_legacy: str | None,
) -> tuple[str, str, str]:
    etapa = normalize_single_allowed_token(
        etapa_consulta, CONSULTA_ETAPA_ALLOWED, "etapa_consulta", required=False
    )
    motivo = normalize_multi_allowed_tokens(
        motivo_consulta, CONSULTA_MOTIVO_ALLOWED, "motivo_consulta", required=False
    )

    if not etapa or not motivo:
        legacy_etapa, legacy_motivo = extract_consulta_from_tipo(tipo_consulta_legacy)
        if not etapa:
            etapa = legacy_etapa
        if not motivo:
            motivo = legacy_motivo

    if not etapa:
        raise HTTPException(
            status_code=400,
            detail="etapa_consulta es requerida (primera_vez_en_clinica o seguimiento).",
        )
    if etapa not in CONSULTA_ETAPA_ALLOWED:
        raise HTTPException(status_code=400, detail=f"etapa_consulta inválida: {etapa}.")

    if not motivo:
        raise HTTPException(
            status_code=400,
            detail="motivo_consulta es requerido (revision_general, graduacion_lentes, lentes_contacto, molestia u otro).",
        )
    motivo_tokens = [t for t in split_pipe_tokens(motivo) if t in CONSULTA_MOTIVO_ALLOWED]
    motivo_tokens = list(dict.fromkeys(motivo_tokens))
    if not motivo_tokens:
        raise HTTPException(
            status_code=400,
            detail="motivo_consulta es requerido (revision_general, graduacion_lentes, lentes_contacto, molestia u otro).",
        )
    motivo = "|".join(motivo_tokens)

    tipo_tokens = list(dict.fromkeys([etapa, *motivo_tokens]))
    tipo_compuesto = "|".join(tipo_tokens)
    return etapa, motivo, tipo_compuesto


def resolve_consulta_read_fields(
    etapa_consulta: str | None,
    motivo_consulta: str | None,
    tipo_consulta: str | None,
) -> tuple[str | None, str | None]:
    etapa: str | None = None
    motivo: str | None = None
    try:
        etapa = normalize_single_allowed_token(
            etapa_consulta, CONSULTA_ETAPA_ALLOWED, "etapa_consulta", required=False
        )
    except HTTPException:
        etapa = None
    try:
        motivo = normalize_multi_allowed_tokens(
            motivo_consulta, CONSULTA_MOTIVO_ALLOWED, "motivo_consulta", required=False
        )
    except HTTPException:
        motivo = None

    if not etapa or not motivo:
        legacy_etapa, legacy_motivo = extract_consulta_from_tipo(tipo_consulta)
        if not etapa:
            etapa = legacy_etapa
        if not motivo:
            motivo = legacy_motivo
    return etapa, motivo


def compose_consulta_tipo(etapa_consulta: str | None, motivo_consulta: str | None) -> str | None:
    etapa = normalize_controlled_token(etapa_consulta)
    motivos = [
        t for t in split_pipe_tokens(motivo_consulta) if t in CONSULTA_MOTIVO_ALLOWED
    ]
    motivos = list(dict.fromkeys(motivos))
    tokens = [t for t in [etapa, *motivos] if t]
    if not tokens:
        return None
    return "|".join(tokens)


def normalize_compra_tokens(value: str | None) -> str | None:
    if value is None:
        return None
    out: list[str] = []
    for raw in str(value).split("|"):
        item = str(raw).strip()
        if not item:
            continue
        # "otro: ..." conserva la parte libre después del prefijo.
        if item.lower().startswith("otro:"):
            detalle = item.split(":", 1)[1].strip()
            if detalle:
                out.append(f"otro:{detalle}")
            else:
                out.append("otro")
            continue
        norm = normalize_controlled_token(item)
        if norm:
            canon = VENTA_COMPRA_ALIASES.get(norm, norm)
            if canon not in VENTA_COMPRA_ALLOWED:
                raise HTTPException(status_code=400, detail=f"Opción de compra inválida: {item}")
            out.append(canon)
    if not out:
        return None
    # Eliminar duplicados preservando orden.
    dedup = list(dict.fromkeys(out))
    return "|".join(dedup)


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


def is_missing_value(v):
    if v is None:
        return True
    if isinstance(v, str) and not v.strip():
        return True
    return False


def sanitize_payload_strings(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: sanitize_payload_strings(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize_payload_strings(v) for v in value]
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned if cleaned != "" else None
    return value


def sanitize_model_strings(model: BaseModel) -> None:
    cleaned = sanitize_payload_strings(model.dict())
    if not isinstance(cleaned, dict):
        return
    for key, value in cleaned.items():
        if hasattr(model, key):
            setattr(model, key, value)


def normalize_peso_kg(value: Any) -> float | None:
    if is_missing_value(value):
        return None
    raw = str(value).strip().replace(",", ".")
    try:
        dec = Decimal(raw)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="peso_kg inválido. Usa número con máximo 1 decimal.")
    if dec < 0:
        raise HTTPException(status_code=400, detail="peso_kg inválido. Debe ser mayor o igual a 0.")
    if dec.as_tuple().exponent < -1:
        raise HTTPException(status_code=400, detail="peso_kg inválido. Solo se permite 1 decimal.")
    return float(dec)


def normalize_altura_cm(value: Any) -> int | None:
    if is_missing_value(value):
        return None
    raw = str(value).strip()
    if not re.fullmatch(r"\d+", raw):
        raise HTTPException(status_code=400, detail="altura_cm inválido. Debe ser entero (cm).")
    altura = int(raw)
    if altura < 0:
        raise HTTPException(status_code=400, detail="altura_cm inválido. Debe ser mayor o igual a 0.")
    return altura
















@app.on_event("startup")
def startup_migrations():
    ensure_auth_schema()
    ensure_historia_schema()
    ensure_ventas_schema()
    ensure_consultas_schema()
    ensure_pacientes_schema()
    ensure_reporting_views()
    _load_google_calendar_env_cache()

   


@app.get("/health", summary="Salud del sistema")
def health():
    return {"ok": True}


def _parse_export_sucursal_id(raw_value: str | None) -> int | None:
    value = str(raw_value or "all").strip().lower()
    if value in {"all", "ambas", "todas"}:
        return None
    try:
        sucursal_id = int(value)
    except Exception:
        raise HTTPException(status_code=400, detail="sucursal_id inválido. Usa un entero o 'all'.")
    if sucursal_id <= 0:
        raise HTTPException(status_code=400, detail="sucursal_id inválido. Debe ser mayor a 0.")
    return sucursal_id


def _parse_export_delimiter(delimiter: str | None) -> str:
    raw = str(delimiter or "comma").strip().lower()
    if raw == "comma":
        return ","
    if raw == "semicolon":
        return ";"
    raise HTTPException(status_code=400, detail="delimiter inválido. Usa 'comma' o 'semicolon'.")


def _parse_iso_date_or_400(value: str, field_name: str) -> date:
    try:
        return datetime.fromisoformat(str(value)).date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"{field_name} inválida. Usa formato YYYY-MM-DD.")


def _resolve_export_date_range(desde: str | None, hasta: str | None, sucursal_id: int | None) -> tuple[date, date]:
    if desde:
        desde_date = _parse_iso_date_or_400(desde, "desde")
    else:
        desde_date = None
    if hasta:
        hasta_date = _parse_iso_date_or_400(hasta, "hasta")
    else:
        hasta_date = None

    if desde_date is None and hasta_date is None:
        tz_name = _timezone_for_sucursal(sucursal_id) if sucursal_id is not None else "UTC"
        today = datetime.now(ZoneInfo(tz_name)).date()
        desde_date = date(today.year, today.month, 1)
        hasta_date = date(today.year, today.month, monthrange(today.year, today.month)[1])
    elif desde_date is None and hasta_date is not None:
        desde_date = hasta_date
    elif desde_date is not None and hasta_date is None:
        hasta_date = desde_date

    if hasta_date < desde_date:
        raise HTTPException(status_code=400, detail="Rango inválido: 'hasta' debe ser mayor o igual a 'desde'.")

    return desde_date, hasta_date


def _csv_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, bool):
        return "true" if value else "false"
    return value


def _stream_csv_query(sql: str, params: tuple[Any, ...], headers: list[str], delimiter_char: str):
    def _generator():
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                buff = io.StringIO()
                writer = csv.writer(buff, delimiter=delimiter_char, lineterminator="\n")
                buff.write("\ufeff")
                writer.writerow(headers)
                yield buff.getvalue()
                buff.seek(0)
                buff.truncate(0)

                while True:
                    rows = cur.fetchmany(1000)
                    if not rows:
                        break
                    for row in rows:
                        writer.writerow([_csv_value(v) for v in row])
                    yield buff.getvalue()
                    buff.seek(0)
                    buff.truncate(0)

    return _generator()


def _export_filename(prefix: str, desde_date: date, hasta_date: date, sucursal_id: int | None) -> str:
    sid = "all" if sucursal_id is None else f"sucursal_{sucursal_id}"
    return f"{prefix}_{sid}_{desde_date.isoformat()}_{hasta_date.isoformat()}.csv"


def _current_user_dep(token: str = Depends(oauth2_scheme)):
    return get_current_user(token)


@app.get("/usuarios/doctores", summary="Listar doctores (solo admin)")
def listar_doctores_para_export(sucursal_id: int | None = None, user=Depends(_current_user_dep)):
    require_roles(user, ("admin",))
    where = ["activo = true", "rol = 'doctor'"]
    params: list[Any] = []
    if sucursal_id is not None:
        where.append("sucursal_id = %s")
        params.append(sucursal_id)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT usuario_id, username, sucursal_id
                FROM core.usuarios
                WHERE {' AND '.join(where)}
                ORDER BY username ASC;
                """,
                tuple(params),
            )
            rows = cur.fetchall()

    return [
        {"doctor_id": int(r[0]), "username": str(r[1]), "sucursal_id": int(r[2]) if r[2] is not None else None}
        for r in rows
    ]


@app.get("/export/consultas.csv", summary="Exportar consultas CSV (solo admin)")
def export_consultas_csv(
    sucursal_id: str = "all",
    desde: str | None = None,
    hasta: str | None = None,
    paciente_id: int | None = None,
    doctor_id: int | None = None,
    delimiter: str = "comma",
    user=Depends(_current_user_dep),
):
    require_roles(user, ("admin",))
    sid = _parse_export_sucursal_id(sucursal_id)
    delimiter_char = _parse_export_delimiter(delimiter)
    desde_date, hasta_date = _resolve_export_date_range(desde, hasta, sid)

    doctor_username: str | None = None
    if doctor_id is not None:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT username
                    FROM core.usuarios
                    WHERE usuario_id = %s
                      AND activo = true
                      AND rol = 'doctor';
                    """,
                    (doctor_id,),
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=400, detail="doctor_id inválido o inactivo.")
                doctor_username = str(row[0])

    where = ["c.activo = true", "DATE(c.fecha_hora) BETWEEN %s AND %s"]
    params: list[Any] = [desde_date, hasta_date]
    if sid is not None:
        where.append("c.sucursal_id = %s")
        params.append(sid)
    if paciente_id is not None:
        where.append("c.paciente_id = %s")
        params.append(paciente_id)
    if doctor_username is not None:
        where.append("LOWER(TRIM(COALESCE(c.doctor_primer_nombre, ''))) = LOWER(TRIM(%s))")
        params.append(doctor_username)

    headers = [
        "consulta_id",
        "paciente_id",
        "sucursal_id",
        "fecha_hora",
        "etapa_consulta",
        "motivo_consulta",
        "doctor_primer_nombre",
        "doctor_apellido_paterno",
        "notas",
        "agenda_event_id",
        "agenda_inicio",
        "agenda_fin",
    ]
    sql = f"""
    SELECT
      c.consulta_id,
      c.paciente_id,
      c.sucursal_id,
      c.fecha_hora,
      c.etapa_consulta,
      c.motivo_consulta,
      c.doctor_primer_nombre,
      c.doctor_apellido_paterno,
      c.notas,
      c.agenda_event_id,
      c.agenda_inicio,
      c.agenda_fin
    FROM core.consultas c
    WHERE {' AND '.join(where)}
    ORDER BY c.fecha_hora DESC, c.consulta_id DESC;
    """
    filename = _export_filename("consultas", desde_date, hasta_date, sid)
    return StreamingResponse(
        _stream_csv_query(sql, tuple(params), headers, delimiter_char),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/export/ventas.csv", summary="Exportar ventas CSV (solo admin)")
def export_ventas_csv(
    sucursal_id: str = "all",
    desde: str | None = None,
    hasta: str | None = None,
    paciente_id: int | None = None,
    doctor_id: int | None = None,
    delimiter: str = "comma",
    user=Depends(_current_user_dep),
):
    require_roles(user, ("admin",))
    sid = _parse_export_sucursal_id(sucursal_id)
    delimiter_char = _parse_export_delimiter(delimiter)
    desde_date, hasta_date = _resolve_export_date_range(desde, hasta, sid)

    doctor_username: str | None = None
    if doctor_id is not None:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT username
                    FROM core.usuarios
                    WHERE usuario_id = %s
                      AND activo = true
                      AND rol = 'doctor';
                    """,
                    (doctor_id,),
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=400, detail="doctor_id inválido o inactivo.")
                doctor_username = str(row[0])

    where = ["v.activo = true", "DATE(v.fecha_hora) BETWEEN %s AND %s"]
    params: list[Any] = [desde_date, hasta_date]
    if sid is not None:
        where.append("v.sucursal_id = %s")
        params.append(sid)
    if paciente_id is not None:
        where.append("v.paciente_id = %s")
        params.append(paciente_id)
    if doctor_username is not None:
        where.append("LOWER(TRIM(COALESCE(v.created_by, ''))) = LOWER(TRIM(%s))")
        params.append(doctor_username)

    headers = [
        "venta_id",
        "sucursal_id",
        "paciente_id",
        "fecha_hora",
        "compra",
        "monto_total",
        "metodo_pago",
        "adelanto_aplica",
        "adelanto_monto",
        "adelanto_metodo",
        "notas",
        "created_by",
        "updated_at",
        "activo",
    ]
    sql = f"""
    SELECT
      v.venta_id,
      v.sucursal_id,
      v.paciente_id,
      v.fecha_hora,
      v.compra,
      v.monto_total,
      v.metodo_pago,
      v.adelanto_aplica,
      v.adelanto_monto,
      v.adelanto_metodo,
      v.notas,
      v.created_by,
      v.updated_at,
      v.activo
    FROM core.ventas v
    WHERE {' AND '.join(where)}
    ORDER BY v.fecha_hora DESC, v.venta_id DESC;
    """
    filename = _export_filename("ventas", desde_date, hasta_date, sid)
    return StreamingResponse(
        _stream_csv_query(sql, tuple(params), headers, delimiter_char),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/export/pacientes.csv", summary="Exportar pacientes CSV (solo admin)")
def export_pacientes_csv(
    sucursal_id: str = "all",
    desde: str | None = None,
    hasta: str | None = None,
    paciente_id: int | None = None,
    doctor_id: int | None = None,
    delimiter: str = "comma",
    user=Depends(_current_user_dep),
):
    require_roles(user, ("admin",))
    if doctor_id is not None:
        raise HTTPException(status_code=400, detail="doctor_id no aplica para export de pacientes.")
    sid = _parse_export_sucursal_id(sucursal_id)
    delimiter_char = _parse_export_delimiter(delimiter)
    desde_date, hasta_date = _resolve_export_date_range(desde, hasta, sid)

    where = ["p.activo = true", "DATE(p.creado_en) BETWEEN %s AND %s"]
    params: list[Any] = [desde_date, hasta_date]
    if sid is not None:
        where.append("p.sucursal_id = %s")
        params.append(sid)
    if paciente_id is not None:
        where.append("p.paciente_id = %s")
        params.append(paciente_id)

    headers = [
        "paciente_id",
        "sucursal_id",
        "primer_nombre",
        "segundo_nombre",
        "apellido_paterno",
        "apellido_materno",
        "fecha_nacimiento",
        "sexo",
        "telefono",
        "correo",
        "creado_en",
        "actualizado_en",
        "activo",
        "como_nos_conocio",
        "calle",
        "numero",
        "colonia",
        "cp",
        "municipio",
        "estado",
        "pais",
    ]
    sql = f"""
    SELECT
      p.paciente_id,
      p.sucursal_id,
      p.primer_nombre,
      p.segundo_nombre,
      p.apellido_paterno,
      p.apellido_materno,
      p.fecha_nacimiento,
      p.sexo,
      p.telefono,
      p.correo,
      p.creado_en,
      p.actualizado_en,
      p.activo,
      p.como_nos_conocio,
      p.calle,
      p.numero,
      p.colonia,
      COALESCE(NULLIF(p.codigo_postal, ''), NULLIF(p.cp, '')) AS cp,
      p.municipio,
      COALESCE(NULLIF(p.estado_direccion, ''), NULLIF(p.estado, '')) AS estado,
      p.pais
    FROM core.pacientes p
    WHERE {' AND '.join(where)}
    ORDER BY p.apellido_paterno ASC, p.apellido_materno ASC, p.primer_nombre ASC, p.paciente_id ASC;
    """
    filename = _export_filename("pacientes", desde_date, hasta_date, sid)
    return StreamingResponse(
        _stream_csv_query(sql, tuple(params), headers, delimiter_char),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/export/historias_clinicas.csv", summary="Exportar historias clínicas CSV (solo admin)")
def export_historias_clinicas_csv(
    sucursal_id: str = "all",
    desde: str | None = None,
    hasta: str | None = None,
    paciente_id: int | None = None,
    doctor_id: int | None = None,
    delimiter: str = "comma",
    user=Depends(_current_user_dep),
):
    require_roles(user, ("admin",))
    if doctor_id is not None:
        raise HTTPException(status_code=400, detail="doctor_id no aplica para export de historias clínicas.")

    sid = _parse_export_sucursal_id(sucursal_id)
    delimiter_char = _parse_export_delimiter(delimiter)
    desde_date, hasta_date = _resolve_export_date_range(desde, hasta, sid)

    where = ["h.activo = true", "DATE(h.created_at_tz) BETWEEN %s AND %s"]
    params: list[Any] = [desde_date, hasta_date]
    if sid is not None:
        where.append("h.sucursal_id = %s")
        params.append(sid)
    if paciente_id is not None:
        where.append("h.paciente_id = %s")
        params.append(paciente_id)

    headers = [
        "historia_id", "paciente_id", "sucursal_id",
        "doctor_atencion", "puesto_laboral",
        "diagnostico_general",
        "diagnostico_principal", "diagnostico_principal_otro",
        "diagnosticos_secundarios", "diagnosticos_secundarios_otro",
        "recomendacion_tratamiento",
        "seguimiento_requerido", "seguimiento_tipo", "seguimiento_valor",
        "antecedentes_generales", "antecedentes_otro",
        "antecedentes_oculares_familiares", "antecedentes_oculares_familiares_otro",
        "alergias", "enfermedades", "cirugias",
        "diabetes_estado", "diabetes_control", "diabetes_anios", "diabetes_tratamiento",
        "horas_pantalla_dia", "conduccion_nocturna_horas", "exposicion_uv",
        "tabaquismo_estado", "tabaquismo_intensidad", "tabaquismo_anios", "tabaquismo_anios_desde_dejo",
        "alcohol_frecuencia",
        "marihuana_frecuencia", "marihuana_forma",
        "drogas_consumo", "drogas_tipos", "drogas_frecuencia",
        "deporte_frecuencia", "deporte_duracion", "deporte_tipos",
        "hipertension",
        "medicamentos",
        "usa_lentes", "tipo_lentes_actual", "tiempo_uso_lentes", "lentes_contacto_horas_dia",
        "uso_lentes_proteccion_uv", "uso_lentes_sol_frecuencia",
        "fotofobia_escala", "dolor_ocular_escala", "cefalea_frecuencia",
        "trabajo_cerca_horas_dia", "distancia_promedio_pantalla_cm", "iluminacion_trabajo",
        "flotadores_destellos", "flotadores_inicio_reciente", "flotadores_lateralidad",
        "horas_exterior_dia", "nivel_educativo", "horas_lectura_dia",
        "horas_sueno_promedio", "estres_nivel", "peso_kg", "altura_cm",
        "sintomas_al_despertar", "sintomas_al_despertar_otro",
        "convive_mascotas", "convive_mascotas_otro",
        "uso_aire_acondicionado_frecuencia", "uso_aire_acondicionado_horas_dia",
        "uso_calefaccion_frecuencia", "uso_calefaccion_horas_dia",
        "uso_pantalla_en_oscuridad", "cafeina_por_dia",
        "sintomas",
        "od_esfera", "od_cilindro", "od_eje", "od_add",
        "oi_esfera", "oi_cilindro", "oi_eje", "oi_add",
        "dp", "queratometria_od", "queratometria_oi", "presion_od", "presion_oi",
        "ppc", "lejos", "cerca", "tension", "mmhg", "di",
        "avsinrxod", "avsinrixoi", "capvisualod", "capvisualoi", "avrxantod", "avrxantoi",
        "queraod", "queraoi", "retinosod", "retinosoi", "subjeod", "subjeoi",
        "papila", "adicionod", "adicionoi",
        "biomicroscopia",
        "created_by", "created_at_tz", "updated_at", "activo",
    ]
    select_cols = ",\n      ".join([f"h.{col}" for col in headers])
    sql = f"""
    SELECT
      {select_cols}
    FROM core.historias_clinicas h
    WHERE {' AND '.join(where)}
    ORDER BY h.created_at_tz DESC, h.historia_id DESC;
    """
    filename = _export_filename("historias_clinicas", desde_date, hasta_date, sid)
    return StreamingResponse(
        _stream_csv_query(sql, tuple(params), headers, delimiter_char),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/export/sucursales.csv", summary="Exportar sucursales CSV (solo admin)")
def export_sucursales_csv(
    delimiter: str = "comma",
    user=Depends(_current_user_dep),
):
    require_roles(user, ("admin",))
    delimiter_char = _parse_export_delimiter(delimiter)
    headers = ["sucursal_id", "nombre", "codigo", "ciudad", "estado", "activa"]
    sql = """
    SELECT
      s.sucursal_id,
      s.nombre,
      s.codigo,
      s.ciudad,
      s.estado,
      s.activa
    FROM core.sucursales s
    ORDER BY s.sucursal_id ASC;
    """
    filename = f"sucursales_{date.today().isoformat()}.csv"
    return StreamingResponse(
        _stream_csv_query(sql, tuple(), headers, delimiter_char),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/export/diccionario_columnas_fisico.csv", summary="Exportar diccionario físico CSV (solo admin)")
def export_diccionario_columnas_fisico_csv(
    delimiter: str = "comma",
    user=Depends(_current_user_dep),
):
    require_roles(user, ("admin",))
    delimiter_char = _parse_export_delimiter(delimiter)
    headers = [
        "schema_name",
        "table_name",
        "column_name",
        "data_type",
        "is_nullable",
        "ordinal_position",
    ]
    sql = """
    SELECT
      c.table_schema AS schema_name,
      c.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.ordinal_position
    FROM information_schema.columns c
    WHERE c.table_schema = 'core'
    ORDER BY c.table_name ASC, c.ordinal_position ASC;
    """
    filename = f"diccionario_columnas_fisico_{date.today().isoformat()}.csv"
    return StreamingResponse(
        _stream_csv_query(sql, tuple(), headers, delimiter_char),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/login", summary="Login (devuelve JWT)")
def login(data: LoginIn):
    # 1) buscar usuario activo
    sql = """
    SELECT username, password_hash, role, sucursal_id, activo, pwd_changed_at
    FROM core.usuarios
    WHERE username = %s
    LIMIT 1;
    """
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (data.username,))
            row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=401, detail="Credenciales inválidas.")

    username, password_hash, role, sucursal_id, activo, pwd_changed_at = row

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
        "rol": role,
        "sucursal_id": sucursal_id,  # None para admin
        "pwd_at": int(pwd_changed_at.timestamp()) if pwd_changed_at else None,
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


PACIENTE_ESTRELLA_CONSULTAS_6M = 15
PACIENTE_ESTRELLA_VENTAS_6M = 15
PACIENTE_ESTRELLA_MONTO_6M = 20000.0
PACIENTE_INTERMEDIO_CONSULTAS_6M = 4
PACIENTE_INTERMEDIO_VENTAS_6M = 4


def _estado_paciente_desde_metricas(
    consultas_6m: int,
    ventas_6m: int,
    monto_6m: float,
) -> str:
    if (
        consultas_6m >= PACIENTE_ESTRELLA_CONSULTAS_6M
        or ventas_6m >= PACIENTE_ESTRELLA_VENTAS_6M
        or monto_6m >= PACIENTE_ESTRELLA_MONTO_6M
    ):
        return "estrella"
    if (
        consultas_6m >= PACIENTE_INTERMEDIO_CONSULTAS_6M
        or ventas_6m >= PACIENTE_INTERMEDIO_VENTAS_6M
    ):
        return "intermedio"
    return "nuevo"


def _estado_paciente_map(sucursal_id: int | None, paciente_ids: list[int]) -> dict[int, str]:
    ids = sorted({int(pid) for pid in paciente_ids if pid is not None})
    if not ids:
        return {}

    sucursal_consultas_clause = "AND c.sucursal_id = %s" if sucursal_id is not None else ""
    sucursal_ventas_clause = "AND v.sucursal_id = %s" if sucursal_id is not None else ""

    sql = f"""
    WITH ids AS (
      SELECT UNNEST(%s::int[]) AS paciente_id
    ),
    consultas_agg AS (
      SELECT c.paciente_id, COUNT(*)::int AS consultas_6m
      FROM core.consultas c
      JOIN ids i ON i.paciente_id = c.paciente_id
      WHERE c.activo = true
        {sucursal_consultas_clause}
        AND c.fecha_hora >= (NOW() - INTERVAL '6 months')
      GROUP BY c.paciente_id
    ),
    ventas_agg AS (
      SELECT
        v.paciente_id,
        COUNT(*)::int AS ventas_6m,
        COALESCE(SUM(v.monto_total), 0)::numeric AS monto_6m
      FROM core.ventas v
      JOIN ids i ON i.paciente_id = v.paciente_id
      WHERE v.activo = true
        {sucursal_ventas_clause}
        AND v.fecha_hora >= (NOW() - INTERVAL '6 months')
      GROUP BY v.paciente_id
    )
    SELECT
      i.paciente_id,
      COALESCE(ca.consultas_6m, 0) AS consultas_6m,
      COALESCE(va.ventas_6m, 0) AS ventas_6m,
      COALESCE(va.monto_6m, 0)::numeric AS monto_6m
    FROM ids i
    LEFT JOIN consultas_agg ca ON ca.paciente_id = i.paciente_id
    LEFT JOIN ventas_agg va ON va.paciente_id = i.paciente_id;
    """

    params: list[Any] = [ids]
    if sucursal_id is not None:
        params.append(sucursal_id)
    if sucursal_id is not None:
        params.append(sucursal_id)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    out: dict[int, str] = {}
    for row in rows:
        pid = int(row[0])
        consultas_6m = int(row[1] or 0)
        ventas_6m = int(row[2] or 0)
        monto_6m = float(row[3] or 0)
        out[pid] = _estado_paciente_desde_metricas(consultas_6m, ventas_6m, monto_6m)
    return out


def _calendar_feature_enabled() -> bool:
    return os.getenv("ENABLE_GOOGLE_CALENDAR", "false").strip().lower() in {"1", "true", "yes", "on"}


OAUTH_STATE_TTL_SEC = 60 * 15
_OAUTH_STATE_PENDING: dict[str, dict[str, Any]] = {}
_GOOGLE_ENV_CACHE_LOADED = False
_GOOGLE_OAUTH_REFRESH_TOKENS_BY_SUCURSAL: dict[str, str] = {}
_GOOGLE_CALENDAR_IDS_BY_SUCURSAL: dict[str, str] = {}
_GOOGLE_OAUTH_REFRESH_TOKEN_FALLBACK: str = ""

SUCURSAL_INVITE_DEFAULTS = {
    "1": {
        "phone": "+52 5620868654",
        "maps": "https://maps.app.goo.gl/wedsqkiCUB5q1ZFf7",
        "display_name": "Óptica OLM Estado de México",
        "address": "Alfonso Reyes 96, Paseos de Sta Maria, 54800 Cuautitlán, Méx., Mexico",
    },
    "2": {
        "phone": "+52 9841776838",
        "maps": "https://maps.app.goo.gl/A2s69jzrfTkZtfhY6",
        "display_name": "Óptica OLM Playa del Carmen",
        "address": "Av. 28 de Julio esquina-115, 77725 Playa del Carmen, Q.R., Mexico",
    },
}


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


def _format_consulta_tipo_for_humans(tipo_consulta: str | None) -> str:
    if not tipo_consulta or not str(tipo_consulta).strip():
        return "General"
    mapping = {
        "primera_vez_en_clinica": "Primera vez",
        "revision_general": "Revisión general",
        "graduacion_lentes": "Graduación de lentes",
        "lentes_contacto": "Lentes de contacto",
        "seguimiento": "Seguimiento",
        "molestia": "Molestia",
        "otro": "Otro",
    }
    parts = [x.strip() for x in str(tipo_consulta).split("|") if x and x.strip()]
    if not parts:
        return "General"

    labels: list[str] = []
    for p in parts:
        low = p.lower()
        if low in mapping:
            labels.append(mapping[low])
        else:
            normalized = p.replace("_", " ").strip()
            labels.append(normalized[:1].upper() + normalized[1:] if normalized else p)

    if len(labels) == 1:
        return labels[0]
    if len(labels) == 2:
        return f"{labels[0]} y {labels[1]}"
    return f"{labels[0]}, {labels[1]} +{len(labels) - 2}"


def _timezone_display_label(tz_name: str) -> str:
    mapping = {
        "America/Cancun": "Hora Cancún",
        "America/Mexico_City": "Hora Ciudad de México",
    }
    return mapping.get(tz_name, f"Hora {tz_name}")


def _format_datetime_span_es(start_local: datetime, end_local: datetime, tz_name: str) -> str:
    weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    weekday = weekdays[start_local.weekday()]
    month = months[start_local.month - 1]
    return (
        f"{weekday} {start_local.day:02d} {month} {start_local.year} · "
        f"{start_local.strftime('%H:%M')}–{end_local.strftime('%H:%M')} "
        f"({_timezone_display_label(tz_name)})"
    )


def _sucursal_invite_contact(sucursal_id: int) -> dict[str, str]:
    data = dict(SUCURSAL_INVITE_DEFAULTS.get(str(sucursal_id), {}))
    raw = os.getenv("AGENDA_SUCURSAL_CONTACTS", "").strip()
    if not raw:
        return data
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return data
        custom = parsed.get(str(sucursal_id))
        if not isinstance(custom, dict):
            return data
        for key in ("phone", "maps", "display_name", "address"):
            value = custom.get(key)
            if value and str(value).strip():
                data[key] = str(value).strip()
    except Exception:
        pass
    return data


def _cancel_url_for_consulta(consulta_id: int, sucursal_id: int) -> str | None:
    template = os.getenv("AGENDA_CANCEL_URL_TEMPLATE", "").strip()
    if not template:
        return None
    return (
        template.replace("{consulta_id}", str(consulta_id))
        .replace("{sucursal_id}", str(sucursal_id))
    )


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
    consulta_id: int,
    sucursal_id: int,
    start_dt: datetime,
    end_dt: datetime,
    paciente_id: int,
    paciente_nombre: str,
    paciente_correo: str | None,
    tipo_consulta: str | None,
    doctor_id: str | None,
    doctor_nombre: str | None,
    sucursal_nombre: str | None,
    sucursal_location: str | None,
) -> str:
    tz_name = _timezone_for_sucursal(sucursal_id)
    cal_id = _calendar_id_for_sucursal(sucursal_id)
    service = _get_google_calendar_service(sucursal_id=sucursal_id)
    start_local = start_dt.astimezone(ZoneInfo(tz_name))
    end_local = end_dt.astimezone(ZoneInfo(tz_name))
    hora_label = _format_datetime_span_es(start_local, end_local, tz_name)
    tipo_label = _format_consulta_tipo_for_humans(tipo_consulta)
    sucursal_contact = _sucursal_invite_contact(sucursal_id)
    phone = sucursal_contact.get("phone", "")
    maps_url = sucursal_contact.get("maps", "")
    display_name = sucursal_contact.get("display_name") or sucursal_nombre or f"Sucursal #{sucursal_id}"
    full_address = sucursal_contact.get("address", "").strip()
    final_location = full_address or (sucursal_location or "").strip()
    cancel_url = _cancel_url_for_consulta(consulta_id, sucursal_id)

    agradecimiento = os.getenv(
        "AGENDA_INVITE_MESSAGE",
        "Gracias por elegir Optica O&LM. Nos vemos pronto para tu consulta.",
    ).strip()

    description_lines = [
        str(display_name),
        f"Paciente: {paciente_nombre}",
        f"Tipo de consulta: {tipo_label}",
        f"Doctor: {doctor_nombre or 'Por confirmar'}",
        f"Fecha: {hora_label}",
        f"Ubicación: {final_location or 'Por confirmar'} (ver mapa abajo)",
        "",
        "Antes de tu cita",
        "Llega 10 min antes",
        "Trae tus lentes actuales y receta previa (si tienes)",
        "",
        "Cambios",
        f"Cancelar: {cancel_url}" if cancel_url else "Cancelar: contáctanos por WhatsApp/Tel",
        "",
        "Contacto",
        f"WhatsApp/Tel: {phone or 'Por confirmar'}",
        "",
        f"Dirección + mapa: {maps_url or 'Por confirmar'}",
        "",
        agradecimiento,
    ]

    body = {
        "summary": f"Óptica O&LM: Consulta ({tipo_label}) | {paciente_nombre}",
        "description": "\n".join(description_lines),
        "start": {"dateTime": start_dt.isoformat(), "timeZone": tz_name},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": tz_name},
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 120},
            ],
        },
        "extendedProperties": {
            "private": {
                "consulta_id": str(consulta_id),
                "paciente_id": str(paciente_id),
                "sucursal_id": str(sucursal_id),
                "doctor_id": str(doctor_id or ""),
                "tipo_consulta": str(tipo_consulta or ""),
            }
        },
    }
    if final_location:
        body["location"] = final_location
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
           creado_en,
           calle, numero, colonia, cp, municipio, estado, pais
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

    estado_map = _estado_paciente_map(sucursal_id, [int(r[0]) for r in rows])

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
            "creado_en": r[10].isoformat() if r[10] else None,
            "calle": r[11],
            "numero": r[12],
            "colonia": r[13],
            "cp": r[14],
            "codigo_postal": r[14],
            "municipio": r[15],
            "estado": r[16],
            "estado_direccion": r[16],
            "pais": r[17],
            "estado_paciente": estado_map.get(int(r[0]), "nuevo"),
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

    q_clean = q.strip()
    q_like = f"%{q_clean}%"
    q_prefix = f"{q_clean}%"
    where = ["p.activo = true"]
    where_params: list[Any] = []

    if sucursal_id is not None:
        where.append("p.sucursal_id = %s")
        where_params.append(sucursal_id)

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
    where_params.extend([q_like, q_like, q_like, q_like, q_like, q_like, q_like, q_like])

    sql = f"""
    SELECT
      p.paciente_id, p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno,
      p.fecha_nacimiento, p.sexo, p.telefono, p.correo,
      p.calle, p.numero, p.colonia, p.cp, p.municipio, p.estado, p.pais,
      CASE
        WHEN CAST(p.paciente_id AS TEXT) ILIKE %s THEN 0
        WHEN p.primer_nombre ILIKE %s THEN 1
        WHEN COALESCE(p.segundo_nombre, '') ILIKE %s THEN 2
        WHEN p.apellido_paterno ILIKE %s THEN 3
        WHEN COALESCE(p.apellido_materno, '') ILIKE %s THEN 4
        WHEN CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno) ILIKE %s THEN 5
        ELSE 9
      END AS orden_busqueda
    FROM core.pacientes p
    WHERE {" AND ".join(where)}
    ORDER BY orden_busqueda ASC, p.creado_en DESC, p.paciente_id DESC
    LIMIT %s;
    """
    params = [
        q_prefix,
        q_prefix,
        q_prefix,
        q_prefix,
        q_prefix,
        q_prefix,
        *where_params,
        limit,
    ]

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    estado_map = _estado_paciente_map(sucursal_id, [int(r[0]) for r in rows])

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
            "calle": r[9],
            "numero": r[10],
            "colonia": r[11],
            "cp": r[12],
            "codigo_postal": r[12],
            "municipio": r[13],
            "estado": r[14],
            "estado_direccion": r[14],
            "pais": r[15],
            "estado_paciente": estado_map.get(int(r[0]), "nuevo"),
        }
        for r in rows
    ]


@app.get("/sucursales", summary="Listar sucursales")
def listar_sucursales():
    sql =
    """
    SELECT sucursal_id, nombre
    FROM core.sucursales
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
    sanitize_model_strings(p)

    if user["rol"] == "admin" and p.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if is_missing_value(p.primer_nombre):
        raise HTTPException(status_code=400, detail="primer_nombre es obligatorio.")
    if is_missing_value(p.apellido_paterno):
        raise HTTPException(status_code=400, detail="apellido_paterno es obligatorio.")
    p.como_nos_conocio = normalize_como_nos_conocio(p.como_nos_conocio)
    p.telefono = normalize_patient_phone(p.telefono)
    if not p.telefono:
        raise HTTPException(status_code=400, detail="Teléfono es obligatorio y debe tener 10 dígitos.")
    

    cp_value = p.cp if p.cp not in (None, "") else p.codigo_postal
    estado_value = p.estado if p.estado not in (None, "") else p.estado_direccion

    sql = """
    INSERT INTO core.pacientes (
      sucursal_id, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
      fecha_nacimiento, sexo, telefono, correo, como_nos_conocio,
      calle, numero, colonia, cp, municipio, estado, pais
    )
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
                    p.como_nos_conocio,
                    p.calle,
                    p.numero,
                    p.colonia,
                    cp_value,
                    p.municipio,
                    estado_value,
                    p.pais,
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
    sanitize_model_strings(p)

    if user["rol"] == "admin" and p.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if is_missing_value(p.primer_nombre):
        raise HTTPException(status_code=400, detail="primer_nombre es obligatorio.")
    if is_missing_value(p.apellido_paterno):
        raise HTTPException(status_code=400, detail="apellido_paterno es obligatorio.")
    p.como_nos_conocio = normalize_como_nos_conocio(p.como_nos_conocio)
    p.telefono = normalize_patient_phone(p.telefono)
    if not p.telefono:
        raise HTTPException(status_code=400, detail="Teléfono es obligatorio y debe tener 10 dígitos.")


    cp_value = p.cp if p.cp not in (None, "") else p.codigo_postal
    estado_value = p.estado if p.estado not in (None, "") else p.estado_direccion

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
      como_nos_conocio = %s,
      calle = %s,
      numero = %s,
      colonia = %s,
      cp = %s,
      municipio = %s,
      estado = %s,
      pais = %s
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
                        p.calle,
                        p.numero,
                        p.colonia,
                        cp_value,
                        p.municipio,
                        estado_value,
                        p.pais,
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


def _calc_paciente_age(value: Any) -> int | None:
    if not value:
        return None
    try:
        nacimiento = value
        if isinstance(nacimiento, str):
            nacimiento = datetime.fromisoformat(nacimiento).date()
        today = datetime.now().date()
        return today.year - nacimiento.year - (
            (today.month, today.day) < (nacimiento.month, nacimiento.day)
        )
    except Exception:
        return None


def _fetch_paciente_snapshot(cur: psycopg.Cursor, paciente_id: int, sucursal_id: int) -> tuple[Any, ...]:
    cur.execute(
        """
        SELECT
          fecha_nacimiento,
          primer_nombre,
          segundo_nombre,
          apellido_paterno,
          apellido_materno,
          telefono,
          correo,
          calle,
          numero,
          colonia,
          COALESCE(NULLIF(codigo_postal, ''), NULLIF(cp, '')) AS codigo_postal,
          municipio,
          COALESCE(NULLIF(estado_direccion, ''), NULLIF(estado, '')) AS estado,
          pais
        FROM core.pacientes
        WHERE paciente_id = %s
          AND sucursal_id = %s
          AND activo = TRUE
        """,
        (paciente_id, sucursal_id),
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Paciente no válido en esta sucursal.")
    return row


def _ensure_historia_clinica_base(cur: psycopg.Cursor, paciente_id: int, sucursal_id: int, created_by: str) -> bool:
    cur.execute(
        """
        SELECT historia_id, activo
        FROM core.historias_clinicas
        WHERE paciente_id = %s
          AND sucursal_id = %s
        ORDER BY historia_id DESC
        LIMIT 1
        """,
        (paciente_id, sucursal_id),
    )
    existing = cur.fetchone()

    paciente_snapshot = _fetch_paciente_snapshot(cur, paciente_id, sucursal_id)
    (
        paciente_fecha_nacimiento,
        paciente_primer_nombre,
        paciente_segundo_nombre,
        paciente_apellido_paterno,
        paciente_apellido_materno,
        paciente_telefono,
        paciente_correo,
        paciente_calle,
        paciente_numero,
        paciente_colonia,
        paciente_codigo_postal,
        paciente_municipio,
        paciente_estado,
        paciente_pais,
    ) = paciente_snapshot
    paciente_edad = _calc_paciente_age(paciente_fecha_nacimiento)

    if existing is None:
        cur.execute(
            """
            INSERT INTO core.historias_clinicas (
              paciente_id,
              sucursal_id,
              paciente_fecha_nacimiento,
              paciente_edad,
              paciente_primer_nombre,
              paciente_segundo_nombre,
              paciente_apellido_paterno,
              paciente_apellido_materno,
              paciente_telefono,
              paciente_correo,
              paciente_calle,
              paciente_numero,
              paciente_colonia,
              paciente_codigo_postal,
              paciente_municipio,
              paciente_estado,
              paciente_pais,
              created_by,
              created_at_tz,
              activo
            )
            VALUES (
              %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),TRUE
            );
            """,
            (
                paciente_id,
                sucursal_id,
                str(paciente_fecha_nacimiento) if paciente_fecha_nacimiento else None,
                paciente_edad,
                paciente_primer_nombre,
                paciente_segundo_nombre,
                paciente_apellido_paterno,
                paciente_apellido_materno,
                paciente_telefono,
                paciente_correo,
                paciente_calle,
                paciente_numero,
                paciente_colonia,
                paciente_codigo_postal,
                paciente_municipio,
                paciente_estado,
                paciente_pais,
                created_by,
            ),
        )
        return True

    historia_id, activo = existing
    if not bool(activo):
        cur.execute(
            """
            UPDATE core.historias_clinicas
            SET activo = TRUE,
                updated_at = NOW(),
                paciente_fecha_nacimiento = %s,
                paciente_edad = %s,
                paciente_primer_nombre = %s,
                paciente_segundo_nombre = %s,
                paciente_apellido_paterno = %s,
                paciente_apellido_materno = %s,
                paciente_telefono = %s,
                paciente_correo = %s,
                paciente_calle = %s,
                paciente_numero = %s,
                paciente_colonia = %s,
                paciente_codigo_postal = %s,
                paciente_municipio = %s,
                paciente_estado = %s,
                paciente_pais = %s
            WHERE historia_id = %s
            """,
            (
                str(paciente_fecha_nacimiento) if paciente_fecha_nacimiento else None,
                paciente_edad,
                paciente_primer_nombre,
                paciente_segundo_nombre,
                paciente_apellido_paterno,
                paciente_apellido_materno,
                paciente_telefono,
                paciente_correo,
                paciente_calle,
                paciente_numero,
                paciente_colonia,
                paciente_codigo_postal,
                paciente_municipio,
                paciente_estado,
                paciente_pais,
                historia_id,
            ),
        )
        return True

    return False


HISTORIA_ALLOWED_FIELDS = {
    "od_esfera", "od_cilindro", "od_eje", "od_add",
    "oi_esfera", "oi_cilindro", "oi_eje", "oi_add",
    "dp", "queratometria_od", "queratometria_oi",
    "presion_od", "presion_oi",
    "paciente_fecha_nacimiento", "paciente_edad",
    "paciente_primer_nombre", "paciente_segundo_nombre",
    "paciente_apellido_paterno", "paciente_apellido_materno",
    "paciente_telefono", "paciente_correo",
    "paciente_calle", "paciente_numero", "paciente_colonia", "paciente_codigo_postal", "paciente_municipio", "paciente_estado", "paciente_pais",
    "puesto_laboral", "doctor_atencion",
    "antecedentes", "antecedentes_generales", "antecedentes_otro",
    "antecedentes_oculares_familiares", "antecedentes_oculares_familiares_otro",
    "alergias", "enfermedades", "cirugias",
    "fumador_tabaco", "fumador_marihuana", "consumidor_alcohol", "diabetes", "tipo_diabetes", "deportista",
    "horas_pantalla_dia", "conduccion_nocturna_horas", "exposicion_uv",
    "tabaquismo_estado", "tabaquismo_intensidad", "tabaquismo_anios", "tabaquismo_anios_desde_dejo",
    "alcohol_frecuencia", "alcohol_copas",
    "marihuana_frecuencia", "marihuana_forma",
    "drogas_consumo", "drogas_tipos", "drogas_frecuencia",
    "deporte_frecuencia", "deporte_duracion", "deporte_tipos",
    "hipertension", "medicamentos",
    "diabetes_estado", "diabetes_control", "diabetes_anios", "diabetes_tratamiento",
    "usa_lentes", "tipo_lentes_actual", "tiempo_uso_lentes",
    "lentes_contacto_horas_dia", "lentes_contacto_dias_semana", "sintomas",
    "uso_lentes_proteccion_uv", "uso_lentes_sol_frecuencia",
    "fotofobia_escala", "dolor_ocular_escala", "cefalea_frecuencia",
    "trabajo_cerca_horas_dia", "distancia_promedio_pantalla_cm", "iluminacion_trabajo",
    "flotadores_destellos", "flotadores_inicio_reciente", "flotadores_lateralidad",
    "horas_exterior_dia", "nivel_educativo", "horas_lectura_dia",
    "horas_sueno_promedio", "estres_nivel", "peso_kg", "altura_cm",
    "sintomas_al_despertar", "sintomas_al_despertar_otro",
    "convive_mascotas", "convive_mascotas_otro",
    "uso_aire_acondicionado_frecuencia", "uso_aire_acondicionado_horas_dia",
    "uso_calefaccion_frecuencia", "uso_calefaccion_horas_dia",
    "uso_pantalla_en_oscuridad", "cafeina_por_dia",
    "ppc", "lejos", "cerca", "tension", "mmhg", "di",
    "avsinrxod", "avsinrixoi", "capvisualod", "capvisualoi", "avrxantod", "avrxantoi",
    "queraod", "queraoi", "retinosod", "retinosoi", "subjeod", "subjeoi", "adicionod", "adicionoi",
    "papila", "biomicroscopia",
    "diagnostico_general",
    "diagnostico_principal", "diagnostico_principal_otro",
    "diagnosticos_secundarios", "diagnosticos_secundarios_otro",
    "recomendacion_tratamiento",
    "seguimiento_requerido", "seguimiento_tipo", "seguimiento_valor",
}


def _normalize_historia_payload(raw_data: dict[str, Any]) -> dict[str, Any]:
    data = {k: v for k, v in raw_data.items() if k in HISTORIA_ALLOWED_FIELDS}

    if "peso_kg" in data:
        data["peso_kg"] = normalize_peso_kg(data.get("peso_kg"))
    if "altura_cm" in data:
        data["altura_cm"] = normalize_altura_cm(data.get("altura_cm"))

    if "diabetes_estado" in data:
        estado_dm = str(data.get("diabetes_estado") or "").strip().lower()
        if estado_dm in {"tipo_1", "tipo_2", "prediabetes"}:
            data["diabetes"] = True
            if is_missing_value(data.get("tipo_diabetes")):
                data["tipo_diabetes"] = estado_dm
        elif estado_dm == "no":
            data["diabetes"] = False
            data["tipo_diabetes"] = "no_aplica"
        elif estado_dm == "no_sabe":
            data["diabetes"] = False
            data["tipo_diabetes"] = "no_sabe"

    if "tabaquismo_estado" in data and "fumador_tabaco" not in data:
        data["fumador_tabaco"] = str(data.get("tabaquismo_estado") or "").strip().lower() == "fumador_actual"
    if "marihuana_frecuencia" in data and "fumador_marihuana" not in data:
        freq_m = str(data.get("marihuana_frecuencia") or "").strip().lower()
        data["fumador_marihuana"] = bool(freq_m and freq_m != "nunca")
    if "alcohol_frecuencia" in data and "consumidor_alcohol" not in data:
        freq_a = str(data.get("alcohol_frecuencia") or "").strip().lower()
        data["consumidor_alcohol"] = bool(freq_a and freq_a != "nunca")
    if "deporte_frecuencia" in data and "deportista" not in data:
        data["deportista"] = str(data.get("deporte_frecuencia") or "").strip() not in {"", "0"}

    if "diabetes" in data and data.get("diabetes") is False and is_missing_value(data.get("tipo_diabetes")):
        data["tipo_diabetes"] = "no_aplica"

    if "seguimiento_tipo" in data:
        tipo = normalize_controlled_token(data.get("seguimiento_tipo"))
        if tipo and tipo != "fecha":
            raise HTTPException(status_code=400, detail="seguimiento_tipo inválido: solo se permite 'fecha'.")
        data["seguimiento_tipo"] = "fecha" if tipo else None

    if data.get("seguimiento_requerido") is True:
        data["seguimiento_tipo"] = "fecha"
        if "seguimiento_valor" in data:
            valor = str(data.get("seguimiento_valor") or "").strip()
            if valor and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", valor):
                raise HTTPException(status_code=400, detail="seguimiento_valor inválido: usa formato YYYY-MM-DD.")
            data["seguimiento_valor"] = valor or None
    elif "seguimiento_requerido" in data and data.get("seguimiento_requerido") is not True:
        data["seguimiento_tipo"] = None
        data["seguimiento_valor"] = None

    return data


@app.put("/pacientes/{paciente_id}/historia", summary="Editar historia clínica (solo doctor/admin)")
def update_historia(
    paciente_id: int,
    sucursal_id: int,
    h: HistoriaClinicaUpdate,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    data = sanitize_payload_strings(h.dict(exclude_unset=True))
    if not data:
        raise HTTPException(status_code=400, detail="No enviaste campos para actualizar.")
    data = _normalize_historia_payload(data)

    if not data:
        raise HTTPException(status_code=400, detail="Campos no válidos para actualizar.")

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
            _ensure_historia_clinica_base(cur, paciente_id, sucursal_id, user["username"])
            cur.execute(sql, tuple(params))
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Historia clínica no encontrada (o inactiva).")
            columns = [desc[0] for desc in cur.description]
            conn.commit()

    return dict(zip(columns, row))






@app.delete("/pacientes/{paciente_id}/historia", summary="Borrar historia clínica (definitivo) (solo admin)")
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
                DELETE FROM core.historias_clinicas
                WHERE paciente_id = %s
                  AND sucursal_id = %s
                RETURNING historia_id;
                """,
                (paciente_id, sucursal_id),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Historia clínica no encontrada.")
            conn.commit()

    return {"ok": True, "deleted_historia_id": row[0], "hard_deleted": True}








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
    q: str | None = None,
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
        # Si hay texto de búsqueda, no limitar automáticamente a "hoy"
        if not (q and q.strip()):
            where.append("DATE(v.fecha_hora) = CURRENT_DATE")

    if q and q.strip():
        qq = f"%{q.strip()}%"
        where.append(
            """
            (
              CAST(v.venta_id AS TEXT) ILIKE %s
              OR TO_CHAR(v.fecha_hora AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') ILIKE %s
              OR CONCAT_WS(' ', v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno) ILIKE %s
              OR COALESCE(v.compra, '') ILIKE %s
              OR CAST(v.monto_total AS TEXT) ILIKE %s
            )
            """
        )
        params.extend([qq, qq, qq, qq, qq])

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
      v.notas,
      v.paciente_id,
      v.paciente_nombre,
      v.sucursal_id,
      v.sucursal_nombre
    FROM core.ventas_detalle v
    WHERE {" AND ".join(where)}
    ORDER BY v.fecha_hora DESC, v.venta_id DESC
    LIMIT %s
    """
    params.append(limit)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    estado_map = _estado_paciente_map(sucursal_id, [int(r[9]) for r in rows])

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
            "como_nos_conocio": None,
            "notas": r[8],
            "paciente_id": r[9],
            "paciente_nombre": r[10],
            "sucursal_id": r[11],
            "sucursal_nombre": r[12],
            "estado_paciente": estado_map.get(int(r[9]), "nuevo"),
        }
        for r in rows
    ]


@app.post("/ventas", summary="Crear venta")
def crear_venta(v: VentaCreate, user=Depends(get_current_user)):
    require_roles(user, ("admin", "recepcion", "doctor"))
    v.sucursal_id = force_sucursal(user, v.sucursal_id)
    sanitize_model_strings(v)
    if user["rol"] == "admin" and v.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if not v.compra or not v.compra.strip():
        raise HTTPException(status_code=400, detail="Compra es obligatoria.")
    if v.monto_total is None or float(v.monto_total) <= 0:
        raise HTTPException(status_code=400, detail="Monto total debe ser mayor a 0.")
    v.compra = normalize_compra_tokens(v.compra)
    v.metodo_pago = normalize_controlled_token(v.metodo_pago)
    if (v.metodo_pago or "").strip() not in {"efectivo", "tarjeta_credito", "tarjeta_debito"}:
        raise HTTPException(status_code=400, detail="metodo_pago inválido.")
    if v.adelanto_aplica:
        if v.adelanto_monto is None or float(v.adelanto_monto) <= 0:
            raise HTTPException(status_code=400, detail="adelanto_monto debe ser mayor a 0.")
        v.adelanto_metodo = normalize_controlled_token(v.adelanto_metodo)
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
                      notas, created_by
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
    sanitize_model_strings(v)
    if user["rol"] == "admin" and v.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if not v.compra or not v.compra.strip():
        raise HTTPException(status_code=400, detail="Compra es obligatoria.")
    if v.monto_total is None or float(v.monto_total) <= 0:
        raise HTTPException(status_code=400, detail="Monto total debe ser mayor a 0.")
    v.compra = normalize_compra_tokens(v.compra)
    v.metodo_pago = normalize_controlled_token(v.metodo_pago)
    if (v.metodo_pago or "").strip() not in {"efectivo", "tarjeta_credito", "tarjeta_debito"}:
        raise HTTPException(status_code=400, detail="metodo_pago inválido.")
    if v.adelanto_aplica:
        if v.adelanto_monto is None or float(v.adelanto_monto) <= 0:
            raise HTTPException(status_code=400, detail="adelanto_monto debe ser mayor a 0.")
        v.adelanto_metodo = normalize_controlled_token(v.adelanto_metodo)
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


@app.delete("/ventas/{venta_id}", summary="Eliminar venta (definitivo)")
def eliminar_venta(venta_id: int, sucursal_id: int, user=Depends(get_current_user)):
    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)
    if user["rol"] == "admin" and sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM core.ventas
                WHERE venta_id = %s
                  AND sucursal_id = %s
                RETURNING venta_id
                """,
                (venta_id, sucursal_id),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Venta no existe en esa sucursal.")
        conn.commit()
    return {"deleted_venta_id": row[0], "hard_deleted": True}


@app.get("/estadisticas/resumen", summary="Resumen estadístico por sucursal")
def estadisticas_resumen(
    sucursal_id: int | None = None,
    modo: str = "hoy",
    fecha: str | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    anio: int | None = None,
    mes: int | None = None,
    q_paciente: str | None = None,
    pacientes_modo: str = "mes",
    pacientes_anio: int | None = None,
    pacientes_mes: int | None = None,
    pacientes_semana: int | None = None,
    pacientes_fecha: str | None = None,
    pacientes_fecha_desde: str | None = None,
    pacientes_fecha_hasta: str | None = None,
    series_anio: int | None = None,
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
    elif modo == "ayer":
        ayer = hoy - timedelta(days=1)
        fecha_desde = ayer
        fecha_hasta = ayer
        periodo_label = f"Ayer ({ayer.isoformat()})"
    elif modo == "dia":
        if fecha:
            try:
                fecha_val = datetime.fromisoformat(fecha).date()
            except Exception:
                raise HTTPException(status_code=400, detail="fecha inválida. Usa YYYY-MM-DD.")
        else:
            fecha_val = hoy
        fecha_desde = fecha_val
        fecha_hasta = fecha_val
        periodo_label = f"Día {fecha_val.isoformat()}"
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
    elif modo == "rango":
        if not fecha_desde or not fecha_hasta:
            raise HTTPException(status_code=400, detail="Para modo=rango envía fecha_desde y fecha_hasta (YYYY-MM-DD).")
        try:
            fecha_desde = datetime.fromisoformat(fecha_desde).date()
            fecha_hasta = datetime.fromisoformat(fecha_hasta).date()
        except Exception:
            raise HTTPException(status_code=400, detail="fecha_desde/fecha_hasta inválidas. Usa YYYY-MM-DD.")
        periodo_label = f"Rango ({fecha_desde.isoformat()} a {fecha_hasta.isoformat()})"
    else:
        raise HTTPException(status_code=400, detail="modo inválido. Usa: hoy, ayer, dia, semana, mes, anio o rango.")

    if fecha_hasta < fecha_desde:
        raise HTTPException(status_code=400, detail="Rango de fechas inválido.")
    q_name = (q_paciente or "").strip()
    q_like = f"%{q_name}%"
    is_admin_user = str(user.get("rol", "")).lower() == "admin"

    def _patient_filter_sql(alias: str) -> tuple[str, list[Any]]:
        if not q_name:
            return "", []
        return (
            f"""
              AND EXISTS (
                SELECT 1
                FROM core.pacientes p
                WHERE p.paciente_id = {alias}.paciente_id
                  AND p.sucursal_id = {alias}.sucursal_id
                  AND p.activo = true
                  AND CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno) ILIKE %s
              )
            """,
            [q_like],
        )

    c_patient_sql, c_patient_params = _patient_filter_sql("c")
    v_patient_sql, v_patient_params = _patient_filter_sql("v")
    admin_sucursales_rows: list[tuple[Any, ...]] = []
    admin_consultas_period_rows: list[tuple[Any, ...]] = []
    admin_ventas_mensuales_rows: list[tuple[Any, ...]] = []
    admin_pacientes_mensuales_rows: list[tuple[Any, ...]] = []

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (
                    WHERE LOWER(COALESCE(tipo_consulta, '')) LIKE '%%no_show%%'
                  )::int AS no_show
                FROM core.consultas
                WHERE activo = true
                  AND sucursal_id = %s
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                  {c_patient_sql};
                """,
                (sucursal_id, fecha_desde, fecha_hasta, *c_patient_params),
            )
            c_total, c_no_show = cur.fetchone()

            cur.execute(
                f"""
                SELECT
                  COUNT(*)::int AS total,
                  COALESCE(SUM(monto_total), 0)::numeric AS monto_total
                FROM core.ventas
                WHERE activo = true
                  AND sucursal_id = %s
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                  {v_patient_sql};
                """,
                (sucursal_id, fecha_desde, fecha_hasta, *v_patient_params),
            )
            v_total, v_monto_total = cur.fetchone()

            cur.execute(
                f"""
                SELECT DATE(fecha_hora) AS dia, COUNT(*)::int
                FROM core.consultas
                WHERE activo = true
                  AND sucursal_id = %s
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                  {c_patient_sql}
                GROUP BY DATE(fecha_hora)
                ORDER BY dia;
                """,
                (sucursal_id, fecha_desde, fecha_hasta, *c_patient_params),
            )
            consultas_dia_rows = cur.fetchall()

            cur.execute(
                f"""
                SELECT DATE(fecha_hora) AS dia, COUNT(*)::int
                FROM core.ventas
                WHERE activo = true
                  AND sucursal_id = %s
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                  {v_patient_sql}
                GROUP BY DATE(fecha_hora)
                ORDER BY dia;
                """,
                (sucursal_id, fecha_desde, fecha_hasta, *v_patient_params),
            )
            ventas_dia_rows = cur.fetchall()

            cur.execute(
                f"""
                SELECT
                  COALESCE(NULLIF(LOWER(TRIM(metodo_pago)), ''), 'sin_metodo') AS etiqueta,
                  COUNT(*)::int AS total
                FROM core.ventas
                WHERE activo = true
                  AND sucursal_id = %s
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                  {v_patient_sql}
                GROUP BY etiqueta
                ORDER BY total DESC, etiqueta ASC;
                """,
                (sucursal_id, fecha_desde, fecha_hasta, *v_patient_params),
            )
            ventas_metodo_rows = cur.fetchall()

            cur.execute(
                f"""
                SELECT
                  item AS etiqueta,
                  COUNT(*)::int AS total
                FROM (
                  SELECT LOWER(TRIM(x.item)) AS item
                  FROM core.consultas c
                  CROSS JOIN LATERAL regexp_split_to_table(COALESCE(NULLIF(c.motivo_consulta, ''), COALESCE(c.tipo_consulta, '')), '\\|') AS x(item)
                  WHERE c.activo = true
                    AND c.sucursal_id = %s
                    AND DATE(c.fecha_hora) BETWEEN %s AND %s
                    {c_patient_sql}
                ) t
                WHERE item <> ''
                GROUP BY item
                ORDER BY total DESC, etiqueta ASC
                LIMIT 10;
                """,
                (sucursal_id, fecha_desde, fecha_hasta, *c_patient_params),
            )
            consultas_tipo_rows = cur.fetchall()

            cur.execute(
                f"""
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
                    {v_patient_sql}
                ) t
                WHERE item <> ''
                GROUP BY producto
                ORDER BY total DESC, producto ASC
                LIMIT 10;
                """,
                (sucursal_id, fecha_desde, fecha_hasta, *v_patient_params),
            )
            productos_top_rows = cur.fetchall()

            mes_actual_desde = date(hoy.year, hoy.month, 1)
            mes_actual_hasta = date(hoy.year, hoy.month, monthrange(hoy.year, hoy.month)[1])
            top_mes_extra_sql = ""
            top_mes_extra_params: list[Any] = []
            if q_name:
                top_mes_extra_sql = "AND CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno) ILIKE %s"
                top_mes_extra_params.append(q_like)
            cur.execute(
                """
                SELECT
                  v.paciente_id,
                  CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno) AS paciente_nombre,
                  COUNT(*)::int AS total_ventas,
                  COALESCE(SUM(v.monto_total), 0)::numeric AS monto_total
                FROM core.ventas v
                JOIN core.pacientes p ON p.paciente_id = v.paciente_id
                WHERE v.activo = true
                  AND p.activo = true
                  AND v.sucursal_id = %s
                  AND DATE(v.fecha_hora) BETWEEN %s AND %s
                  {top_mes_extra_sql}
                GROUP BY v.paciente_id, paciente_nombre
                ORDER BY monto_total DESC, total_ventas DESC, paciente_nombre ASC
                LIMIT 10;
                """.format(top_mes_extra_sql=top_mes_extra_sql),
                (sucursal_id, mes_actual_desde, mes_actual_hasta, *top_mes_extra_params),
            )
            top_pacientes_mes_actual_rows = cur.fetchall()

            top_consultas_extra_sql = ""
            top_consultas_extra_params: list[Any] = []
            if q_name:
                top_consultas_extra_sql = "AND CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno) ILIKE %s"
                top_consultas_extra_params.append(q_like)
            cur.execute(
                """
                SELECT
                  c.paciente_id,
                  CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno) AS paciente_nombre,
                  COUNT(*)::int AS total_consultas
                FROM core.consultas c
                JOIN core.pacientes p
                  ON p.paciente_id = c.paciente_id
                 AND p.sucursal_id = c.sucursal_id
                WHERE c.activo = true
                  AND p.activo = true
                  AND c.sucursal_id = %s
                  AND DATE(c.fecha_hora) BETWEEN %s AND %s
                  {top_consultas_extra_sql}
                GROUP BY c.paciente_id, paciente_nombre
                ORDER BY total_consultas DESC, paciente_nombre ASC
                LIMIT 10;
                """.format(top_consultas_extra_sql=top_consultas_extra_sql),
                (sucursal_id, fecha_desde, fecha_hasta, *top_consultas_extra_params),
            )
            top_pacientes_consultas_rows = cur.fetchall()

            pacientes_modo_clean = (pacientes_modo or "mes").strip().lower()
            if pacientes_modo_clean not in {"dia", "semana", "mes", "rango"}:
                raise HTTPException(status_code=400, detail="pacientes_modo inválido. Usa: dia, semana, mes o rango.")

            p_anio = pacientes_anio or hoy.year
            p_mes = pacientes_mes or hoy.month
            p_semana = pacientes_semana or int(hoy.strftime("%V"))
            p_extra_sql = ""
            p_extra_params: list[Any] = []
            if q_name:
                p_extra_sql = "AND CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno) ILIKE %s"
                p_extra_params.append(q_like)

            pacientes_label = ""
            pacientes_series: list[dict[str, Any]] = []
            if pacientes_modo_clean == "mes":
                cur.execute(
                    f"""
                    SELECT EXTRACT(MONTH FROM p.creado_en)::int AS mes_idx, COUNT(*)::int AS total
                    FROM core.pacientes p
                    WHERE p.activo = true
                      AND p.sucursal_id = %s
                      AND EXTRACT(YEAR FROM p.creado_en) = %s
                      {p_extra_sql}
                    GROUP BY mes_idx
                    ORDER BY mes_idx;
                    """,
                    (sucursal_id, p_anio, *p_extra_params),
                )
                rows = cur.fetchall()
                month_map = {int(r[0]): int(r[1]) for r in rows}
                meses_label = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
                pacientes_series = [
                    {"etiqueta": meses_label[idx - 1], "total": int(month_map.get(idx, 0))}
                    for idx in range(1, 13)
                ]
                pacientes_label = f"Pacientes creados por mes ({p_anio})"
            elif pacientes_modo_clean == "dia":
                if pacientes_fecha:
                    try:
                        p_fecha = datetime.fromisoformat(pacientes_fecha).date()
                    except Exception:
                        raise HTTPException(status_code=400, detail="pacientes_fecha inválida. Usa YYYY-MM-DD.")
                else:
                    p_fecha = hoy
                cur.execute(
                    f"""
                    SELECT COUNT(*)::int AS total
                    FROM core.pacientes p
                    WHERE p.activo = true
                      AND p.sucursal_id = %s
                      AND DATE(p.creado_en) = %s
                      {p_extra_sql}
                    ;
                    """,
                    (sucursal_id, p_fecha, *p_extra_params),
                )
                total_dia = int((cur.fetchone() or [0])[0] or 0)
                pacientes_series = [{"etiqueta": str(p_fecha), "total": total_dia}]
                pacientes_label = f"Pacientes creados en día ({p_fecha.isoformat()})"
            elif pacientes_modo_clean == "rango":
                if not pacientes_fecha_desde or not pacientes_fecha_hasta:
                    raise HTTPException(
                        status_code=400,
                        detail="Para pacientes_modo=rango envía pacientes_fecha_desde y pacientes_fecha_hasta.",
                    )
                try:
                    p_desde = datetime.fromisoformat(pacientes_fecha_desde).date()
                    p_hasta = datetime.fromisoformat(pacientes_fecha_hasta).date()
                except Exception:
                    raise HTTPException(
                        status_code=400,
                        detail="pacientes_fecha_desde/pacientes_fecha_hasta inválidas. Usa YYYY-MM-DD.",
                    )
                if p_hasta < p_desde:
                    raise HTTPException(status_code=400, detail="Rango inválido en pacientes creados.")
                cur.execute(
                    f"""
                    SELECT DATE(p.creado_en) AS dia, COUNT(*)::int AS total
                    FROM core.pacientes p
                    WHERE p.activo = true
                      AND p.sucursal_id = %s
                      AND DATE(p.creado_en) BETWEEN %s AND %s
                      {p_extra_sql}
                    GROUP BY dia
                    ORDER BY dia;
                    """,
                    (sucursal_id, p_desde, p_hasta, *p_extra_params),
                )
                rows = cur.fetchall()
                day_map = {str(r[0]): int(r[1]) for r in rows}
                dcur = p_desde
                while dcur <= p_hasta:
                    k = str(dcur)
                    pacientes_series.append({"etiqueta": k, "total": int(day_map.get(k, 0))})
                    dcur += timedelta(days=1)
                pacientes_label = f"Pacientes creados por rango ({p_desde.isoformat()} a {p_hasta.isoformat()})"
            else:
                if p_semana < 1 or p_semana > 53:
                    raise HTTPException(status_code=400, detail="pacientes_semana inválida. Debe ser 1..53.")
                try:
                    p_desde = date.fromisocalendar(p_anio, p_semana, 1)
                except ValueError:
                    raise HTTPException(status_code=400, detail="Semana/año inválidos para calendario ISO.")
                p_hasta = p_desde + timedelta(days=6)
                cur.execute(
                    f"""
                    SELECT DATE(p.creado_en) AS dia, COUNT(*)::int AS total
                    FROM core.pacientes p
                    WHERE p.activo = true
                      AND p.sucursal_id = %s
                      AND DATE(p.creado_en) BETWEEN %s AND %s
                      {p_extra_sql}
                    GROUP BY dia
                    ORDER BY dia;
                    """,
                    (sucursal_id, p_desde, p_hasta, *p_extra_params),
                )
                rows = cur.fetchall()
                day_map = {str(r[0]): int(r[1]) for r in rows}
                dcur = p_desde
                while dcur <= p_hasta:
                    k = str(dcur)
                    pacientes_series.append({"etiqueta": k, "total": int(day_map.get(k, 0))})
                    dcur += timedelta(days=1)
                pacientes_label = f"Pacientes creados por semana (S{p_semana} {p_anio})"

            series_year = series_anio or hoy.year
            cur.execute(
                """
                SELECT EXTRACT(MONTH FROM v.fecha_hora)::int AS mes_idx, COALESCE(SUM(v.monto_total), 0)::numeric AS total
                FROM core.ventas v
                WHERE v.activo = true
                  AND v.sucursal_id = %s
                  AND EXTRACT(YEAR FROM v.fecha_hora) = %s
                GROUP BY mes_idx
                ORDER BY mes_idx;
                """,
                (sucursal_id, series_year),
            )
            ingresos_rows = cur.fetchall()

            cur.execute(
                """
                SELECT EXTRACT(MONTH FROM c.fecha_hora)::int AS mes_idx, COUNT(*)::int AS total
                FROM core.consultas c
                WHERE c.activo = true
                  AND c.sucursal_id = %s
                  AND EXTRACT(YEAR FROM c.fecha_hora) = %s
                GROUP BY mes_idx
                ORDER BY mes_idx;
                """,
                (sucursal_id, series_year),
            )
            consultas_mensuales_rows = cur.fetchall()

            cur.execute(
                """
                SELECT EXTRACT(MONTH FROM v.fecha_hora)::int AS mes_idx, COUNT(*)::int AS total
                FROM core.ventas v
                WHERE v.activo = true
                  AND v.sucursal_id = %s
                  AND EXTRACT(YEAR FROM v.fecha_hora) = %s
                GROUP BY mes_idx
                ORDER BY mes_idx;
                """,
                (sucursal_id, series_year),
            )
            ventas_mensuales_count_rows = cur.fetchall()

            if is_admin_user:
                cur.execute(
                    """
                    SELECT s.sucursal_id, s.nombre
                    FROM core.sucursales s
                    WHERE s.activa = true
                    ORDER BY s.sucursal_id ASC;
                    """
                )
                admin_sucursales_rows = cur.fetchall()

                cur.execute(
                    """
                    SELECT c.sucursal_id, COUNT(*)::int AS total
                    FROM core.consultas c
                    JOIN core.sucursales s ON s.sucursal_id = c.sucursal_id
                    WHERE c.activo = true
                      AND s.activa = true
                      AND DATE(c.fecha_hora) BETWEEN %s AND %s
                    GROUP BY c.sucursal_id
                    ORDER BY c.sucursal_id ASC;
                    """,
                    (fecha_desde, fecha_hasta),
                )
                admin_consultas_period_rows = cur.fetchall()

                cur.execute(
                    """
                    SELECT
                      v.sucursal_id,
                      EXTRACT(MONTH FROM v.fecha_hora)::int AS mes_idx,
                      COALESCE(SUM(v.monto_total), 0)::numeric AS total
                    FROM core.ventas v
                    JOIN core.sucursales s ON s.sucursal_id = v.sucursal_id
                    WHERE v.activo = true
                      AND s.activa = true
                      AND EXTRACT(YEAR FROM v.fecha_hora) = %s
                    GROUP BY v.sucursal_id, mes_idx
                    ORDER BY v.sucursal_id ASC, mes_idx ASC;
                    """,
                    (series_year,),
                )
                admin_ventas_mensuales_rows = cur.fetchall()

                cur.execute(
                    """
                    SELECT
                      p.sucursal_id,
                      EXTRACT(MONTH FROM p.creado_en)::int AS mes_idx,
                      COUNT(*)::int AS total
                    FROM core.pacientes p
                    JOIN core.sucursales s ON s.sucursal_id = p.sucursal_id
                    WHERE p.activo = true
                      AND s.activa = true
                      AND EXTRACT(YEAR FROM p.creado_en) = %s
                    GROUP BY p.sucursal_id, mes_idx
                    ORDER BY p.sucursal_id ASC, mes_idx ASC;
                    """,
                    (series_year,),
                )
                admin_pacientes_mensuales_rows = cur.fetchall()

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
    top_pacientes_mes_actual = [
        {
            "paciente_id": int(r[0]),
            "paciente_nombre": str(r[1] or "").strip(),
            "total_ventas": int(r[2] or 0),
            "monto_total": float(r[3] or 0),
        }
        for r in top_pacientes_mes_actual_rows
    ]
    top_pacientes_consultas = [
        {
            "paciente_id": int(r[0]),
            "paciente_nombre": str(r[1] or "").strip(),
            "total_consultas": int(r[2] or 0),
        }
        for r in top_pacientes_consultas_rows
    ]
    meses_label = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    ingresos_map = {int(r[0]): float(r[1] or 0) for r in ingresos_rows}
    consultas_mensuales_map = {int(r[0]): int(r[1] or 0) for r in consultas_mensuales_rows}
    ventas_mensuales_count_map = {int(r[0]): int(r[1] or 0) for r in ventas_mensuales_count_rows}
    ingresos_por_mes = [
        {"mes": idx, "etiqueta": meses_label[idx - 1], "total": float(ingresos_map.get(idx, 0))}
        for idx in range(1, 13)
    ]
    consultas_por_mes = [
        {"mes": idx, "etiqueta": meses_label[idx - 1], "total": int(consultas_mensuales_map.get(idx, 0))}
        for idx in range(1, 13)
    ]
    ventas_por_mes = [
        {"mes": idx, "etiqueta": meses_label[idx - 1], "total": int(ventas_mensuales_count_map.get(idx, 0))}
        for idx in range(1, 13)
    ]
    ventas_monto_total_visible = float(v_monto_total or 0) if is_admin_user else None
    comparativo_sucursales = None
    if is_admin_user:
        suc_list = [
            {
                "sucursal_id": int(r[0]),
                "sucursal_nombre": str(r[1] or f"Sucursal #{r[0]}"),
            }
            for r in admin_sucursales_rows
        ]
        consultas_tot_map = {int(r[0]): int(r[1] or 0) for r in admin_consultas_period_rows}
        ventas_mes_map = {(int(r[0]), int(r[1])): float(r[2] or 0) for r in admin_ventas_mensuales_rows}
        pacientes_mes_map = {(int(r[0]), int(r[1])): int(r[2] or 0) for r in admin_pacientes_mensuales_rows}

        comparativo_sucursales = {
            "anio": int(series_year),
            "consultas_periodo_label": periodo_label,
            "consultas_periodo_por_sucursal": [
                {
                    "sucursal_id": s["sucursal_id"],
                    "sucursal_nombre": s["sucursal_nombre"],
                    "total": int(consultas_tot_map.get(s["sucursal_id"], 0)),
                }
                for s in suc_list
            ],
            "ventas_por_mes_por_sucursal": [
                {
                    "sucursal_id": s["sucursal_id"],
                    "sucursal_nombre": s["sucursal_nombre"],
                    "serie": [
                        {
                            "mes": idx,
                            "etiqueta": meses_label[idx - 1],
                            "total": float(ventas_mes_map.get((s["sucursal_id"], idx), 0)),
                        }
                        for idx in range(1, 13)
                    ],
                }
                for s in suc_list
            ],
            "pacientes_por_mes_por_sucursal": [
                {
                    "sucursal_id": s["sucursal_id"],
                    "sucursal_nombre": s["sucursal_nombre"],
                    "serie": [
                        {
                            "mes": idx,
                            "etiqueta": meses_label[idx - 1],
                            "total": int(pacientes_mes_map.get((s["sucursal_id"], idx), 0)),
                        }
                        for idx in range(1, 13)
                    ],
                }
                for s in suc_list
            ],
        }

    return {
        "sucursal_id": sucursal_id,
        "periodo": {
            "modo": modo,
            "fecha_desde": str(fecha_desde),
            "fecha_hasta": str(fecha_hasta),
            "label": periodo_label,
        },
        "filtro_paciente": q_name or None,
        "consultas": {
            "total": int(c_total or 0),
            "no_show": int(c_no_show or 0),
            "por_dia": consultas_series,
            "por_tipo": consultas_tipo,
        },
        "ventas": {
            "total": int(v_total or 0),
            "monto_total": ventas_monto_total_visible,
            "por_dia": ventas_series,
            "por_metodo_pago": ventas_metodo,
        },
        "productos_top": productos_top,
        "top_productos_mes": productos_top,
        "top_pacientes_mes_actual": {
            "label": f"Top 10 pacientes por compra total ({hoy.month:02d}/{hoy.year})",
            "fecha_desde": str(mes_actual_desde),
            "fecha_hasta": str(mes_actual_hasta),
            "rows": top_pacientes_mes_actual,
        },
        "top_pacientes_consultas": {
            "label": f"Top 10 pacientes con más consultas ({periodo_label})",
            "fecha_desde": str(fecha_desde),
            "fecha_hasta": str(fecha_hasta),
            "rows": top_pacientes_consultas,
        },
        "pacientes_creados": {
            "modo": pacientes_modo_clean,
            "label": pacientes_label,
            "serie": pacientes_series,
        },
        "anual_mensual": {
            "anio": int(series_year),
            "ingresos_por_mes": ingresos_por_mes,
            "consultas_por_mes": consultas_por_mes,
            "ventas_por_mes": ventas_por_mes,
        },
        "comparativo_sucursales": comparativo_sucursales,
    }


@app.get("/consultas", summary="Listar consultas")
def listar_consultas(
    limit: int = 50,
    sucursal_id: int | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    anio: int | None = None,
    mes: int | None = None,
    q: str | None = None,
    user=Depends(get_current_user),
):

    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)

    where = ["v.activo = true"]
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
        # Si hay texto de búsqueda, no limitar automáticamente a "hoy"
        if not (q and q.strip()):
            where.append("DATE(v.fecha_hora) = CURRENT_DATE")

    if q and q.strip():
        qq = f"%{q.strip()}%"
        where.append(
            """
            (
              CAST(v.consulta_id AS TEXT) ILIKE %s
              OR CONCAT_WS(' ', v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno) ILIKE %s
              OR CONCAT_WS(' ', v.doctor_primer_nombre, v.doctor_apellido_paterno) ILIKE %s
              OR COALESCE(v.etapa_consulta, '') ILIKE %s
              OR COALESCE(v.motivo_consulta, '') ILIKE %s
              OR TO_CHAR(v.fecha_hora AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') ILIKE %s
            )
            """
        )
        params.extend([qq, qq, qq, qq, qq, qq])

    where_sql = "WHERE " + " AND ".join(where)

    sql = f"""
    SELECT
      v.consulta_id,
      v.fecha_hora,
      v.doctor_primer_nombre,
      v.doctor_apellido_paterno,
      v.notas,
      v.paciente_id,
      v.paciente_nombre,
      v.sucursal_id,
      v.sucursal_nombre,
      v.agenda_inicio,
      v.agenda_fin,
      v.etapa_consulta,
      v.motivo_consulta
    FROM core.consultas_detalle v
    {where_sql}
    ORDER BY v.fecha_hora DESC, v.consulta_id DESC
    LIMIT %s;
    """

    params.append(limit)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    estado_map = _estado_paciente_map(sucursal_id, [int(r[5]) for r in rows])

    out = []
    for r in rows:
        etapa_consulta, motivo_consulta = resolve_consulta_read_fields(r[11], r[12], None)
        tipo_consulta_compuesto = compose_consulta_tipo(etapa_consulta, motivo_consulta)
        out.append(
            {
                "consulta_id": r[0],
                "fecha_hora": str(r[1]) if r[1] else None,
                "tipo_consulta": tipo_consulta_compuesto,
                "etapa_consulta": etapa_consulta,
                "motivo_consulta": motivo_consulta,
                "doctor_primer_nombre": r[2],
                "doctor_apellido_paterno": r[3],
                "notas": r[4],
                "paciente_id": r[5],
                "paciente_nombre": r[6],
                "sucursal_id": r[7],
                "sucursal_nombre": r[8],
                "como_nos_conocio": None,
                "agenda_inicio": str(r[9]) if r[9] else None,
                "agenda_fin": str(r[10]) if r[10] else None,
                "estado_paciente": estado_map.get(int(r[5]), "nuevo"),
            }
        )
    return out


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
              v.consulta_id,
              v.fecha_hora,
              v.doctor_primer_nombre,
              v.doctor_apellido_paterno,
              v.notas,
              v.paciente_id,
              v.paciente_nombre,
              v.sucursal_id,
              v.sucursal_nombre,
              v.agenda_inicio,
              v.agenda_fin,
              v.etapa_consulta,
              v.motivo_consulta
            FROM core.consultas_detalle v
            WHERE v.paciente_id = %s AND v.sucursal_id = %s AND v.activo = true
            ORDER BY v.consulta_id DESC
            LIMIT %s;
            """
            cur.execute(sql, (paciente_id, sucursal_id, limit))
            rows = cur.fetchall()

    out = []
    for r in rows:
        etapa_consulta, motivo_consulta = resolve_consulta_read_fields(r[11], r[12], None)
        tipo_consulta_compuesto = compose_consulta_tipo(etapa_consulta, motivo_consulta)
        out.append(
            {
                "consulta_id": r[0],
                "fecha_hora": str(r[1]) if r[1] else None,
                "tipo_consulta": tipo_consulta_compuesto,
                "etapa_consulta": etapa_consulta,
                "motivo_consulta": motivo_consulta,
                "doctor_primer_nombre": r[2],
                "doctor_apellido_paterno": r[3],
                "notas": r[4],
                "paciente_id": r[5],
                "paciente_nombre": r[6],
                "sucursal_id": r[7],
                "sucursal_nombre": r[8],
                "como_nos_conocio": None,
                "agenda_inicio": str(r[9]) if r[9] else None,
                "agenda_fin": str(r[10]) if r[10] else None,
            }
        )
    return out


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
                  v.notas,
                  v.paciente_id,
                  v.paciente_nombre,
                  v.sucursal_id,
                  v.sucursal_nombre
                FROM core.ventas_detalle v
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
            "como_nos_conocio": None,
            "notas": r[8],
            "paciente_id": r[9],
            "paciente_nombre": r[10],
            "sucursal_id": r[11],
            "sucursal_nombre": r[12],
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
            query_historia = """
            SELECT historia_id, paciente_id, sucursal_id,
                   od_esfera, od_cilindro, od_eje, od_add,
                   oi_esfera, oi_cilindro, oi_eje, oi_add,
                   dp,
                   queratometria_od, queratometria_oi,
                   presion_od, presion_oi,
                   paciente_fecha_nacimiento, paciente_edad,
                   paciente_primer_nombre, paciente_segundo_nombre,
                   paciente_apellido_paterno, paciente_apellido_materno,
                   paciente_telefono, paciente_correo,
                   paciente_calle, paciente_numero, paciente_colonia, paciente_codigo_postal, paciente_municipio, paciente_estado, paciente_pais,
                   puesto_laboral,
                   antecedentes,
                   antecedentes_generales, antecedentes_otro,
                   antecedentes_oculares_familiares, antecedentes_oculares_familiares_otro,
                   alergias, enfermedades, cirugias,
                   fumador_tabaco, fumador_marihuana, consumidor_alcohol, diabetes, tipo_diabetes, deportista,
                   horas_pantalla_dia, conduccion_nocturna_horas, exposicion_uv,
                   tabaquismo_estado, tabaquismo_intensidad, tabaquismo_anios, tabaquismo_anios_desde_dejo,
                   alcohol_frecuencia, alcohol_copas,
                   marihuana_frecuencia, marihuana_forma,
                   drogas_consumo, drogas_tipos, drogas_frecuencia,
                   deporte_frecuencia, deporte_duracion, deporte_tipos,
                   hipertension, medicamentos,
                   diabetes_estado, diabetes_control, diabetes_anios, diabetes_tratamiento,
                   usa_lentes, tipo_lentes_actual, tiempo_uso_lentes,
                   lentes_contacto_horas_dia, lentes_contacto_dias_semana, sintomas,
                   uso_lentes_proteccion_uv, uso_lentes_sol_frecuencia,
                   fotofobia_escala, dolor_ocular_escala, cefalea_frecuencia,
                   trabajo_cerca_horas_dia, distancia_promedio_pantalla_cm, iluminacion_trabajo,
                   flotadores_destellos, flotadores_inicio_reciente, flotadores_lateralidad,
                   horas_exterior_dia, nivel_educativo, horas_lectura_dia,
                   horas_sueno_promedio, estres_nivel, peso_kg, altura_cm,
                   sintomas_al_despertar, sintomas_al_despertar_otro,
                   convive_mascotas, convive_mascotas_otro,
                   uso_aire_acondicionado_frecuencia, uso_aire_acondicionado_horas_dia,
                   uso_calefaccion_frecuencia, uso_calefaccion_horas_dia,
                   uso_pantalla_en_oscuridad, cafeina_por_dia,
                   ppc, lejos, cerca, tension, mmhg, di,
                   avsinrxod, avsinrixoi, capvisualod, capvisualoi, avrxantod, avrxantoi,
                   queraod, queraoi, retinosod, retinosoi, subjeod, subjeoi, adicionod, adicionoi,
                   papila, biomicroscopia,
                   doctor_atencion,
                   diagnostico_general,
                   diagnostico_principal, diagnostico_principal_otro,
                   diagnosticos_secundarios, diagnosticos_secundarios_otro,
                   recomendacion_tratamiento,
                   seguimiento_requerido, seguimiento_tipo, seguimiento_valor,
                   created_by, created_at, created_at_tz, updated_at, activo
            FROM core.historias_clinicas
            WHERE paciente_id = %s
              AND sucursal_id = %s
              AND activo = TRUE
            """
            cur.execute(query_historia, (paciente_id, sucursal_id))

            row = cur.fetchone()

            if not row:
                _ensure_historia_clinica_base(cur, paciente_id, sucursal_id, user["username"])
                cur.execute(query_historia, (paciente_id, sucursal_id))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Historia clínica no encontrada.")
                conn.commit()

            columns = [desc[0] for desc in cur.description]
            return dict(zip(columns, row))


@app.post("/historias/estado", summary="Estado de historia clínica por lista de pacientes")
def get_historias_estado_batch(
    payload: HistoriaEstadoBatchIn,
    sucursal_id: int | None = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)
    if user["rol"] == "admin" and sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

    unique_ids = sorted({int(pid) for pid in (payload.paciente_ids or []) if int(pid) > 0})
    if not unique_ids:
        return {"sucursal_id": sucursal_id, "items": []}

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT paciente_id
                FROM core.historias_clinicas
                WHERE sucursal_id = %s
                  AND paciente_id = ANY(%s)
                  AND activo = TRUE
                GROUP BY paciente_id
                """,
                (sucursal_id, unique_ids),
            )
            existing_ids = {int(r[0]) for r in cur.fetchall()}

    return {
        "sucursal_id": sucursal_id,
        "items": [
            {
                "paciente_id": pid,
                "estado": "exists" if pid in existing_ids else "missing",
            }
            for pid in unique_ids
        ],
    }



@app.post("/pacientes/{paciente_id}/historia", response_model=HistoriaClinicaOut)
def create_historia_clinica(
    paciente_id: int,
    data: HistoriaClinicaCreate,
    sucursal_id: Optional[int] = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)
    sanitize_model_strings(data)

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            _fetch_paciente_snapshot(cur, paciente_id, sucursal_id)
            inserted_or_reactivated = _ensure_historia_clinica_base(cur, paciente_id, sucursal_id, user["username"])
            if not inserted_or_reactivated:
                raise HTTPException(status_code=400, detail="El paciente ya tiene historia clínica.")

            payload = sanitize_payload_strings(data.dict(exclude_unset=True))
            payload.pop("paciente_id", None)
            payload = _normalize_historia_payload(payload)

            if payload:
                set_parts: list[str] = []
                params: list[Any] = []
                for k, v in payload.items():
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
                cur.execute(sql, tuple(params))
            else:
                cur.execute(
                    """
                    SELECT *
                    FROM core.historias_clinicas
                    WHERE paciente_id = %s
                      AND sucursal_id = %s
                      AND activo = true
                    LIMIT 1;
                    """,
                    (paciente_id, sucursal_id),
                )

            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Historia clínica no encontrada (o inactiva).")
            columns = [desc[0] for desc in cur.description]
            conn.commit()
            return dict(zip(columns, row))







@app.post("/consultas", summary="Crear consulta")
def crear_consulta(c: ConsultaCreate, user=Depends(get_current_user)):

    require_roles(user, ("admin", "doctor", "recepcion"))
    c.sucursal_id = force_sucursal(user, c.sucursal_id)
    sanitize_model_strings(c)

    if user["rol"] == "admin" and c.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    etapa_consulta, motivo_consulta, tipo_consulta_compuesto = resolve_consulta_etapa_motivo_tipo(
        c.etapa_consulta,
        c.motivo_consulta,
        c.tipo_consulta,
    )
    c.etapa_consulta = etapa_consulta
    c.motivo_consulta = motivo_consulta
    c.tipo_consulta = tipo_consulta_compuesto

    agenda_event_id: str | None = None
    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:

                cur.execute(
                    "SELECT activa, nombre, ciudad, estado FROM core.sucursales WHERE sucursal_id = %s;",
                    (c.sucursal_id,),
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=400, detail="Sucursal no existe.")
                if row[0] is not True:
                    raise HTTPException(status_code=400, detail="Sucursal está inactiva.")
                sucursal_nombre = str(row[1]).strip() if row[1] else None
                ciudad = str(row[2]).strip() if row[2] else ""
                estado = str(row[3]).strip() if row[3] else ""
                sucursal_location = ", ".join([x for x in [ciudad, estado] if x]) or None

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
                if not calendar_enabled:
                    raise HTTPException(
                        status_code=400,
                        detail="Google Calendar es obligatorio para crear consultas. Verifica configuración OAuth y calendario por sucursal.",
                    )
                if not c.agenda_inicio or not c.agenda_fin:
                    raise HTTPException(
                        status_code=400,
                        detail="Para crear consulta debes enviar agenda_inicio y agenda_fin.",
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
                  paciente_id, sucursal_id, etapa_consulta, motivo_consulta,
                  doctor_primer_nombre, doctor_apellido_paterno,
                  notas,
                  agenda_inicio, agenda_fin
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING consulta_id;
                """
                cur.execute(
                    sql,
                    (
                        c.paciente_id,
                        c.sucursal_id,
                        c.etapa_consulta,
                        c.motivo_consulta,
                        c.doctor_primer_nombre,
                        c.doctor_apellido_paterno,
                        c.notas,
                        agenda_start,
                        agenda_end,
                    ),
                )
                new_id = cur.fetchone()[0]

                if agenda_start and agenda_end:
                    doctor_nombre = " ".join(
                        [
                            x
                            for x in [c.doctor_primer_nombre, c.doctor_apellido_paterno]
                            if x and str(x).strip()
                        ]
                    )
                    agenda_event_id = _create_calendar_event_for_consulta(
                        consulta_id=new_id,
                        sucursal_id=c.sucursal_id,
                        start_dt=agenda_start,
                        end_dt=agenda_end,
                        paciente_id=c.paciente_id,
                        paciente_nombre=paciente_nombre,
                        paciente_correo=paciente_correo,
                        tipo_consulta=c.tipo_consulta,
                        doctor_id=str(user.get("user_id") or user.get("username") or ""),
                        doctor_nombre=doctor_nombre,
                        sucursal_nombre=sucursal_nombre,
                        sucursal_location=sucursal_location,
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





@app.delete("/consultas/{consulta_id}", summary="Eliminar consulta (definitivo)")
def eliminar_consulta(consulta_id: int, sucursal_id: int, user=Depends(get_current_user)):

    require_roles(user, ("admin", "doctor", "recepcion"))
    sucursal_id = force_sucursal(user, sucursal_id)

    if user["rol"] == "admin" and sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

    sql = """
    DELETE FROM core.consultas
    WHERE consulta_id = %s
      AND sucursal_id = %s
    RETURNING consulta_id, agenda_event_id;
    """

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (consulta_id, sucursal_id))
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Consulta no existe en esa sucursal.")
                agenda_event_id = row[1]
                if agenda_event_id:
                    _delete_calendar_event_for_consulta(
                        sucursal_id=sucursal_id,
                        event_id=str(agenda_event_id),
                    )
            conn.commit()

        return {"deleted_consulta_id": row[0], "hard_deleted": True, "calendar_event_deleted": bool(row[1])}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/consultas/{consulta_id}", summary="Actualizar consulta")
def actualizar_consulta(consulta_id: int, c: ConsultaCreate, user=Depends(get_current_user)):
    require_roles(user, ("admin", "doctor", "recepcion"))
    c.sucursal_id = force_sucursal(user, c.sucursal_id)
    sanitize_model_strings(c)

    if user["rol"] == "admin" and c.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    etapa_consulta, motivo_consulta, tipo_consulta_compuesto = resolve_consulta_etapa_motivo_tipo(
        c.etapa_consulta,
        c.motivo_consulta,
        c.tipo_consulta,
    )
    c.etapa_consulta = etapa_consulta
    c.motivo_consulta = motivo_consulta
    c.tipo_consulta = tipo_consulta_compuesto

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
                        etapa_consulta = %s,
                        motivo_consulta = %s,
                        doctor_primer_nombre = %s,
                        doctor_apellido_paterno = %s,
                        notas = %s
                    WHERE consulta_id = %s
                      AND sucursal_id = %s
                      AND activo = true
                    RETURNING consulta_id;
                    """,
                    (
                        c.paciente_id,
                        c.etapa_consulta,
                        c.motivo_consulta,
                        c.doctor_primer_nombre,
                        c.doctor_apellido_paterno,
                        c.notas,
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

    

    
@app.delete("/pacientes/{paciente_id}", summary="Eliminar paciente (definitivo + relacionados)")
def eliminar_paciente(paciente_id: int, sucursal_id: int, user=Depends(get_current_user)):

    require_roles(user, ("admin",))
    sucursal_id = force_sucursal(user, sucursal_id)
    

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                # Consultas ligadas para borrar también evento en Google Calendar.
                cur.execute(
                    """
                    SELECT consulta_id, agenda_event_id
                    FROM core.consultas
                    WHERE paciente_id = %s
                      AND sucursal_id = %s;
                    """,
                    (paciente_id, sucursal_id),
                )
                consultas_rows = cur.fetchall()
                calendar_deleted = 0
                for _, agenda_event_id in consultas_rows:
                    if agenda_event_id:
                        try:
                            _delete_calendar_event_for_consulta(
                                sucursal_id=sucursal_id,
                                event_id=str(agenda_event_id),
                            )
                            calendar_deleted += 1
                        except Exception:
                            # Si falla Calendar, priorizamos limpieza de DB.
                            pass

                cur.execute(
                    """
                    DELETE FROM core.historias_clinicas
                    WHERE paciente_id = %s
                      AND sucursal_id = %s;
                    """,
                    (paciente_id, sucursal_id),
                )
                historias_deleted = int(cur.rowcount or 0)

                cur.execute(
                    """
                    DELETE FROM core.consultas
                    WHERE paciente_id = %s
                      AND sucursal_id = %s;
                    """,
                    (paciente_id, sucursal_id),
                )
                consultas_deleted = int(cur.rowcount or 0)

                cur.execute(
                    """
                    DELETE FROM core.ventas
                    WHERE paciente_id = %s
                      AND sucursal_id = %s;
                    """,
                    (paciente_id, sucursal_id),
                )
                ventas_deleted = int(cur.rowcount or 0)

                cur.execute(
                    """
                    DELETE FROM core.pacientes
                    WHERE paciente_id = %s
                      AND sucursal_id = %s
                    RETURNING paciente_id;
                    """,
                    (paciente_id, sucursal_id),
                )
                row = cur.fetchone()

            conn.commit()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Paciente no existe en esa sucursal.",
            )

        return {
            "deleted_paciente_id": row[0],
            "hard_deleted": True,
            "related_deleted": {
                "historias_clinicas": historias_deleted,
                "consultas": consultas_deleted,
                "ventas": ventas_deleted,
                "calendar_events_deleted": calendar_deleted,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    




    
