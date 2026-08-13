#!/usr/bin/env python3
"""Verify Phase 1G-G optical pricing administration objects and isolation."""

from __future__ import annotations

from pathlib import Path
import re
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
MIGRATION = SCRIPT_DIR / "migrations" / "20260812_phase1gg_optical_pricing_admin.sql"
ROLLBACK = SCRIPT_DIR / "migrations" / "20260812_phase1gg_optical_pricing_admin_rollback.sql"
METADATA_COLUMNS = {
    "costo_confirmado_at", "costo_confirmado_by",
    "costo_confirmado_referencia", "costo_vigente_desde",
}


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
    for forbidden in (r"\bDELETE\b", r"\bTRUNCATE\b", r"\bCASCADE\b", r"\bDROP\b"):
        require(not re.search(forbidden, migration, re.I), f"Migration contains {forbidden}")
        require(not re.search(forbidden, rollback, re.I), f"Rollback contains {forbidden}")
    require("phase1gg_isolated" in rollback, "Rollback does not isolate the audit table")
    return [
        "migration and rollback are transactional",
        "migration and rollback contain no destructive data operation",
        "rollback isolates Phase 1G-G objects instead of deleting history",
    ]


def verify_database(cur) -> list[str]:
    for table in ("catalogo_productos", "catalogo_producto_variantes"):
        cur.execute(
            """SELECT column_name FROM information_schema.columns
               WHERE table_schema='core' AND table_name=%s
                 AND column_name=ANY(%s::text[])""",
            (table, sorted(METADATA_COLUMNS)),
        )
        found = {row[0] for row in cur.fetchall()}
        require(found == METADATA_COLUMNS, f"{table} confirmation metadata is incomplete")
    cur.execute("SELECT to_regclass('core.catalogo_optico_precio_costo_auditoria')")
    require(cur.fetchone()[0] is not None, "Optical price/cost audit table is missing")
    cur.execute(
        """SELECT COUNT(*),COUNT(DISTINCT sku) FROM core.catalogo_productos
           WHERE sku=ANY(%s::text[])""",
        ([
            "DEMO-LENS-MONO", "DEMO-LENS-BIFO", "DEMO-LENS-PROG", "DEMO-LENS-NONRX",
            "DEMO-TRT-AR", "DEMO-TRT-PHOTO", "DEMO-TRT-BLUE", "DEMO-TRT-TINT",
        ],),
    )
    total, unique = cur.fetchone()
    require(total == 8 and unique == 8, "Approved optical component records are missing or duplicated")
    cur.execute(
        """SELECT COUNT(*) FROM core.catalogo_productos
           WHERE sku=ANY(%s::text[]) AND NOT (
             categoria='micas' AND tipo_producto='componente_mica'
             AND modalidad_precio='ajuste_venta'
             AND subcategoria IN ('diseno','tratamiento')
           )""",
        ([
            "DEMO-LENS-MONO", "DEMO-LENS-BIFO", "DEMO-LENS-PROG", "DEMO-LENS-NONRX",
            "DEMO-TRT-AR", "DEMO-TRT-PHOTO", "DEMO-TRT-BLUE", "DEMO-TRT-TINT",
        ],),
    )
    require(cur.fetchone()[0] == 0, "An approved optical record has invalid catalog behavior")
    return [
        "product and variant confirmation metadata columns are present",
        "append-only optical pricing audit table is present",
        "the eight approved optical components remain unique and structurally valid",
    ]


def main() -> int:
    sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main
    import psycopg

    checks = verify_source()
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            checks.extend(verify_database(cur))
    print("PHASE 1G-G OPTICAL PRICING ADMIN VERIFICATION: PASS")
    for check in checks:
        print(f"  [OK] {check}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
