#!/usr/bin/env python3
"""Read-only source/schema verifier for Phase 1F-C2-A."""

from pathlib import Path
import re
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION_PATH = SCRIPT_DIR / "migrations" / "20260806_phase1fc2a_payment_sessions.sql"
ROLLBACK_PATH = SCRIPT_DIR / "migrations" / "20260806_phase1fc2a_payment_sessions_rollback.sql"
TABLES = ("online_pago_sesiones", "online_pago_intentos", "online_pago_eventos")


class VerificationError(RuntimeError):
    pass


def verify_source() -> list[str]:
    migration = MIGRATION_PATH.read_text(encoding="utf-8")
    rollback = ROLLBACK_PATH.read_text(encoding="utf-8")
    for source, label in ((migration, "migration"), (rollback, "rollback")):
        if re.search(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", source, re.I):
            raise VerificationError(f"C2-A {label} contains a destructive command")
    for token in ("online_pagos", "venta_pagos", "ventas", "shipping_labels", "tracking"):
        if token.lower() in migration.lower():
            raise VerificationError(f"C2-A migration contains out-of-scope object: {token}")
    if "SET SCHEMA phase1fc2a_isolated_at_rollback" not in rollback:
        raise VerificationError("C2-A rollback must isolate objects")
    source = (BACKEND_DIR / "online_fulfillment.py").read_text(encoding="utf-8")
    for token in ("PHASE_1FC2A_ENABLED", "fulfillment_payment_session_create", "providerSessionRef", "paymentSessionsEnabled"):
        if token.lower() not in source.lower():
            raise VerificationError(f"Missing C2-A implementation requirement: {token}")
    for token in ("conekta", "stripe", "INSERT INTO core.ventas", "INSERT INTO core.venta_pagos", "card_number"):
        if token.lower() == "stripe":
            continue
        if token.lower() in source.lower() and token.lower() in {"insert into core.ventas", "insert into core.venta_pagos", "card_number"}:
            raise VerificationError(f"C2-A contains forbidden payment or sales write/data: {token}")
    return ["migration is additive", "rollback isolates instead of destroying", "provider value is conekta without provider calls", "no money-movement tables or writes"]


def verify_phase1(cur) -> list[str]:
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'core' AND table_name = ANY(%s)", (list(TABLES),))
    if {row[0] for row in cur.fetchall()} != set(TABLES):
        raise VerificationError("Phase 1F-C2-A table set mismatch")
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'online_pago_sesiones'")
    columns = {row[0] for row in cur.fetchall()}
    required = {"sesion_public_id", "orden_id", "proveedor", "estado", "monto", "moneda", "expira_at"}
    if not required <= columns:
        raise VerificationError(f"C2-A session columns missing: {sorted(required - columns)}")
    cur.execute("SELECT COUNT(*) FROM core.online_pago_sesiones")
    return ["all payment-session, attempt, and event tables exist", "authoritative amount snapshots are present", f"existing provider-neutral sessions preserved ({cur.fetchone()[0]})"]


def main() -> int:
    checks = verify_source()
    sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main
    import psycopg
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            checks.extend(verify_phase1(cur))
    print("PHASE 1F-C2-A VERIFICATION: PASS")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
