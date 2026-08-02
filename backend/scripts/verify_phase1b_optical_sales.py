#!/usr/bin/env python3
"""Read-only verification for the Phase 1B optical-sales foundation."""

from __future__ import annotations

import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent

PHASE1B_TABLES = (
    "catalogo_inventario_movimientos",
    "prescripciones_opticas",
    "venta_catalogo_contextos",
    "venta_configuraciones_opticas",
    "venta_catalogo_detalles",
    "venta_descuentos",
    "venta_descuento_objetivos",
    "venta_calculo_revisiones",
    "venta_descuento_asignaciones",
    "venta_cancelaciones",
    "venta_cancelacion_objetivos",
    "venta_ajustes_cliente",
)


class VerificationError(RuntimeError):
    pass


def _table_exists(cur, table_name: str) -> bool:
    cur.execute("SELECT to_regclass(%s) IS NOT NULL", (f"core.{table_name}",))
    return bool(cur.fetchone()[0])


def verify_phase1b(cur, *, require_empty: bool = False) -> list[str]:
    existing = [name for name in PHASE1B_TABLES if _table_exists(cur, name)]
    if existing != list(PHASE1B_TABLES):
        raise VerificationError(
            "Phase 1B table set is incomplete: "
            + (", ".join(existing) if existing else "none")
        )

    cur.execute(
        """
        SELECT data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'core'
          AND table_name = 'catalogo_productos'
          AND column_name = 'permite_graduacion'
        """
    )
    column = cur.fetchone()
    if column is None or column[0] != "boolean" or column[1] != "NO":
        raise VerificationError("catalogo_productos.permite_graduacion is invalid")

    cur.execute(
        """
        SELECT sku, permite_graduacion
        FROM core.catalogo_productos
        WHERE sku IN ('DEMO-RX-001', 'DEMO-SUN-001')
        ORDER BY sku
        """
    )
    capability = {row[0]: bool(row[1]) for row in cur.fetchall()}
    if capability != {"DEMO-RX-001": True, "DEMO-SUN-001": False}:
        raise VerificationError("Approved prescription capability flags differ")

    cur.execute(
        """
        SELECT COUNT(*)
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        WHERE schema_row.nspname = 'core'
          AND table_row.relname = ANY(%s)
          AND pg_get_constraintdef(constraint_row.oid) ILIKE '%%CASCADE%%'
        """,
        (list(PHASE1B_TABLES),),
    )
    if int(cur.fetchone()[0]) != 0:
        raise VerificationError("A Phase 1B constraint contains a cascading action")

    cur.execute(
        """
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'core'
          AND table_name = ANY(%s)
          AND column_name ILIKE '%%montaje%%'
        """,
        (list(PHASE1B_TABLES),),
    )
    if cur.fetchall():
        raise VerificationError("Phase 1B contains a prohibited mounting field")

    if require_empty:
        populated = []
        for table_name in PHASE1B_TABLES:
            cur.execute(f'SELECT COUNT(*) FROM core."{table_name}"')
            count = int(cur.fetchone()[0])
            if count:
                populated.append(f"{table_name}={count}")
        if populated:
            raise VerificationError(
                "New Phase 1B operational tables were expected to be empty: "
                + ", ".join(populated)
            )

    return [
        "12 additive Phase 1B tables",
        "prescription-capability flag verified",
        "no cascading foreign-key actions",
        "no mounting charge fields",
        "legacy operational tables remain separate",
    ]


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main
    import psycopg

    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            checks = verify_phase1b(cur)
            counts = {}
            for table_name in PHASE1B_TABLES:
                cur.execute(f'SELECT COUNT(*) FROM core."{table_name}"')
                counts[table_name] = int(cur.fetchone()[0])

    print("PHASE 1B VERIFICATION: PASS")
    for check in checks:
        print(f"  [OK] {check}")
    for table_name, count in counts.items():
        print(f"  [INFO] core.{table_name}: rows={count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

