"""Verify Phase 1G-B demo pricing and read-only optical preview behavior."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path
import sys

import psycopg
from psycopg.rows import dict_row


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main  # noqa: E402
from optical_preview import OpticalPreviewRepository, OpticalPreviewRequest  # noqa: E402
from public_catalog import PublicCatalogConfig  # noqa: E402


EXPECTED_PRODUCTS = {
    "DEMO-LENS-MONO": (Decimal("0.00"), Decimal("450.00")),
    "DEMO-LENS-BIFO": (Decimal("900.00"), Decimal("700.00")),
    "DEMO-LENS-PROG": (Decimal("2500.00"), Decimal("1850.00")),
    "DEMO-LENS-NONRX": (Decimal("0.00"), Decimal("180.00")),
    "DEMO-TRT-AR": (Decimal("500.00"), Decimal("220.00")),
    "DEMO-TRT-PHOTO": (Decimal("1000.00"), Decimal("560.00")),
    "DEMO-TRT-BLUE": (Decimal("1500.00"), None),
    "DEMO-TRT-TINT": (Decimal("1000.00"), None),
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def counts(cur) -> dict[str, int]:
    result = {}
    for table in (
        "online_carritos",
        "online_reservas",
        "online_ordenes",
        "online_sesiones_pago",
        "ventas",
        "venta_pagos",
        "catalogo_inventario_movimientos",
    ):
        cur.execute("SELECT to_regclass(%s) AS relation", (f"core.{table}",))
        if cur.fetchone()["relation"]:
            cur.execute(f"SELECT COUNT(*) AS count FROM core.{table}")
            result[table] = int(cur.fetchone()["count"])
    return result


def run() -> int:
    with psycopg.connect(main.DB_CONNINFO, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT producto_id, sku, precio, costo_unitario, costo_confirmado,
                       activo, publicado_online
                FROM core.catalogo_productos
                WHERE sku = ANY(%s::text[])
                ORDER BY sku
                """,
                (list(EXPECTED_PRODUCTS),),
            )
            rows = {row["sku"]: row for row in cur.fetchall()}
            require(set(rows) == set(EXPECTED_PRODUCTS), "Approved demo component set is incomplete")
            for sku, (price, cost) in EXPECTED_PRODUCTS.items():
                row = rows[sku]
                require(row["precio"] == price, f"Unexpected selling adjustment for {sku}")
                require(row["costo_unitario"] == cost, f"Unexpected demo cost for {sku}")
                require(row["costo_confirmado"] is False, f"Demo cost was confirmed for {sku}")
                require(row["activo"] is True, f"Demo component is inactive: {sku}")
                require(row["publicado_online"] is False, f"Component was published as a normal product: {sku}")

            cur.execute(
                """
                SELECT p.sku, v.codigo, v.costo_unitario, v.costo_confirmado
                FROM core.catalogo_producto_variantes v
                JOIN core.catalogo_productos p USING (producto_id)
                WHERE p.sku IN ('DEMO-TRT-BLUE', 'DEMO-TRT-TINT')
                  AND v.activo = TRUE
                """
            )
            variants = list(cur.fetchall())
            require(len(variants) == 12, "Unexpected active blue/tint variant count")
            for variant in variants:
                expected = Decimal("690.00") if variant["sku"] == "DEMO-TRT-BLUE" else Decimal("350.00")
                require(variant["costo_unitario"] == expected, "Unexpected variant demo cost")
                require(variant["costo_confirmado"] is False, "Variant demo cost was confirmed")

            cur.execute("SELECT producto_id FROM core.catalogo_productos WHERE sku='DEMO-RX-001'")
            frame_id = int(cur.fetchone()["producto_id"])
            cur.execute(
                """
                SELECT COALESCE(SUM(stock), 0) AS stock,
                       COALESCE(SUM(stock_reservado), 0) AS reserved,
                       COALESCE(SUM(version), 0) AS versions
                FROM core.catalogo_inventario_sucursal
                """
            )
            inventory_before = dict(cur.fetchone())
            record_counts_before = counts(cur)

    config = PublicCatalogConfig(
        db_conninfo=main.DB_CONNINFO,
        bearer_token="verifier-token",
        media_base_url="http://127.0.0.1:8000",
        allowed_image_origins=("http://127.0.0.1:8000",),
    )
    repository = OpticalPreviewRepository(config)
    options = repository.options(frame_id)
    require(len(options.lensDesigns) == 4, "Expected four lens designs")
    require(len(options.treatments) == 5, "Expected no-treatment plus four treatments")
    preview = repository.preview(
        OpticalPreviewRequest(
            frameProductId=frame_id,
            lensDesignProductId=int(rows["DEMO-LENS-PROG"]["producto_id"]),
            treatmentProductId=int(rows["DEMO-TRT-PHOTO"]["producto_id"]),
            treatmentVariantId=None,
        )
    )
    require(preview.binding is False, "Preview was incorrectly marked binding")

    with psycopg.connect(main.DB_CONNINFO, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(SUM(stock), 0) AS stock,
                       COALESCE(SUM(stock_reservado), 0) AS reserved,
                       COALESCE(SUM(version), 0) AS versions
                FROM core.catalogo_inventario_sucursal
                """
            )
            require(inventory_before == dict(cur.fetchone()), "Preview mutated inventory")
            require(record_counts_before == counts(cur), "Preview created a persistent operational record")

    print("PHASE 1G-B OPTICAL PREVIEW VERIFICATION: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
