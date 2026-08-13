#!/usr/bin/env python3
"""Apply and verify the additive Phase 1G-F audit-event migration."""

from __future__ import annotations

from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION = SCRIPT_DIR / "migrations" / "20260812_phase1gf_physical_optical_queue.sql"


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    sys.path.insert(0, str(SCRIPT_DIR))
    import main as backend_main
    import psycopg
    from verify_phase1gf_physical_optical_queue import verify_database, verify_source

    verify_source()
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL lock_timeout='15s'")
                cur.execute(MIGRATION.read_text(encoding="utf-8"))
                checks = verify_database(cur)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    print("PHASE 1G-F MIGRATION: COMMITTED")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
