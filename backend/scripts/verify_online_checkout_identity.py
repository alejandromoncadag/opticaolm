"""Read-only verification for online checkout identity resolution."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg
from dotenv import dotenv_values


def conninfo() -> str:
    values = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
    direct = values.get("DATABASE_URL") or values.get("DB_CONNINFO")
    if direct:
        return str(direct)
    parts = [
        f"host={values.get('DB_HOST', 'localhost')}",
        f"port={values.get('DB_PORT', '5432')}",
        f"dbname={values.get('DB_NAME', 'eyecare')}",
        f"user={values.get('DB_USER', 'postgres')}",
    ]
    if values.get("DB_PASSWORD"):
        parts.append(f"password={values['DB_PASSWORD']}")
    return " ".join(parts)


def main() -> int:
    required_tables = {"online_guest_email_verifications", "online_identidad_checkout"}
    required_order_columns = {"paciente_id", "identidad_estado", "identidad_resuelta_at"}
    with psycopg.connect(conninfo()) as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT table_name FROM information_schema.tables
               WHERE table_schema='core' AND table_name = ANY(%s)""",
            (list(required_tables),),
        )
        found = {row[0] for row in cur.fetchall()}
        missing = required_tables - found
        if missing:
            print(f"FAIL missing tables: {sorted(missing)}")
            return 1
        cur.execute(
            """SELECT column_name FROM information_schema.columns
               WHERE table_schema='core' AND table_name='online_ordenes'
                 AND column_name = ANY(%s)""",
            (list(required_order_columns),),
        )
        found_columns = {row[0] for row in cur.fetchall()}
        missing_columns = required_order_columns - found_columns
        if missing_columns:
            print(f"FAIL missing order columns: {sorted(missing_columns)}")
            return 1
        cur.execute(
            """SELECT conname FROM pg_constraint
               WHERE conrelid='core.online_ordenes'::regclass
                 AND conname='online_ordenes_identity_state_check'"""
        )
        if cur.fetchone() is None:
            print("FAIL identity state constraint missing")
            return 1
    print("PASS online checkout identity tables, order fields, and state constraint")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
