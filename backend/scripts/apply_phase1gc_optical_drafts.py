#!/usr/bin/env python3
"""Apply and verify the additive Phase 1G-C optical draft schema."""

from __future__ import annotations

from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION = (
    SCRIPT_DIR
    / "migrations"
    / "20260811_phase1gc_optical_order_drafts.sql"
)
TABLES = (
    "online_borradores_opticos",
    "online_configuraciones_opticas_borrador",
    "online_reservas_opticas_borrador",
    "online_borrador_optico_eventos",
)
VIEW = "online_inventario_reservas_activas"


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    sys.path.insert(0, str(SCRIPT_DIR))
    import main as backend_main
    import psycopg
    from verify_phase1gc_optical_drafts import (
        VerificationError,
        verify_database,
        verify_source,
    )

    verify_source()
    migration = MIGRATION.read_text(encoding="utf-8")
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL lock_timeout = '15s'")
                cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'core'
                      AND table_name = ANY(%s)
                    """,
                    (list(TABLES),),
                )
                present = {row[0] for row in cur.fetchall()}
                cur.execute("SELECT to_regclass(%s)", (f"core.{VIEW}",))
                view_present = cur.fetchone()[0] is not None
                if present or view_present:
                    if present != set(TABLES) or not view_present:
                        raise VerificationError(
                            "Partial Phase 1G-C schema found; refusing to modify it"
                        )
                else:
                    cur.execute(migration)
                checks = verify_database(cur)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    print("PHASE 1G-C MIGRATION: COMMITTED")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
