#!/usr/bin/env python3
"""Verify the additive Phase 1G-E identity/prescription bridge."""

from pathlib import Path
import re

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
MIGRATION = SCRIPT_DIR / "migrations" / "20260812_phase1ge_patient_identity.sql"
ROLLBACK = SCRIPT_DIR / "migrations" / "20260812_phase1ge_patient_identity_rollback.sql"
TABLES = (
    "online_cliente_paciente_link_intentos",
    "online_cliente_paciente_links",
    "prescripcion_optica_acceso_online",
    "online_borrador_optico_prescripciones",
    "online_identidad_eventos",
)

class VerificationError(RuntimeError): pass
def require(value, message):
    if not value: raise VerificationError(message)

def verify_source():
    migration, rollback = MIGRATION.read_text("utf-8"), ROLLBACK.read_text("utf-8")
    require("BEGIN;" in migration and "COMMIT;" in migration, "Migration is not transactional")
    require(not re.search(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", migration, re.I), "Migration is destructive")
    require(not re.search(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", rollback, re.I), "Rollback is destructive")
    for table in TABLES: require(f"CREATE TABLE core.{table}" in migration, f"Missing {table}")
    require("SET SCHEMA phase1ge_rollback" in rollback, "Rollback does not isolate objects")
    require("historias_clinicas" not in migration, "Clinical histories must remain untouched")
    return ["migration is additive and transactional", "rollback is non-destructive", "clinical histories are excluded"]

def verify_database(cur):
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='core' AND table_name=ANY(%s)", (list(TABLES),))
    require({row[0] for row in cur.fetchall()} == set(TABLES), "Phase 1G-E tables are incomplete")
    cur.execute("SELECT COUNT(*) FROM core.online_cliente_paciente_links WHERE estado='activo' GROUP BY cuenta_ref_hash HAVING COUNT(*)>1")
    require(cur.fetchone() is None, "An account has multiple active patient links")
    cur.execute("SELECT COUNT(*) FROM core.online_borrador_optico_prescripciones selection JOIN core.prescripcion_optica_acceso_online access USING (acceso_id) WHERE selection.prescripcion_id<>access.prescripcion_id")
    require(cur.fetchone()[0] == 0, "A draft prescription does not match its approved access")
    return ["all five identity objects exist", "active links are unique", "prescription references are consistent"]

def main():
    import sys; sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main, psycopg
    checks = verify_source()
    with psycopg.connect(backend_main.DB_CONNINFO) as conn, conn.cursor() as cur: checks += verify_database(cur)
    print("PHASE 1G-E IDENTITY VERIFICATION: PASS")
    for check in checks: print(f"  [OK] {check}")
    return 0

if __name__ == "__main__": raise SystemExit(main())
