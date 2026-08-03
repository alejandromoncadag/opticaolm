from __future__ import annotations

from decimal import Decimal
from pathlib import Path
import re
import sys
import unittest
from uuid import uuid4

from psycopg.rows import dict_row
import psycopg


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = BACKEND_DIR / "scripts"
MIGRATION = SCRIPT_DIR / "migrations" / "20260802_phase1fb1_manual_fulfillment.sql"
ROLLBACK = SCRIPT_DIR / "migrations" / "20260802_phase1fb1_manual_fulfillment_rollback.sql"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(SCRIPT_DIR))

import main as backend_main
from online_commerce import CommerceOwner
from online_fulfillment import (
    AddressInput,
    ContactInput,
    CreateFulfillmentRequest,
    FulfillmentAdminRepository,
    FulfillmentConfig,
    FulfillmentRepository,
    FulfillmentRuleError,
    ManualQuoteInput,
)
from shipping_packages import (
    PackageRuleError,
    PackagingConfiguration,
    ProductShippingMeasurement,
    SingleCombinedPackageCalculator,
)


class NonCommittingConnection:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc, _traceback):
        return False

    def cursor(self):
        return self.connection.cursor()

    def commit(self):
        return None


class Phase1FB1Tests(unittest.TestCase):
    maxDiff = None

    def test_migration_is_additive_and_isolation_is_non_destructive(self):
        migration = MIGRATION.read_text(encoding="utf-8")
        rollback = ROLLBACK.read_text(encoding="utf-8")
        self.assertEqual([], re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", migration, re.I))
        self.assertEqual([], re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", rollback, re.I))
        self.assertIn("SET SCHEMA phase1fb1_isolated", rollback)
        self.assertNotIn("stock_reservado =", migration)
        self.assertNotIn("online_ordenes", migration)
        self.assertNotIn("online_reservas", migration)

    def test_single_package_rejects_individual_products(self):
        calculator = SingleCombinedPackageCalculator()
        with self.assertRaises(PackageRuleError) as caught:
            calculator.calculate(
                [ProductShippingMeasurement(1, 1, 100, 100, 100, 40, True)],
                PackagingConfiguration(20, 5, 5, 5, 1000, 500, 500, 500),
            )
        self.assertEqual("MULTI_PACKAGE_NOT_SUPPORTED", caught.exception.code)

    def test_live_manual_quote_selection_isolated_from_inventory_and_sales(self):
        connection = psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row)
        wrapper = NonCommittingConnection(connection)
        owner = CommerceOwner("customer", uuid4().hex + uuid4().hex)
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT to_regclass('core.online_solicitudes_cotizacion_envio') AS ready")
                if not cur.fetchone()["ready"]:
                    self.skipTest("Phase 1F-B1 migration has not been applied")
                cur.execute(
                    """SELECT product.* FROM core.catalogo_productos product
                       JOIN core.online_producto_configuracion online USING (producto_id)
                       WHERE product.tipo_producto = 'producto_fisico' AND product.controla_stock = TRUE
                       ORDER BY product.producto_id LIMIT 1"""
                )
                product = cur.fetchone()
                if not product:
                    self.skipTest("No stock-controlled physical product exists")
                product_id = int(product["producto_id"])
                cur.execute("UPDATE core.catalogo_productos SET activo=TRUE, publicado_online=TRUE, precio=100, updated_at=NOW() WHERE producto_id=%s", (product_id,))
                cur.execute("UPDATE core.online_producto_configuracion SET comprable_online=TRUE WHERE producto_id=%s", (product_id,))
                cur.execute("UPDATE core.sucursales SET activa=TRUE, cp=COALESCE(NULLIF(cp,''), '77500') WHERE sucursal_id IN (1,2)")
                for branch_id in (1, 2):
                    cur.execute(
                        """INSERT INTO core.catalogo_inventario_sucursal
                           (producto_id, sucursal_id, stock, stock_reservado, stock_minimo, disponible_venta)
                           VALUES (%s, %s, 10, 0, 0, TRUE)
                           ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET stock=10, stock_reservado=0, disponible_venta=TRUE""",
                        (product_id, branch_id),
                    )
                cur.execute("UPDATE core.envio_configuracion_empaque SET activa=TRUE, peso_empaque_gramos=50, margen_largo_mm=10, margen_ancho_mm=10, margen_alto_mm=10, peso_maximo_gramos=5000, largo_maximo_mm=1000, ancho_maximo_mm=1000, alto_maximo_mm=1000 WHERE configuracion_id=1")
                cur.execute("UPDATE core.catalogo_producto_envio SET activo=FALSE, peso_gramos=NULL, largo_mm=NULL, ancho_mm=NULL, alto_mm=NULL WHERE producto_id=%s", (product_id,))
                cur.execute("UPDATE core.envio_categoria_fallbacks SET activo=FALSE WHERE categoria=%s", (product["categoria"],))
                cur.execute("INSERT INTO core.online_carritos (propietario_tipo, propietario_ref_hash) VALUES ('cliente', %s) RETURNING carrito_id", (owner.owner_hash,))
                cart_id = int(cur.fetchone()["carrito_id"])
                cur.execute(
                    """INSERT INTO core.online_carrito_items (
                           carrito_id, producto_id, sku_snapshot, slug_snapshot, nombre_snapshot,
                           cantidad, configuracion_hash, precio_observado, precio_reconocido,
                           producto_updated_at_observado)
                       SELECT %s, producto_id, sku, slug, nombre, 1, %s, precio, precio, updated_at
                       FROM core.catalogo_productos WHERE producto_id=%s""",
                    (cart_id, "0" * 64, product_id),
                )
                cur.execute("SELECT sucursal_id, stock, stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=%s ORDER BY sucursal_id", (product_id,))
                stock_before = list(cur.fetchall())
                protected_before = {}
                for table in ("ventas", "venta_pagos", "catalogo_inventario_movimientos"):
                    cur.execute(f"SELECT COUNT(*) AS count FROM core.{table}")
                    protected_before[table] = int(cur.fetchone()["count"])
                cur.execute("SELECT username, rol FROM core.usuarios WHERE rol='admin' AND activo=TRUE LIMIT 1")
                admin = cur.fetchone()
                cur.execute("SELECT username, rol FROM core.usuarios WHERE rol='recepcion' AND activo=TRUE LIMIT 1")
                reception = cur.fetchone()
                if not admin or not reception:
                    self.skipTest("Active admin and reception fixtures are required")

            config = FulfillmentConfig("unused", "token", True)
            repository = FulfillmentRepository(config, connect=lambda *_args, **_kwargs: wrapper)
            staff_repository = FulfillmentAdminRepository(config, connect=lambda *_args, **_kwargs: wrapper)
            request_data = CreateFulfillmentRequest(
                method="shipping",
                contact=ContactInput(fullName="Test Customer", email="test@example.com", phone="5512345678"),
                address=AddressInput(street="Avenida Test", exteriorNumber="10", neighborhood="Centro", postalCode="77500", city="Playa del Carmen", state="Quintana Roo", country="México"),
            )
            with self.assertRaises(FulfillmentRuleError) as missing:
                repository.create_request(owner, request_data, f"missing-{uuid4()}")
            self.assertEqual("SHIPPING_MEASUREMENTS_MISSING", missing.exception.detail["code"])
            with connection.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS count FROM core.online_solicitudes_cotizacion_envio WHERE propietario_ref_hash=%s", (owner.owner_hash,))
                self.assertEqual(0, int(cur.fetchone()["count"]))
                cur.execute("UPDATE core.catalogo_producto_envio SET activo=TRUE, peso_gramos=200, largo_mm=180, ancho_mm=80, alto_mm=60 WHERE producto_id=%s", (product_id,))

            created = repository.create_request(owner, request_data, f"request-{uuid4()}")
            self.assertEqual("pending", created["status"])
            self.assertEqual(1, len(created["packages"]))
            request_id = created["requestId"]

            with self.assertRaises(FulfillmentRuleError) as forbidden:
                staff_repository.list_requests({"username": "doctor", "rol": "doctor"})
            self.assertEqual(403, forbidden.exception.status_code)
            reception_queue = staff_repository.list_requests(dict(reception))
            admin_queue = staff_repository.list_requests(dict(admin), status="pending")
            self.assertIn(
                request_id,
                {item["requestId"] for item in reception_queue["requests"]},
            )
            self.assertIn(
                request_id,
                {item["requestId"] for item in admin_queue["requests"]},
            )

            quote_one = staff_repository.add_quote(
                dict(reception), request_id,
                ManualQuoteInput(branchId=1, carrierCode="dhl", serviceLevel="Express", amount=Decimal("180"), minimumDeliveryDays=1, maximumDeliveryDays=2),
            )
            self.assertEqual("quoted", quote_one["status"])
            with self.assertRaises(FulfillmentRuleError) as zero_forbidden:
                staff_repository.add_quote(
                    dict(reception), request_id,
                    ManualQuoteInput(branchId=2, carrierCode="fedex", serviceLevel="Promo", amount=Decimal("0"), minimumDeliveryDays=2, maximumDeliveryDays=3),
                )
            self.assertEqual("ZERO_SHIPPING_ADMIN_REQUIRED", zero_forbidden.exception.detail["code"])
            quoted = staff_repository.add_quote(
                dict(admin), request_id,
                ManualQuoteInput(branchId=2, carrierCode="estafeta", serviceLevel="Terrestre", amount=Decimal("100"), minimumDeliveryDays=4, maximumDeliveryDays=5),
            )
            self.assertEqual(2, len(quoted["options"]))
            self.assertNotEqual(quoted["ranking"]["cheapestOptionId"], quoted["ranking"]["fastestOptionId"])

            fast_option = quoted["ranking"]["fastestOptionId"]
            key = f"select-{uuid4()}"
            preview = repository.select_option(owner, request_id, fast_option, key)
            replay = repository.select_option(owner, request_id, fast_option, key)
            self.assertEqual(preview, replay)
            self.assertFalse(preview["reservationCreated"])
            self.assertFalse(preview["orderCreated"])
            self.assertEqual("280.00", preview["total"])

            selected_request = repository.get_request(owner, request_id)
            self.assertEqual(fast_option, selected_request["selectedOptionId"])
            self.assertEqual(preview, repository.get_preview(owner, request_id))

            alternate_option = next(
                option["optionId"]
                for option in quoted["options"]
                if option["optionId"] != fast_option
            )
            reselection_key = f"reselect-{uuid4()}"
            reselection = repository.select_option(
                owner, request_id, alternate_option, reselection_key
            )
            reselection_replay = repository.select_option(
                owner, request_id, alternate_option, reselection_key
            )
            self.assertEqual(reselection, reselection_replay)
            self.assertEqual("100.00", reselection["shipping"])
            self.assertEqual("200.00", reselection["total"])
            self.assertEqual(alternate_option, reselection["fulfillment"]["optionId"])
            self.assertEqual(reselection, repository.get_preview(owner, request_id))
            self.assertEqual(
                alternate_option,
                repository.get_request(owner, request_id)["selectedOptionId"],
            )

            with connection.cursor() as cur:
                cur.execute("SELECT sucursal_id, stock, stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=%s ORDER BY sucursal_id", (product_id,))
                self.assertEqual(stock_before, list(cur.fetchall()))
                for table, count in protected_before.items():
                    cur.execute(f"SELECT COUNT(*) AS count FROM core.{table}")
                    self.assertEqual(count, int(cur.fetchone()["count"]))
                cur.execute("SELECT COUNT(*) AS count FROM core.online_cotizacion_envio_eventos WHERE solicitud_id=(SELECT solicitud_id FROM core.online_solicitudes_cotizacion_envio WHERE solicitud_public_id=%s) AND evento_tipo='option_selected'", (request_id,))
                self.assertEqual(1, int(cur.fetchone()["count"]))
                cur.execute("SELECT COUNT(*) AS count FROM core.online_cotizacion_envio_eventos WHERE solicitud_id=(SELECT solicitud_id FROM core.online_solicitudes_cotizacion_envio WHERE solicitud_public_id=%s) AND evento_tipo='option_reselected'", (request_id,))
                self.assertEqual(1, int(cur.fetchone()["count"]))
                cur.execute("SELECT COUNT(*) AS count FROM core.online_cotizacion_selecciones WHERE solicitud_id=(SELECT solicitud_id FROM core.online_solicitudes_cotizacion_envio WHERE solicitud_public_id=%s)", (request_id,))
                self.assertEqual(1, int(cur.fetchone()["count"]))
                cur.execute("SELECT COUNT(*) AS count FROM core.online_checkout_previews WHERE solicitud_id=(SELECT solicitud_id FROM core.online_solicitudes_cotizacion_envio WHERE solicitud_public_id=%s)", (request_id,))
                self.assertEqual(1, int(cur.fetchone()["count"]))

                pickup_owner = CommerceOwner("guest", uuid4().hex + uuid4().hex)
                cur.execute("UPDATE core.envio_configuracion_empaque SET activa=FALSE WHERE configuracion_id=1")
                cur.execute("INSERT INTO core.online_carritos (propietario_tipo, propietario_ref_hash, expira_at) VALUES ('invitado', %s, NOW() + INTERVAL '30 days') RETURNING carrito_id", (pickup_owner.owner_hash,))
                pickup_cart_id = int(cur.fetchone()["carrito_id"])
                cur.execute(
                    """INSERT INTO core.online_carrito_items (
                           carrito_id, producto_id, sku_snapshot, slug_snapshot, nombre_snapshot,
                           cantidad, configuracion_hash, precio_observado, precio_reconocido,
                           producto_updated_at_observado)
                       SELECT %s, producto_id, sku, slug, nombre, 1, %s, precio, precio, updated_at
                       FROM core.catalogo_productos WHERE producto_id=%s""",
                    (pickup_cart_id, "1" * 64, product_id),
                )

            pickup = repository.create_request(
                pickup_owner,
                CreateFulfillmentRequest(
                    method="pickup",
                    contact=ContactInput(fullName="Pickup Guest", email="pickup@example.com", phone="5512345678"),
                    pickupBranchId=1,
                ),
                f"pickup-{uuid4()}",
            )
            self.assertEqual([], pickup["packages"])
            self.assertEqual("0.00", pickup["options"][0]["amount"])
            self.assertEqual("pickup", pickup["options"][0]["carrierCode"])
            with connection.cursor() as cur:
                cur.execute("SELECT sucursal_id, stock, stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=%s ORDER BY sucursal_id", (product_id,))
                self.assertEqual(stock_before, list(cur.fetchall()))
        finally:
            connection.rollback()
            connection.close()


if __name__ == "__main__":
    unittest.main()
