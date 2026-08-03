#!/usr/bin/env python3
from __future__ import annotations

from getpass import getpass
import os
from pathlib import Path
import sys

import psycopg
from dotenv import load_dotenv
from passlib.hash import argon2


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")
sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main  # noqa: E402


def main() -> int:
    username = (
        os.getenv("ADMIN_USER")
        or os.getenv("SEED_ADMIN_USERNAME")
        or "admin"
    ).strip()
    password = getpass("Nueva contraseña del administrador: ")
    confirmation = getpass("Confirma la nueva contraseña: ")

    if not password:
        raise SystemExit("La contraseña no puede estar vacía.")
    if password != confirmation:
        raise SystemExit("Las contraseñas no coinciden.")

    password_hash = argon2.hash(password)
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1
                FROM core.usuarios
                WHERE username = %s
                  AND COALESCE(NULLIF(TRIM(rol), ''), NULLIF(TRIM(role), '')) = 'admin'
                LIMIT 1;
                """,
                (username,),
            )
            if cur.fetchone() is None:
                raise SystemExit("No existe el administrador configurado; no se modificó nada.")

            cur.execute(
                """
                UPDATE core.usuarios
                SET password_hash = %s,
                    password_changed_at = NOW(),
                    pwd_changed_at = NOW()
                WHERE username = %s
                  AND COALESCE(NULLIF(TRIM(rol), ''), NULLIF(TRIM(role), '')) = 'admin';
                """,
                (password_hash, username),
            )
            if cur.rowcount != 1:
                raise SystemExit("El administrador cambió durante el reset; no se modificó nada.")
        conn.commit()

    print("Contraseña del administrador actualizada correctamente.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
