from __future__ import annotations

from pathlib import Path
import re
import sys
import unittest
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = BACKEND_DIR / "scripts"
MIGRATION = SCRIPT_DIR / "migrations" / "20260805_phase1fc1_online_orders.sql"
ROLLBACK = SCRIPT_DIR / "migrations" / "20260805_phase1fc1_online_orders_rollback.sql"


class Phase1FC1SourceTests(unittest.TestCase):
    def test_c1_migration_is_additive_and_payment_neutral(self):
        migration = MIGRATION.read_text(encoding="utf-8")
        rollback = ROLLBACK.read_text(encoding="utf-8")
        self.assertEqual([], re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", migration, re.I))
        self.assertEqual([], re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", rollback, re.I))
        self.assertIn("SET SCHEMA phase1fc1_isolated", rollback)
        for token in ("online_pagos", "venta_pagos", "tracking", "facturas"):
            self.assertNotIn(token, migration)

    def test_c1_flag_and_order_boundaries_exist(self):
        source = (BACKEND_DIR / "online_fulfillment.py").read_text(encoding="utf-8")
        example = (BACKEND_DIR / ".env.example").read_text(encoding="utf-8")
        self.assertIn('orders_enabled=_env_bool("PHASE_1FC1_ENABLED", False)', source)
        self.assertIn("PHASE_1FC1_ENABLED=false", example)
        for token in ('"paymentCreated": False', '"saleCreated": False', '"shipmentCreated": False', '"inventoryDeducted": False'):
            self.assertIn(token, source)
        self.assertNotIn("INSERT INTO core.ventas", source)
        self.assertNotIn("INSERT INTO core.venta_pagos", source)


class Phase1FC1LiveTests(unittest.TestCase):
    def test_order_creation_is_idempotent_and_does_not_deduct_inventory(self):
        sys.path.insert(0, str(BACKEND_DIR))
        from online_commerce import CommerceOwner
        from online_fulfillment import (
            AddressInput,
            ContactInput,
            CreateFulfillmentRequest,
            FulfillmentAdminRepository,
            FulfillmentConfig,
            FulfillmentRepository,
            ManualQuoteInput,
        )
        import main as backend_main

        connection = psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row)
        owner = CommerceOwner("customer", uuid4().hex + uuid4().hex)

        class NonCommittingConnection:
            def __enter__(self): return self
            def __exit__(self, *_args): return False
            def cursor(self): return connection.cursor()
            def commit(self): return None

        try:
            with connection.cursor() as cur:
                cur.execute("SELECT product.* FROM core.catalogo_productos product JOIN core.online_producto_configuracion online USING (producto_id) WHERE product.tipo_producto='producto_fisico' AND product.controla_stock=TRUE ORDER BY product.producto_id LIMIT 1")
                product = cur.fetchone()
                if not product:
                    self.skipTest("No stock-controlled product exists")
                product_id = int(product["producto_id"])
                cur.execute("SELECT sucursal_id FROM core.sucursales WHERE activa=TRUE ORDER BY sucursal_id LIMIT 1")
                branch = cur.fetchone()
                if not branch:
                    self.skipTest("No active branch exists")
                branch_id = int(branch["sucursal_id"])
                cur.execute("UPDATE core.catalogo_productos SET activo=TRUE, publicado_online=TRUE, precio=100, updated_at=NOW() WHERE producto_id=%s", (product_id,))
                cur.execute("UPDATE core.online_producto_configuracion SET comprable_online=TRUE WHERE producto_id=%s", (product_id,))
                cur.execute("UPDATE core.sucursales SET cp=COALESCE(NULLIF(cp,''),'77500') WHERE sucursal_id=%s", (branch_id,))
                cur.execute("INSERT INTO core.catalogo_inventario_sucursal (producto_id,sucursal_id,stock,stock_reservado,stock_minimo,disponible_venta) VALUES (%s,%s,10,0,0,TRUE) ON CONFLICT (producto_id,sucursal_id) DO UPDATE SET stock=10,stock_reservado=0,disponible_venta=TRUE", (product_id, branch_id))
                cur.execute("UPDATE core.envio_configuracion_empaque SET activa=TRUE,peso_empaque_gramos=50,margen_largo_mm=10,margen_ancho_mm=10,margen_alto_mm=10,peso_maximo_gramos=5000,largo_maximo_mm=1000,ancho_maximo_mm=1000,alto_maximo_mm=1000 WHERE configuracion_id=1")
                cur.execute("UPDATE core.catalogo_producto_envio SET activo=TRUE,peso_gramos=200,largo_mm=180,ancho_mm=80,alto_mm=60 WHERE producto_id=%s", (product_id,))
                cur.execute("INSERT INTO core.online_carritos (propietario_tipo,propietario_ref_hash) VALUES ('cliente',%s) RETURNING carrito_id", (owner.owner_hash,))
                cart_id = int(cur.fetchone()["carrito_id"])
                cur.execute("INSERT INTO core.online_carrito_items (carrito_id,producto_id,sku_snapshot,slug_snapshot,nombre_snapshot,cantidad,configuracion_hash,precio_observado,precio_reconocido,producto_updated_at_observado) SELECT %s,producto_id,sku,slug,nombre,1,%s,precio,precio,updated_at FROM core.catalogo_productos WHERE producto_id=%s", (cart_id, "0" * 64, product_id))
                cur.execute("SELECT stock,stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=%s AND sucursal_id=%s", (product_id, branch_id))
                before_inventory = tuple(cur.fetchone().values())
                cur.execute("SELECT COUNT(*) AS count FROM core.ventas")
                before_sales = cur.fetchone()["count"]
                cur.execute("SELECT COUNT(*) AS count FROM core.online_ordenes")
                before_orders = cur.fetchone()["count"]
                cur.execute("SELECT COUNT(*) AS count FROM core.online_orden_lineas")
                before_lines = cur.fetchone()["count"]
                cur.execute("SELECT COUNT(*) AS count FROM core.online_orden_eventos WHERE evento_tipo='order_created'")
                before_events = cur.fetchone()["count"]

            wrapper = NonCommittingConnection()
            config = FulfillmentConfig("unused", "token", True, True, True)
            repository = FulfillmentRepository(config, connect=lambda *_args, **_kwargs: wrapper)
            staff_repository = FulfillmentAdminRepository(config, connect=lambda *_args, **_kwargs: wrapper)
            request = repository.create_request(owner, CreateFulfillmentRequest(method="shipping", contact=ContactInput(fullName="C1 Test", email="c1@example.com", phone="5512345678"), address=AddressInput(street="Test", exteriorNumber="1", neighborhood="Centro", postalCode="77500", city="Playa del Carmen", state="Quintana Roo", country="México")), f"request-{uuid4()}")
            quote = staff_repository.add_quote({"username": "admin", "rol": "admin"}, request["requestId"], ManualQuoteInput(branchId=branch_id, carrierCode="dhl", serviceLevel="Test", amount=100, minimumDeliveryDays=1, maximumDeliveryDays=2))
            repository.select_option(owner, request["requestId"], quote["options"][0]["optionId"], f"select-{uuid4()}")
            reservation = repository.create_reservation(owner, request["requestId"], f"reserve-{uuid4()}")
            first = repository.create_order(owner, request["requestId"], f"order-{uuid4()}")
            second = repository.create_order(owner, request["requestId"], f"order-{uuid4()}")
            self.assertEqual(first["orderId"], second["orderId"])
            self.assertEqual("pending_payment", first["status"])
            self.assertEqual("200.00", first["total"])
            self.assertFalse(first["paymentCreated"])
            self.assertFalse(first["saleCreated"])
            self.assertFalse(first["shipmentCreated"])
            self.assertFalse(first["inventoryDeducted"])
            with connection.cursor() as cur:
                cur.execute("SELECT stock,stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=%s AND sucursal_id=%s", (product_id, branch_id))
                self.assertEqual((10, 1), tuple(cur.fetchone().values()))
                cur.execute("SELECT COUNT(*) AS count FROM core.online_ordenes")
                self.assertEqual(before_orders + 1, cur.fetchone()["count"])
                cur.execute("SELECT COUNT(*) AS count FROM core.online_orden_lineas")
                self.assertEqual(before_lines + 1, cur.fetchone()["count"])
                cur.execute("SELECT COUNT(*) AS count FROM core.online_orden_eventos WHERE evento_tipo='order_created'")
                self.assertEqual(before_events + 1, cur.fetchone()["count"])
                cur.execute("SELECT COUNT(*) AS count FROM core.ventas")
                self.assertEqual(before_sales, cur.fetchone()["count"])
                cur.execute("SELECT stock,stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=%s AND sucursal_id=%s", (product_id, branch_id))
                self.assertEqual((10, 1), tuple(cur.fetchone().values()))
        finally:
            connection.rollback()
            connection.close()


if __name__ == "__main__":
    unittest.main()
