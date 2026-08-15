from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.staticfiles import StaticFiles

from jose import jwt, JWTError
from passlib.hash import argon2

from pydantic import BaseModel, ValidationError
from typing import Optional, Any
from datetime import datetime, timedelta, timezone, date, time
import calendar
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from zoneinfo import ZoneInfo
import json
import csv
import io
from calendar import monthrange
import secrets
import re
import time as time_module
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest, urlopen
from urllib.error import HTTPError

import psycopg
import os
from dotenv import load_dotenv
from public_catalog import create_public_catalog_router
from online_commerce import create_online_commerce_router
from online_product_policy import is_direct_purchase_product
from optical_preview import create_optical_preview_router
from online_optical_drafts import create_online_optical_drafts_router
from optical_operations import (
    create_optical_operations_router,
    sync_physical_sale_jobs,
    validate_physical_structural_edit,
)
from optical_catalog_admin import create_optical_catalog_admin_router
from online_patient_identity import (
    create_online_identity_router,
    create_prescription_access_admin_router,
)
from online_checkout_identity import create_checkout_identity_router
from online_fulfillment import (
    create_admin_fulfillment_router,
    create_storefront_fulfillment_router,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()

app = FastAPI(title="Optica OLM API")
app.mount("/media", StaticFiles(directory=os.path.join(BASE_DIR, "media")), name="media")

def _resolve_cors_origins() -> list[str]:
    configured = os.getenv("FRONTEND_ORIGIN", "").strip()
    origins: list[str] = []
    if configured:
        origins.extend([x.strip() for x in configured.split(",") if x.strip()])

    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "https://opticaolm.pages.dev",
    ]
    for origin in defaults:
        if origin not in origins:
            origins.append(origin)
    return origins

CORS_ORIGINS = _resolve_cors_origins()

# permite https://opticaolm.pages.dev y cualquier preview https://<hash>.opticaolm.pages.dev
CORS_ORIGIN_REGEX = os.getenv(
    "FRONTEND_ORIGIN_REGEX",
    r"^https://([a-z0-9-]+\.)?opticaolm\.pages\.dev$",
).strip()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_db_conninfo() -> str:
    direct = os.getenv("DB_CONNINFO", "").strip()
    if direct:
        return direct

    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return database_url

    db_name = os.getenv("DB_NAME", "eyecare").strip() or "eyecare"
    db_host = os.getenv("DB_HOST", "localhost").strip() or "localhost"
    db_port = os.getenv("DB_PORT", "5432").strip() or "5432"
    db_user = os.getenv("DB_USER", "postgres").strip() or "postgres"
    db_password = os.getenv("DB_PASSWORD", "").strip()

    parts = [
        f"host={db_host}",
        f"port={db_port}",
        f"dbname={db_name}",
        f"user={db_user}",
    ]
    if db_password:
        parts.append(f"password={db_password}")
    return " ".join(parts)


DB_CONNINFO = _resolve_db_conninfo()

app.include_router(create_public_catalog_router(DB_CONNINFO))
app.include_router(create_online_commerce_router(DB_CONNINFO))
app.include_router(create_optical_preview_router(DB_CONNINFO))
app.include_router(create_online_optical_drafts_router(DB_CONNINFO))
app.include_router(create_online_identity_router(DB_CONNINFO))
app.include_router(create_checkout_identity_router(DB_CONNINFO, type("IdentityRouterConfig", (), {"db_conninfo": DB_CONNINFO, "bearer_token": os.getenv("ONLINE_IDENTITY_BEARER_TOKEN", "").strip()})(), psycopg.connect))
app.include_router(create_storefront_fulfillment_router(DB_CONNINFO))





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
                ADD COLUMN IF NOT EXISTS paciente_fecha_nacimiento text,
                ADD COLUMN IF NOT EXISTS paciente_edad integer,
                ADD COLUMN IF NOT EXISTS paciente_primer_nombre text,
                ADD COLUMN IF NOT EXISTS paciente_segundo_nombre text,
                ADD COLUMN IF NOT EXISTS paciente_apellido_paterno text,
                ADD COLUMN IF NOT EXISTS paciente_apellido_materno text,
                ADD COLUMN IF NOT EXISTS paciente_telefono text,
                ADD COLUMN IF NOT EXISTS paciente_correo text,
                ADD COLUMN IF NOT EXISTS paciente_calle text,
                ADD COLUMN IF NOT EXISTS paciente_numero text,
                ADD COLUMN IF NOT EXISTS paciente_colonia text,
                ADD COLUMN IF NOT EXISTS paciente_codigo_postal text,
                ADD COLUMN IF NOT EXISTS paciente_municipio text,
                ADD COLUMN IF NOT EXISTS paciente_estado text,
                ADD COLUMN IF NOT EXISTS paciente_pais text,
                ADD COLUMN IF NOT EXISTS antecedentes_generales text,
                ADD COLUMN IF NOT EXISTS antecedentes text,
                ADD COLUMN IF NOT EXISTS antecedentes_otro text,
                ADD COLUMN IF NOT EXISTS alergias text,
                ADD COLUMN IF NOT EXISTS enfermedades text,
                ADD COLUMN IF NOT EXISTS cirugias text,
                ADD COLUMN IF NOT EXISTS avsinrixoi text,
                ADD COLUMN IF NOT EXISTS avsinrxod text,
                ADD COLUMN IF NOT EXISTS capvisualod text,
                ADD COLUMN IF NOT EXISTS capvisualoi text,
                ADD COLUMN IF NOT EXISTS avrxantod text,
                ADD COLUMN IF NOT EXISTS avrxantoi text,
                ADD COLUMN IF NOT EXISTS queraod text,
                ADD COLUMN IF NOT EXISTS queraoi text,
                ADD COLUMN IF NOT EXISTS retinosod text,
                ADD COLUMN IF NOT EXISTS retinosoi text,
                ADD COLUMN IF NOT EXISTS subjeod text,
                ADD COLUMN IF NOT EXISTS subjeoi text,
                ADD COLUMN IF NOT EXISTS horas_pantalla_dia text,
                ADD COLUMN IF NOT EXISTS conduccion_nocturna_horas text,
                ADD COLUMN IF NOT EXISTS exposicion_uv text,
                ADD COLUMN IF NOT EXISTS fumador_tabaco boolean,
                ADD COLUMN IF NOT EXISTS fumador_marihuana boolean,
                ADD COLUMN IF NOT EXISTS consumidor_alcohol boolean,
                ADD COLUMN IF NOT EXISTS diabetes boolean,
                ADD COLUMN IF NOT EXISTS tipo_diabetes text,
                ADD COLUMN IF NOT EXISTS deportista boolean,
                ADD COLUMN IF NOT EXISTS tabaquismo_estado text,
                ADD COLUMN IF NOT EXISTS tabaquismo_intensidad text,
                ADD COLUMN IF NOT EXISTS tabaquismo_anios text,
                ADD COLUMN IF NOT EXISTS tabaquismo_anios_desde_dejo text,
                ADD COLUMN IF NOT EXISTS alcohol_frecuencia text,
                ADD COLUMN IF NOT EXISTS alcohol_copas text,
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
                ADD COLUMN IF NOT EXISTS diabetes_tratamiento_otro text,
                ADD COLUMN IF NOT EXISTS usa_lentes boolean,
                ADD COLUMN IF NOT EXISTS tipo_lentes_actual text,
                ADD COLUMN IF NOT EXISTS lentes_actuales_detalle text,
                ADD COLUMN IF NOT EXISTS tiempo_uso_lentes text,
                ADD COLUMN IF NOT EXISTS lentes_contacto_horas_dia text,
                ADD COLUMN IF NOT EXISTS lentes_contacto_dias_semana text,
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
                ADD COLUMN IF NOT EXISTS flotadores_lateralidad text,
                ADD COLUMN IF NOT EXISTS uso_lentes_proteccion_uv text,
                ADD COLUMN IF NOT EXISTS uso_lentes_sol_frecuencia text,
                ADD COLUMN IF NOT EXISTS horas_exterior_dia text,
                ADD COLUMN IF NOT EXISTS uso_lentes_sol_horas_dia text,
                ADD COLUMN IF NOT EXISTS usa_lentes_manejar_dia boolean,
                ADD COLUMN IF NOT EXISTS tipo_lentes_manejar_dia text,
                ADD COLUMN IF NOT EXISTS tratamientos_lentes_manejar_dia text,
                ADD COLUMN IF NOT EXISTS usa_lentes_manejar_noche boolean,
                ADD COLUMN IF NOT EXISTS tipo_lentes_manejar_noche text,
                ADD COLUMN IF NOT EXISTS tratamientos_lentes_manejar_noche text,
                ADD COLUMN IF NOT EXISTS nivel_educativo text,
                ADD COLUMN IF NOT EXISTS horas_lectura_dia text,
                ADD COLUMN IF NOT EXISTS lee_libros boolean,
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
                ADD COLUMN IF NOT EXISTS papila text,
                ADD COLUMN IF NOT EXISTS biomicroscopia text,
                ADD COLUMN IF NOT EXISTS diagnostico_general text,
                ADD COLUMN IF NOT EXISTS diagnostico_principal text,
                ADD COLUMN IF NOT EXISTS diagnostico_principal_otro text,
                ADD COLUMN IF NOT EXISTS diagnosticos_secundarios text,
                ADD COLUMN IF NOT EXISTS diagnosticos_secundarios_otro text,
                ADD COLUMN IF NOT EXISTS created_by text,
                ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL,
                ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS seguimiento_requerido boolean,
                ADD COLUMN IF NOT EXISTS seguimiento_tipo text,
                ADD COLUMN IF NOT EXISTS seguimiento_valor text;
                """
            )
            cur.execute(
                """
                ALTER TABLE core.historias_clinicas
                DROP COLUMN IF EXISTS flotadores_inicio_reciente;
                """
            )

            cur.execute(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'core'
                          AND table_name = 'historias_clinicas'
                          AND column_name = 'historia_clinica_id'
                    ) AND NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'core'
                          AND table_name = 'historias_clinicas'
                          AND column_name = 'historia_id'
                    ) THEN
                        EXECUTE 'ALTER TABLE core.historias_clinicas RENAME COLUMN historia_clinica_id TO historia_id';
                    END IF;
                END
                $$;
                """
            )

            cur.execute(
                """
                UPDATE core.historias_clinicas
                SET activo = true
                WHERE activo IS NULL;
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
                UPDATE core.historias_clinicas
                SET paciente_pais = CASE
                  WHEN paciente_pais IS NULL OR TRIM(paciente_pais) = '' THEN NULL
                  ELSE TRIM(paciente_pais)
                END
                WHERE paciente_pais IS NOT NULL
                  AND (
                    TRIM(paciente_pais) = ''
                    OR TRIM(paciente_pais) <> paciente_pais
                  );
                """
            )
            cur.execute(
                """
                UPDATE core.historias_clinicas
                SET
                  diagnostico_principal = NULLIF(regexp_replace(lower(trim(COALESCE(diagnostico_principal, ''))), E'\\s*\\|\\s*', '|', 'g'), ''),
                  diagnosticos_secundarios = NULLIF(regexp_replace(lower(trim(COALESCE(diagnosticos_secundarios, ''))), E'\\s*\\|\\s*', '|', 'g'), ''),
                  diagnostico_principal_otro = CASE
                    WHEN regexp_replace(lower(trim(COALESCE(diagnostico_principal, ''))), E'\\s*\\|\\s*', '|', 'g') ~ '(^|\\|)otro(\\||$)' THEN NULLIF(trim(diagnostico_principal_otro), '')
                    ELSE NULL
                  END,
                  diagnosticos_secundarios_otro = CASE
                    WHEN regexp_replace(lower(trim(COALESCE(diagnosticos_secundarios, ''))), E'\\s*\\|\\s*', '|', 'g') ~ '(^|\\|)otro_secundario(\\||$)' THEN NULLIF(trim(diagnosticos_secundarios_otro), '')
                    ELSE NULL
                  END
                WHERE
                  diagnostico_principal IS NOT NULL
                  OR diagnosticos_secundarios IS NOT NULL
                  OR diagnostico_principal_otro IS NOT NULL
                  OR diagnosticos_secundarios_otro IS NOT NULL;
                """
            )
            repaired_diag_rows = _repair_historia_diag_fields(cur)
            if repaired_diag_rows:
                print(f"[startup] historias_clinicas diagnósticos reparados: {repaired_diag_rows}")
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

            cur.execute(
                """
                ALTER TABLE core.sucursales
                ADD COLUMN IF NOT EXISTS codigo text NULL,
                ADD COLUMN IF NOT EXISTS ciudad text NULL,
                ADD COLUMN IF NOT EXISTS estado text NULL,
                ADD COLUMN IF NOT EXISTS calle text NULL,
                ADD COLUMN IF NOT EXISTS numero text NULL,
                ADD COLUMN IF NOT EXISTS colonia text NULL,
                ADD COLUMN IF NOT EXISTS cp text NULL,
                ADD COLUMN IF NOT EXISTS municipio text NULL,
                ADD COLUMN IF NOT EXISTS pais text NULL,
                ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true;
                """
            )
            cur.execute(
                """
                UPDATE core.sucursales
                SET activa = COALESCE(activa, true)
                WHERE activa IS NULL;
                """
            )
            cur.execute(
                """
                UPDATE core.sucursales
                SET
                  ciudad = CASE
                    WHEN sucursal_id = 1 THEN 'Estado de México'
                    WHEN sucursal_id = 2 THEN 'Playa del Carmen'
                    ELSE ciudad
                  END,
                  estado = CASE
                    WHEN sucursal_id = 1 THEN 'Estado de México'
                    WHEN sucursal_id = 2 THEN 'Quintana Roo'
                    ELSE estado
                  END,
                  municipio = CASE
                    WHEN sucursal_id = 1 THEN 'Estado de México'
                    WHEN sucursal_id = 2 THEN 'Playa del Carmen'
                    ELSE municipio
                  END,
                  pais = CASE
                    WHEN sucursal_id IN (1, 2) THEN 'México'
                    ELSE pais
                  END
                WHERE sucursal_id IN (1, 2)
                  AND (
                    ciudad IS NULL OR btrim(ciudad) = ''
                    OR estado IS NULL OR btrim(estado) = ''
                    OR municipio IS NULL OR btrim(municipio) = ''
                    OR pais IS NULL OR btrim(pais) = ''
                  );
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
                    subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
                    descuento_porcentaje numeric(5,2) NOT NULL DEFAULT 0 CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
                    descuento_monto numeric(12,2) NOT NULL DEFAULT 0 CHECK (descuento_monto >= 0),
                    descuento_motivo text NULL,
                    cupon_tipo text NULL,
                    monto_total numeric(12,2) NOT NULL CHECK (monto_total >= 0),
                    metodo_pago text NOT NULL DEFAULT 'efectivo',
                    forma_liquidacion text NOT NULL DEFAULT 'pago_completo',
                    plazo_meses integer NULL,
                    adelanto_aplica boolean NOT NULL DEFAULT false,
                    adelanto_monto numeric(12,2) NULL CHECK (adelanto_monto >= 0),
                    adelanto_metodo text NULL,
                    estado_venta text NOT NULL DEFAULT 'confirmada',
                    estado_pago text NOT NULL DEFAULT 'sin_pago',
                    estado_pedido text NOT NULL DEFAULT 'pendiente_fabricacion',
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
                ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS descuento_porcentaje numeric(5,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS descuento_monto numeric(12,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS descuento_motivo text NULL,
                ADD COLUMN IF NOT EXISTS cupon_tipo text NULL,
                ADD COLUMN IF NOT EXISTS forma_liquidacion text NOT NULL DEFAULT 'pago_completo',
                ADD COLUMN IF NOT EXISTS plazo_meses integer NULL,
                ADD COLUMN IF NOT EXISTS adelanto_aplica boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS adelanto_monto numeric(12,2) NULL,
                ADD COLUMN IF NOT EXISTS adelanto_metodo text NULL,
                ADD COLUMN IF NOT EXISTS estado_venta text NOT NULL DEFAULT 'confirmada',
                ADD COLUMN IF NOT EXISTS estado_pago text NOT NULL DEFAULT 'sin_pago',
                ADD COLUMN IF NOT EXISTS estado_pedido text NOT NULL DEFAULT 'pendiente_fabricacion';
                """
            )
            cur.execute(
                """
                UPDATE core.ventas
                SET subtotal = monto_total
                WHERE subtotal = 0
                  AND monto_total > 0;
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

            # 7) Catálogo e inventario por sucursal.
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.productos (
                    producto_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL REFERENCES core.sucursales(sucursal_id),
                    sku text NOT NULL,
                    categoria text NOT NULL,
                    subcategoria text NULL,
                    nombre text NOT NULL,
                    modelo text NULL,
                    color text NULL,
                    tipo_mica text NULL,
                    descripcion text NULL,
                    imagen_url text NULL,
                    precio numeric(12,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
                    costo_unitario numeric(12,2) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
                    stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
                    stock_minimo integer NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
                    controla_stock boolean NOT NULL DEFAULT true,
                    orden_catalogo integer NOT NULL DEFAULT 100,
                    activo boolean NOT NULL DEFAULT true,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NULL,
                    UNIQUE (sucursal_id, sku)
                );
                """
            )
            cur.execute(
                """
                ALTER TABLE core.productos
                ADD COLUMN IF NOT EXISTS costo_unitario numeric(12,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS controla_stock boolean NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS orden_catalogo integer NOT NULL DEFAULT 100;
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_productos_sucursal_categoria
                ON core.productos (sucursal_id, categoria, nombre, modelo);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.venta_detalles (
                    venta_detalle_id bigserial PRIMARY KEY,
                    venta_id bigint NOT NULL REFERENCES core.ventas(venta_id),
                    producto_id bigint NOT NULL REFERENCES core.productos(producto_id),
                    cantidad integer NOT NULL CHECK (cantidad > 0),
                    precio_unitario numeric(12,2) NOT NULL CHECK (precio_unitario >= 0),
                    subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
                    created_at timestamptz NOT NULL DEFAULT NOW()
                );
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta ON core.venta_detalles (venta_id);"
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.venta_pagos (
                    pago_id bigserial PRIMARY KEY,
                    venta_id bigint NOT NULL REFERENCES core.ventas(venta_id),
                    metodo text NOT NULL,
                    monto numeric(12,2) NOT NULL CHECK (monto > 0),
                    referencia text NULL,
                    created_by text NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    activo boolean NOT NULL DEFAULT true
                );
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_venta_pagos_venta ON core.venta_pagos (venta_id, created_at);"
            )
            cur.execute(
                """
                UPDATE core.ventas venta
                SET estado_pago = CASE
                    WHEN COALESCE(
                        (
                            SELECT SUM(pago.monto)
                            FROM core.venta_pagos pago
                            WHERE pago.venta_id = venta.venta_id
                              AND pago.activo = true
                        ),
                        CASE
                            WHEN venta.adelanto_aplica THEN venta.adelanto_monto
                            ELSE venta.monto_total
                        END,
                        0
                    ) >= venta.monto_total THEN 'pagada'
                    WHEN COALESCE(
                        (
                            SELECT SUM(pago.monto)
                            FROM core.venta_pagos pago
                            WHERE pago.venta_id = venta.venta_id
                              AND pago.activo = true
                        ),
                        venta.adelanto_monto,
                        0
                    ) > 0 THEN 'anticipo'
                    ELSE 'sin_pago'
                END
                WHERE venta.estado_pago = 'sin_pago'
                  AND (
                    EXISTS (
                        SELECT 1
                        FROM core.venta_pagos pago
                        WHERE pago.venta_id = venta.venta_id
                          AND pago.activo = true
                    )
                    OR venta.adelanto_aplica = true
                    OR venta.monto_total = 0
                  );
                """
            )
            cur.execute(
                """
                INSERT INTO core.productos (
                    sucursal_id, sku, categoria, subcategoria, nombre, modelo,
                    color, tipo_mica, descripcion, imagen_url, precio, costo_unitario, stock, stock_minimo,
                    controla_stock, orden_catalogo
                )
                SELECT
                    s.sucursal_id,
                    catalogo.sku,
                    catalogo.categoria,
                    catalogo.subcategoria,
                    catalogo.nombre,
                    catalogo.modelo,
                    catalogo.color,
                    catalogo.tipo_mica,
                    catalogo.descripcion,
                    catalogo.imagen_url,
                    catalogo.precio,
                    CASE
                        WHEN catalogo.sku = 'OLM-AZ-001' THEN 650.00
                        WHEN catalogo.sku = 'SOL-ARENA-001' THEN 720.00
                        WHEN catalogo.sku = 'SOL-GRAD-001' THEN 600.00
                        WHEN catalogo.sku = 'MIC-BASE-001' THEN 350.00
                        WHEN catalogo.sku = 'MIC-MONO-001' THEN 0.00
                        WHEN catalogo.sku = 'MIC-BIFO-001' THEN 450.00
                        WHEN catalogo.sku = 'MIC-PROG-001' THEN 1200.00
                        WHEN catalogo.sku = 'MIC-SINGRAD-001' THEN 0.00
                        WHEN catalogo.sku = 'MIC-SINTRAT-001' THEN 0.00
                        WHEN catalogo.sku = 'MIC-AR-001' THEN 220.00
                        WHEN catalogo.sku = 'MIC-FOTO-001' THEN 60.00
                        WHEN catalogo.sku IN ('MIC-AB-VERDE', 'MIC-AB-AZUL') THEN 800.00
                        WHEN catalogo.sku LIKE 'MIC-TIN-%' THEN 450.00
                        WHEN catalogo.sku = 'EXAM-VIS-001' THEN 80.00
                        WHEN catalogo.sku = 'LC-CLEAR-030' THEN 480.00
                        WHEN catalogo.sku = 'ACC-EST-001' THEN 95.00
                        WHEN catalogo.sku = 'ACC-TAZA-001' THEN 70.00
                        WHEN catalogo.sku = 'CUID-KIT-001' THEN 85.00
                        ELSE 0.00
                    END,
                    catalogo.stock,
                    catalogo.stock_minimo,
                    catalogo.controla_stock,
                    catalogo.orden_catalogo
                FROM core.sucursales s
                CROSS JOIN (
                    VALUES
                        ('OLM-AZ-001', 'lentes_opticos', 'armazon', 'Armazón OLM Azul Noche', 'OLM-RX-001', 'Azul noche', NULL, 'Armazón óptico rectangular de acetato azul noche con bisagras metálicas plateadas.', '/inventory/armazon-olm-azul-001.png', 1299.00, 8, 2, true, 10),
                        ('SOL-ARENA-001', 'lentes_de_sol', 'armazon', 'Lentes de sol Solar Arena', 'SOL-ARENA', 'Carey / humo', 'sin_graduacion', 'Armazón solar de acetato carey con micas oscuras color humo.', '/inventory/lentes-sol-arena-001.png', 1499.00, 6, 2, true, 20),
                        ('SOL-GRAD-001', 'lentes_de_sol', 'graduacion', 'Graduación para lentes de sol', 'SOL-GRAD', NULL, 'con_graduacion', 'Servicio adicional para fabricar las micas solares con graduación.', '/inventory/micas-tratamientos.png', 1200.00, 0, 0, false, 21),
                        ('MIC-BASE-001', 'micas', 'base', 'Par de micas estándar', 'MIC-BASE', 'Transparente', 'base', 'Par base de micas oftálmicas antes de diseño y tratamientos adicionales.', '/inventory/micas-tratamientos.png', 800.00, 0, 0, false, 30),
                        ('MIC-MONO-001', 'micas', 'diseno', 'Diseño monofocal', 'MIC-MONO', NULL, 'monofocal', 'Un solo campo de visión para lejos o cerca.', '/inventory/micas-tratamientos.png', 0.00, 0, 0, false, 31),
                        ('MIC-BIFO-001', 'micas', 'diseno', 'Diseño bifocal', 'MIC-BIFO', NULL, 'bifocal', 'Dos zonas de visión: lejos y cerca.', '/inventory/micas-tratamientos.png', 900.00, 0, 0, false, 32),
                        ('MIC-PROG-001', 'micas', 'diseno', 'Diseño progresivo', 'MIC-PROG', NULL, 'progresivo', 'Transición continua entre visión lejana, intermedia y cercana.', '/inventory/micas-tratamientos.png', 2200.00, 0, 0, false, 33),
                        ('MIC-SINGRAD-001', 'micas', 'diseno', 'Micas sin graduación', 'MIC-SINGRAD', NULL, 'sin_graduacion', 'Micas planas sin graduación.', '/inventory/micas-tratamientos.png', 0.00, 0, 0, false, 34),
                        ('MIC-SINTRAT-001', 'micas', 'tratamiento', 'Sin tratamiento adicional', 'MIC-SINTRAT', 'Transparente', 'sin_tratamiento', 'Micas sin recubrimiento adicional.', '/inventory/micas-tratamientos.png', 0.00, 0, 0, false, 40),
                        ('MIC-AR-001', 'micas', 'tratamiento', 'Tratamiento antirreflejante', 'MIC-AR', 'Transparente', 'antirreflejante', 'Reduce reflejos y mejora la transparencia de la mica.', '/inventory/micas-tratamientos.png', 500.00, 0, 0, false, 41),
                        ('MIC-FOTO-001', 'micas', 'tratamiento', 'Tratamiento fotocromático', 'MIC-FOTO', 'Gris adaptable', 'fotocromatico', 'Se oscurece con luz UV y vuelve a aclararse en interiores.', '/inventory/micas-tratamientos.png', 100.00, 0, 0, false, 42),
                        ('MIC-AB-VERDE', 'micas', 'tratamiento', 'Antiblueray reflejo verde', 'MIC-AB-V', 'Verde', 'antiblueray', 'Filtro de luz azul con reflejo residual verde.', '/inventory/micas-tratamientos.png', 1500.00, 0, 0, false, 43),
                        ('MIC-AB-AZUL', 'micas', 'tratamiento', 'Antiblueray reflejo azul', 'MIC-AB-A', 'Azul', 'antiblueray', 'Filtro de luz azul con reflejo residual azul.', '/inventory/micas-tratamientos.png', 1500.00, 0, 0, false, 44),
                        ('MIC-TIN-GRIS', 'micas', 'tratamiento', 'Tinte gris', 'MIC-TINTE', 'Gris', 'tinte', 'Tinte uniforme color gris.', '/inventory/micas-tratamientos.png', 1000.00, 0, 0, false, 50),
                        ('MIC-TIN-CAFE', 'micas', 'tratamiento', 'Tinte café', 'MIC-TINTE', 'Café', 'tinte', 'Tinte uniforme color café.', '/inventory/micas-tratamientos.png', 1000.00, 0, 0, false, 51),
                        ('MIC-TIN-VERDE', 'micas', 'tratamiento', 'Tinte verde', 'MIC-TINTE', 'Verde', 'tinte', 'Tinte uniforme color verde.', '/inventory/micas-tratamientos.png', 1000.00, 0, 0, false, 52),
                        ('MIC-TIN-AZUL', 'micas', 'tratamiento', 'Tinte azul', 'MIC-TINTE', 'Azul', 'tinte', 'Tinte uniforme color azul.', '/inventory/micas-tratamientos.png', 1000.00, 0, 0, false, 53),
                        ('MIC-TIN-ROSA', 'micas', 'tratamiento', 'Tinte rosa', 'MIC-TINTE', 'Rosa', 'tinte', 'Tinte uniforme color rosa.', '/inventory/micas-tratamientos.png', 1000.00, 0, 0, false, 54),
                        ('MIC-TIN-AMBAR', 'micas', 'tratamiento', 'Tinte ámbar', 'MIC-TINTE', 'Ámbar', 'tinte', 'Tinte uniforme color ámbar.', '/inventory/micas-tratamientos.png', 1000.00, 0, 0, false, 55),
                        ('MIC-TIN-VINO', 'micas', 'tratamiento', 'Tinte vino', 'MIC-TINTE', 'Vino', 'tinte', 'Tinte uniforme color vino.', '/inventory/micas-tratamientos.png', 1000.00, 0, 0, false, 56),
                        ('MIC-TIN-MORADO', 'micas', 'tratamiento', 'Tinte morado', 'MIC-TINTE', 'Morado', 'tinte', 'Tinte uniforme color morado.', '/inventory/micas-tratamientos.png', 1000.00, 0, 0, false, 57),
                        ('MIC-TIN-NEGRO', 'micas', 'tratamiento', 'Tinte negro', 'MIC-TINTE', 'Negro', 'tinte', 'Tinte uniforme color negro.', '/inventory/micas-tratamientos.png', 1000.00, 0, 0, false, 58),
                        ('MIC-TIN-NARANJA', 'micas', 'tratamiento', 'Tinte naranja', 'MIC-TINTE', 'Naranja', 'tinte', 'Tinte uniforme color naranja.', '/inventory/micas-tratamientos.png', 1000.00, 0, 0, false, 59),
                        ('EXAM-VIS-001', 'examen_de_la_vista', 'servicio', 'Examen visual integral', 'EXAM-INT', NULL, NULL, 'Evaluación visual completa en sucursal.', '/inventory/examen-visual-integral.png', 350.00, 0, 0, false, 60),
                        ('LC-CLEAR-030', 'lentes_de_contacto', 'caja', 'Lentes de contacto ClearView 30', 'CLEARVIEW-30', 'Transparente', 'mensual', 'Caja de lentes de contacto blandos mensuales.', '/inventory/contacto-clearview-30.png', 899.00, 10, 3, true, 70),
                        ('ACC-EST-001', 'accesorios_y_refacciones', 'estuche', 'Estuche rígido azul', 'CASE-NAVY', 'Azul marino', NULL, 'Estuche protector rígido con interior suave.', '/inventory/estuche-rigido-azul.png', 250.00, 12, 3, true, 80),
                        ('ACC-TAZA-001', 'accesorios_y_refacciones', 'taza', 'Taza óptica', 'MUG-OLM', 'Blanco / azul', NULL, 'Taza de cerámica con diseño inspirado en lentes.', '/inventory/taza-optica.png', 180.00, 8, 2, true, 81),
                        ('CUID-KIT-001', 'soluciones_y_cuidado', 'limpieza', 'Kit limpiador con paño', 'CLEAN-KIT', 'Azul', NULL, 'Atomizador limpiador para micas acompañado de paño de microfibra.', '/inventory/kit-limpiador-panuelo.png', 220.00, 15, 4, true, 90)
                ) AS catalogo (
                    sku, categoria, subcategoria, nombre, modelo, color, tipo_mica,
                    descripcion, imagen_url, precio, stock, stock_minimo, controla_stock,
                    orden_catalogo
                )
                WHERE s.sucursal_id IN (1, 2)
                ON CONFLICT (sucursal_id, sku) DO UPDATE SET
                    categoria = EXCLUDED.categoria,
                    subcategoria = EXCLUDED.subcategoria,
                    nombre = EXCLUDED.nombre,
                    modelo = EXCLUDED.modelo,
                    color = EXCLUDED.color,
                    tipo_mica = EXCLUDED.tipo_mica,
                    descripcion = EXCLUDED.descripcion,
                    imagen_url = EXCLUDED.imagen_url,
                    stock_minimo = EXCLUDED.stock_minimo,
                    controla_stock = EXCLUDED.controla_stock,
                    orden_catalogo = EXCLUDED.orden_catalogo,
                    activo = true,
                    updated_at = NOW();
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
                ADD COLUMN IF NOT EXISTS agenda_calendar_id text NULL,
                ADD COLUMN IF NOT EXISTS agenda_inicio timestamptz NULL,
                ADD COLUMN IF NOT EXISTS agenda_fin timestamptz NULL,
                ADD COLUMN IF NOT EXISTS etapa_consulta text NULL,
                ADD COLUMN IF NOT EXISTS motivo_consulta text NULL;
                """
            )

            cur.execute(
                """
                ALTER TABLE core.consultas
                ADD COLUMN IF NOT EXISTS created_by text NULL,
                ADD COLUMN IF NOT EXISTS doctor_primer_nombre text NULL,
                ADD COLUMN IF NOT EXISTS doctor_apellido_paterno text NULL;
                """
            )

            cur.execute(
                """
                UPDATE core.consultas
                SET
                  doctor_primer_nombre = COALESCE(
                    NULLIF(TRIM(doctor_primer_nombre), ''),
                    NULLIF(TRIM(created_by), '')
                  ),
                  doctor_apellido_paterno = NULLIF(TRIM(doctor_apellido_paterno), '')
                WHERE
                  doctor_primer_nombre IS NULL OR TRIM(doctor_primer_nombre) = ''
                  OR doctor_apellido_paterno IS NULL OR TRIM(doctor_apellido_paterno) = '';
                """
            )

        conn.commit()


def ensure_pacientes_schema():
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE SCHEMA IF NOT EXISTS core;")

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.pacientes (
                    paciente_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL,
                    nombre text NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    activo boolean NOT NULL DEFAULT true
                );
                """
            )

            cur.execute(
                """
                ALTER TABLE core.pacientes
                ADD COLUMN IF NOT EXISTS nombre text NULL,
                ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS primer_nombre text NULL,
                ADD COLUMN IF NOT EXISTS segundo_nombre text NULL,
                ADD COLUMN IF NOT EXISTS apellido_paterno text NULL,
                ADD COLUMN IF NOT EXISTS apellido_materno text NULL,
                ADD COLUMN IF NOT EXISTS fecha_nacimiento date NULL,
                ADD COLUMN IF NOT EXISTS sexo text NULL,
                ADD COLUMN IF NOT EXISTS telefono text NULL,
                ADD COLUMN IF NOT EXISTS correo text NULL,
                ADD COLUMN IF NOT EXISTS creado_en timestamptz NULL,
                ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NULL,
                ADD COLUMN IF NOT EXISTS como_nos_conocio text NULL,
                ADD COLUMN IF NOT EXISTS calle text NULL,
                ADD COLUMN IF NOT EXISTS numero text NULL,
                ADD COLUMN IF NOT EXISTS colonia text NULL,
                ADD COLUMN IF NOT EXISTS codigo_postal text NULL,
                ADD COLUMN IF NOT EXISTS cp text NULL,
                ADD COLUMN IF NOT EXISTS municipio text NULL,
                ADD COLUMN IF NOT EXISTS estado text NULL,
                ADD COLUMN IF NOT EXISTS estado_direccion text NULL,
                ADD COLUMN IF NOT EXISTS pais text NULL;
                """
            )

            cur.execute(
                """
                UPDATE core.pacientes
                SET
                  created_at = COALESCE(created_at, NOW()),
                  creado_en = COALESCE(creado_en, created_at, NOW()),
                  actualizado_en = COALESCE(actualizado_en, created_at, NOW()),
                  activo = COALESCE(activo, true),
                  primer_nombre = COALESCE(
                    NULLIF(TRIM(primer_nombre), ''),
                    NULLIF(TRIM(SPLIT_PART(COALESCE(nombre, ''), ' ', 1)), ''),
                    CONCAT('Paciente ', paciente_id::text)
                  ),
                  segundo_nombre = NULLIF(TRIM(segundo_nombre), ''),
                  apellido_paterno = COALESCE(
                    NULLIF(TRIM(apellido_paterno), ''),
                    NULLIF(TRIM(REGEXP_REPLACE(COALESCE(nombre, ''), '^\\s*\\S+\\s*', '')), '')
                  ),
                  apellido_materno = NULLIF(TRIM(apellido_materno), ''),
                  codigo_postal = COALESCE(NULLIF(TRIM(codigo_postal), ''), NULLIF(TRIM(cp), '')),
                  cp = COALESCE(NULLIF(TRIM(cp), ''), NULLIF(TRIM(codigo_postal), '')),
                  estado_direccion = COALESCE(NULLIF(TRIM(estado_direccion), ''), NULLIF(TRIM(estado), '')),
                  pais = CASE
                    WHEN pais IS NULL OR TRIM(pais) = '' THEN NULL
                    ELSE TRIM(pais)
                  END
                WHERE
                  created_at IS NULL
                  OR creado_en IS NULL
                  OR actualizado_en IS NULL
                  OR activo IS NULL
                  OR primer_nombre IS NULL OR TRIM(primer_nombre) = ''
                  OR (apellido_paterno IS NULL AND nombre IS NOT NULL)
                  OR (codigo_postal IS NULL AND cp IS NOT NULL)
                  OR (cp IS NULL AND codigo_postal IS NOT NULL)
                  OR (estado_direccion IS NULL AND estado IS NOT NULL)
                  OR (
                    pais IS NOT NULL AND (
                      TRIM(pais) = ''
                      OR TRIM(pais) <> pais
                    )
                  );
                """
            )

            cur.execute(
                """
                ALTER TABLE core.pacientes
                  ALTER COLUMN created_at SET DEFAULT NOW(),
                  ALTER COLUMN created_at SET NOT NULL,
                  ALTER COLUMN creado_en SET DEFAULT NOW(),
                  ALTER COLUMN creado_en SET NOT NULL,
                  ALTER COLUMN activo SET DEFAULT true,
                  ALTER COLUMN activo SET NOT NULL;
                """
            )
        conn.commit()


