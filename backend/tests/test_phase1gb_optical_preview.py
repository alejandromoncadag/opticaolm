from __future__ import annotations

from pathlib import Path
import sys
import unittest

from fastapi import HTTPException
from pydantic import ValidationError
import psycopg
from psycopg.rows import dict_row


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main
from optical_preview import (
    OpticalPreviewRequest,
    OpticalPreviewRepository,
)
from public_catalog import PublicCatalogConfig


PRODUCT_SKUS = (
    "DEMO-RX-001",
    "DEMO-LENS-MONO",
    "DEMO-LENS-BIFO",
    "DEMO-LENS-PROG",
    "DEMO-LENS-NONRX",
    "DEMO-TRT-AR",
    "DEMO-TRT-PHOTO",
    "DEMO-TRT-BLUE",
    "DEMO-TRT-TINT",
)


class Phase1GBOpticalPreviewTests(unittest.TestCase):
    maxDiff = None

    @classmethod
    def setUpClass(cls) -> None:
        cls.config = PublicCatalogConfig(
            db_conninfo=backend_main.DB_CONNINFO,
            bearer_token="phase1gb-test-token",
            media_base_url="http://127.0.0.1:8000",
            allowed_image_origins=("http://127.0.0.1:8000",),
        )
        cls.repository = OpticalPreviewRepository(cls.config)
        with psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT producto_id, sku, categoria, subcategoria, tipo_producto,
                           modalidad_precio, activo, publicado_online, controla_stock,
                           moneda, precio, created_at, updated_at
                    FROM core.catalogo_productos
                    WHERE sku = ANY(%s::text[])
                    """,
                    (list(PRODUCT_SKUS),),
                )
                cls.products = {row["sku"]: row for row in cur.fetchall()}
                missing = set(PRODUCT_SKUS) - set(cls.products)
                if missing:
                    raise unittest.SkipTest(f"Missing Phase 1G-B demo records: {sorted(missing)}")
                frame = cls.products["DEMO-RX-001"]
                if not (frame["activo"] and frame["publicado_online"]):
                    raise unittest.SkipTest("DEMO-RX-001 must be active and published for storefront preview")
                cur.execute(
                    """
                    SELECT p.sku, v.variante_id, v.codigo
                    FROM core.catalogo_producto_variantes v
                    JOIN core.catalogo_productos p USING (producto_id)
                    WHERE p.sku IN ('DEMO-TRT-BLUE', 'DEMO-TRT-TINT')
                      AND v.activo = TRUE
                    """
                )
                cls.variants = {
                    (row["sku"], row["codigo"]): int(row["variante_id"])
                    for row in cur.fetchall()
                }

    @classmethod
    def product_id(cls, sku: str) -> int:
        return int(cls.products[sku]["producto_id"])

    def preview(self, **overrides):
        payload = {
            "frameProductId": self.product_id("DEMO-RX-001"),
            "lensDesignProductId": self.product_id("DEMO-LENS-MONO"),
            "treatmentProductId": None,
            "treatmentVariantId": None,
            **overrides,
        }
        return self.repository.preview(OpticalPreviewRequest.model_validate(payload))

    def test_options_are_authoritative_and_hide_costs(self) -> None:
        payload = self.repository.options(self.product_id("DEMO-RX-001"))
        self.assertEqual(4, len(payload.lensDesigns))
        self.assertEqual(5, len(payload.treatments))
        self.assertIsNone(payload.treatments[0].productId)
        self.assertEqual("Sin tratamiento", payload.treatments[0].name)
        serialized = payload.model_dump_json().lower()
        for forbidden in ("costo", "cost", "margin", "profit", "bearer", "authorization"):
            self.assertNotIn(forbidden, serialized)

    def test_valid_monofocal_without_treatment(self) -> None:
        payload = self.preview()
        self.assertIsNone(payload.treatment)
        self.assertIsNone(payload.variant)
        self.assertFalse(payload.binding)

    def test_valid_progressive_photochromic(self) -> None:
        response = self.preview(
            lensDesignProductId=self.product_id("DEMO-LENS-PROG"),
            treatmentProductId=self.product_id("DEMO-TRT-PHOTO"),
        )
        expected = (
            self.products["DEMO-RX-001"]["precio"]
            + self.products["DEMO-LENS-PROG"]["precio"]
            + self.products["DEMO-TRT-PHOTO"]["precio"]
        )
        self.assertEqual(f"{expected:.2f}", response.configuredTotal)

    def test_valid_blue_filter_variant(self) -> None:
        response = self.preview(
            treatmentProductId=self.product_id("DEMO-TRT-BLUE"),
            treatmentVariantId=self.variants[("DEMO-TRT-BLUE", "reflejo_verde")],
        )
        self.assertEqual("reflejo_verde", response.variant.code)

    def test_valid_tint_variant(self) -> None:
        response = self.preview(
            treatmentProductId=self.product_id("DEMO-TRT-TINT"),
            treatmentVariantId=self.variants[("DEMO-TRT-TINT", "gris")],
        )
        self.assertEqual("gris", response.variant.code)

    def test_invalid_frame_and_component_roles_are_rejected(self) -> None:
        with self.assertRaises(HTTPException) as invalid_frame:
            self.preview(frameProductId=self.product_id("DEMO-TRT-AR"))
        with self.assertRaises(HTTPException) as wrong_design:
            self.preview(lensDesignProductId=self.product_id("DEMO-TRT-AR"))
        self.assertEqual(400, invalid_frame.exception.status_code)
        self.assertEqual(400, wrong_design.exception.status_code)

    def test_variant_rules_are_enforced(self) -> None:
        with self.assertRaises(HTTPException) as missing:
            self.preview(treatmentProductId=self.product_id("DEMO-TRT-BLUE"))
        with self.assertRaises(HTTPException) as wrong_owner:
            self.preview(
                treatmentProductId=self.product_id("DEMO-TRT-BLUE"),
                treatmentVariantId=self.variants[("DEMO-TRT-TINT", "gris")],
            )
        with self.assertRaises(HTTPException) as not_allowed:
            self.preview(
                treatmentProductId=self.product_id("DEMO-TRT-AR"),
                treatmentVariantId=self.variants[("DEMO-TRT-BLUE", "reflejo_azul")],
            )
        self.assertEqual(400, missing.exception.status_code)
        self.assertEqual(400, wrong_owner.exception.status_code)
        self.assertEqual(400, not_allowed.exception.status_code)

    def test_inactive_component_is_rejected(self) -> None:
        inactive = dict(self.products["DEMO-LENS-MONO"])
        inactive["activo"] = False
        with self.assertRaises(HTTPException) as caught:
            self.repository._validate_component(
                inactive,
                subtype="diseno",
                label="Lens design",
            )
        self.assertEqual(400, caught.exception.status_code)

    def test_unknown_and_client_price_fields_are_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            self.preview(price="1.00", configuredTotal="1.00")

    def test_previews_create_no_persistent_records_or_inventory_mutation(self) -> None:
        tables = (
            "online_carritos",
            "online_reservas",
            "online_ordenes",
            "online_sesiones_pago",
            "ventas",
            "venta_pagos",
            "catalogo_inventario_movimientos",
        )

        def snapshot():
            result = {}
            with psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row) as conn:
                with conn.cursor() as cur:
                    for table in tables:
                        cur.execute("SELECT to_regclass(%s) AS relation", (f"core.{table}",))
                        if cur.fetchone()["relation"]:
                            cur.execute(f"SELECT COUNT(*) AS count FROM core.{table}")
                            result[table] = int(cur.fetchone()["count"])
                    cur.execute(
                        """
                        SELECT COALESCE(SUM(stock), 0) AS stock,
                               COALESCE(SUM(stock_reservado), 0) AS reserved,
                               COALESCE(SUM(version), 0) AS versions
                        FROM core.catalogo_inventario_sucursal
                        """
                    )
                    result["inventory"] = dict(cur.fetchone())
            return result

        before = snapshot()
        response = self.preview(
            lensDesignProductId=self.product_id("DEMO-LENS-PROG"),
            treatmentProductId=self.product_id("DEMO-TRT-PHOTO"),
        )
        self.assertFalse(response.binding)
        self.assertEqual(before, snapshot())


if __name__ == "__main__":
    unittest.main()
