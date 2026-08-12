#!/usr/bin/env python3
"""Verify the additive Phase 1G-C optical draft schema and boundaries."""

from __future__ import annotations

from pathlib import Path
import re


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
MIGRATION = SCRIPT_DIR / "migrations" / "20260811_phase1gc_optical_order_drafts.sql"
ROLLBACK = (
    SCRIPT_DIR
    / "migrations"
    / "20260811_phase1gc_optical_order_drafts_rollback.sql"
)
TABLES = (
    "online_borradores_opticos",
    "online_configuraciones_opticas_borrador",
    "online_reservas_opticas_borrador",
    "online_borrador_optico_eventos",
)
VIEW = "online_inventario_reservas_activas"


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
    for table in TABLES:
        require(f"CREATE TABLE core.{table}" in migration, f"Missing {table}")
    require(f"CREATE VIEW core.{VIEW}" in migration, "Missing combined reservation view")
    require("FROM core.online_reserva_lineas" in migration, "B2 reservations are absent from the combined view")
    require("FROM core.online_reservas_opticas_borrador" in migration, "Optical reservations are absent from the combined view")
    require("vigencia_minutos" not in migration, "Phase 1G-C duplicated the B2 reservation lifetime")
    require("stock_reservado = stock_reservado -" in rollback, "Rollback does not release frame reservations")
    for forbidden_table in (
        "core.ventas",
        "core.venta_pagos",
        "core.prescripciones_opticas",
        "core.pacientes",
    ):
        require(forbidden_table not in migration, f"Migration touches {forbidden_table}")
    return [
        "migration and rollback are non-destructive",
        "four optical-specific tables and one combined reservation view are declared",
        "normal B2 and optical reservations share the inventory authority",
        "no sale, payment, patient or clinical prescription table is touched",
    ]


def verify_database(cur) -> list[str]:
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
    require(present == set(TABLES), "Phase 1G-C tables are incomplete")
    cur.execute("SELECT to_regclass(%s)", (f"core.{VIEW}",))
    require(cur.fetchone()[0] is not None, "Combined reservation view is missing")
    cur.execute(
        """
        SELECT COUNT(*)
        FROM core.online_borradores_opticos
        WHERE estado_pago <> 'sin_pago'
        """
    )
    require(cur.fetchone()[0] == 0, "Phase 1G-C contains an unexpected payment status")
    cur.execute(
        """
        SELECT COUNT(*)
        FROM core.online_reservas_opticas_borrador
        WHERE cantidad <> 1
        """
    )
    require(cur.fetchone()[0] == 0, "An optical draft reserves more than one frame")
    return [
        "all Phase 1G-C objects exist",
        "all optical drafts remain payment-neutral",
        "optical reservations are one physical frame each",
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
    print("PHASE 1G-C OPTICAL DRAFT VERIFICATION: PASS")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
