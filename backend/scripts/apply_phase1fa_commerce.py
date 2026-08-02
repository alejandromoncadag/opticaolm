#!/usr/bin/env python3
"""Apply Phase 1F-A atomically while fingerprinting operational data."""

from __future__ import annotations

import re
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION_PATH = (
    SCRIPT_DIR / "migrations" / "20260802_phase1fa_authoritative_commerce.sql"
)
FORBIDDEN_COMMANDS = re.compile(
    r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", re.IGNORECASE
)
PROTECTED_TABLES = (
    "productos",
    "ventas",
    "venta_detalles",
    "venta_pagos",
    "inventario_movimientos",
    "catalogo_productos",
    "catalogo_inventario_sucursal",
    "catalogo_inventario_movimientos",
)


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    sys.path.insert(0, str(SCRIPT_DIR))

    import main as backend_main
    import psycopg
    from verify_phase1a_catalog import PHASE1A_TABLES, fingerprint_table
    from verify_phase1b_optical_sales import verify_phase1b
    from verify_phase1fa_commerce import (
        PHASE1FA_TABLES,
        VerificationError,
        verify_phase1fa,
    )

    migration_sql = MIGRATION_PATH.read_text(encoding="utf-8")
    forbidden = FORBIDDEN_COMMANDS.search(migration_sql)
    if forbidden:
        raise SystemExit(
            f"Migration contains prohibited command: {forbidden.group(0).upper()}"
        )

    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL lock_timeout = '15s'")
                table_list = ", ".join(f"core.{name}" for name in PROTECTED_TABLES)
                cur.execute(f"LOCK TABLE {table_list} IN SHARE MODE")
                before = {
                    name: fingerprint_table(cur, name) for name in PROTECTED_TABLES
                }
                cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'core' AND table_name = ANY(%s)
                    """,
                    (list(PHASE1A_TABLES),),
                )
                if {row[0] for row in cur.fetchall()} != set(PHASE1A_TABLES):
                    raise VerificationError("Phase 1A catalog schema is incomplete")
                verify_phase1b(cur)

                cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'core'
                      AND table_name = ANY(%s)
                    ORDER BY table_name
                    """,
                    (list(PHASE1FA_TABLES),),
                )
                existing = {row[0] for row in cur.fetchall()}

                if existing:
                    if existing != set(PHASE1FA_TABLES):
                        raise VerificationError(
                            "Partial Phase 1F-A schema found; migration stopped immediately"
                        )
                    checks = verify_phase1fa(cur)
                    print("[OK] Existing Phase 1F-A schema passes verification")
                else:
                    cur.execute(migration_sql)
                    checks = verify_phase1fa(cur, require_conservative=True)
                    print("[OK] Phase 1F-A migration executed in one transaction")

                after = {
                    name: fingerprint_table(cur, name) for name in PROTECTED_TABLES
                }
                if before != after:
                    raise VerificationError(
                        "A protected operational table changed; transaction stopped"
                    )

            conn.commit()
        except Exception:
            conn.rollback()
            raise

    print("PHASE 1F-A MIGRATION: COMMITTED")
    for check in checks:
        print(f"  [OK] {check}")
    print("PROTECTED OPERATIONAL TABLES: UNCHANGED")
    for name in PROTECTED_TABLES:
        item = before[name]
        print(
            f"  [OK] core.{name}: rows={item['rows']} "
            f"data={item['data_sha256']} schema={item['schema_sha256']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
