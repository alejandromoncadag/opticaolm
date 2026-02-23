#!/usr/bin/env python3
from __future__ import annotations

import os
from datetime import datetime, timezone

import psycopg
from passlib.hash import argon2


DB_CONNINFO = os.getenv(
    "DB_CONNINFO",
    "host=localhost port=5432 dbname=eyecare user=alejandromoncadag",
)
SEED_ADMIN_USERNAME = os.getenv("SEED_ADMIN_USERNAME", "admin").strip() or "admin"
SEED_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "Opticaolm@admin2026!")
SEED_ADMIN_RESET_PASSWORD = os.getenv("SEED_ADMIN_RESET_PASSWORD", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def seed_sucursales(cur: psycopg.Cursor) -> None:
    sucursales = [
        (1, "Óptica OLM - Estado de México", "OLM_EDOMEX_01", "Cuautitlán", "MEX", True),
        (2, "Óptica OLM - Playa del Carmen", "OLM_PLAYA_01", "Playa del Carmen", "Q.R.", True),
    ]
    for row in sucursales:
        cur.execute(
            """
            INSERT INTO core.sucursales (sucursal_id, nombre, codigo, ciudad, estado, activa)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (sucursal_id) DO UPDATE
            SET nombre = EXCLUDED.nombre,
                codigo = EXCLUDED.codigo,
                ciudad = EXCLUDED.ciudad,
                estado = EXCLUDED.estado,
                activa = EXCLUDED.activa;
            """,
            row,
        )


def seed_admin(cur: psycopg.Cursor) -> None:
    cur.execute(
        """
        SELECT usuario_id
        FROM core.usuarios
        WHERE username = %s
        LIMIT 1;
        """,
        (SEED_ADMIN_USERNAME,),
    )
    existing = cur.fetchone()

    if existing is None:
        password_hash = argon2.hash(SEED_ADMIN_PASSWORD)
        cur.execute(
            """
            INSERT INTO core.usuarios (
              username,
              password_hash,
              rol,
              sucursal_id,
              activo,
              password_changed_at
            )
            VALUES (%s, %s, 'admin', NULL, true, %s);
            """,
            (SEED_ADMIN_USERNAME, password_hash, datetime.now(timezone.utc)),
        )
        print(f"[OK] admin created ({SEED_ADMIN_USERNAME})")
        return

    if SEED_ADMIN_RESET_PASSWORD:
        password_hash = argon2.hash(SEED_ADMIN_PASSWORD)
        cur.execute(
            """
            UPDATE core.usuarios
            SET password_hash = %s,
                rol = 'admin',
                sucursal_id = NULL,
                activo = true,
                password_changed_at = %s
            WHERE username = %s;
            """,
            (password_hash, datetime.now(timezone.utc), SEED_ADMIN_USERNAME),
        )
        print(f"[OK] admin password reset ({SEED_ADMIN_USERNAME})")
    else:
        cur.execute(
            """
            UPDATE core.usuarios
            SET rol = 'admin',
                sucursal_id = NULL,
                activo = true
            WHERE username = %s;
            """,
            (SEED_ADMIN_USERNAME,),
        )
        print(f"[OK] admin preserved ({SEED_ADMIN_USERNAME})")


def main() -> int:
    with psycopg.connect(DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            seed_sucursales(cur)
            seed_admin(cur)
        conn.commit()

    print("Minimal seed completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
