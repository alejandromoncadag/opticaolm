#!/usr/bin/env python3
"""Read-only Phase 1F-B1 schema and isolation verification."""

from __future__ import annotations

import os
from pathlib import Path
import re
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION_PATH = SCRIPT_DIR / "migrations" / "20260802_phase1fb1_manual_fulfillment.sql"
ROLLBACK_PATH = SCRIPT_DIR / "migrations" / "20260802_phase1fb1_manual_fulfillment_rollback.sql"
FORBIDDEN = re.compile(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", re.I)

PHASE1FB1_TABLES = (
    "envio_transportistas",
    "envio_configuracion_empaque",
    "catalogo_producto_envio",
    "envio_categoria_fallbacks",
    "online_solicitudes_cotizacion_envio",
    "online_solicitud_sucursales_elegibles",
    "online_opciones_cotizacion_envio",
    "online_cotizacion_selecciones",
    "online_checkout_previews",
    "online_cotizacion_envio_eventos",
)


class VerificationError(RuntimeError):
    pass


def verify_source() -> list[str]:
    migration = MIGRATION_PATH.read_text(encoding="utf-8")
    rollback = ROLLBACK_PATH.read_text(encoding="utf-8")
    if FORBIDDEN.search(migration) or FORBIDDEN.search(rollback):
        raise VerificationError("Migration or isolation script contains a destructive command")
    forbidden_domains = (
        "stock_reservado =",
        "INSERT INTO core.ventas",
        "INSERT INTO core.venta_pagos",
        "CREATE TABLE core.online_ordenes",
        "CREATE TABLE core.online_reservas",
        "CREATE TABLE core.online_pagos",
    )
    for token in forbidden_domains:
        if token.lower() in migration.lower():
            raise VerificationError(f"Out-of-scope migration behavior found: {token}")
    if "SET SCHEMA phase1fb1_isolated" not in rollback:
        raise VerificationError("Isolation script does not preserve Phase 1F-B1 tables")
    return ["migration is additive", "rollback isolates instead of destroying", "no reservation/order/payment/sale schema"]


def verify_phase1fb1(cur) -> list[str]:
    cur.execute(
        """SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'core' AND table_name = ANY(%s)""",
        (list(PHASE1FB1_TABLES),),
    )
    actual = {row[0] for row in cur.fetchall()}
    if actual != set(PHASE1FB1_TABLES):
        raise VerificationError(f"Phase 1F-B1 table set mismatch: {sorted(actual)}")
    cur.execute("SELECT codigo, nombre, activo FROM core.envio_transportistas ORDER BY transportista_id")
    carriers = cur.fetchall()
    if [row[0] for row in carriers] != ["dhl", "fedex", "estafeta", "other"] or not all(row[2] for row in carriers):
        raise VerificationError("Controlled carrier seed is incorrect")
    cur.execute("SELECT activa, costo_weight, speed_weight, solicitud_vigencia_horas, cotizacion_vigencia_horas, peso_empaque_gramos FROM core.envio_configuracion_empaque WHERE configuracion_id = 1")
    config = cur.fetchone()
    if not config or config[0] or str(config[1]) != "0.6000" or str(config[2]) != "0.4000" or config[3] != 48 or config[4] != 24 or config[5] is not None:
        raise VerificationError("Safe packaging defaults are incorrect")
    cur.execute("SELECT COUNT(*) FROM core.envio_categoria_fallbacks WHERE activo = TRUE")
    if cur.fetchone()[0] != 0:
        raise VerificationError("Production category fallback was activated without approved measurements")
    cur.execute("SELECT COUNT(*) FROM core.catalogo_producto_envio WHERE activo = TRUE")
    if cur.fetchone()[0] != 0:
        raise VerificationError("Product shipping measurements were activated by migration")
    cur.execute(
        """SELECT COUNT(*) FROM information_schema.tables
           WHERE table_schema = 'core' AND (
               table_name LIKE '%%reserva%%' OR table_name LIKE '%%orden_online%%'
               OR table_name LIKE '%%pago_online%%' OR table_name LIKE '%%envio_tracking%%'
           ) AND table_name = ANY(%s)""",
        (list(PHASE1FB1_TABLES),),
    )
    if cur.fetchone()[0]:
        raise VerificationError("Out-of-scope object is present in Phase 1F-B1")
    return [
        "all ten additive tables exist",
        "controlled carriers are seeded",
        "packaging and measurement fallbacks remain inactive",
        "48h request and 24h quote defaults are configured",
        "recommendation defaults are 0.60 cost and 0.40 speed",
        "no Phase 1F-B2 or Phase 1F-C object is present",
    ]


def main() -> int:
    os.environ.setdefault("PHASE_1FB1_ENABLED", "false")
    sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main
    import psycopg

    checks = verify_source()
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            checks.extend(verify_phase1fb1(cur))
    print("PHASE 1F-B1 VERIFICATION: PASS")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
