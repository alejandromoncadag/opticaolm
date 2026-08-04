#!/usr/bin/env python3
"""Read-only source/schema verifier for Phase 1F-B2."""

from __future__ import annotations

from pathlib import Path
import re
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION_PATH = SCRIPT_DIR / "migrations" / "20260803_phase1fb2_online_reservations.sql"
ROLLBACK_PATH = SCRIPT_DIR / "migrations" / "20260803_phase1fb2_online_reservations_rollback.sql"
PHASE1FB2_TABLES = ("online_reserva_configuracion", "online_reservas", "online_reserva_lineas", "online_reserva_eventos")


class VerificationError(RuntimeError):
    pass


def verify_source() -> list[str]:
    migration = MIGRATION_PATH.read_text(encoding="utf-8")
    rollback = ROLLBACK_PATH.read_text(encoding="utf-8")
    if re.search(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", migration, re.I):
        raise VerificationError("B2 migration contains a destructive command")
    if re.search(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", rollback, re.I):
        raise VerificationError("B2 rollback contains a destructive command")
    required = ("stock_reservado", "FOR UPDATE", "SKIP LOCKED", "vigencia_minutos INTEGER NOT NULL DEFAULT 20")
    source = (migration + "\n" + (BACKEND_DIR / "online_fulfillment.py").read_text(encoding="utf-8"))
    for token in required:
        if token.lower() not in source.lower():
            raise VerificationError(f"Missing B2 requirement: {token}")
    forbidden = ("online_ordenes", "online_pagos", "tracking_number", "shipping_label")
    for token in forbidden:
        if token.lower() in migration.lower():
            raise VerificationError(f"Out-of-scope B2 object: {token}")
    if "SET SCHEMA phase1fb2_isolated" not in rollback:
        raise VerificationError("B2 rollback must isolate objects")
    return ["migration is additive", "rollback isolates instead of destroying", "reservation lifetime defaults to 20 minutes", "locking and expiry release are present", "no Phase 1F-C objects"]


def verify_phase1fb2(cur) -> list[str]:
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'core' AND table_name = ANY(%s)", (list(PHASE1FB2_TABLES),))
    if {row[0] for row in cur.fetchall()} != set(PHASE1FB2_TABLES):
        raise VerificationError("Phase 1F-B2 table set mismatch")
    cur.execute("SELECT activa, vigencia_minutos FROM core.online_reserva_configuracion WHERE configuracion_id = 1")
    config = cur.fetchone()
    if not config or not config[0] or config[1] != 20:
        raise VerificationError("B2 configuration must be active with 20-minute lifetime")
    cur.execute("SELECT indexname FROM pg_indexes WHERE schemaname = 'core' AND tablename = 'online_reservas'")
    indexes = {row[0] for row in cur.fetchall()}
    if "online_reservas_solicitud_activa_uq" not in indexes:
        raise VerificationError("Active reservation idempotency index is missing")
    return ["all four reservation tables exist", "20-minute configuration is present", "one active reservation per request is enforced", "reservation audit table is present"]


def main() -> int:
    checks = verify_source()
    sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main
    import psycopg
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            checks.extend(verify_phase1fb2(cur))
    print("PHASE 1F-B2 VERIFICATION: PASS")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
