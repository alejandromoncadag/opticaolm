#!/usr/bin/env python3
"""Verify Phase 1G-D schema, safety boundaries, and queue invariants."""

from __future__ import annotations

from pathlib import Path
import re


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
MIGRATION = SCRIPT_DIR / "migrations" / "20260812_phase1gd_optical_operations.sql"
ROLLBACK = SCRIPT_DIR / "migrations" / "20260812_phase1gd_optical_operations_rollback.sql"
TABLES = ("trabajos_opticos", "trabajo_optico_componentes", "trabajo_optico_eventos")


class VerificationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def verify_source() -> list[str]:
    migration = MIGRATION.read_text(encoding="utf-8")
    rollback = ROLLBACK.read_text(encoding="utf-8")
    forbidden = r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b"
    require(not re.search(forbidden, migration, re.I), "Migration is destructive")
    require(not re.search(forbidden, rollback, re.I), "Rollback is destructive")
    require("BEGIN;" in migration and "COMMIT;" in migration, "Migration is not transactional")
    for table in TABLES:
        require(f"CREATE TABLE core.{table}" in migration, f"Missing {table}")
    require("SET SCHEMA phase1gd_rollback" in rollback, "Rollback does not isolate objects")
    require("app.phase1gd_enabled" in rollback, "Rollback feature guard is absent")
    for forbidden_target in (
        "ALTER TABLE core.online_borradores_opticos",
        "ALTER TABLE core.online_reservas_opticas_borrador",
        "ALTER TABLE core.ventas",
        "ALTER TABLE core.venta_pagos",
        "UPDATE core.catalogo_inventario_sucursal",
    ):
        require(forbidden_target not in migration, f"Migration touches {forbidden_target}")
    return [
        "migration and rollback are transactional and non-destructive",
        "three optical operations tables are declared",
        "rollback isolates only Phase 1G-D objects",
        "source drafts, reservations, sales, payments, and inventory remain unchanged",
    ]


def verify_database(cur) -> list[str]:
    cur.execute(
        """SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'core' AND table_name = ANY(%s)""",
        (list(TABLES),),
    )
    require({row[0] for row in cur.fetchall()} == set(TABLES), "Phase 1G-D tables are incomplete")
    cur.execute(
        """SELECT COUNT(*) FROM core.trabajos_opticos
           WHERE (origen = 'pedido_online') <> (online_borrador_id IS NOT NULL)
              OR (origen = 'venta_fisica') <> (venta_configuracion_id IS NOT NULL)"""
    )
    require(cur.fetchone()[0] == 0, "A queue job has an invalid source")
    cur.execute(
        """SELECT online_borrador_id FROM core.trabajos_opticos
           WHERE online_borrador_id IS NOT NULL GROUP BY online_borrador_id
           HAVING COUNT(*) > 1"""
    )
    require(cur.fetchone() is None, "An online draft maps to multiple jobs")
    cur.execute(
        """SELECT COUNT(*) FROM core.trabajos_opticos
           WHERE estado_produccion <> 'cancelado' AND cancelado_at IS NOT NULL"""
    )
    require(cur.fetchone()[0] == 0, "A non-cancelled job has a cancellation timestamp")
    return [
        "all Phase 1G-D objects exist",
        "job source mappings are valid and unique",
        "production cancellation invariants hold",
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
    print("PHASE 1G-D OPTICAL OPERATIONS VERIFICATION: PASS")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
