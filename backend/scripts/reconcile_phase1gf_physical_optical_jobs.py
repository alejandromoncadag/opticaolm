#!/usr/bin/env python3
"""Dry-run-first reconciliation of active physical optical configurations."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
ADVISORY_LOCK_KEY = 1_071_006


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Commit the reconciliation")
    args = parser.parse_args()
    os.environ["PHASE_1GF_ENABLED"] = "true"
    sys.path.insert(0, str(BACKEND_DIR))
    import main as backend_main
    import psycopg
    from optical_operations import sync_physical_sale_jobs

    mode = "APPLY" if args.apply else "DRY RUN"
    with psycopg.connect(backend_main.DB_CONNINFO) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_try_advisory_xact_lock(%s)", (ADVISORY_LOCK_KEY,))
            if cur.fetchone()[0] is not True:
                raise RuntimeError("Another Phase 1G-F reconciliation is running")
            cur.execute(
                    """SELECT DISTINCT config.venta_id
                       FROM core.venta_configuraciones_opticas config
                       JOIN core.ventas sale ON sale.venta_id=config.venta_id
                       WHERE config.estado_registro='activo' AND sale.activo=TRUE
                       ORDER BY config.venta_id"""
                )
            sale_ids = [int(row[0]) for row in cur.fetchall()]
            cur.execute(
                    """SELECT config.configuracion_id, config.venta_id,
                              config.configuracion_ref
                       FROM core.venta_configuraciones_opticas config
                       JOIN core.ventas sale ON sale.venta_id=config.venta_id
                       LEFT JOIN core.catalogo_productos design
                         ON design.producto_id=config.diseno_producto_id
                       WHERE config.estado_registro='activo' AND sale.activo=TRUE
                         AND config.prescripcion_id IS NULL
                         AND config.tipo_configuracion <> 'solo_tratamiento'
                         AND config.uso_visual <> 'sin_graduacion'
                         AND COALESCE(design.sku,'') <> 'DEMO-LENS-NONRX'
                       ORDER BY config.configuracion_id"""
                )
            anomalies = cur.fetchall()
            before = conn.execute(
                "SELECT COUNT(*) FROM core.trabajos_opticos WHERE origen='venta_fisica'"
            ).fetchone()[0]
            for sale_id in sale_ids:
                sync_physical_sale_jobs(
                    cur, sale_id, username=None, reason="reconciliacion_phase1gf"
                )
            after = conn.execute(
                "SELECT COUNT(*) FROM core.trabajos_opticos WHERE origen='venta_fisica'"
            ).fetchone()[0]
        if args.apply:
            conn.commit()
        else:
            conn.rollback()
    print(f"PHASE 1G-F RECONCILIATION: {mode}")
    print(f"  sales scanned: {len(sale_ids)}")
    print(f"  jobs that would be created: {after - before}")
    print(f"  anomalous configurations reported: {len(anomalies)}")
    for configuration_id, sale_id, reference in anomalies:
        print(f"  [ANOMALY] sale={sale_id} configuration={configuration_id} reference={reference}: required prescription missing")
    if not args.apply:
        print("  no changes committed; rerun with --apply to persist")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
