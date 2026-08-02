#!/usr/bin/env python3
"""Apply Phase 1B transactionally while protecting legacy operational data."""

from __future__ import annotations

import re
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION_PATH = SCRIPT_DIR / "migrations" / "20260801_phase1b_optical_sales.sql"
FORBIDDEN_COMMANDS = re.compile(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", re.IGNORECASE)


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    sys.path.insert(0, str(SCRIPT_DIR))

    import main as backend_main
    import psycopg
    from verify_phase1a_catalog import LEGACY_TABLES, fingerprint_legacy_tables, verify_catalog
    from verify_phase1b_optical_sales import PHASE1B_TABLES, VerificationError, verify_phase1b

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
                legacy_identifiers = ", ".join(f"core.{name}" for name in LEGACY_TABLES)
                cur.execute(f"LOCK TABLE {legacy_identifiers} IN SHARE MODE")
                before = fingerprint_legacy_tables(cur)
                verify_catalog(cur)

                cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'core'
                      AND table_name = ANY(%s)
                    ORDER BY table_name
                    """,
                    (list(PHASE1B_TABLES),),
                )
                existing = {row[0] for row in cur.fetchall()}
                cur.execute(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'core'
                      AND table_name = 'catalogo_productos'
                      AND column_name = 'permite_graduacion'
                    """
                )
                capability_exists = cur.fetchone() is not None

                if existing or capability_exists:
                    if existing != set(PHASE1B_TABLES) or not capability_exists:
                        raise VerificationError(
                            "Partial Phase 1B schema found; migration stopped immediately"
                        )
                    checks = verify_phase1b(cur)
                    print("[OK] Existing Phase 1B schema already passes verification")
                else:
                    cur.execute(migration_sql)
                    checks = verify_phase1b(cur, require_empty=True)
                    print("[OK] Phase 1B migration executed inside protected transaction")

                after = fingerprint_legacy_tables(cur)
                if before != after:
                    raise VerificationError(
                        "A protected operational table changed; transaction stopped"
                    )

            conn.commit()
        except Exception:
            conn.rollback()
            raise

    print("PHASE 1B MIGRATION: COMMITTED")
    for check in checks:
        print(f"  [OK] {check}")
    print("PROTECTED OPERATIONAL TABLES: UNCHANGED")
    for name in LEGACY_TABLES:
        item = before[name]
        print(
            f"  [OK] core.{name}: rows={item['rows']} "
            f"data={item['data_sha256']} schema={item['schema_sha256']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