def ensure_reporting_views():
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DO $$
                BEGIN
                  IF EXISTS (
                    SELECT 1
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'core' AND c.relname = 'ventas' AND c.relkind = 'r'
                  ) THEN
                    ALTER TABLE core.ventas
                      DROP COLUMN IF EXISTS paciente_nombre,
                      DROP COLUMN IF EXISTS sucursal_nombre;
                  END IF;

                  IF EXISTS (
                    SELECT 1
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'core' AND c.relname = 'consultas' AND c.relkind = 'r'
                  ) THEN
                    ALTER TABLE core.consultas
                      DROP COLUMN IF EXISTS paciente_nombre,
                      DROP COLUMN IF EXISTS sucursal_nombre;
                  END IF;

                  IF EXISTS (
                    SELECT 1
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'core' AND c.relname = 'pacientes' AND c.relkind = 'r'
                  ) THEN
                    ALTER TABLE core.pacientes
                      DROP COLUMN IF EXISTS nombre_completo;
                  END IF;
                END
                $$;
                """
            )

            cur.execute(
                """
                DROP VIEW IF EXISTS core.ventas_detalle;
                DROP VIEW IF EXISTS core.pacientes_detalle;
                """
            )

            cur.execute(
                """
                CREATE OR REPLACE VIEW core.pacientes_detalle AS
                SELECT
                    p.*,
                    COALESCE(
                      NULLIF(
                        TRIM(
                          CONCAT_WS(
                            ' ',
                            NULLIF(TRIM(p.primer_nombre), ''),
                            NULLIF(TRIM(p.segundo_nombre), ''),
                            NULLIF(TRIM(p.apellido_paterno), ''),
                            NULLIF(TRIM(p.apellido_materno), '')
                          )
                        ),
                        ''
                      ),
                      NULLIF(TRIM(p.nombre), ''),
                      CONCAT('Paciente #', p.paciente_id::text)
                    ) AS nombre_completo
                FROM core.pacientes p;
                """
            )

            cur.execute(
                """
                CREATE OR REPLACE VIEW core.consultas_detalle AS
                SELECT
                    c.*,
                    COALESCE(
                      NULLIF(
                        TRIM(
                          CONCAT_WS(
                            ' ',
                            NULLIF(TRIM(p.primer_nombre), ''),
                            NULLIF(TRIM(p.segundo_nombre), ''),
                            NULLIF(TRIM(p.apellido_paterno), ''),
                            NULLIF(TRIM(p.apellido_materno), '')
                          )
                        ),
                        ''
                      ),
                      NULLIF(TRIM(p.nombre), ''),
                      CONCAT('Paciente #', c.paciente_id::text)
                    ) AS paciente_nombre,
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
                    COALESCE(
                      NULLIF(
                        TRIM(
                          CONCAT_WS(
                            ' ',
                            NULLIF(TRIM(p.primer_nombre), ''),
                            NULLIF(TRIM(p.segundo_nombre), ''),
                            NULLIF(TRIM(p.apellido_paterno), ''),
                            NULLIF(TRIM(p.apellido_materno), '')
                          )
                        ),
                        ''
                      ),
                      NULLIF(TRIM(p.nombre), ''),
                      CONCAT('Paciente #', v.paciente_id::text)
                    ) AS paciente_nombre,
                    s.nombre AS sucursal_nombre
                FROM core.ventas v
                LEFT JOIN core.pacientes p ON p.paciente_id = v.paciente_id
                LEFT JOIN core.sucursales s ON s.sucursal_id = v.sucursal_id;
                """
            )

        conn.commit()

def _bootstrap_auth_user(
    cur: psycopg.Cursor,
    *,
    username: str,
    password: str,
    role: str,
    sucursal_id: int | None,
    required: bool = False,
) -> bool:
    """Create a missing bootstrap user without mutating an existing account."""
    cur.execute(
        "SELECT 1 FROM core.usuarios WHERE username = %s LIMIT 1;",
        (username,),
    )
    if cur.fetchone() is not None:
        return False

    if not password:
        if required:
            raise RuntimeError(
                f"Missing bootstrap password configuration for user {username!r}."
            )
        return False

    password_hash = argon2.hash(password)
    cur.execute(
        """
        INSERT INTO core.usuarios (
          username, password_hash, rol, role, sucursal_id, activo,
          password_changed_at, pwd_changed_at
        )
        VALUES (%s, %s, %s, %s, %s, true, NOW(), NOW())
        ON CONFLICT (username) DO NOTHING;
        """,
        (username, password_hash, role, role, sucursal_id),
    )
    return True


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
                    rol text NOT NULL DEFAULT 'admin',
                    role text NULL,
                    sucursal_id integer NULL,
                    activo boolean NOT NULL DEFAULT true,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    password_changed_at timestamptz NULL,
                    pwd_changed_at timestamptz NULL
                );
                """
            )

            # Por si la tabla ya existía antes sin sucursal_id
            cur.execute(
                """
                ALTER TABLE core.usuarios
                  ADD COLUMN IF NOT EXISTS rol text,
                  ADD COLUMN IF NOT EXISTS role text,
                  ADD COLUMN IF NOT EXISTS sucursal_id integer NULL,
                  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
                  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
                  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz NULL,
                  ADD COLUMN IF NOT EXISTS pwd_changed_at timestamptz NULL;
                """
            )

            cur.execute(
                """
                UPDATE core.usuarios
                SET
                  rol = COALESCE(NULLIF(TRIM(rol), ''), NULLIF(TRIM(role), ''), 'admin'),
                  role = COALESCE(NULLIF(TRIM(role), ''), NULLIF(TRIM(rol), ''), 'admin'),
                  password_changed_at = COALESCE(password_changed_at, pwd_changed_at, NOW()),
                  pwd_changed_at = COALESCE(pwd_changed_at, password_changed_at, NOW())
                WHERE
                  rol IS NULL OR TRIM(rol) = ''
                  OR role IS NULL OR TRIM(role) = ''
                  OR password_changed_at IS NULL
                  OR pwd_changed_at IS NULL;
                """
            )

            cur.execute(
                """
                ALTER TABLE core.usuarios
                  ALTER COLUMN rol SET DEFAULT 'admin';
                """
            )
            cur.execute(
                """
                ALTER TABLE core.usuarios
                  ALTER COLUMN rol SET NOT NULL;
                """
            )
            cur.execute(
                """
                ALTER TABLE core.usuarios
                  DROP CONSTRAINT IF EXISTS usuarios_rol_check;
                ALTER TABLE core.usuarios
                  ADD CONSTRAINT usuarios_rol_check
                  CHECK (rol IN ('admin', 'recepcion', 'doctor', 'contador'));
                """
            )

            admin_user = (
                os.getenv("ADMIN_USER")
                or os.getenv("SEED_ADMIN_USERNAME")
                or "admin"
            )
            admin_pass = str(
                os.getenv("ADMIN_PASS") or os.getenv("SEED_ADMIN_PASSWORD") or ""
            ).strip()
            _bootstrap_auth_user(
                cur,
                username=admin_user,
                password=admin_pass,
                role="admin",
                sucursal_id=None,
                required=True,
            )

            seed_staff_users = [
                (
                    "edomex_recep",
                    os.getenv("SEED_EDOMEX_RECEP_PASSWORD", ""),
                    "recepcion",
                    1,
                ),
                (
                    "edomex_doc",
                    os.getenv("SEED_EDOMEX_DOC_PASSWORD", ""),
                    "doctor",
                    1,
                ),
                (
                    "playa_recep",
                    os.getenv("SEED_PLAYA_RECEP_PASSWORD", ""),
                    "recepcion",
                    2,
                ),
                (
                    "playa_doc",
                    os.getenv("SEED_PLAYA_DOC_PASSWORD", ""),
                    "doctor",
                    2,
                ),
            ]

            for username, raw_password, user_role, sucursal_id in seed_staff_users:
                password_value = str(raw_password or "").strip()
                _bootstrap_auth_user(
                    cur,
                    username=username,
                    password=password_value,
                    role=user_role,
                    sucursal_id=sucursal_id,
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


class VentaProductoIn(BaseModel):
    producto_id: int
    cantidad: int = 1


class VentaPagoIn(BaseModel):
    pago_id: int | None = None
    metodo: str
    monto: Decimal
    referencia: str | None = None


class VentaCreate(BaseModel):
    paciente_id: int
    sucursal_id: int | None = 1
    compra: str
    subtotal: float | None = None
    descuento_porcentaje: float | None = 0
    descuento_monto: float | None = 0
    descuento_motivo: str | None = None
    cupon_tipo: str | None = None
    monto_total: float | None = None
    metodo_pago: str
    forma_liquidacion: str | None = None
    plazo_meses: int | None = None
    adelanto_aplica: bool | None = False
    adelanto_monto: float | None = None
    adelanto_metodo: str | None = None
    como_nos_conocio: str | None = None
    notas: str | None = None
    productos: list[VentaProductoIn] | None = None
    pagos: list[VentaPagoIn] | None = None
    estado_venta: str | None = None
    estado_pago: str | None = None
    estado_pedido: str | None = None


class VentaSeguimientoUpdate(BaseModel):
    sucursal_id: int | None = 1
    estado_venta: str
    estado_pago: str
    estado_pedido: str
    notas: str | None = None
    nuevo_pago: VentaPagoIn | None = None


class InventarioStockUpdate(BaseModel):
    stock: int
    expected_stock: int


class InventarioProductoUpdate(BaseModel):
    stock: int | None = None
    expected_stock: int | None = None
    precio: Decimal | None = None
    costo_unitario: Decimal | None = None


class ProductoComercioOnlineUpdate(BaseModel):
    publicado_online: bool
    comprable_online: bool
    permite_favorito: bool
    cantidad_maxima_por_linea: int | None = None


class InventarioMovimientoIn(BaseModel):
    sucursal_id: int | None = 1
    tipo: str
    cantidad: int
    expected_stock: int
    costo_unitario: Decimal | None = None
    proveedor: str | None = None
    folio: str | None = None
    notas: str | None = None


class PrescripcionOpticaCreate(BaseModel):
    sucursal_captura_id: int | None = 1
    origen: str
    historia_id: int | None = None
    referencia_externa: str | None = None
    fecha_prescripcion: str | None = None
    od_esfera: str | None = None
    od_cilindro: str | None = None
    od_eje: str | None = None
    od_adicion: str | None = None
    oi_esfera: str | None = None
    oi_cilindro: str | None = None
    oi_eje: str | None = None
    oi_adicion: str | None = None
    distancia_pupilar: str | None = None
    prisma: str | None = None
    base_prisma: str | None = None
    notas: str | None = None


class VentaCatalogoProductoIn(BaseModel):
    linea_ref: str
    producto_id: int
    cantidad: int = 1


class VentaConfiguracionOpticaIn(BaseModel):
    configuracion_ref: str
    tipo_configuracion: str
    armazon_producto_id: int | None = None
    diseno_producto_id: int | None = None
    tratamiento_producto_id: int | None = None
    variante_id: int | None = None
    uso_visual: str
    uso_visual_otro: str | None = None
    prescripcion_id: int | None = None
    comportamiento_abasto_usado: str | None = None
    estado_produccion: str | None = None


class VentaDescuentoFase1BIn(BaseModel):
    descuento_ref: str
    tipo: str
    valor: Decimal
    motivo: str
    motivo_otro: str | None = None
    cupon_tipo: str
    alcance: str = "venta"
    orden_aplicacion: int
    configuracion_refs: list[str] | None = None
    linea_refs: list[str] | None = None


class VentaFase1BCreate(BaseModel):
    paciente_id: int
    sucursal_id: int | None = 1
    notas: str | None = None
    forma_liquidacion: str | None = None
    plazo_meses: int | None = None
    estado_venta: str | None = None
    productos_catalogo: list[VentaCatalogoProductoIn] | None = None
    configuraciones: list[VentaConfiguracionOpticaIn] | None = None
    descuentos: list[VentaDescuentoFase1BIn] | None = None
    pagos: list[VentaPagoIn] | None = None


class VentaCancelacionFase1BIn(BaseModel):
    sucursal_id: int | None = 1
    alcance: str
    motivo: str
    configuracion_refs: list[str] | None = None
    linea_refs: list[str] | None = None
    cantidades_por_linea: dict[str, int] | None = None


class FinanzasMovimientoIn(BaseModel):
    sucursal_id: int | None = 1
    fecha: str | None = None
    cuenta: str
    tipo: str
    categoria: str
    descripcion: str
    monto: Decimal
    estado: str | None = "registrado"
    referencia: str | None = None


class FinanzasGastoIn(BaseModel):
    sucursal_id: int | None = 1
    fecha: str
    categoria: str
    proveedor: str | None = None
    descripcion: str
    monto: Decimal
    cuenta: str | None = None
    estado: str | None = "pendiente"
    comprobante_url: str | None = None
    fecha_pago: str | None = None


class FinanzasNominaIn(BaseModel):
    sucursal_id: int | None = 1
    empleado: str
    periodo_inicio: str
    periodo_fin: str
    salario_base: Decimal = Decimal("0")
    horas: Decimal = Decimal("0")
    comisiones: Decimal = Decimal("0")
    bonos: Decimal = Decimal("0")
    deducciones: Decimal = Decimal("0")
    pago_neto: Decimal = Decimal("0")
    costo_patronal: Decimal = Decimal("0")
    fecha_pago: str | None = None
    cuenta: str | None = None
    estado: str | None = "pendiente"
    notas: str | None = None


class FinanzasCuentaPagarIn(BaseModel):
    sucursal_id: int | None = 1
    proveedor: str
    categoria: str
    concepto: str
    folio: str | None = None
    fecha_emision: str
    fecha_vencimiento: str | None = None
    monto_total: Decimal
    monto_pagado: Decimal = Decimal("0")
    estado: str | None = "pendiente"
    comprobante_url: str | None = None


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
    diabetes_tratamiento_otro: Optional[str] = None
    usa_lentes: Optional[bool] = None
    tipo_lentes_actual: Optional[str] = None
    lentes_actuales_detalle: Optional[str] = None
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
    flotadores_lateralidad: Optional[str] = None
    horas_exterior_dia: Optional[str] = None
    uso_lentes_sol_horas_dia: Optional[str] = None
    usa_lentes_manejar_dia: Optional[bool] = None
    tipo_lentes_manejar_dia: Optional[str] = None
    tratamientos_lentes_manejar_dia: Optional[str] = None
    usa_lentes_manejar_noche: Optional[bool] = None
    tipo_lentes_manejar_noche: Optional[str] = None
    tratamientos_lentes_manejar_noche: Optional[str] = None
    nivel_educativo: Optional[str] = None
    horas_lectura_dia: Optional[str] = None
    lee_libros: Optional[bool] = None
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

COMO_NOS_CONOCIO_VALUES = {
    "instagram",
    "facebook",
    "tiktok",
    "google_maps",
    "whatsapp",
    "pagina_web",
    "paso_sucursal",
    "referencia_familiar_amigo",
    "cliente_anterior",
    "campana_evento",
    "publicidad_impresa",
    "otro",
    # Valores legacy conservados para registros existentes.
    "fb",
    "google",
    "linkedin",
    "linkedln",
    "referencia",
}
COMO_NOS_CONOCIO_CANONICAL = {
    "fb": "facebook",
    "google": "google_maps",
    "linkedln": "linkedin",
    "referencia": "referencia_familiar_amigo",
}
CONSULTA_ETAPA_ALLOWED = {"primera_vez_en_clinica", "seguimiento"}
CONSULTA_MOTIVO_ALLOWED = {
    "revision_visual_general",
    "cambio_actualizacion_graduacion",
    "sintomas_visuales",
    "molestia_ocular",
    "accidente_lesion_ocular",
    "lentes_contacto",
    "seguimiento_revaloracion",
    "otro",
    # Tokens históricos conservados para leer consultas existentes.
    "revision_general",
    "graduacion_lentes",
    "molestia",
}
DIAGNOSTICO_PRINCIPAL_ALLOWED = {
    "miopia",
    "hipermetropia",
    "astigmatismo",
    "presbicia",
    "ojo_seco",
    "conjuntivitis_alergica",
    "blefaritis_mgd",
    "pterigion_pinguecula",
    "catarata",
    "glaucoma",
    "queratocono",
    "patologia_retiniana",
    "otro",
}
DIAGNOSTICO_SECUNDARIO_ALLOWED = {
    "anisometropia",
    "astenopia",
    "insuficiencia_convergencia",
    "disfuncion_acomodativa",
    "intolerancia_lentes_contacto",
    "chalazion_orzuelo",
    "ojo_rojo",
    "moscas_volantes",
    "cefalea_asociada",
    "otro_secundario",
}
DIAGNOSTICO_PRINCIPAL_ALIASES: dict[str, str] = {}
DIAGNOSTICO_SECUNDARIO_ALIASES: dict[str, str] = {
    "aniometropia": "anisometropia",
}
VENTA_COMPRA_ALLOWED = {
    "examen_de_la_vista",
    "armazon_solo",
    "micas_base",
    "micas_monofocales",
    "micas_bifocales",
    "micas_progresivas",
    "micas_sin_graduacion",
    "micas_tinte",
    "tinte_grado_1",
    "tinte_grado_2",
    "tinte_grado_3",
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
VENTA_METODO_PAGO_ALLOWED = {
    "efectivo",
    "tarjeta_credito",
    "tarjeta_debito",
    "transferencia_spei",
    "deposito_bancario",
    "cheque",
}
VENTA_FORMA_LIQUIDACION_ALLOWED = {
    "pago_completo",
    "adelanto_apartado",
    "pago_mixto",
    "meses_sin_intereses",
    "meses_con_intereses",
}
VENTA_PLAZO_MESES_ALLOWED = {3, 6, 9, 12, 18, 24}
VENTA_DESCUENTO_MOTIVO_ALLOWED = {
    "familiar",
    "cliente_referido",
    "promocion_especial",
    "convenio_empresa_escuela_otra",
    "cortesia",
}
VENTA_CUPON_TIPO_ALLOWED = {
    "cupon_online",
    "cupon_fisico",
    "sin_cupon",
}
VENTA_ESTADO_ALLOWED = {
    "cotizacion",
    "pendiente",
    "confirmada",
    "completada",
    "cancelada",
    "devuelta",
}
VENTA_ESTADO_PAGO_ALLOWED = {
    "sin_pago",
    "anticipo",
    "pagada",
    "pago_parcial",
    "reembolsada",
}
VENTA_ESTADO_PEDIDO_ALLOWED = {
    "pendiente_fabricacion",
    "en_fabricacion",
    "listo_entregar",
    "entregado",
    "cancelado",
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
            detail="como_nos_conocio inválido.",
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


def normalize_metodos_pago(value: str | None) -> str:
    tokens = list(dict.fromkeys(split_pipe_tokens(value)))
    if not tokens:
        raise HTTPException(status_code=400, detail="Selecciona al menos un método de pago.")
    invalidos = [token for token in tokens if token not in VENTA_METODO_PAGO_ALLOWED]
    if invalidos:
        raise HTTPException(
            status_code=400,
            detail=f"metodo_pago inválido: {invalidos[0]}.",
        )
    return "|".join(tokens)


def normalize_datos_descuento(
    porcentaje: Decimal,
    monto: Decimal,
    motivo: str | None,
    cupon_tipo: str | None,
) -> tuple[str | None, str | None]:
    if porcentaje <= 0 and monto <= 0:
        return None, None
    motivo_norm = normalize_single_allowed_token(
        motivo,
        VENTA_DESCUENTO_MOTIVO_ALLOWED,
        "Motivo del descuento",
        required=True,
    )
    cupon_norm = normalize_single_allowed_token(
        cupon_tipo,
        VENTA_CUPON_TIPO_ALLOWED,
        "Tipo de cupón",
        required=True,
    )
    return motivo_norm, cupon_norm


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


def _fold_ascii_token(value: str | None) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    for src, dst in (
        ("á", "a"),
        ("é", "e"),
        ("í", "i"),
        ("ó", "o"),
        ("ú", "u"),
        ("ü", "u"),
        ("ñ", "n"),
    ):
        raw = raw.replace(src, dst)
    return re.sub(r"[^a-z0-9]+", "", raw)


def _canonical_diag_token(
    raw_token: str | None,
    allowed: set[str],
    aliases: dict[str, str],
) -> str | None:
    token = normalize_controlled_token(raw_token)
    if token and token in allowed:
        return token

    compact = _fold_ascii_token(raw_token)
    if not compact:
        return None
    mapped = aliases.get(compact, compact)
    if mapped in allowed:
        return mapped
    return None


def _extract_diag_general_segment(diagnostico_general: str | None, section: str) -> str:
    text = str(diagnostico_general or "")
    if not text.strip():
        return ""
    pattern = re.compile(rf"(?im)^\s*{section}\s*:\s*(.+)$")
    m = pattern.search(text)
    if not m:
        return ""
    return str(m.group(1) or "").strip()


def _best_effort_diag_tokens(
    raw_value: str | None,
    allowed: set[str],
    aliases: dict[str, str],
    diagnostico_general: str | None,
    general_section: str,
) -> list[str]:
    tokens = split_pipe_tokens(raw_value)
    out: list[str] = []
    for token in tokens:
        canonical = _canonical_diag_token(token, allowed, aliases)
        if canonical:
            out.append(canonical)
    out = list(dict.fromkeys(out))
    if out:
        return out

    # Corrige patrones dañados tipo a|n|i|s|o|...
    compact = _canonical_diag_token("".join(tokens), allowed, aliases)
    if compact:
        return [compact]

    # Fallback: intenta recuperar desde diagnostico_general legacy.
    segment = _extract_diag_general_segment(diagnostico_general, general_section)
    if segment:
        seg_tokens: list[str] = []
        for piece in re.split(r"[|,;/]+", segment):
            canonical = _canonical_diag_token(piece, allowed, aliases)
            if canonical:
                seg_tokens.append(canonical)
        seg_tokens = list(dict.fromkeys(seg_tokens))
        if seg_tokens:
            return seg_tokens

        compact_segment = _canonical_diag_token(segment, allowed, aliases)
        if compact_segment:
            return [compact_segment]

    return []


def _repair_historia_diag_fields(cur) -> int:
    cur.execute(
        """
        SELECT
          historia_id,
          diagnostico_general,
          diagnostico_principal,
          diagnostico_principal_otro,
          diagnosticos_secundarios,
          diagnosticos_secundarios_otro
        FROM core.historias_clinicas
        WHERE activo = true;
        """
    )
    rows = cur.fetchall()
    repaired = 0

    for historia_id, diag_general, diag_principal, diag_principal_otro, diag_sec, diag_sec_otro in rows:
        principal_tokens = _best_effort_diag_tokens(
            diag_principal,
            DIAGNOSTICO_PRINCIPAL_ALLOWED,
            DIAGNOSTICO_PRINCIPAL_ALIASES,
            diag_general,
            "principal",
        )
        secundarios_tokens = _best_effort_diag_tokens(
            diag_sec,
            DIAGNOSTICO_SECUNDARIO_ALLOWED,
            DIAGNOSTICO_SECUNDARIO_ALIASES,
            diag_general,
            "secundarios?",
        )

        next_principal = "|".join(principal_tokens) if principal_tokens else None
        next_secundarios = "|".join(secundarios_tokens) if secundarios_tokens else None
        next_principal_otro = str(diag_principal_otro or "").strip() or None
        next_sec_otro = str(diag_sec_otro or "").strip() or None

        if "otro" not in principal_tokens:
            next_principal_otro = None
        if "otro_secundario" not in secundarios_tokens:
            next_sec_otro = None

        current_principal_tokens = [
            t for t in split_pipe_tokens(diag_principal) if t in DIAGNOSTICO_PRINCIPAL_ALLOWED
        ]
        current_secundarios_tokens = [
            t for t in split_pipe_tokens(diag_sec) if t in DIAGNOSTICO_SECUNDARIO_ALLOWED
        ]
        current_principal = "|".join(list(dict.fromkeys(current_principal_tokens))) or None
        current_secundarios = "|".join(list(dict.fromkeys(current_secundarios_tokens))) or None
        current_principal_otro = str(diag_principal_otro or "").strip() or None
        current_sec_otro = str(diag_sec_otro or "").strip() or None

        if (
            current_principal != next_principal
            or current_secundarios != next_secundarios
            or current_principal_otro != next_principal_otro
            or current_sec_otro != next_sec_otro
        ):
            cur.execute(
                """
                UPDATE core.historias_clinicas
                SET
                  diagnostico_principal = %s,
                  diagnostico_principal_otro = %s,
                  diagnosticos_secundarios = %s,
                  diagnosticos_secundarios_otro = %s,
                  updated_at = NOW()
                WHERE historia_id = %s;
                """,
                (
                    next_principal,
                    next_principal_otro,
                    next_secundarios,
                    next_sec_otro,
                    historia_id,
                ),
            )
            repaired += 1

    return repaired


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
            detail="motivo_consulta es requerido.",
        )
    motivo_tokens = [t for t in split_pipe_tokens(motivo) if t in CONSULTA_MOTIVO_ALLOWED]
    motivo_tokens = list(dict.fromkeys(motivo_tokens))
    if not motivo_tokens:
        raise HTTPException(
            status_code=400,
            detail="motivo_consulta es requerido.",
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
        if len(local_digits) < 7 or len(local_digits) > 10:
            raise HTTPException(status_code=400, detail="Teléfono debe tener entre 7 y 10 dígitos.")
        return f"+{country_code} {local_digits}"

    digits = re.sub(r"\D", "", raw)
    if len(digits) < 7 or len(digits) > 10:
        raise HTTPException(status_code=400, detail="Teléfono debe tener entre 7 y 10 dígitos.")
    return digits


def normalize_country_name(value: str | None) -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    return raw


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
    ensure_finanzas_schema()
    ensure_consultas_schema()
    ensure_pacientes_schema()
    try:
        ensure_reporting_views()
    except Exception as e:
        # Evita tumbar el arranque por diferencias de objetos legacy en entornos productivos.
        print(f"[startup] ensure_reporting_views omitido temporalmente: {e}")
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
        tz_name = _timezone_for_sucursal(sucursal_id) if sucursal_id is not None else "America/Mexico_City"
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


def _sql_export_local_date_expr(ts_col_ref: str, sucursal_col_ref: str) -> str:
    return (
        f"DATE({ts_col_ref} AT TIME ZONE "
        f"(CASE WHEN {sucursal_col_ref} = 2 THEN 'America/Cancun' ELSE 'America/Mexico_City' END))"
    )


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


def _sql_humanize_anios_text_expr(sql_col_ref: str) -> str:
    return (
        f"CASE "
        f"WHEN {sql_col_ref} IS NULL THEN NULL "
        f"ELSE regexp_replace( "
        f"       regexp_replace({sql_col_ref}, E'\\\\m(anios|anos)\\\\M', 'años', 'gi'), "
        f"       E'\\\\m(ano)\\\\M', 'año', 'gi' "
        f"     ) "
        f"END"
    )


def _sql_humanize_anios_expr(sql_col_ref: str) -> str:
    text_expr = _sql_humanize_anios_text_expr(sql_col_ref)
    return (
        f"CASE "
        f"WHEN {sql_col_ref} IS NULL THEN NULL "
        f"WHEN regexp_replace(lower({sql_col_ref}), E'\\\\s+', '', 'g') IN ('1|anios', '1|anos', '1|ano', '1|año', '1|años', '1.0|anios', '1.0|anos', '1.0|ano', '1.0|año', '1.0|años') THEN '1|año' "
        f"ELSE {text_expr} "
        f"END"
    )


def _sql_humanize_uso_pantalla_oscuridad_expr(sql_col_ref: str) -> str:
    return (
        f"CASE "
        f"WHEN {sql_col_ref} IS NULL OR TRIM({sql_col_ref}) = '' THEN NULL "
        f"WHEN lower(trim({sql_col_ref})) IN ('lt_30min', 'lt-30min', '0_30min', '0-30min') THEN '0-30 minutos' "
        f"WHEN lower(trim({sql_col_ref})) IN ('30min_1h', '30min-1h') THEN '30 minutos - 1 hora' "
        f"WHEN lower(trim({sql_col_ref})) IN ('2h_4h', '2h-4h') THEN '2 horas - 4 horas' "
        f"WHEN lower(trim({sql_col_ref})) IN ('4h_6h', '4h-6h') THEN '4 horas - 6 horas' "
        f"WHEN lower(trim({sql_col_ref})) IN ('6h_plus', '6h+plus', '6h_plus_h') THEN '+6 horas' "
        f"ELSE TRIM({sql_col_ref}) "
        f"END"
    )


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

    consulta_fecha_local_expr = _sql_export_local_date_expr("c.fecha_hora", "c.sucursal_id")
    where = ["c.activo = true", f"{consulta_fecha_local_expr} BETWEEN %s AND %s"]
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

    venta_fecha_local_expr = _sql_export_local_date_expr("v.fecha_hora", "v.sucursal_id")
    where = ["v.activo = true", f"{venta_fecha_local_expr} BETWEEN %s AND %s"]
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

    paciente_fecha_local_expr = _sql_export_local_date_expr("p.creado_en", "p.sucursal_id")
    where = ["p.activo = true", f"{paciente_fecha_local_expr} BETWEEN %s AND %s"]
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
        "diabetes_estado", "diabetes_control", "diabetes_años", "diabetes_tratamiento",
        "horas_pantalla_dia", "conduccion_nocturna_horas", "exposicion_uv",
        "tabaquismo_estado", "tabaquismo_intensidad", "tabaquismo_años", "tabaquismo_años_desde_dejo",
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
        "flotadores_destellos", "flotadores_lateralidad",
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
    select_expr_overrides = {
        "diabetes_años": f"{_sql_humanize_anios_text_expr('h.diabetes_anios')} AS \"diabetes_años\"",
        "tabaquismo_años": f"{_sql_humanize_anios_expr('h.tabaquismo_anios')} AS \"tabaquismo_años\"",
        "tabaquismo_años_desde_dejo": f"{_sql_humanize_anios_expr('h.tabaquismo_anios_desde_dejo')} AS \"tabaquismo_años_desde_dejo\"",
        "alcohol_frecuencia": f"{_sql_humanize_anios_text_expr('h.alcohol_frecuencia')} AS alcohol_frecuencia",
        "marihuana_frecuencia": f"{_sql_humanize_anios_text_expr('h.marihuana_frecuencia')} AS marihuana_frecuencia",
        "drogas_frecuencia": f"{_sql_humanize_anios_text_expr('h.drogas_frecuencia')} AS drogas_frecuencia",
        "tiempo_uso_lentes": (
            "CASE "
            "WHEN h.tiempo_uso_lentes IS NULL THEN NULL "
            "WHEN regexp_replace(lower(h.tiempo_uso_lentes), E'\\s+', '', 'g') IN ('1años', '1anios', '1año', '1ano', '1.0años', '1.0anios', '1.0año', '1.0ano') THEN '1 año' "
            f"ELSE {_sql_humanize_anios_text_expr('h.tiempo_uso_lentes')} "
            "END AS tiempo_uso_lentes"
        ),
        "uso_pantalla_en_oscuridad": (
            f"{_sql_humanize_uso_pantalla_oscuridad_expr('h.uso_pantalla_en_oscuridad')} AS uso_pantalla_en_oscuridad"
        ),
    }
    select_cols = ",\n      ".join([select_expr_overrides.get(col, f"h.{col}") for col in headers])
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


@app.get("/export/historias_ml.csv", summary="Exportar dataset ML base de historias clínicas (solo admin)")
def export_historias_ml_csv(
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
        raise HTTPException(status_code=400, detail="doctor_id no aplica para export ML de historias clínicas.")

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
        "historia_id",
        "sucursal_id",
        "paciente_id",
        "created_at_tz",
        "diagnostico_principal",
        "diagnostico_principal_otro",
        "diagnosticos_secundarios",
        "diagnosticos_secundarios_otro",
        "seguimiento_requerido",
        "seguimiento_valor",
        "paciente_edad",
        "sexo",
        "diabetes_estado",
        "diabetes_control",
        "hipertension",
        "usa_lentes",
        "tipo_lentes_actual",
        "tiempo_uso_lentes",
        "fotofobia_escala",
        "dolor_ocular_escala",
        "cefalea_frecuencia",
        "horas_pantalla_dia",
        "conduccion_nocturna_horas",
        "horas_sueno_promedio",
        "estres_nivel",
        "peso_kg",
        "altura_cm",
        "tabaquismo_estado",
        "tabaquismo_intensidad",
        "tabaquismo_anios",
        "tabaquismo_anios_desde_dejo",
        "alcohol_estado",
        "alcohol_bebidas_dia",
        "marihuana_estado",
        "marihuana_veces_semana",
        "drogas_estado",
        "drogas_frecuencia_semana",
        "sintomas",
        "antecedentes_generales",
        "antecedentes_oculares_familiares",
        "exposicion_uv",
        "uso_pantalla_en_oscuridad",
        "nivel_educativo",
        "horas_lectura_dia",
        "horas_exterior_dia",
        "deporte_frecuencia",
        "deporte_duracion",
        "deporte_tipos",
        "od_esfera",
        "od_cilindro",
        "od_eje",
        "oi_esfera",
        "oi_cilindro",
        "oi_eje",
    ]

    sql = f"""
    SELECT
      h.historia_id,
      h.sucursal_id,
      h.paciente_id,
      h.created_at_tz,
      NULLIF(TRIM(h.diagnostico_principal), '') AS diagnostico_principal,
      NULLIF(TRIM(h.diagnostico_principal_otro), '') AS diagnostico_principal_otro,
      NULLIF(TRIM(h.diagnosticos_secundarios), '') AS diagnosticos_secundarios,
      NULLIF(TRIM(h.diagnosticos_secundarios_otro), '') AS diagnosticos_secundarios_otro,
      h.seguimiento_requerido,
      h.seguimiento_valor,
      h.paciente_edad,
      NULLIF(TRIM(p.sexo), '') AS sexo,
      NULLIF(TRIM(h.diabetes_estado), '') AS diabetes_estado,
      NULLIF(TRIM(h.diabetes_control), '') AS diabetes_control,
      h.hipertension,
      h.usa_lentes,
      NULLIF(TRIM(h.tipo_lentes_actual), '') AS tipo_lentes_actual,
      NULLIF(TRIM(h.tiempo_uso_lentes), '') AS tiempo_uso_lentes,
      NULLIF(TRIM(h.fotofobia_escala), '') AS fotofobia_escala,
      NULLIF(TRIM(h.dolor_ocular_escala), '') AS dolor_ocular_escala,
      NULLIF(TRIM(h.cefalea_frecuencia), '') AS cefalea_frecuencia,
      NULLIF(TRIM(h.horas_pantalla_dia), '') AS horas_pantalla_dia,
      NULLIF(TRIM(h.conduccion_nocturna_horas), '') AS conduccion_nocturna_horas,
      NULLIF(TRIM(h.horas_sueno_promedio), '') AS horas_sueno_promedio,
      NULLIF(TRIM(h.estres_nivel), '') AS estres_nivel,
      h.peso_kg,
      h.altura_cm,
      NULLIF(TRIM(h.tabaquismo_estado), '') AS tabaquismo_estado,
      NULLIF(TRIM(h.tabaquismo_intensidad), '') AS tabaquismo_intensidad,
      NULLIF(TRIM(h.tabaquismo_anios), '') AS tabaquismo_anios,
      NULLIF(TRIM(h.tabaquismo_anios_desde_dejo), '') AS tabaquismo_anios_desde_dejo,
      NULLIF(substring(COALESCE(h.alcohol_frecuencia, '') FROM '"estado"\\s*:\\s*"([^"]+)"'), '') AS alcohol_estado,
      NULLIF(substring(COALESCE(h.alcohol_frecuencia, '') FROM '"bebidas_dia"\\s*:\\s*"?([0-9]+(?:\\.[0-9]+)?)"?'), '') AS alcohol_bebidas_dia,
      NULLIF(substring(COALESCE(h.marihuana_frecuencia, '') FROM '"estado"\\s*:\\s*"([^"]+)"'), '') AS marihuana_estado,
      NULLIF(substring(COALESCE(h.marihuana_frecuencia, '') FROM '"veces_semana"\\s*:\\s*"?([0-9]+(?:\\.[0-9]+)?)"?'), '') AS marihuana_veces_semana,
      NULLIF(substring(COALESCE(h.drogas_frecuencia, '') FROM '"estado"\\s*:\\s*"([^"]+)"'), '') AS drogas_estado,
      NULLIF(substring(COALESCE(h.drogas_frecuencia, '') FROM '"frecuencia_semana"\\s*:\\s*"?([0-9]+(?:\\.[0-9]+)?)"?'), '') AS drogas_frecuencia_semana,
      NULLIF(TRIM(h.sintomas), '') AS sintomas,
      NULLIF(TRIM(h.antecedentes_generales), '') AS antecedentes_generales,
      NULLIF(TRIM(h.antecedentes_oculares_familiares), '') AS antecedentes_oculares_familiares,
      NULLIF(TRIM(h.exposicion_uv), '') AS exposicion_uv,
      {_sql_humanize_uso_pantalla_oscuridad_expr('h.uso_pantalla_en_oscuridad')} AS uso_pantalla_en_oscuridad,
      NULLIF(TRIM(h.nivel_educativo), '') AS nivel_educativo,
      NULLIF(TRIM(h.horas_lectura_dia), '') AS horas_lectura_dia,
      NULLIF(TRIM(h.horas_exterior_dia), '') AS horas_exterior_dia,
      NULLIF(TRIM(h.deporte_frecuencia), '') AS deporte_frecuencia,
      NULLIF(TRIM(h.deporte_duracion), '') AS deporte_duracion,
      NULLIF(TRIM(h.deporte_tipos), '') AS deporte_tipos,
      NULLIF(TRIM(h.od_esfera), '') AS od_esfera,
      NULLIF(TRIM(h.od_cilindro), '') AS od_cilindro,
      NULLIF(TRIM(h.od_eje), '') AS od_eje,
      NULLIF(TRIM(h.oi_esfera), '') AS oi_esfera,
      NULLIF(TRIM(h.oi_cilindro), '') AS oi_cilindro,
      NULLIF(TRIM(h.oi_eje), '') AS oi_eje
    FROM core.historias_clinicas h
    LEFT JOIN core.pacientes p
      ON p.paciente_id = h.paciente_id
     AND p.sucursal_id = h.sucursal_id
    WHERE {' AND '.join(where)}
    ORDER BY h.created_at_tz DESC, h.historia_id DESC;
    """

    filename = _export_filename("historias_ml", desde_date, hasta_date, sid)
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
    headers = [
        "sucursal_id",
        "nombre",
        "codigo",
        "ciudad",
        "estado",
        "calle",
        "numero",
        "colonia",
        "cp",
        "municipio",
        "pais",
        "activa",
    ]
    sql = """
    SELECT
      s.sucursal_id,
      s.nombre,
      s.codigo,
      s.ciudad,
      s.estado,
      s.calle,
      s.numero,
      s.colonia,
      s.cp,
      s.municipio,
      s.pais,
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
    login_username = str(data.username or "").strip()
    if not login_username:
        raise HTTPException(status_code=401, detail="Credenciales inválidas.")

    # 1) buscar usuario activo
    sql = """
    SELECT username, password_hash, role, sucursal_id, activo, pwd_changed_at
    FROM core.usuarios
    WHERE LOWER(TRIM(username)) = LOWER(%s)
    LIMIT 1;
    """
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (login_username,))
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

REPORTING_SCOPE_VALUES = {"general", "online"}


def _resolve_reporting_scope(user: dict[str, Any], raw_scope: str | int | None) -> tuple[str, int | None]:
    """Resolve the shared Sucursal selector without conflating channel and branch."""
    raw = "" if raw_scope is None else str(raw_scope).strip().lower()
    if raw in REPORTING_SCOPE_VALUES:
        if user.get("rol") in {"recepcion", "doctor"}:
            raise HTTPException(status_code=403, detail="Este usuario solo puede consultar su sucursal.")
        return raw, None
    try:
        branch_id = int(raw) if raw else None
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="sucursal_id inválido. Usa general, online o un entero.")
    branch_id = force_sucursal(user, branch_id)
    if branch_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    with psycopg.connect(DB_CONNINFO) as conn:
        row = conn.execute(
            "SELECT 1 FROM core.sucursales WHERE sucursal_id = %s AND COALESCE(activa, true) = true;",
            (branch_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=400, detail="Sucursal física inválida.")
    return "branch", branch_id


def _report_scope_sql(alias: str, scope: str, branch_id: int | None) -> str:
    """Return a validated SQL predicate; values are controlled integers/tokens only."""
    if scope == "general":
        return "TRUE"
    if scope == "online":
        return f"{alias}.canal_venta = 'online'"
    return f"{alias}.canal_venta = 'fisica' AND {alias}.sucursal_id = {int(branch_id)}"

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


app.include_router(create_admin_fulfillment_router(DB_CONNINFO, get_current_user))
app.include_router(create_optical_operations_router(DB_CONNINFO, get_current_user))
app.include_router(create_prescription_access_admin_router(DB_CONNINFO, get_current_user))
app.include_router(create_optical_catalog_admin_router(DB_CONNINFO, get_current_user))


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


def _calendar_primary_fallback_enabled() -> bool:
    return os.getenv("GOOGLE_CALENDAR_PRIMARY_FALLBACK", "true").strip().lower() in {"1", "true", "yes", "on"}


def _should_retry_with_primary_calendar(exc: Exception) -> bool:
    msg = str(exc).lower()
    return (
        "not found" in msg
        or "404" in msg
        or "forbidden" in msg
        or "403" in msg
        or "permission" in msg
        or "insufficient" in msg
    )


def _calendar_id_candidates(calendar_id: str | None) -> list[str]:
    candidates: list[str] = []
    if calendar_id and str(calendar_id).strip():
        candidates.append(str(calendar_id).strip())
    if _calendar_primary_fallback_enabled() and not any(c.lower() == "primary" for c in candidates):
        candidates.append("primary")
    return candidates


def _format_consulta_tipo_for_humans(tipo_consulta: str | None) -> str:
    if not tipo_consulta or not str(tipo_consulta).strip():
        return "General"
    mapping = {
        "primera_vez_en_clinica": "Primera vez",
        "revision_general": "Revisión general",
        "graduacion_lentes": "Graduación de lentes",
        "revision_visual_general": "Revisión visual general",
        "cambio_actualizacion_graduacion": "Cambio o actualización de graduación",
        "sintomas_visuales": "Síntomas visuales",
        "molestia_ocular": "Molestia ocular",
        "accidente_lesion_ocular": "Accidente o lesión ocular",
        "lentes_contacto": "Lentes de contacto",
        "seguimiento": "Seguimiento",
        "seguimiento_revaloracion": "Seguimiento o revaloración",
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

    req = UrlRequest(
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
    cal_id = (_GOOGLE_CALENDAR_IDS_BY_SUCURSAL.get(str(sucursal_id)) or "").strip()
    if cal_id:
        return cal_id
    if _calendar_primary_fallback_enabled():
        return "primary"
    if not cal_id:
        raise HTTPException(status_code=400, detail=f"No hay calendar configurado para sucursal {sucursal_id}.")
    return cal_id


@app.get("/agenda/test", summary="Crear evento de prueba en Google Calendar por sucursal")
def agenda_test(sucursal_id: int, user=Depends(get_current_user)):
    require_roles(user, ("admin",))
    if sucursal_id <= 0:
        raise HTTPException(status_code=400, detail="sucursal_id inválido.")

    tz_name = _timezone_for_sucursal(sucursal_id)
    tz = ZoneInfo(tz_name)
    calendar_id = _calendar_id_for_sucursal(sucursal_id)
    calendar_candidates = _calendar_id_candidates(calendar_id)
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

    last_exc: Exception | None = None
    created = None
    calendar_used = calendar_id
    for idx, current_calendar_id in enumerate(calendar_candidates):
        try:
            created = service.events().insert(calendarId=current_calendar_id, body=body).execute()
            calendar_used = current_calendar_id
            break
        except Exception as e:
            last_exc = e
            has_next = idx < (len(calendar_candidates) - 1)
            if has_next and _should_retry_with_primary_calendar(e):
                continue
            _raise_google_calendar_error(e)
    if created is None and last_exc is not None:
        _raise_google_calendar_error(last_exc)
    if created is None:
        raise HTTPException(status_code=400, detail="No se pudo crear evento de prueba.")

    return {
        "ok": True,
        "sucursal_id": sucursal_id,
        "calendar_id": calendar_used,
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
    candidates = _calendar_id_candidates(calendar_id)
    if not candidates:
        raise HTTPException(status_code=400, detail="No hay calendar configurado para esta sucursal.")

    last_exc: Exception | None = None
    for idx, current_calendar_id in enumerate(candidates):
        try:
            events_result = service.events().list(
                calendarId=current_calendar_id,
                timeMin=start_dt.astimezone(timezone.utc).isoformat(),
                timeMax=end_dt.astimezone(timezone.utc).isoformat(),
                singleEvents=True,
                orderBy="startTime",
            ).execute()
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
        except Exception as e:
            last_exc = e
            has_next = idx < (len(candidates) - 1)
            if has_next and _should_retry_with_primary_calendar(e):
                continue
            _raise_google_calendar_error(e)

    if last_exc is not None:
        _raise_google_calendar_error(last_exc)
    return []


def _has_overlap(start_dt: datetime, end_dt: datetime, busy: list[tuple[datetime, datetime]]) -> bool:
    for b_start, b_end in busy:
        if start_dt < b_end and end_dt > b_start:
            return True
    return False


def _fetch_busy_intervals_consultas(
    sucursal_id: int,
    start_dt: datetime,
    end_dt: datetime,
    exclude_consulta_id: int | None = None,
) -> list[tuple[datetime, datetime]]:
    sql = """
    SELECT agenda_inicio, agenda_fin
    FROM core.consultas
    WHERE sucursal_id = %s
      AND activo = true
      AND agenda_inicio IS NOT NULL
      AND agenda_fin IS NOT NULL
      AND agenda_inicio < %s
      AND agenda_fin > %s
    """
    params: list[Any] = [sucursal_id, end_dt, start_dt]
    if exclude_consulta_id is not None:
        sql += " AND consulta_id <> %s"
        params.append(exclude_consulta_id)
    sql += " ORDER BY agenda_inicio ASC"

    busy: list[tuple[datetime, datetime]] = []
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()
            for row in rows:
                if not row or row[0] is None or row[1] is None:
                    continue
                start, end = row[0], row[1]
                if isinstance(start, datetime) and isinstance(end, datetime) and end > start:
                    busy.append((start, end))
    return busy


def _build_slots_for_day(sucursal_id: int, fecha: date, duracion_min: int = 45) -> dict[str, Any]:
    tz_name = _timezone_for_sucursal(sucursal_id)
    tz = ZoneInfo(tz_name)

    start_hour = int(os.getenv("AGENDA_START_HOUR", "10"))
    end_hour = int(os.getenv("AGENDA_END_HOUR", "20"))
    step_min = duracion_min
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

    busy: list[tuple[datetime, datetime]] = _fetch_busy_intervals_consultas(
        sucursal_id=sucursal_id,
        start_dt=day_start,
        end_dt=day_end,
    )
    calendar_sync = False
    calendar_error: str | None = None
    if _calendar_feature_enabled():
        try:
            cal_id = _calendar_id_for_sucursal(sucursal_id)
            busy.extend(_fetch_busy_intervals(cal_id, tz_name, day_start, day_end, sucursal_id=sucursal_id))
            calendar_sync = True
        except HTTPException as e:
            calendar_error = str(e.detail)

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

    return {
        "timezone": tz_name,
        "fecha": str(fecha),
        "slots": slots,
        "calendar_sync": calendar_sync,
        "calendar_error": calendar_error,
    }


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
) -> tuple[str, str | None]:
    tz_name = _timezone_for_sucursal(sucursal_id)
    cal_id = _calendar_id_for_sucursal(sucursal_id)
    calendar_candidates = _calendar_id_candidates(cal_id)
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

    last_exc: Exception | None = None
    for idx, current_calendar_id in enumerate(calendar_candidates):
        try:
            created = service.events().insert(calendarId=current_calendar_id, body=body, sendUpdates="all").execute()
            return str(created.get("id", "")), str(current_calendar_id)
        except Exception as e:
            last_exc = e
            has_next = idx < (len(calendar_candidates) - 1)
            if has_next and _should_retry_with_primary_calendar(e):
                continue
            _raise_google_calendar_error(e)

    if last_exc is not None:
        _raise_google_calendar_error(last_exc)
    return "", None


def _delete_calendar_event_for_consulta(
    sucursal_id: int,
    event_id: str,
    calendar_id_hint: str | None = None,
) -> bool:
    if not event_id or not str(event_id).strip():
        return False

    cal_id = _calendar_id_for_sucursal(sucursal_id)
    calendar_candidates: list[str] = []
    for candidate in _calendar_id_candidates(calendar_id_hint):
        normalized = str(candidate).strip()
        if normalized and normalized not in calendar_candidates:
            calendar_candidates.append(normalized)
    for candidate in _calendar_id_candidates(cal_id):
        normalized = str(candidate).strip()
        if normalized and normalized not in calendar_candidates:
            calendar_candidates.append(normalized)

    if not calendar_candidates:
        return False

    service = _get_google_calendar_service(sucursal_id=sucursal_id)
    last_exc: Exception | None = None
    for idx, current_calendar_id in enumerate(calendar_candidates):
        has_next = idx < (len(calendar_candidates) - 1)
        try:
            service.events().delete(
                calendarId=current_calendar_id,
                eventId=str(event_id).strip(),
                sendUpdates="all",
            ).execute()
            return True
        except Exception as e:
            msg = str(e).lower()
            # Si ya no existe en Google Calendar, lo tratamos como borrado exitoso.
            if "404" in msg or "not found" in msg:
                if has_next:
                    continue
                return True
            last_exc = e
            if has_next and _should_retry_with_primary_calendar(e):
                continue
            _raise_google_calendar_error(e)

    if last_exc is not None:
        _raise_google_calendar_error(last_exc)
    return False


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








@app.get("/me", summary="Info del usuario autenticado")
def me(token: str = Depends(oauth2_scheme)):
    # 1) Decode JWT
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado.")

    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token inválido (sub faltante).")

    # 2) Leer usuario en DB (usa role, NO rol)
    sql = """
    SELECT username, role, sucursal_id, activo, pwd_changed_at
    FROM core.usuarios
    WHERE username = %s
    LIMIT 1;
    """

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (username,))
            row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=401, detail="Usuario no existe.")
    username_db, role_db, sucursal_id_db, activo_db, pwd_changed_at_db = row

    if not activo_db:
        raise HTTPException(status_code=401, detail="Usuario inactivo.")

    return {
        "username": username_db,
        "rol": role_db,               # la API sigue devolviendo "rol" para tu frontend
        "sucursal_id": sucursal_id_db,
        "pwd_changed_at": pwd_changed_at_db.isoformat() if pwd_changed_at_db else None,
    }






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
    sql = """
    SELECT
      sucursal_id,
      nombre,
      codigo,
      ciudad,
      estado,
      calle,
      numero,
      colonia,
      cp,
      municipio,
      pais,
      activa
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
            "calle": r[5],
            "numero": r[6],
            "colonia": r[7],
            "cp": r[8],
            "municipio": r[9],
            "pais": r[10],
            "activa": r[11],
        }
        for r in rows
    ]



@app.post("/pacientes", summary="Crear paciente")
def crear_paciente(p: PacienteCreate, user=Depends(get_current_user)):

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
    p.pais = normalize_country_name(p.pais)
    if not p.telefono:
        raise HTTPException(status_code=400, detail="Teléfono es obligatorio y debe tener entre 7 y 10 dígitos.")
    

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


# ============================================================================
# Phase 1B — global catalog, branch inventory and optical-sale configuration.
# Legacy endpoints/tables above remain available for historical test records.
# ============================================================================

PHASE1B_CONFIG_TYPES = {"par_completo", "solo_micas", "solo_tratamiento"}
PHASE1B_USO_VISUAL = {"lejos", "cerca", "intermedio", "multifocal", "sin_graduacion", "otro"}
PHASE1B_ABASTO = {"inventario", "laboratorio_bajo_pedido", "fabricacion_interna", "servicio"}
PHASE1B_PRODUCCION = {
    "pendiente_anticipo", "listo_para_produccion", "en_produccion",
    "listo_para_entregar", "entregado", "cancelado",
}
PHASE1B_DESCUENTO_TIPOS = {"porcentaje", "monto_fijo"}
PHASE1B_DESCUENTO_MOTIVOS = {
    "familiar", "cliente_referido", "promocion_especial",
    "convenio_empresa_escuela_organizacion", "cortesia",
    "cliente_frecuente", "otro",
}
PHASE1B_CUPON_TIPOS = {"online", "fisico", "sin_cupon"}
PHASE1B_DESCUENTO_ALCANCES = {"venta", "configuracion", "linea"}


def _phase1b_model_item(value: Any, model_class: type[BaseModel], label: str) -> BaseModel:
    if isinstance(value, model_class):
        return value
    try:
        if hasattr(model_class, "model_validate"):
            return model_class.model_validate(value)
        return model_class.parse_obj(value)
    except (ValidationError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"{label} inválido: {exc}")


def _phase1b_normalize_sale_input(data: VentaFase1BCreate) -> VentaFase1BCreate:
    raw = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    cleaned = sanitize_payload_strings(raw)
    return _phase1b_model_item(cleaned, VentaFase1BCreate, "Venta Phase 1B")


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Importe monetario inválido.")


def _phase1b_effective_catalog_cost(
    product: dict[str, Any], variant: dict[str, Any] | None = None,
) -> Decimal | None:
    """Return the selected record's own cost; NULL variants stay unknown."""
    return variant["costo_unitario"] if variant else product["costo_unitario"]


def _phase1b_patient_row(cur, paciente_id: int, *, lock: bool = False):
    cur.execute(
        f"""
        SELECT paciente_id, sucursal_id, primer_nombre, apellido_paterno,
               apellido_materno, telefono, activo
        FROM core.pacientes
        WHERE paciente_id = %s
        {"FOR SHARE" if lock else ""};
        """,
        (paciente_id,),
    )
    row = cur.fetchone()
    if row is None or row[6] is not True:
        raise HTTPException(status_code=400, detail="El paciente no existe o está inactivo.")
    if not str(row[2] or "").strip():
        raise HTTPException(status_code=400, detail="El paciente debe tener primer nombre.")
    if not (str(row[3] or "").strip() or str(row[4] or "").strip()):
        raise HTTPException(status_code=400, detail="El paciente debe tener al menos un apellido.")
    if not str(row[5] or "").strip():
        raise HTTPException(status_code=400, detail="El paciente debe tener teléfono.")
    return row


def _phase1b_catalog_rows(cur, producto_ids: set[int], sucursal_id: int, *, lock: bool) -> dict[int, dict[str, Any]]:
    if not producto_ids:
        return {}
    lock_clause = "FOR SHARE OF producto" if lock else ""
    cur.execute(
        f"""
        SELECT
            producto.producto_id, producto.sku, producto.slug, producto.nombre,
            producto.descripcion, producto.categoria, producto.subcategoria,
            producto.tipo_producto, producto.modalidad_precio, producto.precio,
            producto.costo_unitario, producto.costo_confirmado,
            producto.controla_stock, producto.comportamiento_abasto_default,
            producto.unidad_medida, producto.permite_graduacion, producto.activo,
            inventario.stock, inventario.stock_reservado, inventario.stock_minimo,
            inventario.costo_promedio, inventario.version,
            imagen.url
        FROM core.catalogo_productos producto
        LEFT JOIN core.catalogo_inventario_sucursal inventario
          ON inventario.producto_id = producto.producto_id
         AND inventario.sucursal_id = %s
        LEFT JOIN LATERAL (
            SELECT url
            FROM core.catalogo_producto_imagenes
            WHERE producto_id = producto.producto_id AND activo = true
            ORDER BY es_principal DESC, display_order, producto_imagen_id
            LIMIT 1
        ) imagen ON true
        WHERE producto.producto_id = ANY(%s::bigint[])
        {lock_clause};
        """,
        (sucursal_id, sorted(producto_ids)),
    )
    rows: dict[int, dict[str, Any]] = {}
    for row in cur.fetchall():
        rows[int(row[0])] = {
            "producto_id": int(row[0]), "sku": row[1], "slug": row[2],
            "nombre": row[3], "descripcion": row[4], "categoria": row[5],
            "subcategoria": row[6], "tipo_producto": row[7],
            "modalidad_precio": row[8], "precio": _money(row[9]),
            "costo_unitario": _money(row[10]) if row[10] is not None else None,
            "costo_confirmado": row[11] is True, "controla_stock": row[12] is True,
            "comportamiento_abasto_default": row[13], "unidad_medida": row[14],
            "permite_graduacion": row[15] is True, "activo": row[16] is True,
            "stock": int(row[17] or 0), "stock_reservado": int(row[18] or 0),
            "stock_minimo": int(row[19] or 0),
            "costo_promedio": _money(row[20]) if row[20] is not None else None,
            "version": int(row[21] or 0), "imagen_url": row[22],
        }
    missing = producto_ids - set(rows)
    if missing:
        raise HTTPException(status_code=404, detail=f"Productos inexistentes: {sorted(missing)}")
    for producto in rows.values():
        if not producto["activo"]:
            raise HTTPException(status_code=400, detail=f"{producto['nombre']} está inactivo.")
        if producto["controla_stock"] and producto["comportamiento_abasto_default"] == "inventario" and producto["version"] == 0 and producto["stock"] == 0:
            # A zero/version-zero row is valid; absence is detected through the join below.
            pass
    return rows


@app.get("/catalogo/inventario", summary="Inventario global por sucursal (Phase 1B)")
def listar_inventario_catalogo(
    sucursal_id: int | None = None,
    categoria: str | None = None,
    incluir_inactivos: bool = False,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor", "contador"))
    sucursal_id = force_sucursal(user, sucursal_id)
    if sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    where = [] if incluir_inactivos else ["producto.activo = true"]
    params: list[Any] = [sucursal_id]
    if categoria and categoria.strip():
        where.append("producto.categoria = %s")
        params.append(normalize_controlled_token(categoria))
    where_sql = " AND ".join(where) if where else "true"
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    producto.producto_id, producto.sku, producto.slug,
                    producto.categoria, producto.subcategoria, producto.nombre,
                    producto.descripcion, producto.precio, producto.costo_unitario,
                    producto.costo_confirmado, producto.controla_stock,
                    producto.comportamiento_abasto_default, producto.unidad_medida,
                    producto.permite_graduacion, producto.orden_catalogo, producto.activo,
                    producto.publicado_online,
                    COALESCE(comercio.comprable_online, FALSE),
                    COALESCE(comercio.permite_favorito, TRUE),
                    comercio.cantidad_maxima_por_linea,
                    COALESCE(inventario.stock, 0), COALESCE(inventario.stock_reservado, 0),
                    COALESCE(inventario.stock_minimo, 0), COALESCE(inventario.version, 0),
                    imagen.url,
                    COALESCE((
                        SELECT json_agg(json_build_object(
                            'variante_id', variante.variante_id,
                            'codigo', variante.codigo,
                            'nombre', variante.nombre,
                            'precio_ajuste_override', variante.precio_ajuste_override,
                            'costo_unitario', CASE WHEN %s THEN variante.costo_unitario ELSE NULL END,
                            'costo_confirmado', CASE WHEN %s THEN variante.costo_confirmado ELSE false END
                        ) ORDER BY variante.orden, variante.variante_id)
                        FROM core.catalogo_producto_variantes variante
                        WHERE variante.producto_id = producto.producto_id AND variante.activo = true
                    ), '[]'::json),
                    producto.tipo_producto
                FROM core.catalogo_productos producto
                LEFT JOIN core.online_producto_configuracion comercio
                  ON comercio.producto_id = producto.producto_id
                LEFT JOIN core.catalogo_inventario_sucursal inventario
                  ON inventario.producto_id = producto.producto_id
                 AND inventario.sucursal_id = %s
                LEFT JOIN LATERAL (
                    SELECT url
                    FROM core.catalogo_producto_imagenes
                    WHERE producto_id = producto.producto_id AND activo = true
                    ORDER BY es_principal DESC, display_order, producto_imagen_id
                    LIMIT 1
                ) imagen ON true
                WHERE {where_sql}
                ORDER BY producto.orden_catalogo, producto.categoria, producto.nombre;
                """,
                tuple([user["rol"] in ("admin", "contador"), user["rol"] in ("admin", "contador"), *params]),
            )
            rows = cur.fetchall()
    can_see_cost = user["rol"] in ("admin", "contador")
    return [
        {
            "producto_id": int(row[0]), "sucursal_id": sucursal_id, "sku": row[1],
            "slug": row[2], "categoria": row[3], "subcategoria": row[4],
            "nombre": row[5], "modelo": row[2], "color": None,
            "tipo_mica": row[4], "descripcion": row[6], "precio": float(row[7] or 0),
            "costo_unitario": float(row[8]) if can_see_cost and row[8] is not None else None,
            "costo_confirmado": bool(row[9]) if can_see_cost else False,
            "controla_stock": bool(row[10]), "comportamiento_abasto_default": row[11],
            "unidad_medida": row[12], "permite_graduacion": bool(row[13]),
            "orden_catalogo": int(row[14] or 100), "activo": bool(row[15]),
            "publicado_online": bool(row[16]), "comprable_online": bool(row[17]),
            "permite_favorito": bool(row[18]),
            "cantidad_maxima_por_linea": int(row[19]) if row[19] is not None else None,
            "stock": int(row[20] or 0), "stock_reservado": int(row[21] or 0),
            "stock_minimo": int(row[22] or 0), "version": int(row[23] or 0),
            "imagen_url": row[24], "variantes": row[25] or [],
            "tipo_producto": row[26],
        }
        for row in rows
    ]


@app.patch(
    "/catalogo/productos/{producto_id}/comercio-online",
    summary="Configurar publicación, compra y favoritos en línea",
)
def actualizar_comercio_online_producto(
    producto_id: int,
    data: ProductoComercioOnlineUpdate,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin",))
    if (
        data.cantidad_maxima_por_linea is not None
        and data.cantidad_maxima_por_linea <= 0
    ):
        raise HTTPException(
            status_code=422,
            detail="La cantidad máxima debe quedar vacía o ser un entero positivo.",
        )

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT producto_id, sku, nombre, categoria, subcategoria,
                       tipo_producto, controla_stock, activo, publicado_online
                FROM core.catalogo_productos
                WHERE producto_id = %s
                FOR UPDATE
                """,
                (producto_id,),
            )
            producto = cur.fetchone()
            if producto is None:
                raise HTTPException(status_code=404, detail="Producto no existe.")

            cur.execute(
                """
                INSERT INTO core.online_producto_configuracion (
                    producto_id, comprable_online, permite_favorito,
                    cantidad_maxima_por_linea
                ) VALUES (%s, FALSE, TRUE, NULL)
                ON CONFLICT (producto_id) DO NOTHING
                """,
                (producto_id,),
            )
            cur.execute(
                """
                SELECT comprable_online, permite_favorito,
                       cantidad_maxima_por_linea
                FROM core.online_producto_configuracion
                WHERE producto_id = %s
                FOR UPDATE
                """,
                (producto_id,),
            )
            comercio_anterior = cur.fetchone()

            product_policy = {
                "categoria": producto[3],
                "subcategoria": producto[4],
                "tipo_producto": producto[5],
                "controla_stock": producto[6],
            }
            if data.comprable_online and not is_direct_purchase_product(product_policy):
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Esta categoría o tipo de producto no puede habilitarse "
                        "para compra en línea durante Phase 1F-A."
                    ),
                )

            anteriores = {
                "publicado_online": bool(producto[8]),
                "comprable_online": bool(comercio_anterior[0]),
                "permite_favorito": bool(comercio_anterior[1]),
                "cantidad_maxima_por_linea": comercio_anterior[2],
            }
            nuevos = {
                "publicado_online": bool(data.publicado_online),
                "comprable_online": bool(data.comprable_online),
                "permite_favorito": bool(data.permite_favorito),
                "cantidad_maxima_por_linea": data.cantidad_maxima_por_linea,
            }

            cur.execute(
                """
                UPDATE core.catalogo_productos
                SET publicado_online = %s, updated_at = NOW()
                WHERE producto_id = %s
                """,
                (data.publicado_online, producto_id),
            )
            cur.execute(
                """
                UPDATE core.online_producto_configuracion
                SET comprable_online = %s,
                    permite_favorito = %s,
                    cantidad_maxima_por_linea = %s,
                    updated_at = NOW()
                WHERE producto_id = %s
                """,
                (
                    data.comprable_online,
                    data.permite_favorito,
                    data.cantidad_maxima_por_linea,
                    producto_id,
                ),
            )
            if anteriores != nuevos:
                cur.execute(
                    """
                    INSERT INTO core.online_producto_configuracion_auditoria (
                        producto_id, valores_anteriores, valores_nuevos,
                        admin_username
                    ) VALUES (%s, %s::jsonb, %s::jsonb, %s)
                    """,
                    (
                        producto_id,
                        json.dumps(anteriores, default=str),
                        json.dumps(nuevos, default=str),
                        user["username"],
                    ),
                )
        conn.commit()

    storefront_activo = bool(producto[7]) and bool(data.publicado_online)
    return {
        "producto_id": producto_id,
        **nuevos,
        "comprable_efectivo": bool(
            storefront_activo
            and data.comprable_online
            and is_direct_purchase_product(product_policy)
        ),
        "favorito_efectivo": bool(storefront_activo and data.permite_favorito),
        "updated": True,
    }


