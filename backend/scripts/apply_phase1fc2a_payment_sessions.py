#!/usr/bin/env python3
"""Apply Phase 1F-C2-A provider-neutral payment-session tables."""

from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION_PATH = SCRIPT_DIR / "migrations" / "20260806_phase1fc2a_payment_sessions.sql"
TABLES = ("online_pago_sesiones", "online_pago_intentos", "online_pago_eventos")


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    sys.path.insert(0, str(SCRIPT_DIR))
    import main as backend_main
    import psycopg
    from verify_phase1fc2a_payment_sessions import VerificationError, verify_phase1, verify_source

    verify_source()
    migration = MIGRATION_PATH.read_text(encoding="utf-8")
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL lock_timeout = '15s'")
                cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'core' AND table_name = ANY(%s)", (list(TABLES),))
                existing = {row[0] for row in cur.fetchall()}
                if existing and existing != set(TABLES):
                    raise VerificationError("Partial Phase 1F-C2-A schema found")
                if not existing:
                    cur.execute(migration)
                checks = verify_phase1(cur)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    print("PHASE 1F-C2-A MIGRATION: COMMITTED WITH FEATURE FLAG DISABLED")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
