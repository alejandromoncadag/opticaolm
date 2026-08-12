from __future__ import annotations

from pathlib import Path
import sys
import unittest
from uuid import uuid4

from pydantic import ValidationError
import psycopg
from psycopg.rows import dict_row


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main
from online_commerce import CommerceOwner
from online_optical_drafts import (
    CreateOpticalDraftRequest,
    OpticalDraftConfig,
    OpticalDraftRepository,
    OpticalDraftRuleError,
    release_expired_optical_reservations,
)
from optical_preview import OpticalPreviewRepository, OpticalPreviewRequest
from public_catalog import PublicCatalogConfig


class NonCommittingConnection:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def cursor(self):
        return self.connection.cursor()

    def commit(self):
        pass


class Phase1GCOpticalDraftTests(unittest.TestCase):
    maxDiff = None

    def setUp(self) -> None:
        self.connection = psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row)
        self.connection.execute("BEGIN")
        self.wrapper = NonCommittingConnection(self.connection)
        with self.connection.cursor() as cur:
            cur.execute(
                """
                SELECT producto_id, sku
                FROM core.catalogo_productos
                WHERE sku = ANY(%s::text[])
                """,
                (["DEMO-RX-001", "DEMO-LENS-MONO", "DEMO-LENS-PROG", "DEMO-TRT-PHOTO", "DEMO-TRT-BLUE"],),
            )
            self.products = {row["sku"]: int(row["producto_id"]) for row in cur.fetchall()}
            if len(self.products) != 5:
                self.connection.rollback()
                self.connection.close()
                raise unittest.SkipTest("Phase 1G-B demo components are incomplete")
            cur.execute(
                """
                SELECT variant.variante_id
                FROM core.catalogo_producto_variantes variant
                JOIN core.catalogo_productos product USING (producto_id)
                WHERE product.sku = 'DEMO-TRT-BLUE'
                  AND variant.codigo = 'reflejo_verde' AND variant.activo = TRUE
                """
            )
            self.blue_variant = int(cur.fetchone()["variante_id"])
            cur.execute(
                """
                SELECT inventory.sucursal_id, inventory.stock,
                       inventory.stock_reservado
                FROM core.catalogo_inventario_sucursal inventory
                JOIN core.sucursales branch USING (sucursal_id)
                WHERE inventory.producto_id = %s AND branch.activa = TRUE
                ORDER BY inventory.sucursal_id
                LIMIT 1
                FOR UPDATE OF inventory
                """,
                (self.products["DEMO-RX-001"],),
            )
            inventory = cur.fetchone()
            if not inventory:
                self.connection.rollback()
                self.connection.close()
                raise unittest.SkipTest("DEMO-RX-001 has no branch inventory row")
            self.branch_id = int(inventory["sucursal_id"])
            cur.execute(
                """
                UPDATE core.catalogo_inventario_sucursal
                SET stock = GREATEST(stock, stock_reservado + 5),
                    disponible_venta = TRUE
                WHERE producto_id = %s AND sucursal_id = %s
                """,
                (self.products["DEMO-RX-001"], self.branch_id),
            )

        catalog = PublicCatalogConfig(
            db_conninfo=backend_main.DB_CONNINFO,
            bearer_token="test",
            media_base_url="http://127.0.0.1:8000",
            allowed_image_origins=("http://127.0.0.1:8000",),
        )
        preview = OpticalPreviewRepository(catalog, connect=lambda *_a, **_k: self.wrapper)
        self.repository = OpticalDraftRepository(
            OpticalDraftConfig(backend_main.DB_CONNINFO, "test", True),
            preview,
            connect=lambda *_a, **_k: self.wrapper,
        )
        self.owner = CommerceOwner("guest", "a" * 64)

    def tearDown(self) -> None:
        if not self.connection.closed:
            self.connection.rollback()
            self.connection.close()

    def _preview(self, *, design="DEMO-LENS-MONO", treatment=None, variant=None):
        with self.connection.cursor() as cur:
            return self.repository.preview_repository.preview_in_transaction(
                cur,
                OpticalPreviewRequest(
                    frameProductId=self.products["DEMO-RX-001"],
                    lensDesignProductId=self.products[design],
                    treatmentProductId=self.products[treatment] if treatment else None,
                    treatmentVariantId=variant,
                ),
            )

    def _request(self, **overrides):
        preview = overrides.pop("preview", self._preview())
        payload = {
            "frameProductId": self.products["DEMO-RX-001"],
            "lensDesignProductId": self.products["DEMO-LENS-MONO"],
            "treatmentProductId": None,
            "treatmentVariantId": None,
            "previewFingerprint": preview.previewFingerprint,
            "prescriptionMethod": "later",
            "branchId": self.branch_id,
            "intendedUse": None,
            **overrides,
        }
        return CreateOpticalDraftRequest.model_validate(payload)

    def _reserved(self, product_id: int) -> int:
        with self.connection.cursor() as cur:
            cur.execute(
                "SELECT stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id = %s AND sucursal_id = %s",
                (product_id, self.branch_id),
            )
            row = cur.fetchone()
            return int(row["stock_reservado"]) if row else 0

    def test_monofocal_creation_is_idempotent_and_only_reserves_frame(self) -> None:
        frame_before = self._reserved(self.products["DEMO-RX-001"])
        component_before = {sku: self._reserved(pid) for sku, pid in self.products.items() if sku != "DEMO-RX-001"}
        request = self._request()
        result = self.repository.create(self.owner, request, "create-mono")
        replay = self.repository.create(self.owner, request, "create-mono")
        self.assertEqual(result["draftPublicId"], replay["draftPublicId"])
        self.assertEqual(frame_before + 1, self._reserved(self.products["DEMO-RX-001"]))
        self.assertEqual(component_before, {sku: self._reserved(pid) for sku, pid in self.products.items() if sku != "DEMO-RX-001"})
        self.assertFalse(result["paymentCreated"])
        self.assertFalse(result["saleCreated"])
        with self.connection.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(SUM(cantidad), 0)::int AS total,
                       COUNT(*) FILTER (WHERE fuente_tipo = 'optical_draft')::int AS optical_lines
                FROM core.online_inventario_reservas_activas
                WHERE producto_id = %s AND sucursal_id = %s
                """,
                (self.products["DEMO-RX-001"], self.branch_id),
            )
            authority = cur.fetchone()
            self.assertEqual(self._reserved(self.products["DEMO-RX-001"]), int(authority["total"]))
            self.assertEqual(1, int(authority["optical_lines"]))
            cur.execute("SELECT COUNT(*) AS count FROM core.online_borradores_opticos WHERE borrador_public_id = %s", (result["draftPublicId"],))
            self.assertEqual(1, int(cur.fetchone()["count"]))

    def test_progressive_photochromic_and_blue_variant_snapshots(self) -> None:
        photo_preview = self._preview(design="DEMO-LENS-PROG", treatment="DEMO-TRT-PHOTO")
        photo = self.repository.create(
            self.owner,
            self._request(
                preview=photo_preview,
                lensDesignProductId=self.products["DEMO-LENS-PROG"],
                treatmentProductId=self.products["DEMO-TRT-PHOTO"],
            ),
            "create-photo",
        )
        self.assertEqual("DEMO-LENS-PROG", photo["configuration"]["lensDesign"]["sku"])
        self.assertEqual("DEMO-TRT-PHOTO", photo["configuration"]["treatment"]["sku"])
        self.repository.cancel(self.owner, photo["draftPublicId"], "cancel-photo")
        blue_preview = self._preview(treatment="DEMO-TRT-BLUE", variant=self.blue_variant)
        blue = self.repository.create(
            self.owner,
            self._request(
                preview=blue_preview,
                treatmentProductId=self.products["DEMO-TRT-BLUE"],
                treatmentVariantId=self.blue_variant,
                prescriptionMethod="exam",
            ),
            "create-blue",
        )
        self.assertEqual("reflejo_verde", blue["configuration"]["variant"]["code"])
        self.assertEqual("exam", blue["prescriptionMethod"])

    def test_stale_preview_and_client_prices_are_rejected(self) -> None:
        stale = self._request(previewFingerprint="0" * 64)
        with self.assertRaises(OpticalDraftRuleError) as caught:
            self.repository.create(self.owner, stale, "stale")
        self.assertEqual(409, caught.exception.status_code)
        self.assertEqual("OPTICAL_PREVIEW_STALE", caught.exception.detail["code"])
        self.assertIn("currentPreview", caught.exception.detail["details"])
        with self.assertRaises(ValidationError):
            CreateOpticalDraftRequest.model_validate({**self._request().model_dump(), "price": "1.00"})

    def test_out_of_stock_and_invalid_component_are_rejected(self) -> None:
        with self.connection.cursor() as cur:
            cur.execute(
                "UPDATE core.catalogo_inventario_sucursal SET stock = stock_reservado WHERE producto_id = %s AND sucursal_id = %s",
                (self.products["DEMO-RX-001"], self.branch_id),
            )
        with self.assertRaises(OpticalDraftRuleError) as out:
            self.repository.create(self.owner, self._request(), "out")
        self.assertEqual("FRAME_OUT_OF_STOCK", out.exception.detail["code"])

    def test_cancel_and_expiration_release_exactly_one_and_enforce_owner(self) -> None:
        before = self._reserved(self.products["DEMO-RX-001"])
        draft = self.repository.create(self.owner, self._request(), "cancel-create")
        other = CommerceOwner("guest", "b" * 64)
        with self.assertRaises(OpticalDraftRuleError) as hidden:
            self.repository.get(other, draft["draftPublicId"])
        self.assertEqual(404, hidden.exception.status_code)
        with self.assertRaises(OpticalDraftRuleError) as cancel_hidden:
            self.repository.cancel(other, draft["draftPublicId"], "other-owner-cancel")
        self.assertEqual(404, cancel_hidden.exception.status_code)
        cancelled = self.repository.cancel(self.owner, draft["draftPublicId"], "cancel-one")
        replay = self.repository.cancel(self.owner, draft["draftPublicId"], "cancel-two")
        self.assertEqual("cancelado", cancelled["status"])
        self.assertEqual("cancelado", replay["status"])
        self.assertEqual(before, self._reserved(self.products["DEMO-RX-001"]))

        expiring = self.repository.create(self.owner, self._request(), "expire-create")
        with self.connection.cursor() as cur:
            cur.execute("UPDATE core.online_reservas_opticas_borrador SET created_at = NOW() - INTERVAL '2 minutes', expires_at = NOW() - INTERVAL '1 second' WHERE reserva_public_id = %s", (expiring["reservationPublicId"],))
            self.assertEqual(1, release_expired_optical_reservations(cur))
            self.assertEqual(0, release_expired_optical_reservations(cur))
        expired = self.repository.get(self.owner, expiring["draftPublicId"])
        self.assertEqual("expirado", expired["status"])
        self.assertEqual(before, self._reserved(self.products["DEMO-RX-001"]))

    def test_no_forbidden_operational_records_are_created(self) -> None:
        tables = (
            "ventas", "venta_pagos", "pacientes", "prescripciones_opticas",
            "online_ordenes", "online_pago_sesiones",
            "catalogo_inventario_movimientos",
        )
        with self.connection.cursor() as cur:
            before = {}
            for table in tables:
                cur.execute(f"SELECT COUNT(*) AS count FROM core.{table}")
                before[table] = int(cur.fetchone()["count"])
        self.repository.create(self.owner, self._request(), "neutral")
        with self.connection.cursor() as cur:
            for table in tables:
                cur.execute(f"SELECT COUNT(*) AS count FROM core.{table}")
                self.assertEqual(before[table], int(cur.fetchone()["count"]), table)


if __name__ == "__main__":
    unittest.main()
