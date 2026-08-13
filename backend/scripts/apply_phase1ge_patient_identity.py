#!/usr/bin/env python3
"""Apply and verify the additive Phase 1G-E schema."""

from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION = SCRIPT_DIR / "migrations" / "20260812_phase1ge_patient_identity.sql"
TABLES = (
    "online_cliente_paciente_link_intentos", "online_cliente_paciente_links",
    "prescripcion_optica_acceso_online", "online_borrador_optico_prescripciones",
    "online_identidad_eventos",
)

def main():
    sys.path[:0] = [str(BACKEND_DIR), str(SCRIPT_DIR)]
    import main as backend_main, psycopg
    from verify_phase1ge_patient_identity import VerificationError, verify_database, verify_source
    verify_source()
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL lock_timeout='15s'")
                cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='core' AND table_name=ANY(%s)", (list(TABLES),))
                present = {row[0] for row in cur.fetchall()}
                if present and present != set(TABLES): raise VerificationError("Partial Phase 1G-E schema found; refusing to modify it")
                if not present: cur.execute(MIGRATION.read_text("utf-8"))
                checks = verify_database(cur)
            conn.commit()
        except Exception: conn.rollback(); raise
    print("PHASE 1G-E MIGRATION: COMMITTED")
    for check in checks: print(f"  [OK] {check}")
    return 0

if __name__ == "__main__": raise SystemExit(main())
