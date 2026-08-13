from __future__ import annotations

from decimal import Decimal
import json
from pathlib import Path
import sys
import unittest

from fastapi import HTTPException
import psycopg
from psycopg.rows import dict_row


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main
from optical_catalog_admin import (
    OpticalCatalogAdminConfig,
    OpticalCatalogAdminRepository,
    OpticalComponentUpdate,
    OpticalVariantUpdate,
    create_optical_catalog_admin_router,
)
from optical_operations import _physical_costs
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

    def rollback(self):
        self.connection.rollback()


class Phase1GGOpticalPricingAdminTests(unittest.TestCase):
    def setUp(self) -> None:
        self.connection = psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row)
        self.connection.execute("BEGIN")
        self.proxy = NonCommittingConnection(self.connection)
        with self.connection.cursor() as cur:
            cur.execute("SELECT to_regclass('core.catalogo_optico_precio_costo_auditoria') AS relation")
            if cur.fetchone()["relation"] is None:
                self.skipTest("Phase 1G-G migration is not applied")
            cur.execute(
                """SELECT producto_id,sku FROM core.catalogo_productos
                   WHERE sku=ANY(%s::text[])""",
                (["DEMO-RX-001", "DEMO-LENS-MONO", "DEMO-TRT-BLUE"],),
            )
            self.products = {row["sku"]: int(row["producto_id"]) for row in cur.fetchall()}
            if len(self.products) != 3:
                self.skipTest("Required Phase 1G catalog records are missing")
            cur.execute(
                """SELECT variante_id FROM core.catalogo_producto_variantes
                   WHERE producto_id=%s ORDER BY variante_id LIMIT 1""",
                (self.products["DEMO-TRT-BLUE"],),
            )
            variant = cur.fetchone()
            if not variant:
                self.skipTest("Blue-filter variants are missing")
            self.variant_id = int(variant["variante_id"])
            cur.execute("SELECT username FROM core.usuarios WHERE rol='admin' AND activo=TRUE ORDER BY usuario_id LIMIT 1")
            admin = cur.fetchone()
            if not admin:
                self.skipTest("No active admin exists")
            self.username = admin["username"]

        config = OpticalCatalogAdminConfig(backend_main.DB_CONNINFO, True)
        self.repository = OpticalCatalogAdminRepository(
            config, connect=lambda *_args, **_kwargs: self.proxy,
        )

        def current_user():
            return {"username": self.username, "rol": "admin", "sucursal_id": None}

        self.router = create_optical_catalog_admin_router(
            backend_main.DB_CONNINFO,
            current_user,
            config=config,
            repository=self.repository,
        )
        self.routes = {
            (method, route.path): route.endpoint
            for route in self.router.routes
            for method in route.methods
        }

    def tearDown(self) -> None:
        if hasattr(self, "connection") and not self.connection.closed:
            self.connection.rollback()
            self.connection.close()

    def component(self, sku: str):
        return next(item for item in self.repository.list_components()["componentes"] if item["sku"] == sku)

    def historical_digest(self) -> tuple:
        with self.connection.cursor() as cur:
            cur.execute(
                """SELECT
                     (SELECT md5(COALESCE(string_agg(to_jsonb(x)::text,'|' ORDER BY configuracion_id),''))
                        FROM (SELECT configuracion_id,precio_armazon_snapshot,precio_diseno_snapshot,
                                     precio_tratamiento_snapshot,precio_variante_snapshot,
                                     costo_armazon_snapshot,costo_diseno_snapshot,
                                     costo_tratamiento_snapshot,costo_variante_snapshot
                                FROM core.venta_configuraciones_opticas) x),
                     (SELECT md5(COALESCE(string_agg(to_jsonb(x)::text,'|' ORDER BY trabajo_id),''))
                        FROM (SELECT trabajo_id,precio_venta_snapshot,costo_armazon_snapshot,
                                     costo_laboratorio_estimado_snapshot,costo_laboratorio_confirmado
                                FROM core.trabajos_opticos) x),
                     (SELECT md5(COALESCE(string_agg(to_jsonb(x)::text,'|' ORDER BY borrador_id),''))
                        FROM (SELECT borrador_id,total_configurado_snapshot,preview_fingerprint
                                FROM core.online_borradores_opticos) x)"""
            )
            row = cur.fetchone()
        return tuple(row.values())

    def test_list_contains_only_existing_eight_components_and_variants(self):
        payload = self.repository.list_components()
        self.assertEqual(8, len(payload["componentes"]))
        self.assertEqual(8, len({item["sku"] for item in payload["componentes"]}))
        blue = next(item for item in payload["componentes"] if item["sku"] == "DEMO-TRT-BLUE")
        self.assertGreaterEqual(len(blue["variantes"]), 2)

    def test_admin_update_changes_future_preview_and_not_historical_snapshots(self):
        design = self.component("DEMO-LENS-MONO")
        catalog = PublicCatalogConfig(
            db_conninfo=backend_main.DB_CONNINFO,
            bearer_token="test",
            media_base_url="http://127.0.0.1:8000",
            allowed_image_origins=("http://127.0.0.1:8000",),
        )
        preview = OpticalPreviewRepository(catalog, connect=lambda *_args, **_kwargs: self.proxy)
        request = OpticalPreviewRequest(
            frameProductId=self.products["DEMO-RX-001"],
            lensDesignProductId=self.products["DEMO-LENS-MONO"],
        )
        with self.connection.cursor() as cur:
            before_preview = preview.preview_in_transaction(cur, request)
        before_history = self.historical_digest()
        updated_price = Decimal(design["ajuste_venta"]) + Decimal("1.00")
        response = self.repository.update_component(
            design["producto_id"],
            OpticalComponentUpdate(
                expected_revision=design["revision"],
                ajuste_venta=updated_price,
                motivo="Phase 1G-G test",
            ),
            self.username,
        )
        with self.connection.cursor() as cur:
            after_preview = preview.preview_in_transaction(cur, request)
        self.assertEqual(f"{updated_price:.2f}", response["ajuste_venta"])
        self.assertNotEqual(before_preview.previewFingerprint, after_preview.previewFingerprint)
        self.assertEqual(Decimal(before_preview.configuredTotal) + Decimal("1.00"), Decimal(after_preview.configuredTotal))
        self.assertEqual(before_history, self.historical_digest())
        with self.connection.cursor() as cur:
            cur.execute(
                """SELECT COUNT(*) AS total FROM core.catalogo_optico_precio_costo_auditoria
                   WHERE producto_id=%s AND admin_username=%s""",
                (design["producto_id"], self.username),
            )
            self.assertEqual(1, cur.fetchone()["total"])

    def test_confirmed_cost_metadata_and_optimistic_revision(self):
        design = self.component("DEMO-LENS-MONO")
        updated = self.repository.update_component(
            design["producto_id"],
            OpticalComponentUpdate(
                expected_revision=design["revision"],
                costo_laboratorio_estimado=Decimal("456.78"),
                costo_confirmado=True,
                costo_confirmado_referencia="Cotización de laboratorio",
                costo_vigente_desde="2026-08-12",
            ),
            self.username,
        )
        self.assertTrue(updated["costo_confirmado"])
        self.assertIsNotNone(updated["costo_confirmado_at"])
        self.assertEqual(self.username, updated["costo_confirmado_by"])
        self.assertEqual("Cotización de laboratorio", updated["costo_confirmado_referencia"])
        with self.assertRaises(HTTPException) as raised:
            self.repository.update_component(
                design["producto_id"],
                OpticalComponentUpdate(expected_revision=design["revision"], activo=True),
                self.username,
            )
        self.assertEqual(409, raised.exception.status_code)

    def test_variant_override_can_inherit_and_null_cost_never_falls_back(self):
        payload = self.repository.list_components()
        blue = next(item for item in payload["componentes"] if item["sku"] == "DEMO-TRT-BLUE")
        variant = next(item for item in blue["variantes"] if item["variante_id"] == self.variant_id)
        updated = self.repository.update_variant(
            self.variant_id,
            OpticalVariantUpdate(
                expected_revision=variant["revision"],
                ajuste_venta_override=None,
                costo_laboratorio_estimado=None,
                costo_confirmado=False,
            ),
            self.username,
        )
        self.assertIsNone(updated["ajuste_venta_override"])
        self.assertIsNone(updated["costo_laboratorio_estimado"])
        self.assertIsNone(
            backend_main._phase1b_effective_catalog_cost(
                {"costo_unitario": Decimal("100.00")}, {"costo_unitario": None}
            )
        )
        estimate, complete, state = _physical_costs({
            "diseno_producto_id": 7,
            "costo_diseno_snapshot": Decimal("50.00"),
            "tratamiento_producto_id": 13,
            "variante_id": self.variant_id,
            "costo_variante_snapshot": None,
            "costo_tratamiento_snapshot": Decimal("100.00"),
        })
        self.assertEqual(Decimal("50.00"), estimate)
        self.assertFalse(complete)
        self.assertEqual("estimado_parcial", state)

    def test_permissions_keep_cost_management_internal(self):
        list_endpoint = self.routes[("GET", "/catalogo/optica/precios-costos")]
        self.assertEqual(8, len(list_endpoint(user={"rol": "contador"})["componentes"]))
        for role in ("recepcion", "doctor"):
            with self.assertRaises(HTTPException) as raised:
                list_endpoint(user={"rol": role})
            self.assertEqual(403, raised.exception.status_code)
        update_endpoint = self.routes[("PATCH", "/catalogo/optica/componentes/{producto_id}")]
        design = self.component("DEMO-LENS-MONO")
        with self.assertRaises(HTTPException) as raised:
            update_endpoint(
                producto_id=design["producto_id"],
                data=OpticalComponentUpdate(expected_revision=design["revision"], activo=True),
                user={"rol": "contador", "username": "contador"},
            )
        self.assertEqual(403, raised.exception.status_code)

    def test_public_preview_contains_no_cost_or_confirmation_metadata(self):
        catalog = PublicCatalogConfig(
            db_conninfo=backend_main.DB_CONNINFO,
            bearer_token="test",
            media_base_url="http://127.0.0.1:8000",
            allowed_image_origins=("http://127.0.0.1:8000",),
        )
        preview = OpticalPreviewRepository(catalog, connect=lambda *_args, **_kwargs: self.proxy)
        response = preview.options(self.products["DEMO-RX-001"])
        serialized = json.dumps(response.model_dump(mode="json"), ensure_ascii=False).lower()
        self.assertNotIn("costo", serialized)
        self.assertNotIn("confirmado_by", serialized)
        self.assertNotIn("auditoria", serialized)


if __name__ == "__main__":
    unittest.main()
