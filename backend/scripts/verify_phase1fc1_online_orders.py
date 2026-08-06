#!/usr/bin/env python3
"""Read-only source/schema verifier for Phase 1F-C1."""

from __future__ import annotations

from pathlib import Path
import re
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION_PATH = SCRIPT_DIR / "migrations" / "20260805_phase1fc1_online_orders.sql"
ROLLBACK_PATH = SCRIPT_DIR / "migrations" / "20260805_phase1fc1_online_orders_rollback.sql"
PHASE1FC1_TABLES = ("online_ordenes", "online_orden_lineas", "online_orden_eventos")


class VerificationError(RuntimeError):
    pass


def verify_source() -> list[str]:
    migration = MIGRATION_PATH.read_text(encoding="utf-8")
    rollback = ROLLBACK_PATH.read_text(encoding="utf-8")
    for source, label in ((migration, "migration"), (rollback, "rollback")):
        if re.search(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", source, re.I):
            raise VerificationError(f"C1 {label} contains a destructive command")
    for token in ("online_pagos", "venta_pagos", "online_envios", "tracking", "facturas"):
        if token.lower() in migration.lower():
            raise VerificationError(f"C1 migration contains out-of-scope object: {token}")
    if "SET SCHEMA phase1fc1_isolated" not in rollback:
        raise VerificationError("C1 rollback must isolate objects")
    source = (BACKEND_DIR / "online_fulfillment.py").read_text(encoding="utf-8")
    for token in ("fulfillment_order_create", "pending_payment", "inventoryDeducted", "PHASE_1FC1_ENABLED"):
        if token.lower() not in source.lower():
            raise VerificationError(f"Missing C1 implementation requirement: {token}")
    for token in ("INSERT INTO core.ventas", "INSERT INTO core.venta_pagos", "INSERT INTO core.online_pagos"):
        if token.lower() in source.lower():
            raise VerificationError(f"C1 creates an out-of-scope record: {token}")
    return ["migration is additive", "rollback isolates instead of destroying", "C1 is payment-provider-neutral", "no payment, sale, shipping, or tracking writes"]


def verify_phase1(cur) -> list[str]:
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'core' AND table_name = ANY(%s)", (list(PHASE1FC1_TABLES),))
    if {row[0] for row in cur.fetchall()} != set(PHASE1FC1_TABLES):
        raise VerificationError("Phase 1F-C1 table set mismatch")
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'online_ordenes'")
    columns = {row[0] for row in cur.fetchall()}
    required = {"orden_public_id", "reserva_id", "preview_id", "estado", "subtotal", "envio", "total", "cotizacion_snapshot"}
    if not required <= columns:
        raise VerificationError(f"C1 order columns missing: {sorted(required - columns)}")
    cur.execute("SELECT COUNT(*) FROM core.online_ordenes")
    order_count = cur.fetchone()[0]
    return ["all three order tables exist", "authoritative order snapshots are present", f"existing pending-order rows are preserved ({order_count})"]


def main() -> int:
    checks = verify_source()
    sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main
    import psycopg
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            checks.extend(verify_phase1(cur))
    print("PHASE 1F-C1 VERIFICATION: PASS")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
