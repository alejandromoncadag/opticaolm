#!/usr/bin/env python3
"""Apply the additive Phase 1A migration with protected legacy fingerprints."""

from __future__ import annotations

import re
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
MIGRATION_PATH = (
    Path(__file__).resolve().parent
    / "migrations"
    / "20260801_phase1a_global_catalog.sql"
)
FORBIDDEN_COMMANDS = re.compile(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", re.IGNORECASE)


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    sys.path.insert(0, str(Path(__file__).resolve().parent))

    import main as backend_main
    import psycopg
    from verify_phase1a_catalog import (
        LEGACY_TABLES,
        PHASE1A_TABLES,
        VerificationError,
        fingerprint_legacy_tables,
        verify_catalog,
        verify_media,
    )

    migration_sql = MIGRATION_PATH.read_text(encoding="utf-8")
    forbidden = FORBIDDEN_COMMANDS.search(migration_sql)
    if forbidden:
        raise SystemExit(
            f"Migration contains prohibited command: {forbidden.group(0).upper()}"
        )

    source_preflight = verify_media(require_destination=False)
    print(f"[OK] Source media preflight: {len(source_preflight)} files")

    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL lock_timeout = '15s'")
                legacy_identifiers = ", ".join(f"core.{name}" for name in LEGACY_TABLES)
                cur.execute(f"LOCK TABLE {legacy_identifiers} IN SHARE MODE")

                before = fingerprint_legacy_tables(cur)
                cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'core'
                      AND table_name = ANY(%s)
                    ORDER BY table_name
                    """,
                    (list(PHASE1A_TABLES),),
                )
                existing = {row[0] for row in cur.fetchall()}

                if existing:
                    if existing != set(PHASE1A_TABLES):
                        raise VerificationError(
                            "Partial Phase 1A table set found; migration stopped"
                        )
                    checks = verify_catalog(cur)
                    print("[OK] Existing Phase 1A tables already pass verification")
                else:
                    cur.execute(migration_sql)
                    checks = verify_catalog(cur)
                    print("[OK] Phase 1A migration executed inside protected transaction")

                after = fingerprint_legacy_tables(cur)
                if before != after:
                    raise VerificationError(
                        "A protected operational table changed; transaction stopped"
                    )

            conn.commit()
        except Exception:
            conn.rollback()
            raise

    print("PHASE 1A MIGRATION: COMMITTED")
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
