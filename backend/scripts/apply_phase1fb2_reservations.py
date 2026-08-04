#!/usr/bin/env python3
"""Apply Phase 1F-B2 without changing operational rows."""

from __future__ import annotations

from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATION_PATH = SCRIPT_DIR / "migrations" / "20260803_phase1fb2_online_reservations.sql"
PROTECTED_TABLES = (
    "productos", "ventas", "venta_detalles", "venta_pagos",
    "inventario_movimientos", "catalogo_productos",
    "catalogo_inventario_sucursal", "catalogo_inventario_movimientos",
    "online_carritos", "online_carrito_items", "online_favoritos",
)
PHASE1FB2_TABLES = (
    "online_reserva_configuracion", "online_reservas",
    "online_reserva_lineas", "online_reserva_eventos",
)


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    sys.path.insert(0, str(SCRIPT_DIR))
    import main as backend_main
    import psycopg
    from verify_phase1a_catalog import fingerprint_table
    from verify_phase1fb2_reservations import VerificationError, verify_phase1fb2, verify_source

    verify_source()
    migration = MIGRATION_PATH.read_text(encoding="utf-8")
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL lock_timeout = '15s'")
                cur.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'core' AND table_name = ANY(%s)",
                    (list(PHASE1FB2_TABLES),),
                )
                existing = {row[0] for row in cur.fetchall()}
                if existing and existing != set(PHASE1FB2_TABLES):
                    raise VerificationError("Partial Phase 1F-B2 schema found")
                cur.execute("LOCK TABLE " + ", ".join(f"core.{name}" for name in PROTECTED_TABLES) + " IN SHARE MODE")
                before = {name: fingerprint_table(cur, name) for name in PROTECTED_TABLES}
                if not existing:
                    cur.execute(migration)
                checks = verify_phase1fb2(cur)
                after = {name: fingerprint_table(cur, name) for name in PROTECTED_TABLES}
                if before != after:
                    raise VerificationError("A protected operational table changed")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    print("PHASE 1F-B2 MIGRATION: COMMITTED WITH FEATURE FLAG DISABLED")
    for check in checks:
        print(f"  [OK] {check}")
    for name in PROTECTED_TABLES:
        print(f"  [OK] core.{name}: unchanged rows={before[name]['rows']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