@app.get("/catalogo/inventario/movimientos", summary="Movimientos del inventario global")
def listar_movimientos_catalogo(
    sucursal_id: int | None = None,
    limit: int = 500,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "contador"))
    sucursal_id = force_sucursal(user, sucursal_id)
    if sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT movimiento.movimiento_id, movimiento.created_at, movimiento.tipo,
                       movimiento.cantidad, movimiento.stock_anterior, movimiento.stock_nuevo,
                       movimiento.costo_unitario, movimiento.proveedor, movimiento.folio,
                       movimiento.notas, movimiento.created_by, producto.producto_id,
                       producto.nombre, producto.sku
                FROM core.catalogo_inventario_movimientos movimiento
                JOIN core.catalogo_productos producto
                  ON producto.producto_id = movimiento.producto_id
                WHERE movimiento.sucursal_id = %s
                ORDER BY movimiento.created_at DESC, movimiento.movimiento_id DESC
                LIMIT %s;
                """,
                (sucursal_id, max(1, min(limit, 2000))),
            )
            rows = cur.fetchall()
    return [
        {
            "movimiento_id": int(row[0]), "fecha_hora": str(row[1]), "tipo": row[2],
            "cantidad": int(row[3]), "stock_anterior": int(row[4]), "stock_nuevo": int(row[5]),
            "costo_unitario": float(row[6]) if row[6] is not None else None,
            "proveedor": row[7], "folio": row[8], "notas": row[9], "usuario": row[10],
            "producto_id": int(row[11]), "producto": row[12], "sku": row[13],
        }
        for row in rows
    ]


def _phase1b_update_inventory(cur, producto_id: int, sucursal_id: int, expected_stock: int, stock: int, user: dict[str, Any], *, tipo: str, notas: str, costo_unitario: Decimal | None = None, proveedor: str | None = None, folio: str | None = None):
    cur.execute(
        """
        SELECT controla_stock
        FROM core.catalogo_productos
        WHERE producto_id = %s;
        """,
        (producto_id,),
    )
    product = cur.fetchone()
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no existe.")
    if product[0] is not True:
        raise HTTPException(status_code=400, detail="Este producto no controla existencias.")

    cur.execute(
        """
        INSERT INTO core.catalogo_inventario_sucursal (
            producto_id, sucursal_id, stock, stock_reservado,
            stock_minimo, disponible_venta, version
        ) VALUES (%s, %s, 0, 0, 0, true, 0)
        ON CONFLICT (producto_id, sucursal_id) DO NOTHING;
        """,
        (producto_id, sucursal_id),
    )
    cur.execute(
        """
        SELECT stock, version
        FROM core.catalogo_inventario_sucursal
        WHERE producto_id = %s
          AND sucursal_id = %s
        FOR UPDATE;
        """,
        (producto_id, sucursal_id),
    )
    inventory = cur.fetchone()
    if inventory is None:
        raise HTTPException(status_code=409, detail="No se pudo preparar el inventario para esta sucursal.")
    current_stock = int(inventory[0])
    current_version = int(inventory[1])
    if current_stock != expected_stock:
        raise HTTPException(status_code=409, detail=f"El stock cambió. Stock actual: {current_stock}.")
    if stock < 0:
        raise HTTPException(status_code=400, detail="El stock no puede ser negativo.")
    cur.execute(
        """
        UPDATE core.catalogo_inventario_sucursal
        SET stock = %s, version = version + 1, updated_at = NOW(),
            costo_promedio = COALESCE(%s, costo_promedio)
        WHERE producto_id = %s AND sucursal_id = %s AND version = %s
        RETURNING stock, version;
        """,
        (stock, costo_unitario, producto_id, sucursal_id, current_version),
    )
    updated_inventory = cur.fetchone()
    if updated_inventory is None:
        raise HTTPException(status_code=409, detail="El inventario cambió durante la actualización. Recarga e intenta de nuevo.")
    if stock != current_stock:
        cur.execute(
            """
            INSERT INTO core.catalogo_inventario_movimientos (
                producto_id, sucursal_id, tipo, cantidad, stock_anterior, stock_nuevo,
                costo_unitario, proveedor, folio, notas, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """,
            (producto_id, sucursal_id, tipo, stock - current_stock, current_stock, stock,
             costo_unitario, proveedor, folio, notas, user["username"]),
        )
    return stock


@app.patch("/catalogo/inventario/{producto_id}/stock", summary="Actualizar stock del catálogo global")
def actualizar_stock_catalogo(
    producto_id: int,
    data: InventarioStockUpdate,
    sucursal_id: int | None = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin",))
    sucursal_id = force_sucursal(user, sucursal_id)
    if sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            stock = _phase1b_update_inventory(
                cur, producto_id, sucursal_id, data.expected_stock, data.stock, user,
                tipo="conteo_fisico", notas="Ajuste rápido de existencias",
            )
        conn.commit()
    return {"producto_id": producto_id, "stock": stock, "updated": True}


@app.patch("/catalogo/inventario/{producto_id}", summary="Actualizar precio, costo o stock global")
def actualizar_producto_catalogo(
    producto_id: int,
    data: InventarioProductoUpdate,
    sucursal_id: int | None = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin",))
    sucursal_id = force_sucursal(user, sucursal_id)
    if sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if data.precio is not None and data.precio < 0:
        raise HTTPException(status_code=400, detail="El precio no puede ser negativo.")
    if data.costo_unitario is not None and data.costo_unitario < 0:
        raise HTTPException(status_code=400, detail="El costo no puede ser negativo.")
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT controla_stock FROM core.catalogo_productos WHERE producto_id = %s FOR UPDATE;",
                (producto_id,),
            )
            product = cur.fetchone()
            if product is None:
                raise HTTPException(status_code=404, detail="Producto no existe.")
            if data.precio is not None or data.costo_unitario is not None:
                cur.execute(
                    """
                    UPDATE core.catalogo_productos
                    SET precio = COALESCE(%s, precio),
                        costo_unitario = CASE WHEN %s THEN %s ELSE costo_unitario END,
                        costo_confirmado = CASE WHEN %s THEN true ELSE costo_confirmado END,
                        updated_at = NOW()
                    WHERE producto_id = %s;
                    """,
                    (data.precio, data.costo_unitario is not None, data.costo_unitario,
                     data.costo_unitario is not None, producto_id),
                )
            if data.stock is not None:
                if data.expected_stock is None:
                    raise HTTPException(status_code=400, detail="expected_stock es requerido.")
                _phase1b_update_inventory(
                    cur, producto_id, sucursal_id, data.expected_stock, data.stock, user,
                    tipo="conteo_fisico", notas="Edición administrativa de producto",
                    costo_unitario=data.costo_unitario,
                )
            cur.execute(
                """
                SELECT producto.precio, producto.costo_unitario,
                       COALESCE(inventario.stock, 0)
                FROM core.catalogo_productos producto
                LEFT JOIN core.catalogo_inventario_sucursal inventario
                  ON inventario.producto_id = producto.producto_id AND inventario.sucursal_id = %s
                WHERE producto.producto_id = %s;
                """,
                (sucursal_id, producto_id),
            )
            row = cur.fetchone()
        conn.commit()
    return {
        "producto_id": producto_id, "precio": float(row[0] or 0),
        "costo_unitario": float(row[1]) if row[1] is not None else None,
        "stock": int(row[2] or 0), "updated": True,
    }


@app.post("/catalogo/inventario/{producto_id}/movimientos", summary="Registrar movimiento del catálogo global")
def registrar_movimiento_catalogo(
    producto_id: int,
    data: InventarioMovimientoIn,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin",))
    data.sucursal_id = force_sucursal(user, data.sucursal_id)
    sanitize_model_strings(data)
    if data.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    tipo = normalize_controlled_token(data.tipo)
    if tipo not in {"entrada_compra", "conteo_fisico", "ajuste_manual"}:
        raise HTTPException(status_code=400, detail="Tipo de movimiento inválido.")
    if tipo == "conteo_fisico":
        target_stock = int(data.cantidad)
    else:
        target_stock = int(data.expected_stock) + int(data.cantidad)
    if tipo == "entrada_compra" and (data.costo_unitario is None or data.costo_unitario < 0):
        raise HTTPException(status_code=400, detail="El costo unitario es requerido para una compra.")
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            stock = _phase1b_update_inventory(
                cur, producto_id, data.sucursal_id, data.expected_stock, target_stock, user,
                tipo=tipo, notas=data.notas or "Movimiento de inventario",
                costo_unitario=data.costo_unitario, proveedor=data.proveedor, folio=data.folio,
            )
            if data.costo_unitario is not None:
                cur.execute(
                    """
                    UPDATE core.catalogo_productos
                    SET costo_unitario = %s, costo_confirmado = true, updated_at = NOW()
                    WHERE producto_id = %s;
                    """,
                    (data.costo_unitario, producto_id),
                )
        conn.commit()
    return {"producto_id": producto_id, "stock": stock, "created": True}


@app.get("/pacientes/{paciente_id}/prescripciones-opticas", summary="Listar recetas ópticas del paciente")
def listar_prescripciones_opticas(paciente_id: int, user=Depends(get_current_user)):
    require_roles(user, ("admin", "recepcion", "doctor"))
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            _phase1b_patient_row(cur, paciente_id)
            cur.execute(
                """
                SELECT prescripcion_id, paciente_id, sucursal_captura_id, historia_id,
                       origen, referencia_externa, fecha_prescripcion,
                       od_esfera, od_cilindro, od_eje, od_adicion,
                       oi_esfera, oi_cilindro, oi_eje, oi_adicion,
                       distancia_pupilar, prisma, base_prisma, notas,
                       created_by, created_at
                FROM core.prescripciones_opticas
                WHERE paciente_id = %s AND activo = true
                ORDER BY fecha_prescripcion DESC NULLS LAST, prescripcion_id DESC;
                """,
                (paciente_id,),
            )
            rows = cur.fetchall()
    keys = (
        "prescripcion_id", "paciente_id", "sucursal_captura_id", "historia_id",
        "origen", "referencia_externa", "fecha_prescripcion", "od_esfera",
        "od_cilindro", "od_eje", "od_adicion", "oi_esfera", "oi_cilindro",
        "oi_eje", "oi_adicion", "distancia_pupilar", "prisma", "base_prisma",
        "notas", "created_by", "created_at",
    )
    return [
        {key: (str(value) if key in {"fecha_prescripcion", "created_at"} and value is not None else value)
         for key, value in zip(keys, row)}
        for row in rows
    ]


@app.post("/pacientes/{paciente_id}/prescripciones-opticas", summary="Crear receta óptica inmutable")
def crear_prescripcion_optica(
    paciente_id: int,
    data: PrescripcionOpticaCreate,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor"))
    data.sucursal_captura_id = force_sucursal(user, data.sucursal_captura_id)
    sanitize_model_strings(data)
    origen = normalize_controlled_token(data.origen)
    if origen not in {"interna", "externa_cliente"}:
        raise HTTPException(status_code=400, detail="Origen de receta inválido.")
    if data.sucursal_captura_id is None:
        raise HTTPException(status_code=400, detail="Sucursal de captura requerida.")
    fecha = None
    if data.fecha_prescripcion:
        try:
            fecha = date.fromisoformat(data.fecha_prescripcion)
        except ValueError:
            raise HTTPException(status_code=400, detail="Fecha de receta inválida.")
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            _phase1b_patient_row(cur, paciente_id, lock=True)
            if data.historia_id is not None:
                cur.execute(
                    "SELECT paciente_id FROM core.historias_clinicas WHERE historia_id = %s AND activo = true;",
                    (data.historia_id,),
                )
                history = cur.fetchone()
                if history is None or int(history[0]) != paciente_id:
                    raise HTTPException(status_code=400, detail="La historia clínica no pertenece al paciente.")
            cur.execute(
                """
                INSERT INTO core.prescripciones_opticas (
                    paciente_id, sucursal_captura_id, historia_id, origen,
                    referencia_externa, fecha_prescripcion,
                    od_esfera, od_cilindro, od_eje, od_adicion,
                    oi_esfera, oi_cilindro, oi_eje, oi_adicion,
                    distancia_pupilar, prisma, base_prisma, notas, created_by
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                ) RETURNING prescripcion_id;
                """,
                (
                    paciente_id, data.sucursal_captura_id, data.historia_id, origen,
                    data.referencia_externa, fecha, data.od_esfera, data.od_cilindro,
                    data.od_eje, data.od_adicion, data.oi_esfera, data.oi_cilindro,
                    data.oi_eje, data.oi_adicion, data.distancia_pupilar,
                    data.prisma, data.base_prisma, data.notas, user["username"],
                ),
            )
            prescripcion_id = int(cur.fetchone()[0])
        conn.commit()
    return {"prescripcion_id": prescripcion_id, "created": True, "immutable": True}


def _phase1b_variant_rows(cur, variante_ids: set[int]) -> dict[int, dict[str, Any]]:
    if not variante_ids:
        return {}
    cur.execute(
        """
        SELECT variante_id, producto_id, codigo, nombre, precio_ajuste_override,
               costo_unitario, costo_confirmado, activo
        FROM core.catalogo_producto_variantes
        WHERE variante_id = ANY(%s::bigint[]);
        """,
        (sorted(variante_ids),),
    )
    rows = {
        int(row[0]): {
            "variante_id": int(row[0]), "producto_id": int(row[1]),
            "codigo": row[2], "nombre": row[3],
            "precio_ajuste_override": _money(row[4]) if row[4] is not None else None,
            "costo_unitario": _money(row[5]) if row[5] is not None else None,
            "costo_confirmado": row[6] is True, "activo": row[7] is True,
        }
        for row in cur.fetchall()
    }
    missing = variante_ids - set(rows)
    if missing:
        raise HTTPException(status_code=404, detail=f"Variantes inexistentes: {sorted(missing)}")
    if any(not row["activo"] for row in rows.values()):
        raise HTTPException(status_code=400, detail="Una variante seleccionada está inactiva.")
    return rows


def _phase1b_validate_prescriptions(cur, paciente_id: int, prescripcion_ids: set[int]) -> dict[int, int]:
    if not prescripcion_ids:
        return {}
    cur.execute(
        """
        SELECT prescripcion_id, paciente_id, sucursal_captura_id, activo
        FROM core.prescripciones_opticas
        WHERE prescripcion_id = ANY(%s::bigint[])
        FOR SHARE;
        """,
        (sorted(prescripcion_ids),),
    )
    rows = cur.fetchall()
    if len(rows) != len(prescripcion_ids):
        raise HTTPException(status_code=400, detail="Una receta seleccionada no existe.")
    result: dict[int, int] = {}
    for prescription_id, owner_id, branch_id, active in rows:
        if active is not True or int(owner_id) != paciente_id:
            raise HTTPException(
                status_code=400,
                detail="Todas las recetas deben estar activas y pertenecer al paciente de la venta.",
            )
        result[int(prescription_id)] = int(branch_id)
    return result


def _phase1b_prepare_lines(
    cur,
    data: VentaFase1BCreate,
    sucursal_id: int,
    *,
    lock: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    productos_input = [
        _phase1b_model_item(item, VentaCatalogoProductoIn, "Producto del catálogo")
        for item in (data.productos_catalogo or [])
    ]
    configuraciones_input = [
        _phase1b_model_item(item, VentaConfiguracionOpticaIn, "Configuración óptica")
        for item in (data.configuraciones or [])
    ]
    if not productos_input and not configuraciones_input:
        raise HTTPException(status_code=400, detail="Agrega al menos un producto o configuración óptica.")

    product_ids: set[int] = {int(item.producto_id) for item in productos_input}
    variant_ids: set[int] = set()
    prescription_ids: set[int] = set()
    for config in configuraciones_input:
        for product_id in (
            config.armazon_producto_id,
            config.diseno_producto_id,
            config.tratamiento_producto_id,
        ):
            if product_id is not None:
                product_ids.add(int(product_id))
        if config.variante_id is not None:
            variant_ids.add(int(config.variante_id))
        if config.prescripcion_id is not None:
            prescription_ids.add(int(config.prescripcion_id))

    products = _phase1b_catalog_rows(cur, product_ids, sucursal_id, lock=lock)
    variants = _phase1b_variant_rows(cur, variant_ids)
    prescription_branches = _phase1b_validate_prescriptions(cur, data.paciente_id, prescription_ids)

    lines: list[dict[str, Any]] = []
    configs: list[dict[str, Any]] = []
    used_line_refs: set[str] = set()
    used_config_refs: set[str] = set()

    def add_line(*, line_ref: str, line_type: str, product: dict[str, Any], quantity: int,
                 supply: str, config_ref: str | None = None,
                 variant: dict[str, Any] | None = None, effective_price: Decimal | None = None):
        clean_ref = str(line_ref or "").strip()
        if not clean_ref or len(clean_ref) > 100:
            raise HTTPException(status_code=400, detail="Referencia de línea inválida.")
        if clean_ref in used_line_refs:
            raise HTTPException(status_code=400, detail=f"Referencia de línea repetida: {clean_ref}")
        used_line_refs.add(clean_ref)
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a cero.")
        price = effective_price if effective_price is not None else product["precio"]
        cost = _phase1b_effective_catalog_cost(product, variant)
        lines.append({
            "linea_ref": clean_ref, "tipo_linea": line_type,
            "producto_id": product["producto_id"], "variante_id": variant["variante_id"] if variant else None,
            "configuracion_ref": config_ref, "sucursal_id": sucursal_id,
            "sku": product["sku"], "nombre": product["nombre"],
            "descripcion": product["descripcion"], "categoria": product["categoria"],
            "subcategoria": product["subcategoria"], "unidad_medida": product["unidad_medida"],
            "comportamiento_abasto": supply, "controla_stock": product["controla_stock"],
            "cantidad": quantity, "precio_unitario": price, "costo_unitario": cost,
            "subtotal": (price * quantity).quantize(Decimal("0.01")),
            "imagen_url": product["imagen_url"], "slug": product["slug"],
            "variante_codigo": variant["codigo"] if variant else None,
            "variante_nombre": variant["nombre"] if variant else None,
        })

    for item in productos_input:
        product = products[int(item.producto_id)]
        if product["categoria"] == "micas":
            raise HTTPException(
                status_code=400,
                detail="Los diseños y tratamientos deben pertenecer a una configuración óptica.",
            )
        add_line(
            line_ref=item.linea_ref, line_type="producto", product=product,
            quantity=int(item.cantidad), supply=product["comportamiento_abasto_default"],
        )

    for config in configuraciones_input:
        config_ref = str(config.configuracion_ref or "").strip()
        if not config_ref or len(config_ref) > 80 or config_ref in used_config_refs:
            raise HTTPException(status_code=400, detail="Referencia de configuración inválida o repetida.")
        used_config_refs.add(config_ref)
        config_type = normalize_controlled_token(config.tipo_configuracion)
        visual_use = normalize_controlled_token(config.uso_visual)
        if config_type not in PHASE1B_CONFIG_TYPES:
            raise HTTPException(status_code=400, detail="Tipo de configuración óptica inválido.")
        if visual_use not in PHASE1B_USO_VISUAL:
            raise HTTPException(status_code=400, detail="Uso visual inválido.")
        visual_other = (config.uso_visual_otro or "").strip() or None
        if visual_use == "otro" and not visual_other:
            raise HTTPException(status_code=400, detail="Describe el uso visual 'otro'.")

        frame = products.get(int(config.armazon_producto_id)) if config.armazon_producto_id else None
        design = products.get(int(config.diseno_producto_id)) if config.diseno_producto_id else None
        treatment = products.get(int(config.tratamiento_producto_id)) if config.tratamiento_producto_id else None
        variant = variants.get(int(config.variante_id)) if config.variante_id else None

        if config_type == "par_completo":
            if frame is None or design is None:
                raise HTTPException(status_code=400, detail="Un par completo requiere armazón y diseño.")
            if frame["categoria"] not in {"lentes_opticos", "lentes_de_sol"} or frame["subcategoria"] != "armazon":
                raise HTTPException(status_code=400, detail="El armazón seleccionado no es válido.")
            if frame["categoria"] == "lentes_de_sol" and not frame["permite_graduacion"]:
                raise HTTPException(status_code=400, detail="Este modelo de lentes de sol no permite graduación.")
        elif config_type == "solo_micas":
            if frame is not None or design is None:
                raise HTTPException(status_code=400, detail="Solo micas usa el armazón del cliente y requiere diseño.")
        elif frame is not None or design is not None or treatment is None:
            raise HTTPException(status_code=400, detail="Solo tratamiento requiere exactamente un tratamiento y no compra diseño o armazón.")

        if design is not None and not (design["categoria"] == "micas" and design["subcategoria"] == "diseno"):
            raise HTTPException(status_code=400, detail="El diseño seleccionado no es válido.")
        if treatment is not None and not (treatment["categoria"] == "micas" and treatment["subcategoria"] == "tratamiento"):
            raise HTTPException(status_code=400, detail="El tratamiento seleccionado no es válido.")

        requires_variant = treatment is not None and treatment["sku"] in {"DEMO-TRT-BLUE", "DEMO-TRT-TINT"}
        if requires_variant and variant is None:
            raise HTTPException(status_code=400, detail="El filtro azul o tinte requiere una variante.")
        if variant is not None:
            if treatment is None or variant["producto_id"] != treatment["producto_id"]:
                raise HTTPException(status_code=400, detail="La variante no pertenece al tratamiento seleccionado.")
            if not requires_variant:
                raise HTTPException(status_code=400, detail="Este tratamiento no acepta variante.")

        default_supply_product = treatment if config_type == "solo_tratamiento" else design
        supply = normalize_controlled_token(config.comportamiento_abasto_usado)
        supply = supply or (default_supply_product["comportamiento_abasto_default"] if default_supply_product else "laboratorio_bajo_pedido")
        if supply not in {"inventario", "laboratorio_bajo_pedido", "fabricacion_interna"}:
            raise HTTPException(status_code=400, detail="Comportamiento de abasto óptico inválido.")

        non_rx = design is not None and design["sku"] == "DEMO-LENS-NONRX"
        prescription_optional = config_type == "solo_tratamiento" or non_rx or visual_use == "sin_graduacion"
        if config.prescripcion_id is None and not prescription_optional:
            raise HTTPException(status_code=400, detail="La configuración graduada requiere una receta del paciente.")
        prescription_branch = prescription_branches.get(int(config.prescripcion_id)) if config.prescripcion_id else None

        requested_status = normalize_controlled_token(config.estado_produccion) or "pendiente_anticipo"
        if requested_status not in PHASE1B_PRODUCCION or requested_status == "cancelado":
            raise HTTPException(status_code=400, detail="Estado de producción inválido para una configuración activa.")

        frame_price = frame["precio"] if frame else None
        design_price = design["precio"] if design else None
        treatment_price = treatment["precio"] if treatment else None
        variant_override = variant["precio_ajuste_override"] if variant else None
        effective_treatment_price = (
            variant_override if variant_override is not None else treatment_price
        ) if treatment else None
        subtotal = sum(
            (value for value in (frame_price, design_price, effective_treatment_price) if value is not None),
            Decimal("0.00"),
        ).quantize(Decimal("0.01"))

        configs.append({
            "configuracion_ref": config_ref, "tipo_configuracion": config_type,
            "usa_armazon_cliente": config_type in {"solo_micas", "solo_tratamiento"},
            "armazon_producto_id": frame["producto_id"] if frame else None,
            "diseno_producto_id": design["producto_id"] if design else None,
            "tratamiento_producto_id": treatment["producto_id"] if treatment else None,
            "variante_id": variant["variante_id"] if variant else None,
            "uso_visual": visual_use, "uso_visual_otro": visual_other,
            "prescripcion_id": config.prescripcion_id,
            "sucursal_prescripcion_snapshot": prescription_branch,
            "comportamiento_abasto_usado": supply,
            "estado_produccion": requested_status,
            "precio_armazon_snapshot": frame_price,
            "precio_diseno_snapshot": design_price,
            "precio_tratamiento_snapshot": treatment_price,
            "precio_variante_snapshot": variant_override,
            "costo_armazon_snapshot": frame["costo_unitario"] if frame else None,
            "costo_diseno_snapshot": design["costo_unitario"] if design else None,
            "costo_tratamiento_snapshot": treatment["costo_unitario"] if treatment else None,
            "costo_variante_snapshot": variant["costo_unitario"] if variant else None,
            "subtotal_bruto_snapshot": subtotal,
        })
        if frame:
            add_line(
                line_ref=f"{config_ref}:armazon", line_type="armazon", product=frame,
                quantity=1, supply="inventario", config_ref=config_ref,
            )
        if design:
            add_line(
                line_ref=f"{config_ref}:diseno", line_type="diseno", product=design,
                quantity=1, supply=supply, config_ref=config_ref,
            )
        if treatment:
            add_line(
                line_ref=f"{config_ref}:tratamiento", line_type="tratamiento", product=treatment,
                quantity=1, supply=supply, config_ref=config_ref, variant=variant,
                effective_price=effective_treatment_price,
            )

    return lines, configs


def _phase1b_normalize_discounts(
    discounts_input: list[VentaDescuentoFase1BIn],
    *,
    role: str,
) -> list[dict[str, Any]]:
    if role != "admin" and len(discounts_input) > 1:
        raise HTTPException(status_code=403, detail="Solo administración puede acumular varios descuentos.")
    discounts: list[dict[str, Any]] = []
    refs: set[str] = set()
    orders: set[int] = set()
    for raw_discount in discounts_input:
        discount = _phase1b_model_item(raw_discount, VentaDescuentoFase1BIn, "Descuento")
        ref = str(discount.descuento_ref or "").strip()
        discount_type = normalize_controlled_token(discount.tipo)
        reason = normalize_controlled_token(discount.motivo)
        coupon = normalize_controlled_token(discount.cupon_tipo)
        scope = normalize_controlled_token(discount.alcance)
        value = _money(discount.valor)
        order = int(discount.orden_aplicacion)
        if not ref or len(ref) > 80 or ref in refs:
            raise HTTPException(status_code=400, detail="Referencia de descuento inválida o repetida.")
        if discount_type not in PHASE1B_DESCUENTO_TIPOS:
            raise HTTPException(status_code=400, detail="Tipo de descuento inválido.")
        if value <= 0 or (discount_type == "porcentaje" and value > 100):
            raise HTTPException(status_code=400, detail="Valor de descuento inválido.")
        if reason not in PHASE1B_DESCUENTO_MOTIVOS:
            raise HTTPException(status_code=400, detail="Motivo de descuento inválido.")
        reason_other = (discount.motivo_otro or "").strip() or None
        if reason == "otro" and not reason_other:
            raise HTTPException(status_code=400, detail="Describe el motivo de descuento.")
        if coupon not in PHASE1B_CUPON_TIPOS:
            raise HTTPException(status_code=400, detail="Tipo de cupón inválido.")
        if scope not in PHASE1B_DESCUENTO_ALCANCES:
            raise HTTPException(status_code=400, detail="Alcance de descuento inválido.")
        if order <= 0 or order in orders:
            raise HTTPException(status_code=400, detail="orden_aplicacion debe ser positivo y único.")
        refs.add(ref)
        orders.add(order)
        discounts.append({
            "descuento_ref": ref, "tipo": discount_type, "valor": value,
            "motivo": reason, "motivo_otro": reason_other, "cupon_tipo": coupon,
            "alcance": scope, "orden_aplicacion": order,
            "configuracion_refs": list(dict.fromkeys(discount.configuracion_refs or [])),
            "linea_refs": list(dict.fromkeys(discount.linea_refs or [])),
        })
    if discounts and sorted(orders) != list(range(1, len(discounts) + 1)):
        raise HTTPException(status_code=400, detail="El orden de descuentos debe ser consecutivo desde 1.")
    return sorted(discounts, key=lambda item: item["orden_aplicacion"])


def _phase1b_allocate_cents(total_cents: int, balances: dict[str, int]) -> dict[str, int]:
    eligible_total = sum(balances.values())
    if total_cents < 0 or total_cents > eligible_total:
        raise ValueError("Invalid allocation")
    if total_cents == 0:
        return {key: 0 for key in balances}
    allocations: dict[str, int] = {}
    remainders: list[tuple[int, int, str]] = []
    assigned = 0
    for key, balance in balances.items():
        quotient, remainder = divmod(total_cents * balance, eligible_total)
        allocations[key] = quotient
        assigned += quotient
        remainders.append((remainder, balance, key))
    cents_left = total_cents - assigned
    for _, _, key in sorted(remainders, key=lambda item: (-item[0], -item[1], item[2])):
        if cents_left <= 0:
            break
        if allocations[key] < balances[key]:
            allocations[key] += 1
            cents_left -= 1
    if cents_left:
        raise ValueError("Unable to allocate discount exactly")
    return allocations


def _phase1b_calculate_discounts(
    lines: list[dict[str, Any]],
    discounts: list[dict[str, Any]],
) -> dict[str, Any]:
    line_map = {line["linea_ref"]: line for line in lines}
    config_refs = {line["configuracion_ref"] for line in lines if line.get("configuracion_ref")}
    balances = {
        line["linea_ref"]: int((_money(line["subtotal"]) * 100).to_integral_value())
        for line in lines
    }
    subtotal_cents = sum(balances.values())
    results: list[dict[str, Any]] = []
    for discount in discounts:
        if discount["alcance"] == "venta":
            eligible_refs = list(line_map)
        elif discount["alcance"] == "configuracion":
            requested = set(discount["configuracion_refs"])
            if not requested or not requested.issubset(config_refs):
                raise HTTPException(status_code=400, detail="Objetivo de configuración inválido para el descuento.")
            eligible_refs = [ref for ref, line in line_map.items() if line.get("configuracion_ref") in requested]
        else:
            requested = set(discount["linea_refs"])
            if not requested or not requested.issubset(line_map):
                raise HTTPException(status_code=400, detail="Objetivo de línea inválido para el descuento.")
            eligible_refs = [ref for ref in line_map if ref in requested]
        eligible_balances = {ref: balances[ref] for ref in eligible_refs if balances[ref] > 0}
        eligible_cents = sum(eligible_balances.values())
        if eligible_cents <= 0:
            raise HTTPException(status_code=400, detail="El descuento no tiene saldo elegible restante.")
        if discount["tipo"] == "porcentaje":
            amount_cents = int(
                (Decimal(eligible_cents) * discount["valor"] / Decimal("100"))
                .quantize(Decimal("1"), rounding=ROUND_DOWN)
            )
        else:
            amount_cents = int((discount["valor"] * 100).to_integral_value())
            if amount_cents > eligible_cents:
                raise HTTPException(
                    status_code=400,
                    detail=f"El descuento fijo #{discount['orden_aplicacion']} supera el saldo elegible restante.",
                )
        allocations = _phase1b_allocate_cents(amount_cents, eligible_balances)
        allocation_rows = []
        for ref in eligible_refs:
            if ref not in allocations:
                continue
            before = balances[ref]
            assigned = allocations[ref]
            after = before - assigned
            if after < 0:
                raise HTTPException(status_code=400, detail="Un descuento reduciría una línea por debajo de cero.")
            balances[ref] = after
            allocation_rows.append({
                "linea_ref": ref, "base_antes": Decimal(before) / 100,
                "monto_asignado": Decimal(assigned) / 100,
                "base_despues": Decimal(after) / 100,
            })
        results.append({
            **discount,
            "base_elegible": Decimal(eligible_cents) / 100,
            "monto_aplicado": Decimal(amount_cents) / 100,
            "asignaciones": allocation_rows,
        })
    discount_total_cents = subtotal_cents - sum(balances.values())
    return {
        "subtotal": Decimal(subtotal_cents) / 100,
        "descuento_total": Decimal(discount_total_cents) / 100,
        "total": Decimal(sum(balances.values())) / 100,
        "saldos_linea": {key: Decimal(value) / 100 for key, value in balances.items()},
        "descuentos": results,
    }


def _phase1b_validate_payments(payments_input: list[VentaPagoIn]) -> list[dict[str, Any]]:
    payments: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    for raw_payment in payments_input:
        payment = _phase1b_model_item(raw_payment, VentaPagoIn, "Pago")
        method = normalize_controlled_token(payment.metodo)
        if method not in VENTA_METODO_PAGO_ALLOWED:
            raise HTTPException(status_code=400, detail="Método de pago inválido.")
        amount = _money(payment.monto)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Cada pago debe ser mayor a cero.")
        payment_id = int(payment.pago_id) if payment.pago_id is not None else None
        if payment_id is not None:
            if payment_id in seen_ids:
                raise HTTPException(status_code=400, detail="Pago repetido.")
            seen_ids.add(payment_id)
        reference = (payment.referencia or "").strip() or None
        if reference and len(reference) > 120:
            raise HTTPException(status_code=400, detail="La referencia del pago es demasiado larga.")
        payments.append({"pago_id": payment_id, "metodo": method, "monto": amount, "referencia": reference})
    return payments


def _phase1b_payment_state(amount_paid: Decimal, total: Decimal, payment_count: int) -> str:
    if amount_paid <= 0:
        return "sin_pago"
    if amount_paid >= total:
        return "pagada"
    return "anticipo" if payment_count == 1 else "pago_parcial"


def _phase1b_purchase_tokens(lines: list[dict[str, Any]], configs: list[dict[str, Any]]) -> str:
    tokens: list[str] = []
    for config in configs:
        tokens.append(config["tipo_configuracion"])
    for line in lines:
        if line.get("configuracion_ref"):
            continue
        category = line["categoria"]
        token = {
            "lentes_opticos": "armazon_solo",
            "lentes_de_sol": "lentes_de_sol_sin_graduacion",
            "examen_de_la_vista": "examen_de_la_vista",
            "lentes_de_contacto": "lentes_de_contacto",
            "accesorios_y_refacciones": "accesorios_y_refacciones",
            "soluciones_y_cuidado": "soluciones_y_cuidado",
        }.get(category, category)
        tokens.append(token)
    return "|".join(dict.fromkeys(tokens))


def _phase1b_apply_inventory_delta(
    cur,
    *,
    sucursal_id: int,
    venta_id: int,
    old_lines: list[dict[str, Any]],
    new_lines: list[dict[str, Any]],
    username: str,
    movement_type: str,
):
    old_quantities: dict[int, int] = {}
    new_quantities: dict[int, int] = {}
    for line in old_lines:
        if line["controla_stock"] and line["comportamiento_abasto"] == "inventario":
            old_quantities[line["producto_id"]] = old_quantities.get(line["producto_id"], 0) + line["cantidad"]
    for line in new_lines:
        if line["controla_stock"] and line["comportamiento_abasto"] == "inventario":
            new_quantities[line["producto_id"]] = new_quantities.get(line["producto_id"], 0) + line["cantidad"]

    for product_id in sorted(set(old_quantities) | set(new_quantities)):
        delta_sale = new_quantities.get(product_id, 0) - old_quantities.get(product_id, 0)
        if delta_sale == 0:
            continue
        cur.execute(
            """
            SELECT stock, stock_reservado
            FROM core.catalogo_inventario_sucursal
            WHERE producto_id = %s AND sucursal_id = %s
            FOR UPDATE;
            """,
            (product_id, sucursal_id),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=409, detail="Falta inventario por sucursal para un producto físico.")
        before = int(row[0])
        reserved = int(row[1])
        after = before - delta_sale
        if delta_sale > 0 and before - reserved < delta_sale:
            raise HTTPException(status_code=409, detail=f"Stock insuficiente para el producto #{product_id}. Disponible para venta: {before - reserved}.")
        if after < reserved:
            raise HTTPException(status_code=409, detail=f"El ajuste dejaría comprometido el inventario reservado del producto #{product_id}.")
        cur.execute(
            """
            UPDATE core.catalogo_inventario_sucursal
            SET stock = %s, version = version + 1, updated_at = NOW()
            WHERE producto_id = %s AND sucursal_id = %s;
            """,
            (after, product_id, sucursal_id),
        )
        cur.execute(
            """
            INSERT INTO core.catalogo_inventario_movimientos (
                producto_id, sucursal_id, tipo, cantidad, stock_anterior, stock_nuevo,
                fuente_tipo, fuente_id, notas, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, 'venta', %s, %s, %s);
            """,
            (
                product_id, sucursal_id, movement_type, -delta_sale, before, after,
                venta_id, f"Venta global #{venta_id}", username,
            ),
        )


def _phase1b_write_payments(
    cur,
    *,
    venta_id: int,
    payments: list[dict[str, Any]] | None,
    username: str,
) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT pago_id, metodo, monto, referencia, created_at
        FROM core.venta_pagos
        WHERE venta_id = %s AND activo = true
        ORDER BY created_at, pago_id
        FOR UPDATE;
        """,
        (venta_id,),
    )
    existing_rows = cur.fetchall()
    if payments is None:
        return [
            {"pago_id": int(row[0]), "metodo": row[1], "monto": _money(row[2]),
             "referencia": row[3], "fecha_hora": row[4]}
            for row in existing_rows
        ]
    existing = {int(row[0]): row for row in existing_rows}
    received_ids: set[int] = set()
    final: list[dict[str, Any]] = []
    for payment in payments:
        payment_id = payment["pago_id"]
        if payment_id is not None:
            if payment_id not in existing:
                raise HTTPException(status_code=400, detail="Un pago no pertenece a esta venta.")
            received_ids.add(payment_id)
            cur.execute(
                """
                UPDATE core.venta_pagos
                SET metodo = %s, monto = %s, referencia = %s
                WHERE pago_id = %s AND venta_id = %s AND activo = true
                RETURNING pago_id, metodo, monto, referencia, created_at;
                """,
                (payment["metodo"], payment["monto"], payment["referencia"], payment_id, venta_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO core.venta_pagos (venta_id, metodo, monto, referencia, created_by)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING pago_id, metodo, monto, referencia, created_at;
                """,
                (venta_id, payment["metodo"], payment["monto"], payment["referencia"], username),
            )
        row = cur.fetchone()
        final.append({
            "pago_id": int(row[0]), "metodo": row[1], "monto": _money(row[2]),
            "referencia": row[3], "fecha_hora": row[4],
        })
    removed_ids = set(existing) - received_ids
    if removed_ids:
        cur.execute(
            """
            UPDATE core.venta_pagos
            SET activo = false
            WHERE venta_id = %s AND pago_id = ANY(%s::bigint[]);
            """,
            (venta_id, sorted(removed_ids)),
        )
    return final


def _phase1b_insert_configuration_rows(cur, *, venta_id: int, configs: list[dict[str, Any]], paid: Decimal, username: str) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for config in configs:
        status = config["estado_produccion"]
        if paid > 0 and status == "pendiente_anticipo":
            status = "listo_para_produccion"
        cur.execute(
            """
            INSERT INTO core.venta_configuraciones_opticas (
                venta_id, configuracion_ref, tipo_configuracion, usa_armazon_cliente,
                armazon_producto_id, diseno_producto_id, tratamiento_producto_id,
                variante_id, uso_visual, uso_visual_otro, prescripcion_id,
                sucursal_prescripcion_snapshot, comportamiento_abasto_usado,
                estado_produccion, precio_armazon_snapshot, precio_diseno_snapshot,
                precio_tratamiento_snapshot, precio_variante_snapshot,
                costo_armazon_snapshot, costo_diseno_snapshot,
                costo_tratamiento_snapshot, costo_variante_snapshot,
                subtotal_bruto_snapshot, created_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING configuracion_id;
            """,
            (
                venta_id, config["configuracion_ref"], config["tipo_configuracion"],
                config["usa_armazon_cliente"], config["armazon_producto_id"],
                config["diseno_producto_id"], config["tratamiento_producto_id"],
                config["variante_id"], config["uso_visual"], config["uso_visual_otro"],
                config["prescripcion_id"], config["sucursal_prescripcion_snapshot"],
                config["comportamiento_abasto_usado"], status,
                config["precio_armazon_snapshot"], config["precio_diseno_snapshot"],
                config["precio_tratamiento_snapshot"], config["precio_variante_snapshot"],
                config["costo_armazon_snapshot"], config["costo_diseno_snapshot"],
                config["costo_tratamiento_snapshot"], config["costo_variante_snapshot"],
                config["subtotal_bruto_snapshot"], username,
            ),
        )
        mapping[config["configuracion_ref"]] = int(cur.fetchone()[0])
    return mapping


def _phase1b_insert_detail_rows(cur, *, venta_id: int, lines: list[dict[str, Any]], config_ids: dict[str, int], username: str) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for line in lines:
        cur.execute(
            """
            INSERT INTO core.venta_catalogo_detalles (
                venta_id, configuracion_id, linea_ref, tipo_linea, producto_id,
                variante_id, sucursal_id, sku_snapshot, nombre_snapshot,
                descripcion_snapshot, categoria_snapshot, subcategoria_snapshot,
                unidad_medida_snapshot, comportamiento_abasto_snapshot,
                controla_stock_snapshot, cantidad, precio_unitario_snapshot,
                costo_unitario_snapshot, subtotal_bruto_snapshot, created_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING venta_catalogo_detalle_id;
            """,
            (
                venta_id, config_ids.get(line.get("configuracion_ref")), line["linea_ref"],
                line["tipo_linea"], line["producto_id"], line["variante_id"],
                line["sucursal_id"], line["sku"], line["nombre"], line["descripcion"],
                line["categoria"], line["subcategoria"], line["unidad_medida"],
                line["comportamiento_abasto"], line["controla_stock"], line["cantidad"],
                line["precio_unitario"], line["costo_unitario"], line["subtotal"], username,
            ),
        )
        mapping[line["linea_ref"]] = int(cur.fetchone()[0])
    return mapping


def _phase1b_insert_discount_rows(
    cur,
    *,
    venta_id: int,
    calculation: dict[str, Any],
    config_ids: dict[str, int],
    detail_ids: dict[str, int],
    revision_id: int,
    username: str,
):
    for discount in calculation["descuentos"]:
        cur.execute(
            """
            INSERT INTO core.venta_descuentos (
                venta_id, descuento_ref, tipo, valor, motivo, motivo_otro,
                cupon_tipo, alcance, orden_aplicacion, base_elegible_snapshot,
                monto_aplicado_snapshot, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING descuento_id;
            """,
            (
                venta_id, discount["descuento_ref"], discount["tipo"], discount["valor"],
                discount["motivo"], discount["motivo_otro"], discount["cupon_tipo"],
                discount["alcance"], discount["orden_aplicacion"],
                discount["base_elegible"], discount["monto_aplicado"], username,
            ),
        )
        discount_id = int(cur.fetchone()[0])
        if discount["alcance"] == "configuracion":
            for ref in discount["configuracion_refs"]:
                cur.execute(
                    """
                    INSERT INTO core.venta_descuento_objetivos (descuento_id, configuracion_id)
                    VALUES (%s, %s);
                    """,
                    (discount_id, config_ids[ref]),
                )
        elif discount["alcance"] == "linea":
            for ref in discount["linea_refs"]:
                cur.execute(
                    """
                    INSERT INTO core.venta_descuento_objetivos (descuento_id, venta_catalogo_detalle_id)
                    VALUES (%s, %s);
                    """,
                    (discount_id, detail_ids[ref]),
                )
        for allocation in discount["asignaciones"]:
            cur.execute(
                """
                INSERT INTO core.venta_descuento_asignaciones (
                    calculo_revision_id, descuento_id, venta_catalogo_detalle_id,
                    base_antes, monto_asignado, base_despues
                ) VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (
                    revision_id, discount_id, detail_ids[allocation["linea_ref"]],
                    allocation["base_antes"], allocation["monto_asignado"],
                    allocation["base_despues"],
                ),
            )


def _phase1b_sale_detail(cur, venta_id: int, role: str) -> dict[str, Any]:
    cur.execute(
        """
        SELECT venta.venta_id, venta.fecha_hora, venta.paciente_id,
               CONCAT_WS(' ', paciente.primer_nombre, paciente.segundo_nombre,
                         paciente.apellido_paterno, paciente.apellido_materno),
               venta.sucursal_id, sucursal.nombre, venta.compra, venta.subtotal,
               venta.monto_total, venta.metodo_pago, venta.forma_liquidacion,
               venta.plazo_meses, venta.estado_venta, venta.estado_pago,
               venta.estado_pedido, venta.notas, contexto.descuento_total,
               contexto.credito_cliente, contexto.version, contexto.estado
        FROM core.ventas venta
        JOIN core.venta_catalogo_contextos contexto ON contexto.venta_id = venta.venta_id
        JOIN core.pacientes paciente ON paciente.paciente_id = venta.paciente_id
        JOIN core.sucursales sucursal ON sucursal.sucursal_id = venta.sucursal_id
        WHERE venta.venta_id = %s;
        """,
        (venta_id,),
    )
    header = cur.fetchone()
    if header is None:
        raise HTTPException(status_code=404, detail="Venta de catálogo no existe.")
    cur.execute(
        """
        SELECT pago_id, metodo, monto, referencia, created_at
        FROM core.venta_pagos
        WHERE venta_id = %s AND activo = true
        ORDER BY created_at, pago_id;
        """,
        (venta_id,),
    )
    payments = [
        {"pago_id": int(row[0]), "metodo": row[1], "monto": float(row[2]),
         "referencia": row[3], "fecha_hora": str(row[4])}
        for row in cur.fetchall()
    ]
    cur.execute(
        """
        SELECT detalle.venta_catalogo_detalle_id, detalle.linea_ref,
               detalle.tipo_linea, detalle.producto_id, detalle.variante_id,
               detalle.sku_snapshot, detalle.nombre_snapshot,
               detalle.descripcion_snapshot, detalle.categoria_snapshot,
               detalle.subcategoria_snapshot, detalle.cantidad,
               detalle.precio_unitario_snapshot, detalle.costo_unitario_snapshot,
               detalle.subtotal_bruto_snapshot, detalle.estado_registro,
               detalle.cantidad_cancelada, imagen.url,
               config.configuracion_ref, variante.codigo, variante.nombre
        FROM core.venta_catalogo_detalles detalle
        LEFT JOIN core.venta_configuraciones_opticas config
          ON config.configuracion_id = detalle.configuracion_id
        LEFT JOIN core.catalogo_producto_variantes variante
          ON variante.variante_id = detalle.variante_id
        LEFT JOIN LATERAL (
            SELECT url FROM core.catalogo_producto_imagenes
            WHERE producto_id = detalle.producto_id AND activo = true
            ORDER BY es_principal DESC, display_order, producto_imagen_id LIMIT 1
        ) imagen ON true
        WHERE detalle.venta_id = %s AND detalle.estado_registro <> 'reemplazado'
        ORDER BY detalle.venta_catalogo_detalle_id;
        """,
        (venta_id,),
    )
    products = []
    for row in cur.fetchall():
        products.append({
            "venta_catalogo_detalle_id": int(row[0]), "linea_ref": row[1],
            "tipo_linea": row[2], "producto_id": int(row[3]), "variante_id": int(row[4]) if row[4] else None,
            "sku": row[5], "nombre": row[6], "descripcion": row[7], "categoria": row[8],
            "subcategoria": row[9], "cantidad": int(row[10]), "precio_unitario": float(row[11]),
            "costo_unitario": float(row[12]) if role in ("admin", "contador") and row[12] is not None else None,
            "subtotal": float(row[13]), "estado_registro": row[14], "cantidad_cancelada": int(row[15]),
            "imagen_url": row[16], "configuracion_ref": row[17],
            "variante_codigo": row[18], "variante_nombre": row[19],
        })
    cur.execute(
        """
        SELECT configuracion_id, configuracion_ref, tipo_configuracion,
               usa_armazon_cliente, armazon_producto_id, diseno_producto_id,
               tratamiento_producto_id, variante_id, uso_visual, uso_visual_otro,
               prescripcion_id, sucursal_prescripcion_snapshot,
               comportamiento_abasto_usado, estado_produccion,
               precio_armazon_snapshot, precio_diseno_snapshot,
               precio_tratamiento_snapshot, precio_variante_snapshot,
               costo_armazon_snapshot, costo_diseno_snapshot,
               costo_tratamiento_snapshot, costo_variante_snapshot,
               subtotal_bruto_snapshot, estado_registro
        FROM core.venta_configuraciones_opticas
        WHERE venta_id = %s AND estado_registro <> 'reemplazado'
        ORDER BY configuracion_id;
        """,
        (venta_id,),
    )
    configurations = []
    for row in cur.fetchall():
        config = {
            "configuracion_id": int(row[0]), "configuracion_ref": row[1],
            "tipo_configuracion": row[2], "usa_armazon_cliente": bool(row[3]),
            "armazon_producto_id": int(row[4]) if row[4] else None,
            "diseno_producto_id": int(row[5]) if row[5] else None,
            "tratamiento_producto_id": int(row[6]) if row[6] else None,
            "variante_id": int(row[7]) if row[7] else None,
            "uso_visual": row[8], "uso_visual_otro": row[9],
            "prescripcion_id": int(row[10]) if row[10] else None,
            "sucursal_prescripcion_snapshot": int(row[11]) if row[11] else None,
            "comportamiento_abasto_usado": row[12], "estado_produccion": row[13],
            "precio_armazon_snapshot": float(row[14]) if row[14] is not None else None,
            "precio_diseno_snapshot": float(row[15]) if row[15] is not None else None,
            "precio_tratamiento_snapshot": float(row[16]) if row[16] is not None else None,
            "precio_variante_snapshot": float(row[17]) if row[17] is not None else None,
            "subtotal_bruto_snapshot": float(row[22]), "estado_registro": row[23],
        }
        if role in ("admin", "contador"):
            config.update({
                "costo_armazon_snapshot": float(row[18]) if row[18] is not None else None,
                "costo_diseno_snapshot": float(row[19]) if row[19] is not None else None,
                "costo_tratamiento_snapshot": float(row[20]) if row[20] is not None else None,
                "costo_variante_snapshot": float(row[21]) if row[21] is not None else None,
            })
        configurations.append(config)
    cur.execute(
        """
        SELECT descuento.descuento_id, descuento.descuento_ref, descuento.tipo,
               descuento.valor, descuento.motivo, descuento.motivo_otro,
               descuento.cupon_tipo, descuento.alcance, descuento.orden_aplicacion,
               descuento.base_elegible_snapshot, descuento.monto_aplicado_snapshot,
               COALESCE(array_agg(DISTINCT config.configuracion_ref)
                        FILTER (WHERE config.configuracion_ref IS NOT NULL), ARRAY[]::text[]),
               COALESCE(array_agg(DISTINCT detalle.linea_ref)
                        FILTER (WHERE detalle.linea_ref IS NOT NULL), ARRAY[]::text[])
        FROM core.venta_descuentos descuento
        LEFT JOIN core.venta_descuento_objetivos objetivo
          ON objetivo.descuento_id = descuento.descuento_id
        LEFT JOIN core.venta_configuraciones_opticas config
          ON config.configuracion_id = objetivo.configuracion_id
        LEFT JOIN core.venta_catalogo_detalles detalle
          ON detalle.venta_catalogo_detalle_id = objetivo.venta_catalogo_detalle_id
        WHERE descuento.venta_id = %s AND descuento.estado = 'activo'
        GROUP BY descuento.descuento_id
        ORDER BY descuento.orden_aplicacion;
        """,
        (venta_id,),
    )
    discounts = [
        {
            "descuento_id": int(row[0]), "descuento_ref": row[1], "tipo": row[2],
            "valor": float(row[3]), "motivo": row[4], "motivo_otro": row[5],
            "cupon_tipo": row[6], "alcance": row[7], "orden_aplicacion": int(row[8]),
            "base_elegible": float(row[9]), "monto_aplicado": float(row[10]),
            "configuracion_refs": list(row[11] or []), "linea_refs": list(row[12] or []),
        }
        for row in cur.fetchall()
    ]
    amount_paid = round(sum(item["monto"] for item in payments), 2)
    total = float(header[8] or 0)
    return {
        "venta_id": int(header[0]), "fecha_hora": str(header[1]),
        "paciente_id": int(header[2]), "paciente_nombre": header[3],
        "sucursal_id": int(header[4]), "sucursal_nombre": header[5],
        "compra": header[6], "subtotal": float(header[7] or 0), "monto_total": total,
        "metodo_pago": header[9], "forma_liquidacion": header[10],
        "plazo_meses": int(header[11]) if header[11] is not None else None,
        "estado_venta": header[12], "estado_pago": header[13], "estado_pedido": header[14],
        "notas": None if role == "contador" else header[15],
        "descuento_porcentaje": 0, "descuento_monto": float(header[16] or 0),
        "credito_cliente": float(header[17] or 0), "version_catalogo": int(header[18]),
        "estado_catalogo": header[19], "origen_catalogo": "fase1b",
        "pagos": payments, "productos": products, "configuraciones": configurations,
        "descuentos": discounts, "monto_pagado": amount_paid,
        "saldo_pendiente": max(0.0, round(total - amount_paid, 2)),
    }


def _phase1b_order_status(configs: list[dict[str, Any]]) -> str:
    statuses = {config["estado_produccion"] for config in configs}
    if not statuses:
        return "entregado"
    if statuses == {"entregado"}:
        return "entregado"
    if statuses.issubset({"listo_para_entregar", "entregado"}):
        return "listo_entregar"
    if statuses & {"en_produccion", "listo_para_produccion"}:
        return "en_fabricacion"
    return "pendiente_fabricacion"


def _phase1b_save_sale(
    data: VentaFase1BCreate,
    user: dict[str, Any],
    *,
    venta_id: int | None = None,
) -> dict[str, Any]:
    require_roles(user, ("admin", "recepcion", "doctor"))
    data.sucursal_id = force_sucursal(user, data.sucursal_id)
    data = _phase1b_normalize_sale_input(data)
    payments_input_raw = data.pagos
    if data.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    branch_id = int(data.sucursal_id)
    sale_state = normalize_controlled_token(data.estado_venta) or "confirmada"
    if sale_state not in VENTA_ESTADO_ALLOWED or sale_state in {"cancelada", "devuelta"}:
        raise HTTPException(status_code=400, detail="Estado de venta inválido para guardar una venta activa.")
    liquidation = normalize_controlled_token(data.forma_liquidacion) or "pago_completo"
    if liquidation not in VENTA_FORMA_LIQUIDACION_ALLOWED:
        raise HTTPException(status_code=400, detail="Forma de liquidación inválida.")
    if liquidation in {"meses_sin_intereses", "meses_con_intereses"}:
        if data.plazo_meses not in VENTA_PLAZO_MESES_ALLOWED:
            raise HTTPException(status_code=400, detail="Selecciona un plazo válido.")
    else:
        data.plazo_meses = None
    payments_normalized = (
        _phase1b_validate_payments(list(payments_input_raw or []))
        if payments_input_raw is not None
        else None
    )
    discounts_normalized = _phase1b_normalize_discounts(list(data.descuentos or []), role=user["rol"])

    with psycopg.connect(DB_CONNINFO) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT activa FROM core.sucursales WHERE sucursal_id = %s FOR SHARE;", (branch_id,))
                branch = cur.fetchone()
                if branch is None or branch[0] is not True:
                    raise HTTPException(status_code=400, detail="Sucursal inexistente o inactiva.")
                _phase1b_patient_row(cur, data.paciente_id, lock=True)

                is_edit = venta_id is not None
                previous_version = 0
                old_lines: list[dict[str, Any]] = []
                old_status_by_ref: dict[str, str] = {}
                if is_edit:
                    cur.execute(
                        """
                        SELECT contexto.version
                        FROM core.ventas venta
                        JOIN core.venta_catalogo_contextos contexto
                          ON contexto.venta_id = venta.venta_id
                        WHERE venta.venta_id = %s AND venta.sucursal_id = %s
                          AND venta.activo = true AND contexto.estado = 'activo'
                        FOR UPDATE OF venta, contexto;
                        """,
                        (venta_id, branch_id),
                    )
                    context = cur.fetchone()
                    if context is None:
                        raise HTTPException(status_code=404, detail="Venta Phase 1B no existe o no está activa.")
                    previous_version = int(context[0])
                    cur.execute(
                        """
                        SELECT producto_id, GREATEST(cantidad - cantidad_cancelada, 0),
                               controla_stock_snapshot, comportamiento_abasto_snapshot
                        FROM core.venta_catalogo_detalles
                        WHERE venta_id = %s AND estado_registro = 'activo'
                        FOR UPDATE;
                        """,
                        (venta_id,),
                    )
                    old_lines = [
                        {"producto_id": int(row[0]), "cantidad": int(row[1]),
                         "controla_stock": bool(row[2]), "comportamiento_abasto": row[3]}
                        for row in cur.fetchall()
                    ]
                    cur.execute(
                        """
                        SELECT configuracion_ref, estado_produccion
                        FROM core.venta_configuraciones_opticas
                        WHERE venta_id = %s AND estado_registro = 'activo';
                        """,
                        (venta_id,),
                    )
                    old_status_by_ref = {row[0]: row[1] for row in cur.fetchall()}

                lines, configs = _phase1b_prepare_lines(cur, data, branch_id, lock=True)
                config_inputs = {item.configuracion_ref: item for item in (data.configuraciones or [])}
                for config in configs:
                    source = config_inputs.get(config["configuracion_ref"])
                    if source is not None and source.estado_produccion is None:
                        config["estado_produccion"] = old_status_by_ref.get(
                            config["configuracion_ref"], config["estado_produccion"]
                        )
                if is_edit:
                    validate_physical_structural_edit(cur, int(venta_id), configs)
                calculation = _phase1b_calculate_discounts(lines, discounts_normalized)
                subtotal = _money(calculation["subtotal"])
                discount_total = _money(calculation["descuento_total"])
                final_total = _money(calculation["total"])
                purchase_tokens = _phase1b_purchase_tokens(lines, configs)

                if not is_edit:
                    cur.execute(
                        """
                        INSERT INTO core.ventas (
                            sucursal_id, paciente_id, compra, subtotal,
                            descuento_porcentaje, descuento_monto, descuento_motivo,
                            cupon_tipo, monto_total, metodo_pago, forma_liquidacion,
                            plazo_meses, adelanto_aplica, adelanto_monto,
                            adelanto_metodo, estado_venta, estado_pago,
                            estado_pedido, notas, created_by
                        ) VALUES (
                            %s, %s, %s, %s, 0, %s, %s, %s, %s,
                            'efectivo', %s, %s, false, NULL, NULL,
                            %s, 'sin_pago', %s, %s, %s
                        ) RETURNING venta_id;
                        """,
                        (
                            branch_id, data.paciente_id, purchase_tokens, subtotal,
                            discount_total,
                            calculation["descuentos"][0]["motivo"] if calculation["descuentos"] else None,
                            calculation["descuentos"][0]["cupon_tipo"] if calculation["descuentos"] else None,
                            final_total, liquidation, data.plazo_meses, sale_state,
                            _phase1b_order_status(configs), data.notas, user["username"],
                        ),
                    )
                    venta_id = int(cur.fetchone()[0])
                    payments_for_write = payments_normalized or []
                else:
                    payments_for_write = payments_normalized

                payments = _phase1b_write_payments(
                    cur, venta_id=venta_id, payments=payments_for_write, username=user["username"]
                )
                amount_paid = sum((item["monto"] for item in payments), Decimal("0.00")).quantize(Decimal("0.01"))
                if not is_edit and amount_paid > final_total:
                    raise HTTPException(status_code=400, detail="La suma de pagos supera el total de la venta.")
                customer_credit = max(Decimal("0.00"), amount_paid - final_total)
                payment_state = _phase1b_payment_state(amount_paid, final_total, len(payments))
                payment_methods = list(dict.fromkeys(item["metodo"] for item in payments))
                payment_method = "|".join(payment_methods) if payment_methods else "efectivo"
                if liquidation not in {"meses_sin_intereses", "meses_con_intereses"}:
                    if amount_paid <= 0:
                        liquidation = "pago_completo"
                    elif amount_paid < final_total:
                        liquidation = "adelanto_apartado"
                    else:
                        liquidation = "pago_mixto" if len(payment_methods) > 1 else "pago_completo"
                deposit_applies = amount_paid > 0 and amount_paid < final_total
                deposit_method = payment_methods[0] if deposit_applies and len(payment_methods) == 1 else None

                _phase1b_apply_inventory_delta(
                    cur, sucursal_id=branch_id, venta_id=venta_id,
                    old_lines=old_lines, new_lines=lines, username=user["username"],
                    movement_type="edicion_venta" if is_edit else "salida_venta",
                )

                if is_edit:
                    cur.execute(
                        """
                        UPDATE core.venta_configuraciones_opticas
                        SET estado_registro = 'reemplazado'
                        WHERE venta_id = %s AND estado_registro = 'activo';
                        """,
                        (venta_id,),
                    )
                    cur.execute(
                        """
                        UPDATE core.venta_catalogo_detalles
                        SET estado_registro = 'reemplazado'
                        WHERE venta_id = %s AND estado_registro = 'activo';
                        """,
                        (venta_id,),
                    )
                    cur.execute(
                        """
                        UPDATE core.venta_descuentos
                        SET estado = 'reemplazado'
                        WHERE venta_id = %s AND estado = 'activo';
                        """,
                        (venta_id,),
                    )
                    cur.execute(
                        "UPDATE core.venta_calculo_revisiones SET es_actual = false WHERE venta_id = %s AND es_actual = true;",
                        (venta_id,),
                    )

                config_ids = _phase1b_insert_configuration_rows(
                    cur, venta_id=venta_id, configs=configs, paid=amount_paid, username=user["username"]
                )
                detail_ids = _phase1b_insert_detail_rows(
                    cur, venta_id=venta_id, lines=lines, config_ids=config_ids, username=user["username"]
                )
                revision_number = previous_version + 1
                cur.execute(
                    """
                    INSERT INTO core.venta_calculo_revisiones (
                        venta_id, numero_revision, motivo, subtotal_bruto,
                        descuento_total, total_neto, monto_pagado_snapshot,
                        saldo_pendiente, credito_cliente, es_actual, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, true, %s)
                    RETURNING calculo_revision_id;
                    """,
                    (
                        venta_id, revision_number, "edicion" if is_edit else "creacion",
                        subtotal, discount_total, final_total, amount_paid,
                        max(Decimal("0.00"), final_total - amount_paid), customer_credit,
                        user["username"],
                    ),
                )
                revision_id = int(cur.fetchone()[0])
                _phase1b_insert_discount_rows(
                    cur, venta_id=venta_id, calculation=calculation,
                    config_ids=config_ids, detail_ids=detail_ids,
                    revision_id=revision_id, username=user["username"],
                )

                if is_edit:
                    cur.execute(
                        """
                        UPDATE core.venta_catalogo_contextos
                        SET version = %s, subtotal_bruto = %s, descuento_total = %s,
                            total_neto = %s, credito_cliente = %s,
                            updated_by = %s, updated_at = NOW()
                        WHERE venta_id = %s;
                        """,
                        (revision_number, subtotal, discount_total, final_total,
                         customer_credit, user["username"], venta_id),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO core.venta_catalogo_contextos (
                            venta_id, version, subtotal_bruto, descuento_total,
                            total_neto, credito_cliente, created_by
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s);
                        """,
                        (venta_id, revision_number, subtotal, discount_total,
                         final_total, customer_credit, user["username"]),
                    )

                order_status = _phase1b_order_status([
                    {**config, "estado_produccion": (
                        "listo_para_produccion"
                        if amount_paid > 0 and config["estado_produccion"] == "pendiente_anticipo"
                        else config["estado_produccion"]
                    )}
                    for config in configs
                ])
                cur.execute(
                    """
                    UPDATE core.ventas
                    SET paciente_id = %s, compra = %s, subtotal = %s,
                        descuento_porcentaje = 0, descuento_monto = %s,
                        descuento_motivo = %s, cupon_tipo = %s,
                        monto_total = %s, metodo_pago = %s,
                        forma_liquidacion = %s, plazo_meses = %s,
                        adelanto_aplica = %s, adelanto_monto = %s,
                        adelanto_metodo = %s, estado_venta = %s,
                        estado_pago = %s, estado_pedido = %s,
                        notas = %s, updated_at = NOW()
                    WHERE venta_id = %s AND sucursal_id = %s AND activo = true;
                    """,
                    (
                        data.paciente_id, purchase_tokens, subtotal, discount_total,
                        calculation["descuentos"][0]["motivo"] if calculation["descuentos"] else None,
                        calculation["descuentos"][0]["cupon_tipo"] if calculation["descuentos"] else None,
                        final_total, payment_method, liquidation, data.plazo_meses,
                        deposit_applies, amount_paid if deposit_applies else None,
                        deposit_method, sale_state, payment_state, order_status,
                        data.notas, venta_id, branch_id,
                    ),
                )
                sync_physical_sale_jobs(
                    cur, int(venta_id), username=user["username"],
                    reason="edicion_venta" if is_edit else "creacion_venta",
                )
                result = _phase1b_sale_detail(cur, venta_id, user["rol"])
            conn.commit()
            return result
        except HTTPException:
            conn.rollback()
            raise
        except Exception as exc:
            conn.rollback()
            raise HTTPException(status_code=400, detail=str(exc))


@app.post("/ventas/fase1b/preview", summary="Previsualizar venta y descuentos Phase 1B")
def previsualizar_venta_fase1b(data: VentaFase1BCreate, user=Depends(get_current_user)):
    require_roles(user, ("admin", "recepcion", "doctor"))
    data.sucursal_id = force_sucursal(user, data.sucursal_id)
    data = _phase1b_normalize_sale_input(data)
    if data.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            _phase1b_patient_row(cur, data.paciente_id)
            lines, configs = _phase1b_prepare_lines(cur, data, int(data.sucursal_id), lock=False)
            discounts = _phase1b_normalize_discounts(list(data.descuentos or []), role=user["rol"])
            calculation = _phase1b_calculate_discounts(lines, discounts)
    return {
        "subtotal": float(calculation["subtotal"]),
        "descuento_total": float(calculation["descuento_total"]),
        "total": float(calculation["total"]),
        "descuentos": [
            {
                "descuento_ref": item["descuento_ref"], "tipo": item["tipo"],
                "valor": float(item["valor"]), "orden_aplicacion": item["orden_aplicacion"],
                "base_elegible": float(item["base_elegible"]),
                "monto_aplicado": float(item["monto_aplicado"]),
                "asignaciones": [
                    {key: (float(value) if isinstance(value, Decimal) else value) for key, value in allocation.items()}
                    for allocation in item["asignaciones"]
                ],
            }
            for item in calculation["descuentos"]
        ],
        "lineas": [
            {
                "linea_ref": line["linea_ref"], "configuracion_ref": line.get("configuracion_ref"),
                "producto_id": line["producto_id"], "nombre": line["nombre"],
                "cantidad": line["cantidad"], "precio_unitario": float(line["precio_unitario"]),
                "subtotal": float(line["subtotal"]),
                "saldo_despues_descuentos": float(calculation["saldos_linea"][line["linea_ref"]]),
            }
            for line in lines
        ],
        "configuraciones": [
            {key: (float(value) if isinstance(value, Decimal) else value)
             for key, value in config.items() if not key.startswith("costo_") or user["rol"] == "admin"}
            for config in configs
        ],
    }


@app.post("/ventas/fase1b", summary="Crear venta con catálogo global")
def crear_venta_fase1b(data: VentaFase1BCreate, user=Depends(get_current_user)):
    return _phase1b_save_sale(data, user)


@app.put("/ventas/{venta_id}/fase1b", summary="Editar venta con catálogo global")
def editar_venta_fase1b(venta_id: int, data: VentaFase1BCreate, user=Depends(get_current_user)):
    if user["rol"] != "admin":
        raise HTTPException(status_code=403, detail="Solo administración puede editar una venta completa.")
    return _phase1b_save_sale(data, user, venta_id=venta_id)


@app.get("/ventas/{venta_id}/fase1b", summary="Detalle de venta con catálogo global")
def detalle_venta_fase1b(venta_id: int, user=Depends(get_current_user)):
    require_roles(user, ("admin", "recepcion", "doctor", "contador"))
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            detail = _phase1b_sale_detail(cur, venta_id, user["rol"])
    requested_branch = force_sucursal(user, detail["sucursal_id"])
    if requested_branch != detail["sucursal_id"]:
        raise HTTPException(status_code=403, detail="Venta fuera de la sucursal permitida.")
    return detail


def _phase1b_cancel_sale_scope(
    venta_id: int,
    data: VentaCancelacionFase1BIn,
    user: dict[str, Any],
) -> dict[str, Any]:
    require_roles(user, ("admin",))
    data.sucursal_id = force_sucursal(user, data.sucursal_id)
    sanitize_model_strings(data)
    scope = normalize_controlled_token(data.alcance)
    reason = (data.motivo or "").strip()
    if scope not in {"configuracion", "linea", "venta"}:
        raise HTTPException(status_code=400, detail="Alcance de cancelación inválido.")
    if not reason:
        raise HTTPException(status_code=400, detail="El motivo de cancelación es obligatorio.")
    if data.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal requerida.")
    with psycopg.connect(DB_CONNINFO) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT contexto.version, contexto.subtotal_bruto,
                           contexto.descuento_total, contexto.total_neto,
                           contexto.credito_cliente
                    FROM core.ventas venta
                    JOIN core.venta_catalogo_contextos contexto
                      ON contexto.venta_id = venta.venta_id
                    WHERE venta.venta_id = %s AND venta.sucursal_id = %s
                      AND venta.activo = true AND contexto.estado = 'activo'
                    FOR UPDATE OF venta, contexto;
                    """,
                    (venta_id, data.sucursal_id),
                )
                context = cur.fetchone()
                if context is None:
                    raise HTTPException(status_code=404, detail="Venta Phase 1B no existe o ya está cancelada.")
                version, subtotal_before, discount_before, total_before, old_credit = context
                cur.execute(
                    """
                    SELECT detalle.venta_catalogo_detalle_id, detalle.linea_ref,
                           detalle.configuracion_id, config.configuracion_ref,
                           detalle.producto_id, detalle.cantidad,
                           detalle.cantidad_cancelada, detalle.controla_stock_snapshot,
                           detalle.comportamiento_abasto_snapshot,
                           detalle.precio_unitario_snapshot,
                           detalle.subtotal_bruto_snapshot
                    FROM core.venta_catalogo_detalles detalle
                    LEFT JOIN core.venta_configuraciones_opticas config
                      ON config.configuracion_id = detalle.configuracion_id
                    WHERE detalle.venta_id = %s AND detalle.estado_registro = 'activo'
                    ORDER BY detalle.venta_catalogo_detalle_id
                    FOR UPDATE OF detalle;
                    """,
                    (venta_id,),
                )
                rows = cur.fetchall()
                lines = [
                    {
                        "detail_id": int(row[0]), "linea_ref": row[1],
                        "config_id": int(row[2]) if row[2] else None,
                        "configuracion_ref": row[3], "producto_id": int(row[4]),
                        "cantidad": int(row[5]), "cantidad_cancelada": int(row[6]),
                        "controla_stock": bool(row[7]), "comportamiento_abasto": row[8],
                        "precio_unitario": _money(row[9]), "subtotal": _money(row[10]),
                    }
                    for row in rows
                ]
                effective = {line["linea_ref"]: line["cantidad"] - line["cantidad_cancelada"] for line in lines}
                config_refs = {line["configuracion_ref"] for line in lines if line["configuracion_ref"]}
                if scope == "venta":
                    selected_refs = {ref for ref, quantity in effective.items() if quantity > 0}
                elif scope == "configuracion":
                    requested_configs = set(data.configuracion_refs or [])
                    if not requested_configs or not requested_configs.issubset(config_refs):
                        raise HTTPException(status_code=400, detail="Configuración a cancelar inválida.")
                    selected_refs = {
                        line["linea_ref"] for line in lines
                        if line["configuracion_ref"] in requested_configs and effective[line["linea_ref"]] > 0
                    }
                else:
                    selected_refs = set(data.linea_refs or [])
                    if not selected_refs or not selected_refs.issubset(effective):
                        raise HTTPException(status_code=400, detail="Línea a cancelar inválida.")
                if not selected_refs:
                    raise HTTPException(status_code=400, detail="No hay elementos activos para cancelar.")

                quantities = dict(data.cantidades_por_linea or {})
                cancel_quantities: dict[str, int] = {}
                for ref in selected_refs:
                    available = effective[ref]
                    requested = int(quantities.get(ref, available)) if scope == "linea" else available
                    if requested <= 0 or requested > available:
                        raise HTTPException(status_code=400, detail=f"Cantidad inválida para {ref}.")
                    cancel_quantities[ref] = requested

                current_sale = _phase1b_sale_detail(cur, venta_id, user["rol"])
                remaining_lines: list[dict[str, Any]] = []
                detail_ids: dict[str, int] = {}
                config_ids: dict[str, int] = {}
                for line in lines:
                    remaining_quantity = effective[line["linea_ref"]] - cancel_quantities.get(line["linea_ref"], 0)
                    if remaining_quantity <= 0:
                        continue
                    remaining_lines.append({
                        "linea_ref": line["linea_ref"],
                        "configuracion_ref": line["configuracion_ref"],
                        "subtotal": (line["precio_unitario"] * remaining_quantity).quantize(Decimal("0.01")),
                    })
                    detail_ids[line["linea_ref"]] = line["detail_id"]
                    if line["configuracion_ref"] and line["config_id"]:
                        config_ids[line["configuracion_ref"]] = line["config_id"]

                remaining_line_refs = set(detail_ids)
                remaining_config_refs = set(config_ids)
                discounts_for_recalculation: list[dict[str, Any]] = []
                for saved in current_sale["descuentos"]:
                    if saved["alcance"] == "venta":
                        if not remaining_lines:
                            continue
                        config_targets: list[str] = []
                        line_targets: list[str] = []
                    elif saved["alcance"] == "configuracion":
                        config_targets = [ref for ref in saved["configuracion_refs"] if ref in remaining_config_refs]
                        line_targets = []
                        if not config_targets:
                            continue
                    else:
                        config_targets = []
                        line_targets = [ref for ref in saved["linea_refs"] if ref in remaining_line_refs]
                        if not line_targets:
                            continue
                    discounts_for_recalculation.append({
                        "descuento_ref": saved["descuento_ref"], "tipo": saved["tipo"],
                        "valor": _money(saved["valor"]), "motivo": saved["motivo"],
                        "motivo_otro": saved["motivo_otro"], "cupon_tipo": saved["cupon_tipo"],
                        "alcance": saved["alcance"],
                        "orden_aplicacion": len(discounts_for_recalculation) + 1,
                        "configuracion_refs": config_targets, "linea_refs": line_targets,
                    })
                calculation = _phase1b_calculate_discounts(remaining_lines, discounts_for_recalculation)
                subtotal_after = _money(calculation["subtotal"])
                discount_after = _money(calculation["descuento_total"])
                total_after = _money(calculation["total"])
                cur.execute(
                    "SELECT COALESCE(SUM(monto), 0) FROM core.venta_pagos WHERE venta_id = %s AND activo = true;",
                    (venta_id,),
                )
                amount_paid = _money(cur.fetchone()[0])
                customer_credit = max(Decimal("0.00"), amount_paid - total_after)
                cur.execute(
                    """
                    INSERT INTO core.venta_cancelaciones (
                        venta_id, alcance, motivo, subtotal_antes, descuento_antes,
                        total_antes, subtotal_despues, descuento_despues,
                        total_despues, monto_pagado_snapshot, credito_cliente, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING cancelacion_id;
                    """,
                    (
                        venta_id, scope, reason, subtotal_before, discount_before,
                        total_before, subtotal_after, discount_after, total_after,
                        amount_paid, customer_credit, user["username"],
                    ),
                )
                cancellation_id = int(cur.fetchone()[0])

                cur.execute(
                    """
                    SELECT asignacion.venta_catalogo_detalle_id,
                           COALESCE(SUM(asignacion.monto_asignado), 0)
                    FROM core.venta_descuento_asignaciones asignacion
                    JOIN core.venta_calculo_revisiones revision
                      ON revision.calculo_revision_id = asignacion.calculo_revision_id
                    WHERE revision.venta_id = %s AND revision.es_actual = true
                    GROUP BY asignacion.venta_catalogo_detalle_id;
                    """,
                    (venta_id,),
                )
                old_allocations = {int(row[0]): _money(row[1]) for row in cur.fetchall()}

                for line in lines:
                    ref = line["linea_ref"]
                    if ref not in cancel_quantities:
                        continue
                    cancelled_quantity = cancel_quantities[ref]
                    gross_cancelled = (line["precio_unitario"] * cancelled_quantity).quantize(Decimal("0.01"))
                    old_discount = old_allocations.get(line["detail_id"], Decimal("0.00"))
                    proportional_discount = (
                        old_discount * Decimal(cancelled_quantity) / Decimal(max(1, effective[ref]))
                    ).quantize(Decimal("0.01"))
                    net_cancelled = max(Decimal("0.00"), gross_cancelled - proportional_discount)
                    restore_key = f"fase1b-cancel-{cancellation_id}-detail-{line['detail_id']}"
                    restored = False
                    if line["controla_stock"] and line["comportamiento_abasto"] == "inventario":
                        cur.execute(
                            """
                            SELECT stock FROM core.catalogo_inventario_sucursal
                            WHERE producto_id = %s AND sucursal_id = %s FOR UPDATE;
                            """,
                            (line["producto_id"], data.sucursal_id),
                        )
                        inventory = cur.fetchone()
                        if inventory is None:
                            raise HTTPException(status_code=409, detail="Falta inventario para restaurar la cancelación.")
                        before_stock = int(inventory[0])
                        after_stock = before_stock + cancelled_quantity
                        cur.execute(
                            """
                            UPDATE core.catalogo_inventario_sucursal
                            SET stock = %s, version = version + 1, updated_at = NOW()
                            WHERE producto_id = %s AND sucursal_id = %s;
                            """,
                            (after_stock, line["producto_id"], data.sucursal_id),
                        )
                        cur.execute(
                            """
                            INSERT INTO core.catalogo_inventario_movimientos (
                                producto_id, sucursal_id, tipo, cantidad,
                                stock_anterior, stock_nuevo, fuente_tipo, fuente_id,
                                clave_idempotencia, notas, created_by
                            ) VALUES (%s, %s, 'cancelacion_venta', %s, %s, %s,
                                      'cancelacion_venta', %s, %s, %s, %s);
                            """,
                            (
                                line["producto_id"], data.sucursal_id, cancelled_quantity,
                                before_stock, after_stock, cancellation_id, restore_key,
                                f"Cancelación de venta #{venta_id}", user["username"],
                            ),
                        )
                        restored = True
                    remaining_quantity = effective[ref] - cancelled_quantity
                    cur.execute(
                        """
                        UPDATE core.venta_catalogo_detalles
                        SET cantidad_cancelada = cantidad_cancelada + %s,
                            stock_restaurado = stock_restaurado + %s,
                            estado_registro = CASE WHEN %s = 0 THEN 'cancelado' ELSE estado_registro END
                        WHERE venta_catalogo_detalle_id = %s;
                        """,
                        (cancelled_quantity, cancelled_quantity if restored else 0,
                         remaining_quantity, line["detail_id"]),
                    )
                    cur.execute(
                        """
                        INSERT INTO core.venta_cancelacion_objetivos (
                            cancelacion_id, venta_catalogo_detalle_id, cantidad_cancelada,
                            subtotal_bruto_cancelado, descuento_cancelado, neto_cancelado,
                            inventario_restaurado, clave_restauracion
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                        """,
                        (
                            cancellation_id, line["detail_id"], cancelled_quantity,
                            gross_cancelled, proportional_discount, net_cancelled,
                            restored, restore_key if restored else None,
                        ),
                    )

                cur.execute(
                    """
                    UPDATE core.venta_configuraciones_opticas config
                    SET estado_registro = 'cancelado', estado_produccion = 'cancelado',
                        motivo_cancelacion = %s, cancelado_by = %s, cancelado_at = NOW()
                    WHERE config.venta_id = %s AND config.estado_registro = 'activo'
                      AND NOT EXISTS (
                          SELECT 1 FROM core.venta_catalogo_detalles detalle
                          WHERE detalle.configuracion_id = config.configuracion_id
                            AND detalle.estado_registro = 'activo'
                            AND detalle.cantidad > detalle.cantidad_cancelada
                      );
                    """,
                    (reason, user["username"], venta_id),
                )
                cur.execute(
                    "UPDATE core.venta_descuentos SET estado = 'reemplazado' WHERE venta_id = %s AND estado = 'activo';",
                    (venta_id,),
                )
                cur.execute(
                    "UPDATE core.venta_calculo_revisiones SET es_actual = false WHERE venta_id = %s AND es_actual = true;",
                    (venta_id,),
                )
                next_version = int(version) + 1
                cur.execute(
                    """
                    INSERT INTO core.venta_calculo_revisiones (
                        venta_id, numero_revision, motivo, subtotal_bruto,
                        descuento_total, total_neto, monto_pagado_snapshot,
                        saldo_pendiente, credito_cliente, es_actual, created_by
                    ) VALUES (%s, %s, 'cancelacion', %s, %s, %s, %s, %s, %s, true, %s)
                    RETURNING calculo_revision_id;
                    """,
                    (
                        venta_id, next_version, subtotal_after, discount_after, total_after,
                        amount_paid, max(Decimal("0.00"), total_after - amount_paid),
                        customer_credit, user["username"],
                    ),
                )
                revision_id = int(cur.fetchone()[0])
                _phase1b_insert_discount_rows(
                    cur, venta_id=venta_id, calculation=calculation,
                    config_ids=config_ids, detail_ids=detail_ids,
                    revision_id=revision_id, username=user["username"],
                )
                context_state = "cancelado" if total_after == 0 else "activo"
                cur.execute(
                    """
                    UPDATE core.venta_catalogo_contextos
                    SET version = %s, subtotal_bruto = %s, descuento_total = %s,
                        total_neto = %s, credito_cliente = %s, estado = %s,
                        updated_by = %s, updated_at = NOW()
                    WHERE venta_id = %s;
                    """,
                    (next_version, subtotal_after, discount_after, total_after,
                     customer_credit, context_state, user["username"], venta_id),
                )
                payment_state = _phase1b_payment_state(amount_paid, total_after, 1 if amount_paid > 0 else 0)
                cur.execute(
                    """
                    UPDATE core.ventas
                    SET subtotal = %s, descuento_porcentaje = 0,
                        descuento_monto = %s, monto_total = %s,
                        estado_venta = CASE WHEN %s = 0 THEN 'cancelada' ELSE estado_venta END,
                        estado_pago = %s,
                        estado_pedido = CASE WHEN %s = 0 THEN 'cancelado' ELSE estado_pedido END,
                        updated_at = NOW()
                    WHERE venta_id = %s;
                    """,
                    (subtotal_after, discount_after, total_after, total_after,
                     payment_state, total_after, venta_id),
                )
                if customer_credit > _money(old_credit):
                    cur.execute(
                        """
                        INSERT INTO core.venta_ajustes_cliente (
                            venta_id, cancelacion_id, tipo, monto, notas, created_by
                        ) VALUES (%s, %s, 'credito', %s, %s, %s);
                        """,
                        (
                            venta_id, cancellation_id, customer_credit - _money(old_credit),
                            "Crédito generado por cancelación parcial o total",
                            user["username"],
                        ),
                    )
                sync_physical_sale_jobs(
                    cur, venta_id, username=user["username"],
                    reason="cancelacion_venta",
                )
                result = _phase1b_sale_detail(cur, venta_id, user["rol"])
                result["cancelacion_id"] = cancellation_id
            conn.commit()
            return result
        except HTTPException:
            conn.rollback()
            raise
        except Exception as exc:
            conn.rollback()
            raise HTTPException(status_code=400, detail=str(exc))


@app.post("/ventas/{venta_id}/fase1b/cancelaciones", summary="Cancelar parte o toda una venta Phase 1B")
def cancelar_venta_fase1b(
    venta_id: int,
    data: VentaCancelacionFase1BIn,
    user=Depends(get_current_user),
):
    return _phase1b_cancel_sale_scope(venta_id, data, user)
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
    p.pais = normalize_country_name(p.pais)
    if not p.telefono:
        raise HTTPException(status_code=400, detail="Teléfono es obligatorio y debe tener entre 7 y 10 dígitos.")


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
    "diabetes_estado", "diabetes_control", "diabetes_anios", "diabetes_tratamiento", "diabetes_tratamiento_otro",
    "usa_lentes", "tipo_lentes_actual", "lentes_actuales_detalle", "tiempo_uso_lentes",
    "lentes_contacto_horas_dia", "lentes_contacto_dias_semana", "sintomas",
    "uso_lentes_proteccion_uv", "uso_lentes_sol_frecuencia",
    "fotofobia_escala", "dolor_ocular_escala", "cefalea_frecuencia",
    "trabajo_cerca_horas_dia", "distancia_promedio_pantalla_cm", "iluminacion_trabajo",
    "flotadores_destellos", "flotadores_lateralidad",
    "horas_exterior_dia", "uso_lentes_sol_horas_dia",
    "usa_lentes_manejar_dia", "tipo_lentes_manejar_dia", "tratamientos_lentes_manejar_dia",
    "usa_lentes_manejar_noche", "tipo_lentes_manejar_noche", "tratamientos_lentes_manejar_noche",
    "nivel_educativo", "horas_lectura_dia", "lee_libros",
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

    if "diagnostico_principal" in data:
        data["diagnostico_principal"] = normalize_multi_allowed_tokens(
            data.get("diagnostico_principal"),
            DIAGNOSTICO_PRINCIPAL_ALLOWED,
            "diagnostico_principal",
            required=False,
        )

    if "diagnosticos_secundarios" in data:
        data["diagnosticos_secundarios"] = normalize_multi_allowed_tokens(
            data.get("diagnosticos_secundarios"),
            DIAGNOSTICO_SECUNDARIO_ALLOWED,
            "diagnosticos_secundarios",
            required=False,
        )

    if "diagnostico_principal_otro" in data:
        otro = str(data.get("diagnostico_principal_otro") or "").strip()
        data["diagnostico_principal_otro"] = otro or None
    if "diagnosticos_secundarios_otro" in data:
        otro_sec = str(data.get("diagnosticos_secundarios_otro") or "").strip()
        data["diagnosticos_secundarios_otro"] = otro_sec or None

    principal_tokens = split_pipe_tokens(data.get("diagnostico_principal"))
    secundarios_tokens = split_pipe_tokens(data.get("diagnosticos_secundarios"))

    if "diagnostico_principal" in data:
        if not principal_tokens:
            raise HTTPException(status_code=400, detail="diagnostico_principal es obligatorio.")
        if "otro" in principal_tokens:
            if is_missing_value(data.get("diagnostico_principal_otro")):
                raise HTTPException(
                    status_code=400,
                    detail="diagnostico_principal_otro es obligatorio cuando diagnostico_principal incluye otro.",
                )
        else:
            data["diagnostico_principal_otro"] = None

    if "diagnosticos_secundarios" in data:
        if "otro_secundario" in secundarios_tokens:
            if is_missing_value(data.get("diagnosticos_secundarios_otro")):
                raise HTTPException(
                    status_code=400,
                    detail="diagnosticos_secundarios_otro es obligatorio cuando diagnosticos_secundarios incluye otro_secundario.",
                )
        else:
            data["diagnosticos_secundarios_otro"] = None

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
                  AND {physical_scope_c}
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
    duracion_min: int = 45,
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
    sucursal_id: str | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    anio: int | None = None,
    mes: int | None = None,
    q: str | None = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor", "contador"))
    reporting_scope, branch_id = _resolve_reporting_scope(user, sucursal_id)
    tz_name = _timezone_for_sucursal(branch_id) if branch_id is not None else None
    search_tz = tz_name or "America/Mexico_City"
    fecha_hora_local_expr = (
        f"DATE(v.fecha_hora AT TIME ZONE '{tz_name}')"
        if tz_name
        else "DATE(v.fecha_hora)"
    )
    year_expr = (
        f"EXTRACT(YEAR FROM v.fecha_hora AT TIME ZONE '{tz_name}')"
        if tz_name
        else "EXTRACT(YEAR FROM v.fecha_hora)"
    )
    month_expr = (
        f"EXTRACT(MONTH FROM v.fecha_hora AT TIME ZONE '{tz_name}')"
        if tz_name
        else "EXTRACT(MONTH FROM v.fecha_hora)"
    )

    where = ["v.activo = true", _report_scope_sql("venta_base", reporting_scope, branch_id)]
    params: list[Any] = []

    if mes is not None and (mes < 1 or mes > 12):
        raise HTTPException(status_code=400, detail="Mes inválido. Debe ser entre 1 y 12.")

    if fecha_desde and fecha_hasta:
        where.append(f"{fecha_hora_local_expr} BETWEEN %s AND %s")
        params.extend([fecha_desde, fecha_hasta])
    elif fecha_desde:
        where.append(f"{fecha_hora_local_expr} >= %s")
        params.append(fecha_desde)
    elif fecha_hasta:
        where.append(f"{fecha_hora_local_expr} <= %s")
        params.append(fecha_hasta)
    elif anio is not None and mes is not None:
        where.append(f"{year_expr} = %s")
        where.append(f"{month_expr} = %s")
        params.extend([anio, mes])
    elif anio is not None:
        where.append(f"{year_expr} = %s")
        params.append(anio)
    else:
        # Si hay texto de búsqueda, no limitar automáticamente a "hoy"
        if not (q and q.strip()):
            if tz_name:
                hoy_local = datetime.now(ZoneInfo(tz_name)).date()
                where.append(f"{fecha_hora_local_expr} = %s")
                params.append(hoy_local)
            else:
                where.append("DATE(v.fecha_hora) = CURRENT_DATE")

    if q and q.strip():
        qq = f"%{q.strip()}%"
        where.append(
            """
            (
              CAST(v.venta_id AS TEXT) ILIKE %s
              OR TO_CHAR(v.fecha_hora AT TIME ZONE '{search_tz}', 'YYYY-MM-DD HH24:MI') ILIKE %s
              OR COALESCE(v.paciente_nombre, '') ILIKE %s
              OR COALESCE(v.compra, '') ILIKE %s
              OR CAST(v.monto_total AS TEXT) ILIKE %s
            )
            """.format(search_tz=search_tz)
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
      v.sucursal_nombre,
      venta_base.subtotal,
      venta_base.descuento_porcentaje,
      venta_base.forma_liquidacion,
      venta_base.descuento_motivo,
      venta_base.cupon_tipo,
      venta_base.estado_venta,
      venta_base.estado_pago,
      venta_base.estado_pedido,
      venta_base.plazo_meses,
      venta_base.descuento_monto,
      venta_base.canal_venta,
      venta_base.online_orden_id
    FROM core.ventas_detalle v
    JOIN core.ventas venta_base ON venta_base.venta_id = v.venta_id
    WHERE {" AND ".join(where)}
    ORDER BY v.fecha_hora DESC, v.venta_id DESC
    LIMIT %s
    """
    params.append(limit)

    fase1b_details: dict[int, dict[str, Any]] = {}
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()
            pagos_rows = []
            productos_rows = []
            venta_ids = [int(row[0]) for row in rows]
            if venta_ids:
                cur.execute(
                    """
                    SELECT pago_id, venta_id, metodo, monto, referencia, created_at
                    FROM core.venta_pagos
                    WHERE venta_id = ANY(%s::bigint[])
                      AND activo = true
                    ORDER BY created_at, pago_id;
                    """,
                    (venta_ids,),
                )
                pagos_rows = cur.fetchall()
                cur.execute(
                    """
                    SELECT
                      detalle.venta_id,
                      detalle.producto_id,
                      producto.sku,
                      producto.categoria,
                      producto.subcategoria,
                      producto.nombre,
                      producto.modelo,
                      producto.color,
                      producto.tipo_mica,
                      producto.descripcion,
                      producto.imagen_url,
                      detalle.cantidad,
                      detalle.precio_unitario,
                      detalle.subtotal
                    FROM core.venta_detalles detalle
                    JOIN core.productos producto
                      ON producto.producto_id = detalle.producto_id
                    WHERE detalle.venta_id = ANY(%s::bigint[])
                    ORDER BY detalle.venta_id, detalle.venta_detalle_id;
                    """,
                    (venta_ids,),
                )
                productos_rows = cur.fetchall()
                cur.execute(
                    """
                    SELECT venta_id
                    FROM core.venta_catalogo_contextos
                    WHERE venta_id = ANY(%s::bigint[])
                    ORDER BY venta_id;
                    """,
                    (venta_ids,),
                )
                for (phase1b_venta_id,) in cur.fetchall():
                    fase1b_details[int(phase1b_venta_id)] = _phase1b_sale_detail(
                        cur, int(phase1b_venta_id), user["rol"]
                    )

    estado_map = _estado_paciente_map(branch_id, [int(r[9]) for r in rows])
    pagos_por_venta: dict[int, list[dict[str, Any]]] = {}
    for pago in pagos_rows:
        pagos_por_venta.setdefault(int(pago[1]), []).append(
            {
                "pago_id": int(pago[0]),
                "metodo": pago[2],
                "monto": float(pago[3] or 0),
                "referencia": pago[4],
                "fecha_hora": str(pago[5]) if pago[5] else None,
            }
        )
    productos_por_venta: dict[int, list[dict[str, Any]]] = {}
    for producto in productos_rows:
        productos_por_venta.setdefault(int(producto[0]), []).append(
            {
                "producto_id": int(producto[1]),
                "sku": producto[2],
                "categoria": producto[3],
                "subcategoria": producto[4],
                "nombre": producto[5],
                "modelo": producto[6],
                "color": producto[7],
                "tipo_mica": producto[8],
                "descripcion": producto[9],
                "imagen_url": producto[10],
                "cantidad": int(producto[11] or 0),
                "precio_unitario": float(producto[12] or 0),
                "subtotal": float(producto[13] or 0),
            }
        )

    ventas_out = []
    for r in rows:
        phase1b_detail = fase1b_details.get(int(r[0]))
        if phase1b_detail is not None:
            phase1b_detail["estado_paciente"] = estado_map.get(int(r[9]), "nuevo")
            phase1b_detail["adelanto_aplica"] = (
                phase1b_detail["monto_pagado"] > 0
                and phase1b_detail["saldo_pendiente"] > 0
            )
            phase1b_detail["adelanto_monto"] = (
                phase1b_detail["monto_pagado"]
                if phase1b_detail["adelanto_aplica"] else None
            )
            phase1b_detail["canal_venta"] = r[23] or "fisica"
            phase1b_detail["online_orden_id"] = r[24]
            ventas_out.append(phase1b_detail)
            continue
        pagos = pagos_por_venta.get(int(r[0]), [])
        monto_total = float(r[3] or 0)
        if pagos:
            monto_pagado = round(sum(float(pago["monto"]) for pago in pagos), 2)
        else:
            # Compatibilidad con ventas anteriores a la captura de pagos por importe.
            monto_pagado = round(float(r[6] or 0), 2) if bool(r[5]) else monto_total
        saldo_pendiente = max(0.0, round(monto_total - monto_pagado, 2))
        if monto_pagado <= 0:
            estado_pago_calculado = "sin_pago"
        elif saldo_pendiente > 0:
            estado_pago_calculado = "anticipo" if len(pagos) <= 1 else "pago_parcial"
        else:
            estado_pago_calculado = "pagada"
        estado_pago_guardado = normalize_controlled_token(r[19])
        if estado_pago_guardado == "reembolsada":
            estado_pago = "reembolsada"
        elif estado_pago_guardado == "pagada" and saldo_pendiente <= 0:
            estado_pago = "pagada"
        elif (
            estado_pago_guardado in {"anticipo", "pago_parcial"}
            and monto_pagado > 0
            and saldo_pendiente > 0
        ):
            estado_pago = estado_pago_guardado
        elif estado_pago_guardado == "sin_pago" and monto_pagado <= 0:
            estado_pago = "sin_pago"
        else:
            estado_pago = estado_pago_calculado
        ventas_out.append({
            "venta_id": r[0],
            "fecha_hora": str(r[1]) if r[1] else None,
            "compra": r[2],
            "monto_total": monto_total,
            "metodo_pago": r[4],
            "adelanto_aplica": bool(r[5]),
            "adelanto_monto": float(r[6]) if r[6] is not None else None,
            "adelanto_metodo": r[7],
            "como_nos_conocio": None,
            # Las notas libres pueden contener información privada. El contador
            # recibe únicamente la información comercial de la venta.
            "notas": None if user["rol"] == "contador" else r[8],
            "paciente_id": r[9],
            "paciente_nombre": r[10],
            "sucursal_id": r[11],
            "sucursal_nombre": r[12],
            "subtotal": float(r[13]) if r[13] is not None else float(r[3] or 0),
            "descuento_porcentaje": float(r[14] or 0),
            "descuento_monto": float(r[22] or 0),
            "forma_liquidacion": r[15] or "pago_completo",
            "descuento_motivo": r[16],
            "cupon_tipo": r[17],
            "estado_paciente": estado_map.get(int(r[9]), "nuevo"),
            "pagos": pagos,
            "productos": productos_por_venta.get(int(r[0]), []),
            "monto_pagado": monto_pagado,
            "saldo_pendiente": saldo_pendiente,
            "estado_pago": estado_pago,
            "estado_venta": r[18] or "confirmada",
            "estado_pedido": r[20] or "pendiente_fabricacion",
            "plazo_meses": int(r[21]) if r[21] is not None else None,
            "canal_venta": r[23] or "fisica",
            "online_orden_id": r[24],
        })
    return ventas_out


@app.get("/inventario", summary="Listar inventario por sucursal")
def listar_inventario(
    sucursal_id: int | None = None,
    categoria: str | None = None,
    incluir_inactivos: bool = False,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor", "contador"))
    sucursal_id = force_sucursal(user, sucursal_id)
    if sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

    where = ["p.sucursal_id = %s"]
    params: list[Any] = [sucursal_id]
    if not incluir_inactivos:
        where.append("p.activo = true")
    if categoria and categoria.strip():
        where.append("p.categoria = %s")
        params.append(normalize_controlled_token(categoria))

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    p.producto_id, p.sucursal_id, p.sku, p.categoria, p.subcategoria,
                    p.nombre, p.modelo, p.color, p.tipo_mica, p.descripcion,
                    p.imagen_url, p.precio, p.stock, p.stock_minimo, p.activo,
                    p.controla_stock, p.orden_catalogo, p.created_at, p.updated_at,
                    p.costo_unitario
                FROM core.productos p
                WHERE {" AND ".join(where)}
                ORDER BY p.orden_catalogo, p.categoria, p.nombre, p.producto_id;
                """,
                tuple(params),
            )
            rows = cur.fetchall()

    return [
        {
            "producto_id": r[0],
            "sucursal_id": r[1],
            "sku": r[2],
            "categoria": r[3],
            "subcategoria": r[4],
            "nombre": r[5],
            "modelo": r[6],
            "color": r[7],
            "tipo_mica": r[8],
            "descripcion": r[9],
            "imagen_url": r[10],
            "precio": float(r[11] or 0),
            "stock": int(r[12] or 0),
            "stock_minimo": int(r[13] or 0),
            "activo": bool(r[14]),
            "controla_stock": bool(r[15]),
            "orden_catalogo": int(r[16] or 100),
            "created_at": str(r[17]) if r[17] else None,
            "updated_at": str(r[18]) if r[18] else None,
            "costo_unitario": float(r[19] or 0) if user["rol"] in ("admin", "contador") else None,
        }
        for r in rows
    ]


@app.patch("/inventario/{producto_id}/stock", summary="Actualizar stock (solo admin)")
def actualizar_stock_inventario(
    producto_id: int,
    data: InventarioStockUpdate,
    sucursal_id: int | None = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin",))
    sucursal_id = force_sucursal(user, sucursal_id)
    if sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if data.stock < 0 or data.expected_stock < 0:
        raise HTTPException(status_code=400, detail="El stock no puede ser negativo.")

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE core.productos
                SET stock = %s, updated_at = NOW()
                WHERE producto_id = %s
                  AND {physical_scope_c}
                  AND stock = %s
                  AND controla_stock = true
                RETURNING producto_id, stock;
                """,
                (data.stock, producto_id, sucursal_id, data.expected_stock),
            )
            row = cur.fetchone()
            if row is None:
                cur.execute(
                    """
                    SELECT stock, controla_stock
                    FROM core.productos
                    WHERE producto_id = %s
                      AND sucursal_id = %s;
                    """,
                    (producto_id, sucursal_id),
                )
                current_row = cur.fetchone()
                if current_row is None:
                    raise HTTPException(status_code=404, detail="Producto no existe en esta sucursal.")
                if current_row[1] is not True:
                    raise HTTPException(
                        status_code=400,
                        detail="Este producto es un servicio o adicional y no controla existencias.",
                    )
                raise HTTPException(
                    status_code=409,
                    detail=f"El stock cambió mientras editabas. Stock actual: {int(current_row[0])}. Actualiza la lista e intenta de nuevo.",
                )
            if data.stock != data.expected_stock:
                cur.execute(
                    """INSERT INTO core.inventario_movimientos (
                         sucursal_id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
                         notas, created_by
                       ) VALUES (%s, %s, 'conteo_fisico', %s, %s, %s, %s, %s);""",
                    (
                        sucursal_id,
                        producto_id,
                        data.stock - data.expected_stock,
                        data.expected_stock,
                        data.stock,
                        "Ajuste rápido de existencias",
                        user["username"],
                    ),
                )
        conn.commit()

    return {"producto_id": row[0], "stock": row[1], "updated": True}


def ensure_finanzas_schema():
    """Crea las estructuras auditables de inventario y finanzas sin duplicar ventas."""
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE SCHEMA IF NOT EXISTS core;")
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS core.inventario_movimientos (
                    movimiento_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL REFERENCES core.sucursales(sucursal_id),
                    producto_id bigint NOT NULL REFERENCES core.productos(producto_id),
                    tipo text NOT NULL,
                    cantidad integer NOT NULL,
                    stock_anterior integer NOT NULL,
                    stock_nuevo integer NOT NULL,
                    costo_unitario numeric(12,2) NULL,
                    proveedor text NULL,
                    folio text NULL,
                    notas text NULL,
                    fuente_tipo text NULL,
                    fuente_id bigint NULL,
                    created_by text NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_sucursal_fecha
                ON core.inventario_movimientos (sucursal_id, created_at DESC);

                CREATE TABLE IF NOT EXISTS core.fin_movimientos (
                    movimiento_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL REFERENCES core.sucursales(sucursal_id),
                    fecha timestamptz NOT NULL DEFAULT NOW(),
                    cuenta text NOT NULL,
                    tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
                    categoria text NOT NULL,
                    descripcion text NOT NULL,
                    monto numeric(12,2) NOT NULL CHECK (monto > 0),
                    estado text NOT NULL DEFAULT 'registrado',
                    referencia text NULL,
                    created_by text NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_fin_movimientos_sucursal_fecha
                ON core.fin_movimientos (sucursal_id, fecha DESC);

                CREATE TABLE IF NOT EXISTS core.fin_gastos (
                    gasto_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL REFERENCES core.sucursales(sucursal_id),
                    fecha date NOT NULL DEFAULT CURRENT_DATE,
                    categoria text NOT NULL,
                    proveedor text NULL,
                    descripcion text NOT NULL,
                    monto numeric(12,2) NOT NULL CHECK (monto > 0),
                    cuenta text NULL,
                    estado text NOT NULL DEFAULT 'pendiente',
                    comprobante_url text NULL,
                    fecha_pago date NULL,
                    created_by text NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_fin_gastos_sucursal_fecha
                ON core.fin_gastos (sucursal_id, fecha DESC);

                CREATE TABLE IF NOT EXISTS core.fin_nomina (
                    nomina_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL REFERENCES core.sucursales(sucursal_id),
                    empleado text NOT NULL,
                    periodo_inicio date NOT NULL,
                    periodo_fin date NOT NULL,
                    salario_base numeric(12,2) NOT NULL DEFAULT 0,
                    horas numeric(8,2) NOT NULL DEFAULT 0,
                    comisiones numeric(12,2) NOT NULL DEFAULT 0,
                    bonos numeric(12,2) NOT NULL DEFAULT 0,
                    deducciones numeric(12,2) NOT NULL DEFAULT 0,
                    pago_neto numeric(12,2) NOT NULL DEFAULT 0,
                    costo_patronal numeric(12,2) NOT NULL DEFAULT 0,
                    fecha_pago date NULL,
                    cuenta text NULL,
                    estado text NOT NULL DEFAULT 'pendiente',
                    notas text NULL,
                    created_by text NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_fin_nomina_sucursal_periodo
                ON core.fin_nomina (sucursal_id, periodo_inicio DESC);

                CREATE TABLE IF NOT EXISTS core.fin_cuentas_pagar (
                    cuenta_pagar_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL REFERENCES core.sucursales(sucursal_id),
                    proveedor text NOT NULL,
                    categoria text NOT NULL,
                    concepto text NOT NULL,
                    folio text NULL,
                    fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
                    fecha_vencimiento date NULL,
                    monto_total numeric(12,2) NOT NULL CHECK (monto_total > 0),
                    monto_pagado numeric(12,2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0),
                    estado text NOT NULL DEFAULT 'pendiente',
                    comprobante_url text NULL,
                    created_by text NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_fin_cxp_sucursal_vencimiento
                ON core.fin_cuentas_pagar (sucursal_id, fecha_vencimiento);

                CREATE TABLE IF NOT EXISTS core.fin_comprobantes (
                    comprobante_id bigserial PRIMARY KEY,
                    sucursal_id integer NOT NULL REFERENCES core.sucursales(sucursal_id),
                    recurso text NOT NULL,
                    registro_id bigint NOT NULL,
                    nombre_archivo text NOT NULL,
                    mime_type text NOT NULL,
                    contenido bytea NOT NULL,
                    created_by text NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_fin_comprobantes_recurso
                ON core.fin_comprobantes (sucursal_id, recurso, registro_id, created_at DESC);
                """
            )
            cur.execute(
                """
                ALTER TABLE core.venta_detalles
                ADD COLUMN IF NOT EXISTS costo_unitario numeric(12,2) NULL;
                UPDATE core.venta_detalles detalle
                SET costo_unitario = producto.costo_unitario
                FROM core.productos producto
                WHERE producto.producto_id = detalle.producto_id
                  AND detalle.costo_unitario IS NULL;
                """
            )
        conn.commit()


@app.patch("/inventario/{producto_id}", summary="Actualizar costo, precio o stock (solo admin)")
def actualizar_producto_inventario(
    producto_id: int,
    data: InventarioProductoUpdate,
    sucursal_id: int | None = None,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin",))
    sucursal_id = force_sucursal(user, sucursal_id)
    if sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if data.stock is None and data.precio is None and data.costo_unitario is None:
        raise HTTPException(status_code=400, detail="No hay cambios para guardar.")
    if data.stock is not None:
        if data.expected_stock is None:
            raise HTTPException(status_code=400, detail="expected_stock es requerido para cambiar existencias.")
        if data.stock < 0 or data.expected_stock < 0:
            raise HTTPException(status_code=400, detail="El stock no puede ser negativo.")
    if data.precio is not None and data.precio < 0:
        raise HTTPException(status_code=400, detail="El precio de venta no puede ser negativo.")
    if data.costo_unitario is not None and data.costo_unitario < 0:
        raise HTTPException(status_code=400, detail="El costo unitario no puede ser negativo.")

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE core.productos
                SET stock = CASE WHEN %s::integer IS NULL THEN stock ELSE %s::integer END,
                    precio = CASE WHEN %s::numeric IS NULL THEN precio ELSE %s::numeric END,
                    costo_unitario = CASE WHEN %s::numeric IS NULL THEN costo_unitario ELSE %s::numeric END,
                    updated_at = NOW()
                WHERE producto_id = %s
                  AND sucursal_id = %s
                  AND (%s::integer IS NULL OR stock = %s::integer)
                  AND (%s::integer IS NULL OR controla_stock = true)
                RETURNING producto_id, stock, precio, costo_unitario;
                """,
                (
                    data.stock,
                    data.stock,
                    data.precio,
                    data.precio,
                    data.costo_unitario,
                    data.costo_unitario,
                    producto_id,
                    sucursal_id,
                    data.stock,
                    data.expected_stock,
                    data.stock,
                ),
            )
            row = cur.fetchone()
            if row is None:
                cur.execute(
                    """
                    SELECT stock, controla_stock
                    FROM core.productos
                    WHERE producto_id = %s
                      AND sucursal_id = %s;
                    """,
                    (producto_id, sucursal_id),
                )
                current_row = cur.fetchone()
                if current_row is None:
                    raise HTTPException(status_code=404, detail="Producto no existe en esta sucursal.")
                if data.stock is not None and current_row[1] is not True:
                    raise HTTPException(
                        status_code=400,
                        detail="Este producto es un servicio o adicional y no controla existencias.",
                    )
                if data.stock is not None:
                    raise HTTPException(
                        status_code=409,
                        detail=f"El stock cambió mientras editabas. Stock actual: {int(current_row[0])}. Actualiza la lista e intenta de nuevo.",
                    )
                raise HTTPException(status_code=400, detail="No se pudo actualizar el producto.")
            if data.stock is not None and data.stock != data.expected_stock:
                cur.execute(
                    """INSERT INTO core.inventario_movimientos (
                         sucursal_id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
                         notas, created_by
                       ) VALUES (%s, %s, 'conteo_fisico', %s, %s, %s, %s, %s);""",
                    (
                        sucursal_id,
                        producto_id,
                        data.stock - data.expected_stock,
                        data.expected_stock,
                        data.stock,
                        "Ajuste desde Costos y rentabilidad",
                        user["username"],
                    ),
                )
        conn.commit()

    return {
        "producto_id": row[0],
        "stock": int(row[1] or 0),
        "precio": float(row[2] or 0),
        "costo_unitario": float(row[3] or 0),
        "updated": True,
    }


@app.post("/inventario/{producto_id}/movimientos", summary="Registrar entrada, salida o conteo de inventario")
def registrar_movimiento_inventario(
    producto_id: int,
    data: InventarioMovimientoIn,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin",))
    data.sucursal_id = force_sucursal(user, data.sucursal_id)
    if data.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    tipo = normalize_controlled_token(data.tipo) or ""
    entradas = {"entrada_compra", "devolucion", "ajuste_positivo"}
    salidas = {"merma", "ajuste_negativo"}
    if tipo not in entradas | salidas | {"conteo_fisico"}:
        raise HTTPException(status_code=400, detail="Tipo de movimiento inválido.")
    if data.cantidad < 0 or (tipo != "conteo_fisico" and data.cantidad == 0):
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0.")
    if data.costo_unitario is not None and data.costo_unitario < 0:
        raise HTTPException(status_code=400, detail="El costo unitario no puede ser negativo.")
    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT stock, costo_unitario, controla_stock, nombre
                    FROM core.productos
                    WHERE producto_id = %s AND sucursal_id = %s AND activo = true
                    FOR UPDATE;
                    """,
                    (producto_id, data.sucursal_id),
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Producto no existe en esta sucursal.")
                stock_anterior, costo_anterior, controla_stock, nombre = row
                stock_anterior = int(stock_anterior or 0)
                if controla_stock is not True:
                    raise HTTPException(status_code=400, detail="Este producto no controla existencias.")
                if stock_anterior != data.expected_stock:
                    raise HTTPException(status_code=409, detail=f"El stock cambió. Stock actual: {stock_anterior}.")
                if tipo == "conteo_fisico":
                    stock_nuevo = data.cantidad
                    cantidad_movimiento = stock_nuevo - stock_anterior
                else:
                    cantidad_movimiento = data.cantidad if tipo in entradas else -data.cantidad
                    stock_nuevo = stock_anterior + cantidad_movimiento
                if stock_nuevo < 0:
                    raise HTTPException(status_code=400, detail="La salida supera las existencias disponibles.")
                costo_nuevo = Decimal(str(costo_anterior or 0))
                if tipo == "entrada_compra" and data.costo_unitario is not None and cantidad_movimiento > 0:
                    valor_anterior = Decimal(stock_anterior) * costo_nuevo
                    valor_entrada = Decimal(cantidad_movimiento) * data.costo_unitario
                    costo_nuevo = ((valor_anterior + valor_entrada) / Decimal(stock_nuevo)).quantize(Decimal("0.01")) if stock_nuevo else data.costo_unitario
                cur.execute(
                    """
                    UPDATE core.productos
                    SET stock = %s, costo_unitario = %s, updated_at = NOW()
                    WHERE producto_id = %s AND sucursal_id = %s;
                    """,
                    (stock_nuevo, costo_nuevo, producto_id, data.sucursal_id),
                )
                cur.execute(
                    """
                    INSERT INTO core.inventario_movimientos (
                        sucursal_id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
                        costo_unitario, proveedor, folio, notas, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING movimiento_id, created_at;
                    """,
                    (
                        data.sucursal_id, producto_id, tipo, cantidad_movimiento, stock_anterior,
                        stock_nuevo, data.costo_unitario, data.proveedor, data.folio, data.notas,
                        user["username"],
                    ),
                )
                movimiento_id, created_at = cur.fetchone()
            conn.commit()
        return {
            "movimiento_id": movimiento_id, "producto_id": producto_id, "producto": nombre,
            "stock_anterior": stock_anterior, "stock": stock_nuevo,
            "costo_unitario": float(costo_nuevo), "created_at": created_at.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/inventario/movimientos", summary="Historial auditable de inventario")
def listar_movimientos_inventario(
    sucursal_id: int | None = None,
    limit: int = 200,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "contador"))
    sucursal_id = force_sucursal(user, sucursal_id)
    if sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT m.movimiento_id, m.created_at, m.tipo, m.cantidad, m.stock_anterior,
                       m.stock_nuevo, m.costo_unitario, m.proveedor, m.folio, m.notas,
                       m.created_by, p.producto_id, p.nombre, p.sku
                FROM core.inventario_movimientos m
                JOIN core.productos p ON p.producto_id = m.producto_id
                WHERE m.sucursal_id = %s
                ORDER BY m.created_at DESC, m.movimiento_id DESC
                LIMIT %s;
                """,
                (sucursal_id, min(max(limit, 1), 1000)),
            )
            rows = cur.fetchall()
    return [
        {
            "movimiento_id": r[0], "fecha_hora": r[1].isoformat(), "tipo": r[2],
            "cantidad": int(r[3]), "stock_anterior": int(r[4]), "stock_nuevo": int(r[5]),
            "costo_unitario": float(r[6]) if r[6] is not None else None,
            "proveedor": r[7], "folio": r[8], "notas": r[9], "usuario": r[10],
            "producto_id": r[11], "producto": r[12], "sku": r[13],
        }
        for r in rows
    ]


def _finanzas_fecha(value: str | None, default: date) -> date:
    if not value:
        return default
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha inválida. Usa YYYY-MM-DD.")


def _finanzas_scope(user, sucursal_id: int | None) -> int:
    require_roles(user, ("admin", "contador"))
    resolved = force_sucursal(user, sucursal_id)
    if resolved is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    return resolved


@app.post("/finanzas/movimientos", summary="Registrar movimiento financiero manual")
def crear_movimiento_financiero(data: FinanzasMovimientoIn, user=Depends(get_current_user)):
    sucursal_id = _finanzas_scope(user, data.sucursal_id)
    tipo = normalize_controlled_token(data.tipo)
    if tipo not in {"ingreso", "egreso"} or data.monto <= 0:
        raise HTTPException(status_code=400, detail="Tipo o monto inválido.")
    fecha = data.fecha or datetime.now(timezone.utc).isoformat()
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO core.fin_movimientos
                   (sucursal_id, fecha, cuenta, tipo, categoria, descripcion, monto, estado, referencia, created_by)
                   VALUES (%s, %s::timestamptz, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING movimiento_id;""",
                (sucursal_id, fecha, data.cuenta.strip(), tipo, data.categoria.strip(), data.descripcion.strip(), data.monto, data.estado or "registrado", data.referencia, user["username"]),
            )
            new_id = cur.fetchone()[0]
        conn.commit()
    return {"movimiento_id": new_id, "created": True}


@app.post("/finanzas/gastos", summary="Registrar gasto")
def crear_gasto(data: FinanzasGastoIn, user=Depends(get_current_user)):
    sucursal_id = _finanzas_scope(user, data.sucursal_id)
    if data.monto <= 0 or (data.estado or "pendiente") not in {"pendiente", "pagado", "aprobado", "cancelado"}:
        raise HTTPException(status_code=400, detail="Monto o estado inválido.")
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO core.fin_gastos
                   (sucursal_id, fecha, categoria, proveedor, descripcion, monto, cuenta, estado, comprobante_url, fecha_pago, created_by)
                   VALUES (%s,%s::date,%s,%s,%s,%s,%s,%s,%s,%s::date,%s) RETURNING gasto_id;""",
                (sucursal_id, data.fecha, data.categoria, data.proveedor, data.descripcion, data.monto, data.cuenta, data.estado or "pendiente", data.comprobante_url, data.fecha_pago, user["username"]),
            )
            new_id = cur.fetchone()[0]
        conn.commit()
    return {"gasto_id": new_id, "created": True}


@app.post("/finanzas/nomina", summary="Registrar nómina sin cálculo fiscal")
def crear_nomina(data: FinanzasNominaIn, user=Depends(get_current_user)):
    sucursal_id = _finanzas_scope(user, data.sucursal_id)
    valores = [data.salario_base, data.horas, data.comisiones, data.bonos, data.deducciones, data.pago_neto, data.costo_patronal]
    if any(valor < 0 for valor in valores):
        raise HTTPException(status_code=400, detail="Los importes de nómina no pueden ser negativos.")
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO core.fin_nomina
                   (sucursal_id, empleado, periodo_inicio, periodo_fin, salario_base, horas,
                    comisiones, bonos, deducciones, pago_neto, costo_patronal, fecha_pago,
                    cuenta, estado, notas, created_by)
                   VALUES (%s,%s,%s::date,%s::date,%s,%s,%s,%s,%s,%s,%s,%s::date,%s,%s,%s,%s)
                   RETURNING nomina_id;""",
                (sucursal_id, data.empleado, data.periodo_inicio, data.periodo_fin, data.salario_base, data.horas, data.comisiones, data.bonos, data.deducciones, data.pago_neto, data.costo_patronal, data.fecha_pago, data.cuenta, data.estado or "pendiente", data.notas, user["username"]),
            )
            new_id = cur.fetchone()[0]
        conn.commit()
    return {"nomina_id": new_id, "created": True}


@app.post("/finanzas/cuentas-pagar", summary="Registrar cuenta por pagar")
def crear_cuenta_pagar(data: FinanzasCuentaPagarIn, user=Depends(get_current_user)):
    sucursal_id = _finanzas_scope(user, data.sucursal_id)
    if data.monto_total <= 0 or data.monto_pagado < 0 or data.monto_pagado > data.monto_total:
        raise HTTPException(status_code=400, detail="Importes de cuenta por pagar inválidos.")
    estado = data.estado or ("pagada" if data.monto_pagado >= data.monto_total else "pendiente")
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO core.fin_cuentas_pagar
                   (sucursal_id, proveedor, categoria, concepto, folio, fecha_emision,
                    fecha_vencimiento, monto_total, monto_pagado, estado, comprobante_url, created_by)
                   VALUES (%s,%s,%s,%s,%s,%s::date,%s::date,%s,%s,%s,%s,%s)
                   RETURNING cuenta_pagar_id;""",
                (sucursal_id, data.proveedor, data.categoria, data.concepto, data.folio, data.fecha_emision, data.fecha_vencimiento, data.monto_total, data.monto_pagado, estado, data.comprobante_url, user["username"]),
            )
            new_id = cur.fetchone()[0]
            if data.monto_pagado > 0:
                cur.execute(
                    """INSERT INTO core.fin_movimientos
                       (sucursal_id, fecha, cuenta, tipo, categoria, descripcion, monto, estado, referencia, created_by)
                       VALUES (%s,%s::date,'Por definir','egreso','pago_cuenta_por_pagar',%s,%s,'registrado',%s,%s);""",
                    (
                        sucursal_id,
                        data.fecha_emision,
                        f"Pago inicial de obligación: {data.concepto}",
                        data.monto_pagado,
                        f"cuenta_pagar:{new_id}",
                        user["username"],
                    ),
                )
        conn.commit()
    return {"cuenta_pagar_id": new_id, "created": True}


@app.post("/finanzas/comprobantes", summary="Adjuntar comprobante financiero")
async def subir_comprobante_financiero(
    request: Request,
    recurso: str,
    registro_id: int,
    nombre: str,
    sucursal_id: int | None = None,
    user=Depends(get_current_user),
):
    sucursal_id = _finanzas_scope(user, sucursal_id)
    recurso = normalize_controlled_token(recurso) or ""
    config = {
        "gasto": ("core.fin_gastos", "gasto_id"),
        "cuenta_pagar": ("core.fin_cuentas_pagar", "cuenta_pagar_id"),
    }.get(recurso)
    if config is None:
        raise HTTPException(status_code=400, detail="Tipo de comprobante inválido.")
    contenido = await request.body()
    if not contenido or len(contenido) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El comprobante debe medir entre 1 byte y 10 MB.")
    mime_type = (request.headers.get("content-type") or "application/octet-stream").split(";", 1)[0].lower()
    if mime_type not in {"application/pdf", "image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF, JPG, PNG o WEBP.")
    nombre = re.sub(r"[^A-Za-z0-9._() -]", "_", str(nombre or "comprobante"))[:180]
    table, key = config
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT 1 FROM {table} WHERE {key}=%s AND sucursal_id=%s;", (registro_id, sucursal_id))
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="El registro financiero no existe en esta sucursal.")
            cur.execute(
                """INSERT INTO core.fin_comprobantes
                   (sucursal_id, recurso, registro_id, nombre_archivo, mime_type, contenido, created_by)
                   VALUES (%s,%s,%s,%s,%s,%s,%s)
                   RETURNING comprobante_id;""",
                (sucursal_id, recurso, registro_id, nombre, mime_type, contenido, user["username"]),
            )
            comprobante_id = cur.fetchone()[0]
        conn.commit()
    return {"comprobante_id": comprobante_id, "uploaded": True}


@app.get("/finanzas/comprobantes/{comprobante_id}", summary="Abrir comprobante financiero")
def abrir_comprobante_financiero(
    comprobante_id: int,
    sucursal_id: int | None = None,
    user=Depends(get_current_user),
):
    sucursal_id = _finanzas_scope(user, sucursal_id)
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT nombre_archivo, mime_type, contenido
                   FROM core.fin_comprobantes
                   WHERE comprobante_id=%s AND sucursal_id=%s;""",
                (comprobante_id, sucursal_id),
            )
            row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado.")
    safe_name = str(row[0]).replace('"', "_")
    return Response(
        content=bytes(row[2]),
        media_type=row[1],
        headers={"Content-Disposition": f'inline; filename="{safe_name}"'},
    )


@app.patch("/finanzas/{recurso}/{registro_id}/estado", summary="Actualizar estado financiero")
def actualizar_estado_financiero(
    recurso: str,
    registro_id: int,
    estado: str,
    sucursal_id: int,
    monto_pagado: Decimal | None = None,
    user=Depends(get_current_user),
):
    sucursal_id = _finanzas_scope(user, sucursal_id)
    recurso = normalize_controlled_token(recurso) or ""
    estado = normalize_controlled_token(estado) or ""
    config = {
        "gastos": ("core.fin_gastos", "gasto_id", {"pendiente", "pagado", "aprobado", "cancelado"}),
        "nomina": ("core.fin_nomina", "nomina_id", {"pendiente", "pagada", "aprobada", "cancelada"}),
        "cuentas_pagar": ("core.fin_cuentas_pagar", "cuenta_pagar_id", {"pendiente", "parcial", "pagada", "cancelada"}),
    }.get(recurso)
    if config is None or estado not in config[2]:
        raise HTTPException(status_code=400, detail="Recurso o estado inválido.")
    table, key, _ = config
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            if recurso == "cuentas_pagar" and monto_pagado is not None:
                cur.execute(
                    f"SELECT monto_total, monto_pagado, concepto FROM {table} WHERE {key}=%s AND sucursal_id=%s FOR UPDATE;",
                    (registro_id, sucursal_id),
                )
                deuda = cur.fetchone()
                if deuda is None:
                    raise HTTPException(status_code=404, detail="Registro no encontrado en esta sucursal.")
                if monto_pagado < 0 or monto_pagado > deuda[0]:
                    raise HTTPException(status_code=400, detail="El monto pagado debe estar entre 0 y el total de la obligación.")
                monto_anterior = Decimal(str(deuda[1] or 0))
                cur.execute(
                    f"UPDATE {table} SET estado=%s, monto_pagado=%s, updated_at=NOW() WHERE {key}=%s AND sucursal_id=%s RETURNING {key};",
                    (estado, monto_pagado, registro_id, sucursal_id),
                )
                diferencia = Decimal(str(monto_pagado)) - monto_anterior
                if diferencia != 0:
                    cur.execute(
                        """INSERT INTO core.fin_movimientos
                           (sucursal_id, fecha, cuenta, tipo, categoria, descripcion, monto, estado, referencia, created_by)
                           VALUES (%s,NOW(),'Por definir',%s,%s,%s,%s,'registrado',%s,%s);""",
                        (
                            sucursal_id,
                            "egreso" if diferencia > 0 else "ingreso",
                            "pago_cuenta_por_pagar" if diferencia > 0 else "ajuste_cuenta_por_pagar",
                            f"Pago de obligación: {deuda[2]}",
                            abs(diferencia),
                            f"cuenta_pagar:{registro_id}",
                            user["username"],
                        ),
                    )
            else:
                cur.execute(
                    f"UPDATE {table} SET estado=%s, updated_at=NOW() WHERE {key}=%s AND sucursal_id=%s RETURNING {key};",
                    (estado, registro_id, sucursal_id),
                )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Registro no encontrado en esta sucursal.")
        conn.commit()
    return {"updated": True, "id": row[0], "estado": estado}


@app.get("/finanzas/datos", summary="Resumen y auxiliares financieros")
def obtener_datos_finanzas(
    sucursal_id: str | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    user=Depends(get_current_user),
):
    reporting_scope, branch_id = _resolve_reporting_scope(user, sucursal_id)
    if reporting_scope == "online" and user.get("rol") not in {"admin", "contador"}:
        raise HTTPException(status_code=403, detail="Sin permiso para consultar Finanzas en línea.")
    hoy = date.today()
    desde = _finanzas_fecha(fecha_desde, hoy.replace(day=1))
    hasta = _finanzas_fecha(fecha_hasta, hoy)
    if desde > hasta:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser posterior a la final.")
    sales_scope = _report_scope_sql("v", reporting_scope, branch_id)
    branch_scope = (
        "TRUE" if reporting_scope == "general"
        else "FALSE" if reporting_scope == "online"
        else f"sucursal_id = {int(branch_id)}"
    )
    params = (desde, hasta)
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT COALESCE(SUM(v.subtotal),0), COALESCE(SUM(v.subtotal-v.monto_total),0), COALESCE(SUM(v.monto_total),0)
                FROM core.ventas v WHERE {sales_scope} AND v.activo=true
                  AND COALESCE(v.estado_venta,'confirmada') NOT IN ('cancelada','devuelta')
                  AND v.fecha_hora::date BETWEEN %s AND %s;
                """, params,
            )
            ventas_brutas, descuentos, ventas_netas = cur.fetchone()
            cur.execute(
                f"""SELECT COALESCE(SUM(p.monto),0) FROM core.venta_pagos p
                   JOIN core.ventas v ON v.venta_id=p.venta_id
                   WHERE {sales_scope} AND p.activo=true AND p.created_at::date BETWEEN %s AND %s;""", params,
            )
            cobrado = cur.fetchone()[0]
            cur.execute(
                f"""SELECT COALESCE(SUM(GREATEST(v.monto_total-COALESCE(p.pagado,0),0)),0)
                   FROM core.ventas v
                   LEFT JOIN (SELECT venta_id,SUM(monto) pagado FROM core.venta_pagos WHERE activo=true GROUP BY venta_id) p ON p.venta_id=v.venta_id
                   WHERE {sales_scope} AND v.activo=true
                     AND COALESCE(v.estado_venta,'confirmada') NOT IN ('cancelada','devuelta')
                     AND v.fecha_hora::date BETWEEN %s AND %s;""", params,
            )
            cuentas_cobrar_total = cur.fetchone()[0]
            cur.execute(
                f"""SELECT COALESCE(SUM(d.cantidad*COALESCE(d.costo_unitario,p.costo_unitario,0)),0)
                   FROM core.venta_detalles d JOIN core.ventas v ON v.venta_id=d.venta_id
                   JOIN core.productos p ON p.producto_id=d.producto_id
                     WHERE {sales_scope} AND v.activo=true
                     AND COALESCE(v.estado_venta,'confirmada') NOT IN ('cancelada','devuelta')
                     AND v.fecha_hora::date BETWEEN %s AND %s;""", params,
            )
            costo_productos = cur.fetchone()[0]
            cur.execute(f"SELECT COALESCE(SUM(monto),0) FROM core.fin_gastos WHERE {branch_scope} AND fecha BETWEEN %s AND %s AND estado IN ('pagado','aprobado');", params)
            gastos_total = cur.fetchone()[0]
            cur.execute(f"SELECT COALESCE(SUM(costo_patronal),0) FROM core.fin_nomina WHERE {branch_scope} AND periodo_inicio BETWEEN %s AND %s AND estado IN ('pagada','aprobada');", params)
            nomina_total = cur.fetchone()[0]
            cur.execute(f"SELECT COALESCE(SUM(costo_unitario*stock),0) FROM core.productos WHERE {branch_scope} AND activo=true AND controla_stock=true;")
            valor_inventario = cur.fetchone()[0]
            cur.execute(f"SELECT COALESCE(SUM(GREATEST(monto_total-monto_pagado,0)),0) FROM core.fin_cuentas_pagar WHERE {branch_scope} AND estado NOT IN ('pagada','cancelada');")
            cuentas_pagar_total = cur.fetchone()[0]

            cur.execute(
                f"""SELECT v.venta_id,v.fecha_hora,
                          COALESCE(NULLIF(TRIM(CONCAT_WS(' ',p.primer_nombre,p.apellido_paterno)),''),CONCAT('Cliente #',v.paciente_id)),
                          v.monto_total,COALESCE(pg.pagado,0),GREATEST(v.monto_total-COALESCE(pg.pagado,0),0),v.estado_pago
                   FROM core.ventas v LEFT JOIN core.pacientes p ON p.paciente_id=v.paciente_id
                   LEFT JOIN (SELECT venta_id,SUM(monto) pagado FROM core.venta_pagos WHERE activo=true GROUP BY venta_id) pg ON pg.venta_id=v.venta_id
                   WHERE {sales_scope} AND v.activo=true AND GREATEST(v.monto_total-COALESCE(pg.pagado,0),0)>0
                     AND COALESCE(v.estado_venta,'confirmada') NOT IN ('cancelada','devuelta')
                   ORDER BY v.fecha_hora DESC LIMIT 500;""", (),
            )
            cuentas_cobrar = [{"venta_id":r[0],"fecha":r[1].isoformat() if r[1] else None,"cliente":r[2],"total":float(r[3]),"pagado":float(r[4]),"saldo":float(r[5]),"estado_pago":r[6]} for r in cur.fetchall()]
            cur.execute(f"""SELECT g.gasto_id,g.fecha,g.categoria,g.proveedor,g.descripcion,g.monto,g.cuenta,g.estado,g.comprobante_url,g.fecha_pago,
                                  c.comprobante_id,c.nombre_archivo
                           FROM core.fin_gastos g
                           LEFT JOIN LATERAL (SELECT comprobante_id,nombre_archivo FROM core.fin_comprobantes WHERE sucursal_id=g.sucursal_id AND recurso='gasto' AND registro_id=g.gasto_id ORDER BY created_at DESC LIMIT 1) c ON true
                           WHERE {branch_scope} AND g.fecha BETWEEN %s AND %s ORDER BY g.fecha DESC,g.gasto_id DESC LIMIT 500;""", params)
            gastos = [{"gasto_id":r[0],"fecha":str(r[1]),"categoria":r[2],"proveedor":r[3],"descripcion":r[4],"monto":float(r[5]),"cuenta":r[6],"estado":r[7],"comprobante_url":r[8],"fecha_pago":str(r[9]) if r[9] else None,"comprobante_id":r[10],"comprobante_nombre":r[11]} for r in cur.fetchall()]
            cur.execute(f"SELECT nomina_id,empleado,periodo_inicio,periodo_fin,salario_base,horas,comisiones,bonos,deducciones,pago_neto,costo_patronal,fecha_pago,estado FROM core.fin_nomina WHERE {branch_scope} AND periodo_inicio BETWEEN %s AND %s ORDER BY periodo_inicio DESC,nomina_id DESC LIMIT 500;", params)
            nomina = [{"nomina_id":r[0],"empleado":r[1],"periodo_inicio":str(r[2]),"periodo_fin":str(r[3]),"salario_base":float(r[4]),"horas":float(r[5]),"comisiones":float(r[6]),"bonos":float(r[7]),"deducciones":float(r[8]),"pago_neto":float(r[9]),"costo_patronal":float(r[10]),"fecha_pago":str(r[11]) if r[11] else None,"estado":r[12]} for r in cur.fetchall()]
            cur.execute(f"""SELECT cp.cuenta_pagar_id,cp.proveedor,cp.categoria,cp.concepto,cp.folio,cp.fecha_emision,cp.fecha_vencimiento,cp.monto_total,cp.monto_pagado,cp.estado,cp.comprobante_url,
                                  c.comprobante_id,c.nombre_archivo
                           FROM core.fin_cuentas_pagar cp
                           LEFT JOIN LATERAL (SELECT comprobante_id,nombre_archivo FROM core.fin_comprobantes WHERE sucursal_id=cp.sucursal_id AND recurso='cuenta_pagar' AND registro_id=cp.cuenta_pagar_id ORDER BY created_at DESC LIMIT 1) c ON true
                           WHERE {branch_scope.replace('sucursal_id', 'cp.sucursal_id')} AND cp.fecha_emision BETWEEN %s AND %s ORDER BY cp.fecha_vencimiento NULLS LAST,cp.cuenta_pagar_id DESC LIMIT 500;""", params)
            cuentas_pagar = [{"cuenta_pagar_id":r[0],"proveedor":r[1],"categoria":r[2],"concepto":r[3],"folio":r[4],"fecha_emision":str(r[5]),"fecha_vencimiento":str(r[6]) if r[6] else None,"monto_total":float(r[7]),"monto_pagado":float(r[8]),"saldo":float(r[7]-r[8]),"estado":r[9],"comprobante_url":r[10],"comprobante_id":r[11],"comprobante_nombre":r[12]} for r in cur.fetchall()]
            cur.execute(
                f"""SELECT fecha,cuenta,tipo,categoria,descripcion,monto,fuente FROM (
                     SELECT p.created_at fecha,p.metodo cuenta,'ingreso' tipo,'venta' categoria,CONCAT('Pago venta #',v.venta_id) descripcion,p.monto,'venta' fuente
                     FROM core.venta_pagos p JOIN core.ventas v ON v.venta_id=p.venta_id WHERE {sales_scope} AND p.activo=true AND p.created_at::date BETWEEN %s AND %s
                     UNION ALL SELECT m.fecha,m.cuenta,m.tipo,m.categoria,m.descripcion,m.monto,'manual' FROM core.fin_movimientos m WHERE {branch_scope.replace('sucursal_id', 'm.sucursal_id')} AND m.estado<>'cancelado' AND m.fecha::date BETWEEN %s AND %s
                     UNION ALL SELECT COALESCE(g.fecha_pago,g.fecha)::timestamptz,COALESCE(g.cuenta,'Sin cuenta'),'egreso','gasto',g.descripcion,g.monto,'gasto' FROM core.fin_gastos g WHERE {branch_scope.replace('sucursal_id', 'g.sucursal_id')} AND g.estado='pagado' AND COALESCE(g.fecha_pago,g.fecha) BETWEEN %s AND %s
                     UNION ALL SELECT COALESCE(n.fecha_pago,n.periodo_fin)::timestamptz,COALESCE(n.cuenta,'Sin cuenta'),'egreso','nomina',CONCAT('Nómina: ',n.empleado),n.pago_neto,'nomina' FROM core.fin_nomina n WHERE {branch_scope.replace('sucursal_id', 'n.sucursal_id')} AND n.estado='pagada' AND COALESCE(n.fecha_pago,n.periodo_fin) BETWEEN %s AND %s
                   ) movimientos ORDER BY fecha DESC LIMIT 1000;""", params + params + params + params,
            )
            movimientos = [{"fecha":r[0].isoformat() if r[0] else None,"cuenta":r[1],"tipo":r[2],"categoria":r[3],"descripcion":r[4],"monto":float(r[5]),"fuente":r[6]} for r in cur.fetchall()]
            cur.execute(
                f"""SELECT COALESCE(SUM(monto_firmado), 0) FROM (
                     SELECT p.monto AS monto_firmado
                     FROM core.venta_pagos p JOIN core.ventas v ON v.venta_id=p.venta_id
                     WHERE {sales_scope} AND p.activo=true AND p.created_at::date < %s
                     UNION ALL
                     SELECT CASE WHEN m.tipo='ingreso' THEN m.monto ELSE -m.monto END
                     FROM core.fin_movimientos m
                     WHERE {branch_scope.replace('sucursal_id', 'm.sucursal_id')} AND m.estado<>'cancelado' AND m.fecha::date < %s
                     UNION ALL
                     SELECT -g.monto FROM core.fin_gastos g
                     WHERE {branch_scope.replace('sucursal_id', 'g.sucursal_id')} AND g.estado='pagado' AND COALESCE(g.fecha_pago,g.fecha) < %s
                     UNION ALL
                     SELECT -n.pago_neto FROM core.fin_nomina n
                     WHERE {branch_scope.replace('sucursal_id', 'n.sucursal_id')} AND n.estado='pagada' AND COALESCE(n.fecha_pago,n.periodo_fin) < %s
                   ) saldo_anterior;""",
                (desde, desde, desde, desde),
            )
            saldo_inicial = float(cur.fetchone()[0] or 0)

    entradas = sum(item["monto"] for item in movimientos if item["tipo"] == "ingreso")
    salidas = sum(item["monto"] for item in movimientos if item["tipo"] == "egreso")
    utilidad_bruta = Decimal(str(ventas_netas)) - Decimal(str(costo_productos))
    utilidad_neta = utilidad_bruta - Decimal(str(gastos_total)) - Decimal(str(nomina_total))
    efectivo_final = saldo_inicial + entradas - salidas
    activos = Decimal(str(efectivo_final)) + Decimal(str(cuentas_cobrar_total)) + Decimal(str(valor_inventario))
    pasivos = Decimal(str(cuentas_pagar_total))
    return {
        "periodo":{"desde":str(desde),"hasta":str(hasta)},
        "resumen":{"ingresos_ventas":float(ventas_brutas),"descuentos":float(descuentos),"ventas_netas":float(ventas_netas),"dinero_cobrado":float(cobrado),"saldos_pendientes":float(cuentas_cobrar_total),"costo_productos":float(costo_productos),"gastos":float(gastos_total),"nomina":float(nomina_total),"utilidad_bruta":float(utilidad_bruta),"utilidad_neta":float(utilidad_neta),"valor_inventario":float(valor_inventario)},
        "movimientos":movimientos,"gastos":gastos,"nomina":nomina,"cuentas_cobrar":cuentas_cobrar,"cuentas_pagar":cuentas_pagar,
        "estado_resultados":{"ventas_netas":float(ventas_netas),"costo_productos":float(costo_productos),"utilidad_bruta":float(utilidad_bruta),"gastos_operativos":float(gastos_total),"nomina":float(nomina_total),"utilidad_neta":float(utilidad_neta)},
        "flujo_efectivo":{"saldo_inicial":saldo_inicial,"entradas":entradas,"salidas":salidas,"saldo_final":efectivo_final},
        "balance_general":{"activos":float(activos),"efectivo":efectivo_final,"cuentas_cobrar":float(cuentas_cobrar_total),"inventario":float(valor_inventario),"pasivos":float(pasivos),"capital_contable":float(activos-pasivos)},
    }


def _restore_inventory_for_sales(
    cur,
    venta_ids: list[int],
    sucursal_id: int,
    created_by: str,
) -> int:
    normalized_ids = sorted({int(venta_id) for venta_id in venta_ids if int(venta_id) > 0})
    if not normalized_ids:
        return 0

    cur.execute(
        """
        SELECT COUNT(*)
        FROM core.venta_detalles
        WHERE venta_id = ANY(%s::bigint[]);
        """,
        (normalized_ids,),
    )
    total_detalles = int(cur.fetchone()[0] or 0)

    cur.execute(
        """
        SELECT vd.producto_id, vd.cantidad, p.controla_stock
        FROM core.venta_detalles vd
        JOIN core.ventas v ON v.venta_id = vd.venta_id
        JOIN core.productos p ON p.producto_id = vd.producto_id
        WHERE vd.venta_id = ANY(%s::bigint[])
          AND v.sucursal_id = %s
          AND p.sucursal_id = %s
        ORDER BY vd.producto_id, vd.venta_detalle_id
        FOR UPDATE OF vd, p;
        """,
        (normalized_ids, sucursal_id, sucursal_id),
    )
    detalle_rows = cur.fetchall()
    if len(detalle_rows) != total_detalles:
        raise HTTPException(
            status_code=409,
            detail="No se pudo restaurar el inventario porque los detalles de venta no coinciden con la sucursal.",
        )

    cantidades_por_producto: dict[int, int] = {}
    for producto_id, cantidad, controla_stock in detalle_rows:
        if controla_stock is not True:
            continue
        producto_id = int(producto_id)
        cantidades_por_producto[producto_id] = (
            cantidades_por_producto.get(producto_id, 0) + int(cantidad or 0)
        )

    for producto_id in sorted(cantidades_por_producto):
        cantidad_restaurada = cantidades_por_producto[producto_id]
        cur.execute(
            """
            UPDATE core.productos
            SET stock = stock + %s, updated_at = NOW()
            WHERE producto_id = %s
              AND sucursal_id = %s
            RETURNING stock;
            """,
            (cantidad_restaurada, producto_id, sucursal_id),
        )
        stock_nuevo = int(cur.fetchone()[0])
        cur.execute(
            """INSERT INTO core.inventario_movimientos (
                 sucursal_id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
                 fuente_tipo, fuente_id, notas, created_by
               ) VALUES (%s, %s, 'venta_eliminada', %s, %s, %s, 'venta', %s, %s, %s);""",
            (
                sucursal_id,
                producto_id,
                cantidad_restaurada,
                stock_nuevo - cantidad_restaurada,
                stock_nuevo,
                normalized_ids[0] if len(normalized_ids) == 1 else None,
                f"Restauración por eliminación de {len(normalized_ids)} venta(s)",
                created_by,
            ),
        )

    cur.execute(
        """
        DELETE FROM core.venta_detalles
        WHERE venta_id = ANY(%s::bigint[]);
        """,
        (normalized_ids,),
    )
    return len(detalle_rows)


def _inventory_product_matches_purchase(
    categoria: str | None,
    subcategoria: str | None,
    tipo_mica: str | None,
    compra_tokens: set[str],
) -> bool:
    categoria = normalize_controlled_token(categoria) or ""
    subcategoria = normalize_controlled_token(subcategoria) or ""
    tipo_mica = normalize_controlled_token(tipo_mica) or ""

    if categoria == "lentes_opticos" and subcategoria == "armazon":
        return bool(
            compra_tokens
            & {
                "armazon_solo",
                "armazon_con_micas_sin_tratamiento",
                "armazon_con_micas_antirreflejante",
                "armazon_con_micas_fotocromaticas",
                "armazon_con_micas_antiblueray",
            }
        )

    if categoria == "micas":
        token_by_type = {
            "base": "micas_base",
            "monofocal": "micas_monofocales",
            "bifocal": "micas_bifocales",
            "progresivo": "micas_progresivas",
            "sin_graduacion": "micas_sin_graduacion",
            "sin_tratamiento": "micas_solas_sin_tratamiento",
            "antirreflejante": "micas_antirreflejante",
            "fotocromatico": "micas_fotocromaticas",
            "antiblueray": "micas_antiblueray",
            "tinte": "micas_tinte",
        }
        return token_by_type.get(tipo_mica) in compra_tokens

    if categoria == "lentes_de_sol":
        if subcategoria == "graduacion":
            return "lentes_de_sol_con_graduacion" in compra_tokens
        return bool(
            compra_tokens
            & {"lentes_de_sol_sin_graduacion", "lentes_de_sol_con_graduacion"}
        )

    if categoria == "accesorios_y_refacciones":
        expected = "estuche_para_armazon" if subcategoria == "estuche" else "accesorios_y_refacciones"
        return expected in compra_tokens

    allowed_by_category = {
        "examen_de_la_vista": {"examen_de_la_vista"},
        "lentes_de_contacto": {"lentes_de_contacto"},
        "soluciones_y_cuidado": {"soluciones_y_cuidado"},
    }
    return bool(compra_tokens & allowed_by_category.get(categoria, set()))


@app.post("/ventas", summary="Crear venta")
def crear_venta(v: VentaCreate, user=Depends(get_current_user)):
    require_roles(user, ("admin", "recepcion", "doctor"))
    v.sucursal_id = force_sucursal(user, v.sucursal_id)
    productos_input = list(v.productos or [])
    pagos_input = list(v.pagos or [])
    sanitize_model_strings(v)
    if user["rol"] == "admin" and v.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if not v.compra or not v.compra.strip():
        raise HTTPException(status_code=400, detail="Compra es obligatoria.")
    v.compra = normalize_compra_tokens(v.compra)
    v.metodo_pago = normalize_metodos_pago(v.metodo_pago)
    v.estado_venta = normalize_controlled_token(v.estado_venta) or "confirmada"
    v.estado_pedido = normalize_controlled_token(v.estado_pedido) or "pendiente_fabricacion"
    if v.estado_venta not in VENTA_ESTADO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_venta inválido.")
    if v.estado_pedido not in VENTA_ESTADO_PEDIDO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_pedido inválido.")

    v.forma_liquidacion = normalize_controlled_token(v.forma_liquidacion)
    if not v.forma_liquidacion:
        v.forma_liquidacion = "adelanto_apartado" if v.adelanto_aplica else "pago_completo"
    if v.forma_liquidacion not in VENTA_FORMA_LIQUIDACION_ALLOWED:
        raise HTTPException(status_code=400, detail="forma_liquidacion inválida.")
    if v.forma_liquidacion in {"meses_sin_intereses", "meses_con_intereses"}:
        if v.plazo_meses not in VENTA_PLAZO_MESES_ALLOWED:
            raise HTTPException(
                status_code=400,
                detail="Selecciona un plazo de 3, 6, 9, 12, 18 o 24 meses.",
            )
    else:
        v.plazo_meses = None

    if v.pagos is None:
        v.adelanto_aplica = v.forma_liquidacion in {"adelanto_apartado", "pago_mixto"}
        if v.adelanto_aplica:
            if v.adelanto_monto is None or float(v.adelanto_monto) <= 0:
                raise HTTPException(status_code=400, detail="adelanto_monto debe ser mayor a 0.")
            v.adelanto_metodo = normalize_controlled_token(v.adelanto_metodo)
            if (v.adelanto_metodo or "").strip() not in VENTA_METODO_PAGO_ALLOWED:
                raise HTTPException(status_code=400, detail="adelanto_metodo inválido.")
        else:
            v.adelanto_monto = None
            v.adelanto_metodo = None

    descuento_porcentaje = Decimal(str(v.descuento_porcentaje or 0))
    if descuento_porcentaje < 0 or descuento_porcentaje > 100:
        raise HTTPException(
            status_code=400,
            detail="descuento_porcentaje debe estar entre 0 y 100.",
        )
    descuento_monto = Decimal(str(v.descuento_monto or 0)).quantize(Decimal("0.01"))
    if descuento_monto < 0:
        raise HTTPException(status_code=400, detail="descuento_monto no puede ser negativo.")
    if descuento_porcentaje > 0 and descuento_monto > 0:
        raise HTTPException(
            status_code=400,
            detail="Usa un descuento por porcentaje o por monto, no ambos.",
        )
    v.descuento_motivo, v.cupon_tipo = normalize_datos_descuento(
        descuento_porcentaje,
        descuento_monto,
        v.descuento_motivo,
        v.cupon_tipo,
    )

    productos_solicitados: dict[int, int] = {}
    for item in productos_input:
        producto_id = int(item.producto_id)
        cantidad = int(item.cantidad)
        if producto_id <= 0 or cantidad <= 0:
            raise HTTPException(status_code=400, detail="Producto y cantidad de inventario inválidos.")
        productos_solicitados[producto_id] = productos_solicitados.get(producto_id, 0) + cantidad
    if productos_solicitados and user["rol"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Solo administradores pueden descontar productos del inventario.",
        )
    if user["rol"] == "admin" and not productos_solicitados:
        raise HTTPException(
            status_code=400,
            detail="Agrega al menos un producto del catálogo a la venta.",
        )
    compra_tokens = set(split_pipe_tokens(v.compra))

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

                productos_validados: list[dict[str, Any]] = []
                subtotal_calculado = Decimal("0.00")
                for producto_id in sorted(productos_solicitados):
                    cantidad = productos_solicitados[producto_id]
                    cur.execute(
                        """
                        SELECT
                            nombre, sku, precio, stock, categoria, subcategoria,
                            tipo_mica, controla_stock, costo_unitario
                        FROM core.productos
                        WHERE producto_id = %s
                          AND sucursal_id = %s
                          AND activo = true
                        FOR UPDATE;
                        """,
                        (producto_id, v.sucursal_id),
                    )
                    producto_row = cur.fetchone()
                    if producto_row is None:
                        raise HTTPException(
                            status_code=404,
                            detail=f"Producto de inventario #{producto_id} no existe en esta sucursal.",
                        )
                    (
                        nombre_producto,
                        sku_producto,
                        precio_producto,
                        stock_actual,
                        categoria_producto,
                        subcategoria_producto,
                        tipo_mica_producto,
                        controla_stock,
                        costo_unitario_producto,
                    ) = producto_row
                    if not _inventory_product_matches_purchase(
                        categoria_producto,
                        subcategoria_producto,
                        tipo_mica_producto,
                        compra_tokens,
                    ):
                        raise HTTPException(
                            status_code=400,
                            detail=f"El producto {nombre_producto} no corresponde con la opción de compra seleccionada.",
                        )
                    if controla_stock is True and int(stock_actual or 0) < cantidad:
                        raise HTTPException(
                            status_code=409,
                            detail=f"Stock insuficiente para {nombre_producto}. Disponible: {int(stock_actual or 0)}.",
                        )
                    precio_unitario = Decimal(str(precio_producto or 0))
                    subtotal_producto = precio_unitario * cantidad
                    subtotal_calculado += subtotal_producto
                    productos_validados.append(
                        {
                            "producto_id": producto_id,
                            "cantidad": cantidad,
                            "nombre": nombre_producto,
                            "sku": sku_producto,
                            "precio_unitario": precio_unitario,
                            "costo_unitario": Decimal(str(costo_unitario_producto or 0)),
                            "subtotal": subtotal_producto,
                            "stock_actual": int(stock_actual or 0),
                            "controla_stock": controla_stock is True,
                            "categoria": categoria_producto,
                            "subcategoria": subcategoria_producto,
                        }
                    )

                tratamientos_mica = [
                    producto
                    for producto in productos_validados
                    if normalize_controlled_token(producto["categoria"]) == "micas"
                    and normalize_controlled_token(producto["subcategoria"]) == "tratamiento"
                ]
                if len(tratamientos_mica) > 1:
                    raise HTTPException(
                        status_code=400,
                        detail="Solo se puede seleccionar un tratamiento o tinte para las micas.",
                    )

                if productos_validados:
                    subtotal_venta = subtotal_calculado.quantize(Decimal("0.01"))
                else:
                    subtotal_venta = Decimal(str(v.subtotal if v.subtotal is not None else v.monto_total or 0))
                    if subtotal_venta <= 0:
                        raise HTTPException(status_code=400, detail="Monto total debe ser mayor a 0.")

                if descuento_monto > subtotal_venta:
                    raise HTTPException(
                        status_code=400,
                        detail="El descuento en pesos no puede ser mayor al subtotal.",
                    )
                descuento_calculado = (
                    descuento_monto
                    if descuento_monto > 0
                    else subtotal_venta * descuento_porcentaje / Decimal("100")
                ).quantize(Decimal("0.01"))
                monto_total = (subtotal_venta - descuento_calculado).quantize(Decimal("0.01"))
                pagos_validados: list[dict[str, Any]] = []
                monto_pagado = Decimal("0.00")
                for pago in pagos_input:
                    metodo = normalize_controlled_token(pago.metodo)
                    if metodo not in VENTA_METODO_PAGO_ALLOWED:
                        raise HTTPException(status_code=400, detail="Método de pago inválido.")
                    monto_pago = Decimal(str(pago.monto)).quantize(Decimal("0.01"))
                    if monto_pago <= 0:
                        raise HTTPException(status_code=400, detail="Cada pago debe ser mayor a 0.")
                    referencia = (pago.referencia or "").strip() or None
                    if referencia and len(referencia) > 120:
                        raise HTTPException(status_code=400, detail="La referencia del pago es demasiado larga.")
                    pagos_validados.append(
                        {"metodo": metodo, "monto": monto_pago, "referencia": referencia}
                    )
                    monto_pagado += monto_pago

                if not pagos_validados:
                    raise HTTPException(
                        status_code=400,
                        detail="Registra al menos un pago o adelanto.",
                    )
                if monto_pagado > monto_total:
                    raise HTTPException(
                        status_code=400,
                        detail="La suma de los pagos no puede ser mayor al total de la venta.",
                    )
                if pagos_validados:
                    metodos_pago = list(dict.fromkeys(pago["metodo"] for pago in pagos_validados))
                    v.metodo_pago = "|".join(metodos_pago)
                    tiene_plan_financiamiento = v.forma_liquidacion in {
                        "meses_sin_intereses",
                        "meses_con_intereses",
                    }
                    if monto_pagado < monto_total:
                        if not tiene_plan_financiamiento:
                            v.forma_liquidacion = "adelanto_apartado"
                        v.adelanto_aplica = True
                        v.adelanto_monto = float(monto_pagado)
                        v.adelanto_metodo = metodos_pago[0] if len(metodos_pago) == 1 else None
                    else:
                        if not tiene_plan_financiamiento:
                            v.forma_liquidacion = "pago_mixto" if len(metodos_pago) > 1 else "pago_completo"
                        v.adelanto_aplica = False
                        v.adelanto_monto = None
                        v.adelanto_metodo = None
                v.estado_pago = (
                    "pagada"
                    if monto_pagado >= monto_total
                    else "anticipo"
                    if len(pagos_validados) == 1
                    else "pago_parcial"
                )
                cur.execute(
                    """
                    INSERT INTO core.ventas (
                      sucursal_id, paciente_id, compra, subtotal, descuento_porcentaje, descuento_monto,
                      descuento_motivo, cupon_tipo, monto_total, metodo_pago, forma_liquidacion, plazo_meses, adelanto_aplica,
                      adelanto_monto, adelanto_metodo, estado_venta, estado_pago,
                      estado_pedido, notas, created_by
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING venta_id;
                    """,
                    (
                        v.sucursal_id,
                        v.paciente_id,
                        v.compra,
                        subtotal_venta,
                        descuento_porcentaje,
                        descuento_monto,
                        v.descuento_motivo,
                        v.cupon_tipo,
                        monto_total,
                        v.metodo_pago,
                        v.forma_liquidacion,
                        v.plazo_meses,
                        v.adelanto_aplica,
                        v.adelanto_monto,
                        v.adelanto_metodo,
                        v.estado_venta,
                        v.estado_pago,
                        v.estado_pedido,
                        v.notas,
                        user["username"],
                    ),
                )
                new_id = cur.fetchone()[0]

                for pago in pagos_validados:
                    cur.execute(
                        """
                        INSERT INTO core.venta_pagos (
                            venta_id, metodo, monto, referencia, created_by
                        )
                        VALUES (%s, %s, %s, %s, %s);
                        """,
                        (
                            new_id,
                            pago["metodo"],
                            pago["monto"],
                            pago["referencia"],
                            user["username"],
                        ),
                    )

                inventario_descontado: list[dict[str, Any]] = []
                for producto in productos_validados:
                    if producto["controla_stock"]:
                        cur.execute(
                            """
                            UPDATE core.productos
                            SET stock = stock - %s, updated_at = NOW()
                            WHERE producto_id = %s
                              AND sucursal_id = %s;
                            """,
                            (
                                producto["cantidad"],
                                producto["producto_id"],
                                v.sucursal_id,
                            ),
                        )
                        cur.execute(
                            """INSERT INTO core.inventario_movimientos (
                                 sucursal_id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
                                 fuente_tipo, fuente_id, notas, created_by
                               ) VALUES (%s, %s, 'venta', %s, %s, %s, 'venta', %s, %s, %s);""",
                            (
                                v.sucursal_id,
                                producto["producto_id"],
                                -producto["cantidad"],
                                producto["stock_actual"],
                                producto["stock_actual"] - producto["cantidad"],
                                new_id,
                                f"Venta #{new_id}",
                                user["username"],
                            ),
                        )
                    cur.execute(
                        """
                        INSERT INTO core.venta_detalles (
                            venta_id, producto_id, cantidad, precio_unitario, subtotal, costo_unitario
                        )
                        VALUES (%s, %s, %s, %s, %s, %s);
                        """,
                        (
                            new_id,
                            producto["producto_id"],
                            producto["cantidad"],
                            producto["precio_unitario"],
                            producto["subtotal"],
                            producto["costo_unitario"],
                        ),
                    )
                    inventario_descontado.append(
                        {
                            "producto_id": producto["producto_id"],
                            "sku": producto["sku"],
                            "cantidad": producto["cantidad"],
                            "stock_restante": (
                                producto["stock_actual"] - producto["cantidad"]
                                if producto["controla_stock"]
                                else None
                            ),
                        }
                    )
            conn.commit()
        return {
            "venta_id": new_id,
            "subtotal": float(subtotal_venta),
            "descuento_porcentaje": float(descuento_porcentaje),
            "descuento_monto": float(descuento_monto),
            "monto_total": float(monto_total),
            "monto_pagado": float(monto_pagado),
            "saldo_pendiente": float(monto_total - monto_pagado),
            "estado_venta": v.estado_venta,
            "estado_pago": v.estado_pago,
            "estado_pedido": v.estado_pedido,
            "plazo_meses": v.plazo_meses,
            "inventario_descontado": inventario_descontado,
        }
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
    if v.monto_total is None or float(v.monto_total) < 0:
        raise HTTPException(status_code=400, detail="Monto total no puede ser negativo.")
    v.compra = normalize_compra_tokens(v.compra)
    v.metodo_pago = normalize_metodos_pago(v.metodo_pago)
    v.estado_venta = normalize_controlled_token(v.estado_venta)
    v.estado_pago = normalize_controlled_token(v.estado_pago)
    v.estado_pedido = normalize_controlled_token(v.estado_pedido)
    if v.estado_venta and v.estado_venta not in VENTA_ESTADO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_venta inválido.")
    if v.estado_pago and v.estado_pago not in VENTA_ESTADO_PAGO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_pago inválido.")
    if v.estado_pedido and v.estado_pedido not in VENTA_ESTADO_PEDIDO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_pedido inválido.")
    v.forma_liquidacion = normalize_controlled_token(v.forma_liquidacion)
    if not v.forma_liquidacion:
        v.forma_liquidacion = "adelanto_apartado" if v.adelanto_aplica else "pago_completo"
    if v.forma_liquidacion not in VENTA_FORMA_LIQUIDACION_ALLOWED:
        raise HTTPException(status_code=400, detail="forma_liquidacion inválida.")
    if v.forma_liquidacion in {"meses_sin_intereses", "meses_con_intereses"}:
        if v.plazo_meses not in VENTA_PLAZO_MESES_ALLOWED:
            raise HTTPException(
                status_code=400,
                detail="Selecciona un plazo de 3, 6, 9, 12, 18 o 24 meses.",
            )
    else:
        v.plazo_meses = None
    v.adelanto_aplica = v.forma_liquidacion in {"adelanto_apartado", "pago_mixto"}
    if v.adelanto_aplica:
        if v.adelanto_monto is None or float(v.adelanto_monto) <= 0:
            raise HTTPException(status_code=400, detail="adelanto_monto debe ser mayor a 0.")
        v.adelanto_metodo = normalize_controlled_token(v.adelanto_metodo)
        if (v.adelanto_metodo or "").strip() not in VENTA_METODO_PAGO_ALLOWED:
            raise HTTPException(status_code=400, detail="adelanto_metodo inválido.")
    else:
        v.adelanto_monto = None
        v.adelanto_metodo = None
    if v.productos:
        raise HTTPException(
            status_code=400,
            detail="El inventario de una venta existente no se modifica desde esta operación.",
        )
    if v.pagos is not None:
        raise HTTPException(
            status_code=400,
            detail="Los pagos de una venta existente se registran por separado.",
        )
    descuento_porcentaje = Decimal(str(v.descuento_porcentaje or 0))
    if descuento_porcentaje < 0 or descuento_porcentaje > 100:
        raise HTTPException(status_code=400, detail="descuento_porcentaje debe estar entre 0 y 100.")
    descuento_monto = Decimal(str(v.descuento_monto or 0)).quantize(Decimal("0.01"))
    if descuento_monto < 0:
        raise HTTPException(status_code=400, detail="descuento_monto no puede ser negativo.")
    if descuento_porcentaje > 0 and descuento_monto > 0:
        raise HTTPException(
            status_code=400,
            detail="Usa un descuento por porcentaje o por monto, no ambos.",
        )
    v.descuento_motivo, v.cupon_tipo = normalize_datos_descuento(
        descuento_porcentaje,
        descuento_monto,
        v.descuento_motivo,
        v.cupon_tipo,
    )
    subtotal_venta = Decimal(str(v.subtotal if v.subtotal is not None else v.monto_total or 0))
    if descuento_monto > subtotal_venta:
        raise HTTPException(
            status_code=400,
            detail="El descuento en pesos no puede ser mayor al subtotal.",
        )
    descuento_calculado = (
        descuento_monto
        if descuento_monto > 0
        else subtotal_venta * descuento_porcentaje / Decimal("100")
    ).quantize(Decimal("0.01"))
    monto_total = (subtotal_venta - descuento_calculado).quantize(Decimal("0.01"))

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT p.categoria, p.subcategoria, p.tipo_mica
                    FROM core.venta_detalles vd
                    JOIN core.ventas venta ON venta.venta_id = vd.venta_id
                    JOIN core.productos p ON p.producto_id = vd.producto_id
                    WHERE vd.venta_id = %s
                      AND venta.sucursal_id = %s
                    ORDER BY vd.venta_detalle_id;
                    """,
                    (venta_id, v.sucursal_id),
                )
                productos_existentes = cur.fetchall()
                if productos_existentes and user["rol"] != "admin":
                    raise HTTPException(
                        status_code=403,
                        detail="Solo administradores pueden editar una venta ligada al inventario.",
                    )
                compra_tokens_actualizados = set(split_pipe_tokens(v.compra))
                if any(
                    not _inventory_product_matches_purchase(
                        categoria,
                        subcategoria,
                        tipo_mica,
                        compra_tokens_actualizados,
                    )
                    for categoria, subcategoria, tipo_mica in productos_existentes
                ):
                    raise HTTPException(
                        status_code=400,
                        detail="La opción de compra no corresponde con el producto ligado a esta venta.",
                    )

                cur.execute(
                    """
                    SELECT 1
                    FROM core.pacientes
                    WHERE paciente_id = %s
                      AND sucursal_id = %s
                      AND activo = true;
                    """,
                    (v.paciente_id, v.sucursal_id),
                )
                if cur.fetchone() is None:
                    raise HTTPException(
                        status_code=400,
                        detail="Paciente no existe/activo en esa sucursal.",
                    )

                cur.execute(
                    """
                    UPDATE core.ventas
                    SET paciente_id = %s,
                        compra = %s,
                        subtotal = %s,
                        descuento_porcentaje = %s,
                        descuento_monto = %s,
                        descuento_motivo = %s,
                        cupon_tipo = %s,
                        monto_total = %s,
                        metodo_pago = %s,
                        forma_liquidacion = %s,
                        plazo_meses = %s,
                        adelanto_aplica = %s,
                        adelanto_monto = %s,
                        adelanto_metodo = %s,
                        estado_venta = COALESCE(%s, estado_venta),
                        estado_pago = COALESCE(%s, estado_pago),
                        estado_pedido = COALESCE(%s, estado_pedido),
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
                        subtotal_venta,
                        descuento_porcentaje,
                        descuento_monto,
                        v.descuento_motivo,
                        v.cupon_tipo,
                        monto_total,
                        v.metodo_pago,
                        v.forma_liquidacion,
                        v.plazo_meses,
                        v.adelanto_aplica,
                        v.adelanto_monto,
                        v.adelanto_metodo,
                        v.estado_venta,
                        v.estado_pago,
                        v.estado_pedido,
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


@app.put("/ventas/{venta_id}/edicion-completa", summary="Editar productos, pagos e importes de una venta")
def editar_venta_completa(venta_id: int, v: VentaCreate, user=Depends(get_current_user)):
    require_roles(user, ("admin",))
    v.sucursal_id = force_sucursal(user, v.sucursal_id)
    productos_input = list(v.productos or [])
    pagos_input = list(v.pagos or [])
    sanitize_model_strings(v)

    if v.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")
    if not v.compra or not v.compra.strip():
        raise HTTPException(status_code=400, detail="Compra es obligatoria.")
    if not productos_input:
        raise HTTPException(status_code=400, detail="La venta debe conservar al menos un producto.")

    v.compra = normalize_compra_tokens(v.compra)
    compra_tokens = set(split_pipe_tokens(v.compra))
    v.estado_venta = normalize_controlled_token(v.estado_venta) or "confirmada"
    v.estado_pedido = normalize_controlled_token(v.estado_pedido) or "pendiente_fabricacion"
    estado_pago_solicitado = normalize_controlled_token(v.estado_pago)
    if v.estado_venta not in VENTA_ESTADO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_venta inválido.")
    if v.estado_pedido not in VENTA_ESTADO_PEDIDO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_pedido inválido.")
    if estado_pago_solicitado and estado_pago_solicitado not in VENTA_ESTADO_PAGO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_pago inválido.")

    v.forma_liquidacion = normalize_controlled_token(v.forma_liquidacion) or "pago_completo"
    if v.forma_liquidacion not in VENTA_FORMA_LIQUIDACION_ALLOWED:
        raise HTTPException(status_code=400, detail="forma_liquidacion inválida.")
    if v.forma_liquidacion in {"meses_sin_intereses", "meses_con_intereses"}:
        if v.plazo_meses not in VENTA_PLAZO_MESES_ALLOWED:
            raise HTTPException(status_code=400, detail="Selecciona un plazo válido para el financiamiento.")
    else:
        v.plazo_meses = None

    descuento_porcentaje = Decimal(str(v.descuento_porcentaje or 0))
    descuento_monto = Decimal(str(v.descuento_monto or 0)).quantize(Decimal("0.01"))
    if descuento_porcentaje < 0 or descuento_porcentaje > 100:
        raise HTTPException(status_code=400, detail="descuento_porcentaje debe estar entre 0 y 100.")
    if descuento_monto < 0:
        raise HTTPException(status_code=400, detail="descuento_monto no puede ser negativo.")
    if descuento_porcentaje > 0 and descuento_monto > 0:
        raise HTTPException(status_code=400, detail="Usa porcentaje o monto fijo, no ambos.")
    v.descuento_motivo, v.cupon_tipo = normalize_datos_descuento(
        descuento_porcentaje,
        descuento_monto,
        v.descuento_motivo,
        v.cupon_tipo,
    )

    productos_solicitados: dict[int, int] = {}
    for item in productos_input:
        producto_id = int(item.producto_id)
        cantidad = int(item.cantidad)
        if producto_id <= 0 or cantidad <= 0:
            raise HTTPException(status_code=400, detail="Producto y cantidad inválidos.")
        productos_solicitados[producto_id] = productos_solicitados.get(producto_id, 0) + cantidad

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT venta_id
                    FROM core.ventas
                    WHERE venta_id = %s AND sucursal_id = %s AND activo = true
                    FOR UPDATE;
                    """,
                    (venta_id, v.sucursal_id),
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Venta no existe o está inactiva.")

                cur.execute(
                    """
                    SELECT 1 FROM core.pacientes
                    WHERE paciente_id = %s AND sucursal_id = %s AND activo = true;
                    """,
                    (v.paciente_id, v.sucursal_id),
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=400, detail="Paciente no existe/activo en esa sucursal.")

                cur.execute(
                    "SELECT producto_id, cantidad FROM core.venta_detalles WHERE venta_id = %s FOR UPDATE;",
                    (venta_id,),
                )
                cantidades_anteriores = {int(row[0]): int(row[1] or 0) for row in cur.fetchall()}
                ids_productos = sorted(set(cantidades_anteriores) | set(productos_solicitados))
                catalogo: dict[int, dict[str, Any]] = {}
                for producto_id in ids_productos:
                    cur.execute(
                        """
                        SELECT nombre, sku, modelo, color, precio, stock, categoria,
                               subcategoria, tipo_mica, controla_stock, activo, imagen_url, costo_unitario
                        FROM core.productos
                        WHERE producto_id = %s AND sucursal_id = %s
                        FOR UPDATE;
                        """,
                        (producto_id, v.sucursal_id),
                    )
                    row = cur.fetchone()
                    if row is None:
                        raise HTTPException(status_code=404, detail=f"Producto #{producto_id} no existe.")
                    catalogo[producto_id] = {
                        "producto_id": producto_id,
                        "nombre": row[0],
                        "sku": row[1],
                        "modelo": row[2],
                        "color": row[3],
                        "precio": Decimal(str(row[4] or 0)),
                        "stock": int(row[5] or 0),
                        "categoria": row[6],
                        "subcategoria": row[7],
                        "tipo_mica": row[8],
                        "controla_stock": row[9] is True,
                        "activo": row[10] is True,
                        "imagen_url": row[11],
                        "costo_unitario": Decimal(str(row[12] or 0)),
                    }

                productos_validados: list[dict[str, Any]] = []
                subtotal_venta = Decimal("0.00")
                for producto_id in sorted(productos_solicitados):
                    producto = catalogo[producto_id]
                    cantidad = productos_solicitados[producto_id]
                    if not producto["activo"]:
                        raise HTTPException(status_code=400, detail=f"{producto['nombre']} ya no está activo.")
                    if not _inventory_product_matches_purchase(
                        producto["categoria"], producto["subcategoria"], producto["tipo_mica"], compra_tokens
                    ):
                        raise HTTPException(
                            status_code=400,
                            detail=f"{producto['nombre']} no corresponde con la selección de compra.",
                        )
                    diferencia = cantidad - cantidades_anteriores.get(producto_id, 0)
                    if producto["controla_stock"] and diferencia > producto["stock"]:
                        raise HTTPException(
                            status_code=409,
                            detail=f"Stock insuficiente para {producto['nombre']}. Disponible adicional: {producto['stock']}.",
                        )
                    subtotal_producto = producto["precio"] * cantidad
                    subtotal_venta += subtotal_producto
                    productos_validados.append(
                        {**producto, "cantidad": cantidad, "subtotal": subtotal_producto}
                    )

                tratamientos = [
                    producto for producto in productos_validados
                    if normalize_controlled_token(producto["categoria"]) == "micas"
                    and normalize_controlled_token(producto["subcategoria"]) == "tratamiento"
                ]
                if len(tratamientos) > 1:
                    raise HTTPException(status_code=400, detail="Solo se permite un tratamiento o tinte.")

                subtotal_venta = subtotal_venta.quantize(Decimal("0.01"))
                if descuento_monto > subtotal_venta:
                    raise HTTPException(status_code=400, detail="El descuento supera el subtotal.")
                descuento_calculado = (
                    descuento_monto
                    if descuento_monto > 0
                    else subtotal_venta * descuento_porcentaje / Decimal("100")
                ).quantize(Decimal("0.01"))
                monto_total = (subtotal_venta - descuento_calculado).quantize(Decimal("0.01"))

                cur.execute(
                    """
                    SELECT pago_id, metodo, monto, referencia, created_at
                    FROM core.venta_pagos
                    WHERE venta_id = %s AND activo = true
                    ORDER BY created_at, pago_id
                    FOR UPDATE;
                    """,
                    (venta_id,),
                )
                pagos_anteriores = list(cur.fetchall())
                pagos_por_id = {int(row[0]): row for row in pagos_anteriores}
                ids_recibidos: set[int] = set()
                pagos_finales: list[tuple[Any, ...]] = []

                for pago in pagos_input:
                    metodo = normalize_controlled_token(pago.metodo)
                    monto_pago = Decimal(str(pago.monto)).quantize(Decimal("0.01"))
                    if metodo not in VENTA_METODO_PAGO_ALLOWED:
                        raise HTTPException(status_code=400, detail="Método de pago inválido.")
                    if monto_pago <= 0:
                        raise HTTPException(status_code=400, detail="Cada pago debe ser mayor a 0.")
                    referencia = (pago.referencia or "").strip() or None
                    pago_id = int(pago.pago_id) if pago.pago_id is not None else None
                    if pago_id is not None:
                        if pago_id in ids_recibidos or pago_id not in pagos_por_id:
                            raise HTTPException(status_code=400, detail="Pago inválido o repetido.")
                        ids_recibidos.add(pago_id)
                        cur.execute(
                            """
                            UPDATE core.venta_pagos
                            SET metodo = %s, monto = %s, referencia = %s
                            WHERE pago_id = %s AND venta_id = %s AND activo = true
                            RETURNING pago_id, metodo, monto, referencia, created_at;
                            """,
                            (metodo, monto_pago, referencia, pago_id, venta_id),
                        )
                    else:
                        cur.execute(
                            """
                            INSERT INTO core.venta_pagos (venta_id, metodo, monto, referencia, created_by)
                            VALUES (%s, %s, %s, %s, %s)
                            RETURNING pago_id, metodo, monto, referencia, created_at;
                            """,
                            (venta_id, metodo, monto_pago, referencia, user["username"]),
                        )
                    pagos_finales.append(cur.fetchone())

                ids_quitados = set(pagos_por_id) - ids_recibidos
                if ids_quitados:
                    cur.execute(
                        "UPDATE core.venta_pagos SET activo = false WHERE venta_id = %s AND pago_id = ANY(%s::bigint[]);",
                        (venta_id, sorted(ids_quitados)),
                    )
                pagos_finales.sort(key=lambda row: (row[4], row[0]))
                monto_pagado = sum(
                    (Decimal(str(row[2] or 0)) for row in pagos_finales), Decimal("0.00")
                ).quantize(Decimal("0.01"))
                if monto_pagado > monto_total:
                    raise HTTPException(status_code=400, detail="El total pagado supera el nuevo total de la venta.")

                if estado_pago_solicitado == "reembolsada":
                    estado_pago = "reembolsada"
                elif monto_pagado <= 0:
                    estado_pago = "sin_pago"
                elif monto_pagado >= monto_total:
                    estado_pago = "pagada"
                elif len(pagos_finales) == 1:
                    estado_pago = "anticipo"
                else:
                    estado_pago = "pago_parcial"
                metodos = list(dict.fromkeys(str(row[1]) for row in pagos_finales))
                metodo_pago = "|".join(metodos) if metodos else "efectivo"
                tiene_plan = v.forma_liquidacion in {"meses_sin_intereses", "meses_con_intereses"}
                if estado_pago == "pagada":
                    forma_liquidacion = v.forma_liquidacion if tiene_plan else ("pago_mixto" if len(metodos) > 1 else "pago_completo")
                    adelanto_aplica, adelanto_monto, adelanto_metodo = False, None, None
                elif monto_pagado > 0:
                    forma_liquidacion = v.forma_liquidacion if tiene_plan else "adelanto_apartado"
                    adelanto_aplica = True
                    adelanto_monto = monto_pagado
                    adelanto_metodo = metodos[0] if len(metodos) == 1 else None
                else:
                    forma_liquidacion = v.forma_liquidacion
                    adelanto_aplica, adelanto_monto, adelanto_metodo = False, None, None

                for producto_id in ids_productos:
                    producto = catalogo[producto_id]
                    diferencia = productos_solicitados.get(producto_id, 0) - cantidades_anteriores.get(producto_id, 0)
                    if producto["controla_stock"] and diferencia != 0:
                        cur.execute(
                            "UPDATE core.productos SET stock = stock - %s, updated_at = NOW() WHERE producto_id = %s AND sucursal_id = %s;",
                            (diferencia, producto_id, v.sucursal_id),
                        )
                        cur.execute(
                            """INSERT INTO core.inventario_movimientos (
                                 sucursal_id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
                                 fuente_tipo, fuente_id, notas, created_by
                               ) VALUES (%s, %s, 'edicion_venta', %s, %s, %s, 'venta', %s, %s, %s);""",
                            (
                                v.sucursal_id,
                                producto_id,
                                -diferencia,
                                producto["stock"],
                                producto["stock"] - diferencia,
                                venta_id,
                                f"Edición de venta #{venta_id}",
                                user["username"],
                            ),
                        )
                cur.execute("DELETE FROM core.venta_detalles WHERE venta_id = %s;", (venta_id,))
                for producto in productos_validados:
                    cur.execute(
                        """
                        INSERT INTO core.venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal, costo_unitario)
                        VALUES (%s, %s, %s, %s, %s, %s);
                        """,
                        (venta_id, producto["producto_id"], producto["cantidad"], producto["precio"], producto["subtotal"], producto["costo_unitario"]),
                    )

                cur.execute(
                    """
                    UPDATE core.ventas
                    SET paciente_id = %s, compra = %s, subtotal = %s,
                        descuento_porcentaje = %s, descuento_monto = %s,
                        descuento_motivo = %s, cupon_tipo = %s, monto_total = %s,
                        metodo_pago = %s, forma_liquidacion = %s, plazo_meses = %s,
                        adelanto_aplica = %s, adelanto_monto = %s, adelanto_metodo = %s,
                        estado_venta = %s, estado_pago = %s, estado_pedido = %s,
                        notas = %s, updated_at = NOW()
                    WHERE venta_id = %s AND sucursal_id = %s AND activo = true;
                    """,
                    (
                        v.paciente_id, v.compra, subtotal_venta, descuento_porcentaje,
                        descuento_monto, v.descuento_motivo, v.cupon_tipo, monto_total,
                        metodo_pago, forma_liquidacion, v.plazo_meses, adelanto_aplica,
                        adelanto_monto, adelanto_metodo, v.estado_venta, estado_pago,
                        v.estado_pedido, v.notas, venta_id, v.sucursal_id,
                    ),
                )
            conn.commit()

        return {
            "venta_id": venta_id,
            "updated": True,
            "subtotal": float(subtotal_venta),
            "descuento_porcentaje": float(descuento_porcentaje),
            "descuento_monto": float(descuento_monto),
            "monto_total": float(monto_total),
            "monto_pagado": float(monto_pagado),
            "saldo_pendiente": float(max(Decimal("0.00"), monto_total - monto_pagado)),
            "metodo_pago": metodo_pago,
            "forma_liquidacion": forma_liquidacion,
            "estado_venta": v.estado_venta,
            "estado_pago": estado_pago,
            "estado_pedido": v.estado_pedido,
            "notas": v.notas,
            "pagos": [
                {
                    "pago_id": int(row[0]), "metodo": row[1], "monto": float(row[2] or 0),
                    "referencia": row[3], "fecha_hora": str(row[4]) if row[4] else None,
                }
                for row in pagos_finales
            ],
            "productos": [
                {
                    "producto_id": producto["producto_id"], "sku": producto["sku"],
                    "categoria": producto["categoria"], "subcategoria": producto["subcategoria"],
                    "nombre": producto["nombre"], "modelo": producto["modelo"],
                    "color": producto["color"], "tipo_mica": producto["tipo_mica"],
                    "imagen_url": producto["imagen_url"], "cantidad": producto["cantidad"],
                    "precio_unitario": float(producto["precio"]), "subtotal": float(producto["subtotal"]),
                }
                for producto in productos_validados
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/ventas/{venta_id}/seguimiento", summary="Actualizar seguimiento y pagos de una venta")
def actualizar_seguimiento_venta(
    venta_id: int,
    data: VentaSeguimientoUpdate,
    user=Depends(get_current_user),
):
    require_roles(user, ("admin", "recepcion", "doctor"))
    data.sucursal_id = force_sucursal(user, data.sucursal_id)
    nuevo_pago_input = data.nuevo_pago
    sanitize_model_strings(data)
    if user["rol"] == "admin" and data.sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

    estado_venta = normalize_controlled_token(data.estado_venta)
    estado_pago_solicitado = normalize_controlled_token(data.estado_pago)
    estado_pedido = normalize_controlled_token(data.estado_pedido)
    if estado_venta not in VENTA_ESTADO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_venta inválido.")
    if estado_pago_solicitado not in VENTA_ESTADO_PAGO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_pago inválido.")
    if estado_pedido not in VENTA_ESTADO_PEDIDO_ALLOWED:
        raise HTTPException(status_code=400, detail="estado_pedido inválido.")
    if nuevo_pago_input is not None and estado_venta in {"cancelada", "devuelta"}:
        raise HTTPException(
            status_code=400,
            detail="No se puede registrar un pago nuevo en una venta cancelada o devuelta.",
        )
    if nuevo_pago_input is not None and estado_pago_solicitado == "reembolsada":
        raise HTTPException(
            status_code=400,
            detail="No se puede registrar un pago nuevo y marcarlo como reembolsado al mismo tiempo.",
        )

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  monto_total,
                  forma_liquidacion,
                  adelanto_aplica,
                  adelanto_monto,
                  metodo_pago,
                  adelanto_metodo
                FROM core.ventas
                WHERE venta_id = %s
                  AND sucursal_id = %s
                  AND activo = true
                FOR UPDATE;
                """,
                (venta_id, data.sucursal_id),
            )
            venta_row = cur.fetchone()
            if venta_row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Venta no existe en esa sucursal o está inactiva.",
                )
            monto_total = Decimal(str(venta_row[0] or 0)).quantize(Decimal("0.01"))
            forma_liquidacion_actual = normalize_controlled_token(venta_row[1]) or "pago_completo"
            adelanto_legacy = bool(venta_row[2])
            adelanto_monto_legacy = Decimal(str(venta_row[3] or 0)).quantize(Decimal("0.01"))
            metodo_pago_legacy = normalize_metodos_pago(venta_row[4] or "efectivo")
            adelanto_metodo_legacy = normalize_controlled_token(venta_row[5])

            cur.execute(
                """
                SELECT pago_id, metodo, monto, referencia, created_at
                FROM core.venta_pagos
                WHERE venta_id = %s
                  AND activo = true
                ORDER BY created_at, pago_id
                FOR UPDATE;
                """,
                (venta_id,),
            )
            pagos_rows = list(cur.fetchall())
            if not pagos_rows:
                monto_legacy = adelanto_monto_legacy if adelanto_legacy else monto_total
                if monto_legacy > 0:
                    metodo_legacy = (
                        adelanto_metodo_legacy
                        if adelanto_metodo_legacy in VENTA_METODO_PAGO_ALLOWED
                        else split_pipe_tokens(metodo_pago_legacy)[0]
                        if split_pipe_tokens(metodo_pago_legacy)
                        else "efectivo"
                    )
                    cur.execute(
                        """
                        INSERT INTO core.venta_pagos (
                            venta_id, metodo, monto, referencia, created_by
                        )
                        VALUES (%s, %s, %s, NULL, %s)
                        RETURNING pago_id, metodo, monto, referencia, created_at;
                        """,
                        (venta_id, metodo_legacy, monto_legacy, user["username"]),
                    )
                    pagos_rows.append(cur.fetchone())

            if nuevo_pago_input is not None:
                metodo_nuevo = normalize_controlled_token(nuevo_pago_input.metodo)
                if metodo_nuevo not in VENTA_METODO_PAGO_ALLOWED:
                    raise HTTPException(status_code=400, detail="Método de pago inválido.")
                monto_nuevo = Decimal(str(nuevo_pago_input.monto)).quantize(Decimal("0.01"))
                if monto_nuevo <= 0:
                    raise HTTPException(status_code=400, detail="El pago nuevo debe ser mayor a 0.")
                monto_pagado_actual = sum(
                    (Decimal(str(row[2] or 0)) for row in pagos_rows),
                    Decimal("0.00"),
                )
                if monto_pagado_actual + monto_nuevo > monto_total:
                    raise HTTPException(
                        status_code=400,
                        detail="El pago nuevo es mayor que el saldo por pagar.",
                    )
                cur.execute(
                    """
                    INSERT INTO core.venta_pagos (
                        venta_id, metodo, monto, referencia, created_by
                    )
                    VALUES (%s, %s, %s, NULL, %s)
                    RETURNING pago_id, metodo, monto, referencia, created_at;
                    """,
                    (venta_id, metodo_nuevo, monto_nuevo, user["username"]),
                )
                pagos_rows.append(cur.fetchone())

            monto_pagado = sum(
                (Decimal(str(row[2] or 0)) for row in pagos_rows),
                Decimal("0.00"),
            ).quantize(Decimal("0.01"))
            saldo_pendiente = max(Decimal("0.00"), monto_total - monto_pagado)

            if estado_pago_solicitado == "reembolsada":
                estado_pago = "reembolsada"
            elif monto_pagado <= 0:
                if estado_pago_solicitado != "sin_pago":
                    raise HTTPException(
                        status_code=400,
                        detail="Sin pagos registrados, el estado debe ser Sin pago.",
                    )
                estado_pago = "sin_pago"
            elif saldo_pendiente <= 0:
                if estado_pago_solicitado != "pagada":
                    raise HTTPException(
                        status_code=400,
                        detail="La venta está liquidada; el estado de pago debe ser Pagada.",
                    )
                estado_pago = "pagada"
            else:
                if estado_pago_solicitado not in {"anticipo", "pago_parcial"}:
                    raise HTTPException(
                        status_code=400,
                        detail="La venta aún tiene saldo; usa Anticipo o Pago parcial.",
                    )
                estado_pago = estado_pago_solicitado

            metodos = list(dict.fromkeys(str(row[1]) for row in pagos_rows))
            metodo_pago = "|".join(metodos) if metodos else "efectivo"
            if estado_pago == "pagada":
                forma_liquidacion = (
                    forma_liquidacion_actual
                    if forma_liquidacion_actual in {"meses_sin_intereses", "meses_con_intereses"}
                    else "pago_mixto"
                    if len(metodos) > 1
                    else "pago_completo"
                )
                adelanto_aplica = False
                adelanto_monto = None
                adelanto_metodo = None
            elif monto_pagado > 0:
                forma_liquidacion = (
                    forma_liquidacion_actual
                    if forma_liquidacion_actual in {"meses_sin_intereses", "meses_con_intereses"}
                    else "adelanto_apartado"
                )
                adelanto_aplica = True
                adelanto_monto = monto_pagado
                adelanto_metodo = metodos[0] if len(metodos) == 1 else None
            else:
                forma_liquidacion = forma_liquidacion_actual
                adelanto_aplica = False
                adelanto_monto = None
                adelanto_metodo = None

            cur.execute(
                """
                UPDATE core.ventas
                SET estado_venta = %s,
                    estado_pago = %s,
                    estado_pedido = %s,
                    metodo_pago = %s,
                    forma_liquidacion = %s,
                    adelanto_aplica = %s,
                    adelanto_monto = %s,
                    adelanto_metodo = %s,
                    notas = %s,
                    updated_at = NOW()
                WHERE venta_id = %s
                  AND sucursal_id = %s
                  AND activo = true;
                """,
                (
                    estado_venta,
                    estado_pago,
                    estado_pedido,
                    metodo_pago,
                    forma_liquidacion,
                    adelanto_aplica,
                    adelanto_monto,
                    adelanto_metodo,
                    data.notas,
                    venta_id,
                    data.sucursal_id,
                ),
            )
            sync_physical_sale_jobs(
                cur, venta_id, username=user["username"],
                reason="seguimiento_pago",
            )
        conn.commit()

    return {
        "venta_id": venta_id,
        "estado_venta": estado_venta,
        "estado_pago": estado_pago,
        "estado_pedido": estado_pedido,
        "metodo_pago": metodo_pago,
        "forma_liquidacion": forma_liquidacion,
        "monto_pagado": float(monto_pagado),
        "saldo_pendiente": float(saldo_pendiente),
        "notas": data.notas,
        "pagos": [
            {
                "pago_id": int(row[0]),
                "metodo": row[1],
                "monto": float(row[2] or 0),
                "referencia": row[3],
                "fecha_hora": str(row[4]) if row[4] else None,
            }
            for row in pagos_rows
        ],
    }


@app.delete("/ventas/{venta_id}", summary="Cancelar venta sin eliminar registros")
def eliminar_venta(venta_id: int, sucursal_id: int, user=Depends(get_current_user)):
    require_roles(user, ("admin", "recepcion", "doctor"))
    sucursal_id = force_sucursal(user, sucursal_id)
    if user["rol"] == "admin" and sucursal_id is None:
        raise HTTPException(status_code=400, detail="Sucursal es requerida.")

    with psycopg.connect(DB_CONNINFO) as check_conn:
        with check_conn.cursor() as check_cur:
            check_cur.execute(
                "SELECT 1 FROM core.venta_catalogo_contextos WHERE venta_id = %s;",
                (venta_id,),
            )
            is_phase1b = check_cur.fetchone() is not None
    if is_phase1b:
        if user["rol"] != "admin":
            raise HTTPException(status_code=403, detail="Solo administración puede cancelar esta venta.")
        return _phase1b_cancel_sale_scope(
            venta_id,
            VentaCancelacionFase1BIn(
                sucursal_id=sucursal_id,
                alcance="venta",
                motivo="Cancelación total confirmada desde el resumen de ventas",
            ),
            user,
        )

    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT venta_id
                FROM core.ventas
                WHERE venta_id = %s
                  AND sucursal_id = %s
                  AND activo = true
                FOR UPDATE;
                """,
                (venta_id, sucursal_id),
            )
            venta_row = cur.fetchone()
            if venta_row is None:
                raise HTTPException(status_code=404, detail="Venta no existe en esa sucursal.")

            cur.execute(
                """
                SELECT 1
                FROM core.venta_detalles
                WHERE venta_id = %s
                LIMIT 1;
                """,
                (venta_id,),
            )
            if cur.fetchone() is not None and user["rol"] != "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Solo administradores pueden eliminar una venta ligada al inventario.",
                )

            detalles_restaurados = _restore_inventory_for_sales(
                cur,
                [venta_id],
                sucursal_id,
                user["username"],
            )
            cur.execute(
                """
                UPDATE core.ventas
                SET activo = false,
                    estado_venta = 'cancelada',
                    estado_pedido = 'cancelado',
                    updated_at = NOW()
                WHERE venta_id = %s
                  AND sucursal_id = %s
                RETURNING venta_id
                """,
                (venta_id, sucursal_id),
            )
            row = cur.fetchone()
        conn.commit()
    return {
        "cancelled_venta_id": row[0],
        "hard_deleted": False,
        "inventory_lines_restored": detalles_restaurados,
    }


@app.get("/estadisticas/resumen", summary="Resumen estadístico por sucursal")
def estadisticas_resumen(
    sucursal_id: str | None = None,
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
    reporting_scope, branch_id = _resolve_reporting_scope(user, sucursal_id)
    if reporting_scope == "online" and user.get("rol") not in {"admin", "contador"}:
        raise HTTPException(status_code=403, detail="Sin permiso para consultar Estadísticas en línea.")
    sucursal_id = branch_id
    sales_scope = _report_scope_sql("v", reporting_scope, branch_id)
    physical_scope_c = "TRUE" if reporting_scope == "general" else "FALSE" if reporting_scope == "online" else f"c.sucursal_id = {int(branch_id)}"
    physical_scope_v = "TRUE" if reporting_scope == "general" else "FALSE" if reporting_scope == "online" else f"v.sucursal_id = {int(branch_id)}"
    physical_scope_p = "TRUE" if reporting_scope == "general" else "FALSE" if reporting_scope == "online" else f"p.sucursal_id = {int(branch_id)}"

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
                FROM core.consultas c
                WHERE activo = true
                  AND {physical_scope_c}
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                  {c_patient_sql};
                """,
                (fecha_desde, fecha_hasta, *c_patient_params),
            )
            c_total, c_no_show = cur.fetchone()

            cur.execute(
                f"""
                SELECT
                  COUNT(*)::int AS total,
                  COALESCE(SUM(monto_total), 0)::numeric AS monto_total
                FROM core.ventas v
                WHERE activo = true
                  AND {sales_scope}
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                  {v_patient_sql};
                """,
                (fecha_desde, fecha_hasta, *v_patient_params),
            )
            v_total, v_monto_total = cur.fetchone()

            cur.execute(
                f"""
                SELECT DATE(fecha_hora) AS dia, COUNT(*)::int
                FROM core.consultas c
                WHERE activo = true
                  AND {physical_scope_c}
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                  {c_patient_sql}
                GROUP BY DATE(fecha_hora)
                ORDER BY dia;
                """,
                (fecha_desde, fecha_hasta, *c_patient_params),
            )
            consultas_dia_rows = cur.fetchall()

            cur.execute(
                f"""
                SELECT DATE(fecha_hora) AS dia, COUNT(*)::int
                FROM core.ventas v
                WHERE activo = true
                  AND {sales_scope}
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                  {v_patient_sql}
                GROUP BY DATE(fecha_hora)
                ORDER BY dia;
                """,
                (fecha_desde, fecha_hasta, *v_patient_params),
            )
            ventas_dia_rows = cur.fetchall()

            cur.execute(
                f"""
                SELECT
                  COALESCE(NULLIF(LOWER(TRIM(metodo_pago)), ''), 'sin_metodo') AS etiqueta,
                  COUNT(*)::int AS total
                FROM core.ventas v
                WHERE activo = true
                  AND {sales_scope}
                  AND DATE(fecha_hora) BETWEEN %s AND %s
                  {v_patient_sql}
                GROUP BY etiqueta
                ORDER BY total DESC, etiqueta ASC;
                """,
                (fecha_desde, fecha_hasta, *v_patient_params),
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
                    AND {physical_scope_c}
                    AND DATE(c.fecha_hora) BETWEEN %s AND %s
                    {c_patient_sql}
                ) t
                WHERE item <> ''
                GROUP BY item
                ORDER BY total DESC, etiqueta ASC
                LIMIT 10;
                """,
                (fecha_desde, fecha_hasta, *c_patient_params),
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
                    AND {sales_scope}
                    AND DATE(v.fecha_hora) BETWEEN %s AND %s
                    {v_patient_sql}
                ) t
                WHERE item <> ''
                GROUP BY producto
                ORDER BY total DESC, producto ASC
                LIMIT 10;
                """,
                (fecha_desde, fecha_hasta, *v_patient_params),
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
                f"""
                SELECT
                  v.paciente_id,
                  CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno) AS paciente_nombre,
                  COUNT(*)::int AS total_ventas,
                  COALESCE(SUM(v.monto_total), 0)::numeric AS monto_total
                FROM core.ventas v
                JOIN core.pacientes p ON p.paciente_id = v.paciente_id
                WHERE v.activo = true
                  AND p.activo = true
                  AND {sales_scope}
                  AND DATE(v.fecha_hora) BETWEEN %s AND %s
                  {top_mes_extra_sql}
                GROUP BY v.paciente_id, paciente_nombre
                ORDER BY monto_total DESC, total_ventas DESC, paciente_nombre ASC
                LIMIT 10;
                """.format(top_mes_extra_sql=top_mes_extra_sql),
                (mes_actual_desde, mes_actual_hasta, *top_mes_extra_params),
            )
            top_pacientes_mes_actual_rows = cur.fetchall()

            top_consultas_extra_sql = ""
            top_consultas_extra_params: list[Any] = []
            if q_name:
                top_consultas_extra_sql = "AND CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno) ILIKE %s"
                top_consultas_extra_params.append(q_like)
            cur.execute(
                f"""
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
                  AND {physical_scope_c}
                  AND DATE(c.fecha_hora) BETWEEN %s AND %s
                  {top_consultas_extra_sql}
                GROUP BY c.paciente_id, paciente_nombre
                ORDER BY total_consultas DESC, paciente_nombre ASC
                LIMIT 10;
                """.format(top_consultas_extra_sql=top_consultas_extra_sql),
                (fecha_desde, fecha_hasta, *top_consultas_extra_params),
            )
            top_pacientes_consultas_rows = cur.fetchall()

            pacientes_modo_clean = (pacientes_modo or "mes").strip().lower()
            if pacientes_modo_clean not in {"dia", "semana", "mes", "anio", "rango"}:
                raise HTTPException(status_code=400, detail="pacientes_modo inválido. Usa: dia, semana, mes, anio o rango.")

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
            if pacientes_modo_clean == "anio":
                cur.execute(
                    f"""
                    SELECT EXTRACT(MONTH FROM p.creado_en)::int AS mes_idx, COUNT(*)::int AS total
                    FROM core.pacientes p
                    WHERE p.activo = true
                      AND {physical_scope_p}
                      AND EXTRACT(YEAR FROM p.creado_en) = %s
                      {p_extra_sql}
                    GROUP BY mes_idx
                    ORDER BY mes_idx;
                    """,
                    (p_anio, *p_extra_params),
                )
                rows = cur.fetchall()
                month_map = {int(r[0]): int(r[1]) for r in rows}
                meses_label = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
                pacientes_series = [
                    {"etiqueta": meses_label[idx - 1], "total": int(month_map.get(idx, 0))}
                    for idx in range(1, 13)
                ]
                pacientes_label = f"Pacientes creados por mes ({p_anio})"
            elif pacientes_modo_clean == "mes":
                _, last_day = calendar.monthrange(p_anio, p_mes)
                p_desde = date(p_anio, p_mes, 1)
                p_hasta = date(p_anio, p_mes, last_day)
                cur.execute(
                    f"""
                    SELECT DATE(p.creado_en) AS dia, COUNT(*)::int AS total
                    FROM core.pacientes p
                    WHERE p.activo = true
                      AND {physical_scope_p}
                      AND DATE(p.creado_en) BETWEEN %s AND %s
                      {p_extra_sql}
                    GROUP BY dia
                    ORDER BY dia;
                    """,
                    (p_desde, p_hasta, *p_extra_params),
                )
                day_map = {str(r[0]): int(r[1]) for r in cur.fetchall()}
                pacientes_series = [
                    {"etiqueta": str(day), "total": int(day_map.get(str(day), 0))}
                    for day in (p_desde + timedelta(days=offset) for offset in range(last_day))
                ]
                pacientes_label = f"Pacientes creados por día ({p_mes:02d}/{p_anio})"
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
                      AND {physical_scope_p}
                      AND DATE(p.creado_en) = %s
                      {p_extra_sql}
                    ;
                    """,
                    (p_fecha, *p_extra_params),
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
                      AND {physical_scope_p}
                      AND DATE(p.creado_en) BETWEEN %s AND %s
                      {p_extra_sql}
                    GROUP BY dia
                    ORDER BY dia;
                    """,
                    (p_desde, p_hasta, *p_extra_params),
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
                      AND {physical_scope_p}
                      AND DATE(p.creado_en) BETWEEN %s AND %s
                      {p_extra_sql}
                    GROUP BY dia
                    ORDER BY dia;
                    """,
                    (p_desde, p_hasta, *p_extra_params),
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
                f"""
                SELECT EXTRACT(MONTH FROM v.fecha_hora)::int AS mes_idx, COALESCE(SUM(v.monto_total), 0)::numeric AS total
                FROM core.ventas v
                WHERE v.activo = true
                  AND {sales_scope}
                  AND EXTRACT(YEAR FROM v.fecha_hora) = %s
                GROUP BY mes_idx
                ORDER BY mes_idx;
                """,
                (series_year,),
            )
            ingresos_rows = cur.fetchall()

            cur.execute(
                f"""
                SELECT EXTRACT(MONTH FROM c.fecha_hora)::int AS mes_idx, COUNT(*)::int AS total
                FROM core.consultas c
                WHERE c.activo = true
                  AND {physical_scope_c}
                  AND EXTRACT(YEAR FROM c.fecha_hora) = %s
                GROUP BY mes_idx
                ORDER BY mes_idx;
                """,
                (series_year,),
            )
            consultas_mensuales_rows = cur.fetchall()

            cur.execute(
                f"""
                SELECT EXTRACT(MONTH FROM v.fecha_hora)::int AS mes_idx, COUNT(*)::int AS total
                FROM core.ventas v
                WHERE v.activo = true
                  AND {sales_scope}
                  AND EXTRACT(YEAR FROM v.fecha_hora) = %s
                GROUP BY mes_idx
                ORDER BY mes_idx;
                """,
                (series_year,),
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
    tz_name = _timezone_for_sucursal(sucursal_id) if sucursal_id is not None else None
    search_tz = tz_name or "America/Mexico_City"
    fecha_hora_local_expr = (
        f"DATE(v.fecha_hora AT TIME ZONE '{tz_name}')"
        if tz_name
        else "DATE(v.fecha_hora)"
    )
    year_expr = (
        f"EXTRACT(YEAR FROM v.fecha_hora AT TIME ZONE '{tz_name}')"
        if tz_name
        else "EXTRACT(YEAR FROM v.fecha_hora)"
    )
    month_expr = (
        f"EXTRACT(MONTH FROM v.fecha_hora AT TIME ZONE '{tz_name}')"
        if tz_name
        else "EXTRACT(MONTH FROM v.fecha_hora)"
    )

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
        where.append(f"{fecha_hora_local_expr} BETWEEN %s AND %s")
        params.extend([fecha_desde, fecha_hasta])
    elif fecha_desde:
        where.append(f"{fecha_hora_local_expr} >= %s")
        params.append(fecha_desde)
    elif fecha_hasta:
        where.append(f"{fecha_hora_local_expr} <= %s")
        params.append(fecha_hasta)
    elif anio is not None and mes is not None:
        where.append(f"{year_expr} = %s")
        where.append(f"{month_expr} = %s")
        params.extend([anio, mes])
    elif anio is not None:
        where.append(f"{year_expr} = %s")
        params.append(anio)
    else:
        # Si hay texto de búsqueda, no limitar automáticamente a "hoy"
        if not (q and q.strip()):
            if tz_name:
                hoy_local = datetime.now(ZoneInfo(tz_name)).date()
                where.append(f"{fecha_hora_local_expr} = %s")
                params.append(hoy_local)
            else:
                where.append("DATE(v.fecha_hora) = CURRENT_DATE")

    if q and q.strip():
        qq = f"%{q.strip()}%"
        where.append(
            """
            (
              CAST(v.consulta_id AS TEXT) ILIKE %s
              OR COALESCE(v.paciente_nombre, '') ILIKE %s
              OR CONCAT_WS(' ', v.doctor_primer_nombre, v.doctor_apellido_paterno) ILIKE %s
              OR COALESCE(v.etapa_consulta, '') ILIKE %s
              OR COALESCE(v.motivo_consulta, '') ILIKE %s
              OR TO_CHAR(v.fecha_hora AT TIME ZONE '{search_tz}', 'YYYY-MM-DD HH24:MI') ILIKE %s
            )
            """.format(search_tz=search_tz)
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
                   diabetes_estado, diabetes_control, diabetes_anios, diabetes_tratamiento, diabetes_tratamiento_otro,
                   usa_lentes, tipo_lentes_actual, lentes_actuales_detalle, tiempo_uso_lentes,
                   lentes_contacto_horas_dia, lentes_contacto_dias_semana, sintomas,
                   uso_lentes_proteccion_uv, uso_lentes_sol_frecuencia,
                   fotofobia_escala, dolor_ocular_escala, cefalea_frecuencia,
                   trabajo_cerca_horas_dia, distancia_promedio_pantalla_cm, iluminacion_trabajo,
                   flotadores_destellos, flotadores_lateralidad,
                   horas_exterior_dia, uso_lentes_sol_horas_dia,
                   usa_lentes_manejar_dia, tipo_lentes_manejar_dia, tratamientos_lentes_manejar_dia,
                   usa_lentes_manejar_noche, tipo_lentes_manejar_noche, tratamientos_lentes_manejar_noche,
                   nivel_educativo, horas_lectura_dia, lee_libros,
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
            if is_missing_value(payload.get("diagnostico_principal")):
                raise HTTPException(
                    status_code=400,
                    detail="diagnostico_principal es obligatorio al crear historia clínica.",
                )

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
    agenda_calendar_id: str | None = None
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

                busy_consultas = _fetch_busy_intervals_consultas(
                    sucursal_id=c.sucursal_id,
                    start_dt=agenda_start,
                    end_dt=agenda_end,
                )
                if _has_overlap(agenda_start, agenda_end, busy_consultas):
                    raise HTTPException(
                        status_code=409,
                        detail="El horario seleccionado ya no está disponible (consulta ya registrada).",
                    )
                if calendar_enabled:
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

                if calendar_enabled and agenda_start and agenda_end:
                    doctor_nombre = " ".join(
                        [
                            x
                            for x in [c.doctor_primer_nombre, c.doctor_apellido_paterno]
                            if x and str(x).strip()
                        ]
                    )
                    agenda_event_id, agenda_calendar_id = _create_calendar_event_for_consulta(
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
                            SET agenda_event_id = %s,
                                agenda_calendar_id = %s
                            WHERE consulta_id = %s
                              AND sucursal_id = %s
                            """,
                            (agenda_event_id, agenda_calendar_id, new_id, c.sucursal_id),
                        )

            conn.commit()

        return {
            "consulta_id": new_id,
            "agenda_event_id": agenda_event_id,
            "agenda_calendar_id": agenda_calendar_id,
        }

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
    RETURNING consulta_id, agenda_event_id, agenda_calendar_id;
    """

    try:
        with psycopg.connect(DB_CONNINFO) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (consulta_id, sucursal_id))
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Consulta no existe en esa sucursal.")
                agenda_event_id = row[1]
                agenda_calendar_id = row[2]
                if agenda_event_id:
                    _delete_calendar_event_for_consulta(
                        sucursal_id=sucursal_id,
                        event_id=str(agenda_event_id),
                        calendar_id_hint=str(agenda_calendar_id) if agenda_calendar_id else None,
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
                cur.execute(
                    """
                    SELECT paciente_id
                    FROM core.pacientes
                    WHERE paciente_id = %s
                      AND sucursal_id = %s
                    FOR UPDATE;
                    """,
                    (paciente_id, sucursal_id),
                )
                if cur.fetchone() is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Paciente no existe en esa sucursal.",
                    )

                # Consultas ligadas para borrar también evento en Google Calendar.
                cur.execute(
                    """
                    SELECT consulta_id, agenda_event_id, agenda_calendar_id
                    FROM core.consultas
                    WHERE paciente_id = %s
                      AND sucursal_id = %s;
                    """,
                    (paciente_id, sucursal_id),
                )
                consultas_rows = cur.fetchall()
                calendar_deleted = 0
                for _, agenda_event_id, agenda_calendar_id in consultas_rows:
                    if agenda_event_id:
                        try:
                            _delete_calendar_event_for_consulta(
                                sucursal_id=sucursal_id,
                                event_id=str(agenda_event_id),
                                calendar_id_hint=str(agenda_calendar_id) if agenda_calendar_id else None,
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
                    SELECT venta_id
                    FROM core.ventas
                    WHERE paciente_id = %s
                      AND sucursal_id = %s
                    ORDER BY venta_id
                    FOR UPDATE;
                    """,
                    (paciente_id, sucursal_id),
                )
                venta_ids = [int(venta_id) for (venta_id,) in cur.fetchall()]
                inventario_lineas_restauradas = _restore_inventory_for_sales(
                    cur,
                    venta_ids,
                    sucursal_id,
                    user["username"],
                )

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
                "inventory_lines_restored": inventario_lineas_restauradas,
                "calendar_events_deleted": calendar_deleted,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    




    
