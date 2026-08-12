"""Apply the approved Phase 1G-B demo prices and unconfirmed cost estimates."""

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


PRODUCT_VALUES = {
    "DEMO-LENS-MONO": ("diseno", Decimal("0"), Decimal("450")),
    "DEMO-LENS-BIFO": ("diseno", Decimal("900"), Decimal("700")),
    "DEMO-LENS-PROG": ("diseno", Decimal("2500"), Decimal("1850")),
    "DEMO-LENS-NONRX": ("diseno", Decimal("0"), Decimal("180")),
    "DEMO-TRT-AR": ("tratamiento", Decimal("500"), Decimal("220")),
    "DEMO-TRT-PHOTO": ("tratamiento", Decimal("1000"), Decimal("560")),
    "DEMO-TRT-BLUE": ("tratamiento", Decimal("1500"), None),
    "DEMO-TRT-TINT": ("tratamiento", Decimal("1000"), None),
}


def main_seed() -> int:
    changes = 0
    with psycopg.connect(main.DB_CONNINFO, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT producto_id, sku, categoria, subcategoria, tipo_producto,
                       modalidad_precio, publicado_online
                FROM core.catalogo_productos
                WHERE sku = ANY(%s::text[])
                FOR UPDATE
                """,
                (list(PRODUCT_VALUES),),
            )
            products = {str(row["sku"]): row for row in cur.fetchall()}
            missing = set(PRODUCT_VALUES) - set(products)
            if missing:
                raise RuntimeError(f"Missing approved demo products: {sorted(missing)}")
            for sku, (subtype, _price, _cost) in PRODUCT_VALUES.items():
                row = products[sku]
                if not (
                    row["categoria"] == "micas"
                    and row["subcategoria"] == subtype
                    and row["tipo_producto"] == "componente_mica"
                    and row["modalidad_precio"] == "ajuste_venta"
                    and row["publicado_online"] is False
                ):
                    raise RuntimeError(f"Unexpected catalog identity for {sku}; no changes applied.")

            for sku, (_subtype, price, cost) in PRODUCT_VALUES.items():
                cur.execute(
                    """
                    UPDATE core.catalogo_productos
                    SET precio = %s,
                        costo_unitario = %s,
                        costo_confirmado = FALSE,
                        updated_at = CASE
                            WHEN precio IS DISTINCT FROM %s
                              OR costo_unitario IS DISTINCT FROM %s
                              OR costo_confirmado IS DISTINCT FROM FALSE
                            THEN NOW() ELSE updated_at END
                    WHERE sku = %s
                    RETURNING (precio IS NOT DISTINCT FROM %s
                               AND costo_unitario IS NOT DISTINCT FROM %s) AS matches
                    """,
                    (price, cost, price, cost, sku, price, cost),
                )
                if cur.fetchone()["matches"]:
                    changes += 1

            cur.execute(
                """
                SELECT v.variante_id, p.sku, v.codigo
                FROM core.catalogo_producto_variantes v
                JOIN core.catalogo_productos p USING (producto_id)
                WHERE p.sku IN ('DEMO-TRT-BLUE', 'DEMO-TRT-TINT')
                FOR UPDATE OF v
                """
            )
            variants = list(cur.fetchall())
            blue_codes = {row["codigo"] for row in variants if row["sku"] == "DEMO-TRT-BLUE"}
            if blue_codes != {"reflejo_verde", "reflejo_azul"}:
                raise RuntimeError("Unexpected blue-filter variants; no changes applied.")
            tint_variants = [row for row in variants if row["sku"] == "DEMO-TRT-TINT"]
            if not tint_variants:
                raise RuntimeError("Tint variants are missing; no changes applied.")
            for row in variants:
                cost = Decimal("690") if row["sku"] == "DEMO-TRT-BLUE" else Decimal("350")
                cur.execute(
                    """
                    UPDATE core.catalogo_producto_variantes
                    SET costo_unitario = %s,
                        costo_confirmado = FALSE,
                        updated_at = CASE
                            WHEN costo_unitario IS DISTINCT FROM %s
                              OR costo_confirmado IS DISTINCT FROM FALSE
                            THEN NOW() ELSE updated_at END
                    WHERE variante_id = %s
                    """,
                    (cost, cost, row["variante_id"]),
                )
                changes += 1
        conn.commit()
    print(f"PHASE 1G-B DEMO PRICING: PASS ({changes} validated product/variant records)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_seed())
