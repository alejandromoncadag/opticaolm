"""Create or update the fixed accountant login without storing its password in source."""

from __future__ import annotations

import os
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import main  # noqa: E402


def run() -> None:
    username = os.environ.get("OPTICA_CONTADOR_USERNAME", "").strip()
    password = os.environ.get("OPTICA_CONTADOR_PASSWORD", "")
    if not username or not password:
        raise SystemExit("Faltan OPTICA_CONTADOR_USERNAME y OPTICA_CONTADOR_PASSWORD.")

    password_hash = main.argon2.hash(password)
    with main.psycopg.connect(main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO core.usuarios (
                    username, password_hash, rol, role, sucursal_id, activo,
                    password_changed_at, pwd_changed_at
                )
                VALUES (%s, %s, 'contador', 'contador', NULL, true, NOW(), NOW())
                ON CONFLICT (username) DO UPDATE
                SET password_hash = EXCLUDED.password_hash,
                    rol = 'contador',
                    role = 'contador',
                    sucursal_id = NULL,
                    activo = true,
                    password_changed_at = NOW(),
                    pwd_changed_at = NOW()
                RETURNING username, rol, activo;
                """,
                (username, password_hash),
            )
            row = cur.fetchone()
        conn.commit()

    print(f"Cuenta lista: usuario={row[0]}, rol={row[1]}, activa={bool(row[2])}")


if __name__ == "__main__":
    run()
