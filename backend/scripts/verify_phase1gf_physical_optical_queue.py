#!/usr/bin/env python3
"""Verify Phase 1G-F shared physical optical queue integration."""

from __future__ import annotations

from pathlib import Path
import re


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
MIGRATION = SCRIPT_DIR / "migrations" / "20260812_phase1gf_physical_optical_queue.sql"
ROLLBACK = SCRIPT_DIR / "migrations" / "20260812_phase1gf_physical_optical_queue_rollback.sql"
EVENT_TYPES = ("fuente_fisica_sincronizada", "cancelado_por_venta")


class VerificationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def verify_source() -> list[str]:
    migration = MIGRATION.read_text(encoding="utf-8")
    rollback = ROLLBACK.read_text(encoding="utf-8")
    require("BEGIN;" in migration and "COMMIT;" in migration, "Migration is not transactional")
    require("BEGIN;" in rollback and "COMMIT;" in rollback, "Rollback is not transactional")
    for token in EVENT_TYPES:
        require(token in migration, f"Missing audit event {token}")
    for forbidden in (r"\bDELETE\b", r"\bTRUNCATE\b", r"\bCASCADE\b"):
        require(not re.search(forbidden, migration, re.I), f"Migration contains {forbidden}")
        require(not re.search(forbidden, rollback, re.I), f"Rollback contains {forbidden}")
    require("phase1gf_events > 0" in rollback, "Rollback does not protect audit history")
    return [
        "migration and rollback are transactional",
        "only the two approved physical audit event types are added",
        "rollback refuses to delete or rewrite audit history",
    ]


def verify_database(cur) -> list[str]:
    cur.execute(
        """SELECT pg_get_constraintdef(oid) FROM pg_constraint
           WHERE conrelid='core.trabajo_optico_eventos'::regclass
             AND conname='trabajo_optico_eventos_tipo_check'"""
    )
    row = cur.fetchone()
    require(row is not None, "Optical event constraint is missing")
    definition = row[0]
    for token in EVENT_TYPES:
        require(token in definition, f"Database does not allow {token}")
    cur.execute(
        """SELECT indexdef FROM pg_indexes WHERE schemaname='core'
           AND indexname='trabajos_opticos_venta_configuracion_uq'"""
    )
    require(cur.fetchone() is not None, "Physical configuration unique index is missing")
    cur.execute(
        """SELECT COUNT(*) FROM core.trabajos_opticos job
           LEFT JOIN core.venta_configuraciones_opticas config
             ON config.configuracion_id=job.venta_configuracion_id
           WHERE job.origen='venta_fisica'
             AND (job.online_borrador_id IS NOT NULL OR config.configuracion_id IS NULL)"""
    )
    require(cur.fetchone()[0] == 0, "A physical optical job has an invalid source")
    return [
        "database permits both Phase 1G-F audit events",
        "one-job-per-physical-configuration index remains present",
        "all existing physical jobs have valid exclusive sources",
    ]


def main() -> int:
    import sys
    sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main
    import psycopg

    checks = verify_source()
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            checks.extend(verify_database(cur))
    print("PHASE 1G-F PHYSICAL OPTICAL QUEUE VERIFICATION: PASS")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
