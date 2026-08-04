#!/usr/bin/env python3
"""Read-only verification for the Phase 1F-A authoritative-commerce foundation."""

from __future__ import annotations

import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]

PHASE1FA_TABLES = (
    "online_producto_configuracion",
    "online_producto_configuracion_auditoria",
    "online_carritos",
    "online_carrito_items",
    "online_favoritos",
    "online_comercio_eventos",
    "online_idempotencia",
)


class VerificationError(RuntimeError):
    pass


def _table_exists(cur, table_name: str) -> bool:
    cur.execute("SELECT to_regclass(%s) IS NOT NULL", (f"core.{table_name}",))
    return bool(cur.fetchone()[0])


def verify_phase1fa(cur, *, require_conservative: bool = False) -> list[str]:
    existing = [name for name in PHASE1FA_TABLES if _table_exists(cur, name)]
    if existing != list(PHASE1FA_TABLES):
        raise VerificationError(
            "Phase 1F-A table set is incomplete: "
            + (", ".join(existing) if existing else "none")
        )

    cur.execute("SELECT COUNT(*) FROM core.catalogo_productos")
    product_count = int(cur.fetchone()[0])
    cur.execute("SELECT COUNT(*) FROM core.online_producto_configuracion")
    config_count = int(cur.fetchone()[0])
    if config_count != product_count:
        raise VerificationError(
            "Every catalog product must have exactly one online-commerce configuration"
        )

    if require_conservative:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM core.online_producto_configuracion
            WHERE comprable_online = TRUE
               OR permite_favorito = FALSE
               OR cantidad_maxima_por_linea IS NOT NULL
            """
        )
        if int(cur.fetchone()[0]) != 0:
            raise VerificationError(
                "Initial online purchase configuration is not conservative"
            )

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
        (list(PHASE1FA_TABLES),),
    )
    if int(cur.fetchone()[0]) != 0:
        raise VerificationError("A Phase 1F-A constraint contains a cascading action")

    required_indexes = {
        "online_carritos_propietario_activo_uq",
        "online_carrito_items_activo_uq",
        "online_favoritos_activo_uq",
        "online_idempotencia_alcance_clave_uq",
    }
    cur.execute(
        """
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'core' AND indexname = ANY(%s)
        """,
        (list(required_indexes),),
    )
    indexes = {row[0] for row in cur.fetchall()}
    if indexes != required_indexes:
        raise VerificationError("Phase 1F-A uniqueness indexes are incomplete")

    cur.execute(
        """
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'core'
          AND table_name = 'online_producto_configuracion'
          AND column_name IN (
              'comprable_online', 'permite_favorito', 'cantidad_maxima_por_linea'
          )
        ORDER BY column_name
        """
    )
    columns = {row[0]: (row[1], row[2]) for row in cur.fetchall()}
    if set(columns) != {
        "comprable_online",
        "permite_favorito",
        "cantidad_maxima_por_linea",
    }:
        raise VerificationError("Product commerce-control columns are incomplete")
    if columns["cantidad_maxima_por_linea"][0] != "YES":
        raise VerificationError("The per-line quantity limit must be optional")

    cur.execute(
        """
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = 'core'
          AND table_name = ANY(%s)
        """,
        (["online_ordenes", "online_pagos"],),
    )
    if int(cur.fetchone()[0]) != 0:
        raise VerificationError("Out-of-scope Phase 1F-B/C objects were found")

    return [
        "7 additive Phase 1F-A tables",
        "one conservative commerce configuration per catalog product",
        "guest/customer active-cart and favorite uniqueness",
        "optional positive per-line quantity limit",
        "no cascading foreign-key actions",
        "no order or payment objects; reservation objects belong to the separately gated B2 phase",
    ]


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main
    import psycopg

    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            checks = verify_phase1fa(cur)
            counts = {}
            for table_name in PHASE1FA_TABLES:
                cur.execute(f'SELECT COUNT(*) FROM core."{table_name}"')
                counts[table_name] = int(cur.fetchone()[0])

    print("PHASE 1F-A VERIFICATION: PASS")
    for check in checks:
        print(f"  [OK] {check}")
    for table_name, count in counts.items():
        print(f"  [INFO] core.{table_name}: rows={count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
