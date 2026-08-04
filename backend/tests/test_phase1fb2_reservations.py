from __future__ import annotations

from pathlib import Path
import re
import sys
import time
import unittest
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = BACKEND_DIR / "scripts"
MIGRATION = SCRIPT_DIR / "migrations" / "20260803_phase1fb2_online_reservations.sql"
ROLLBACK = SCRIPT_DIR / "migrations" / "20260803_phase1fb2_online_reservations_rollback.sql"


class Phase1FB2SourceTests(unittest.TestCase):
    def test_migration_is_additive_and_out_of_scope_actions_are_absent(self):
        migration = MIGRATION.read_text(encoding="utf-8")
        rollback = ROLLBACK.read_text(encoding="utf-8")
        self.assertEqual([], re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", migration, re.I))
        self.assertEqual([], re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", rollback, re.I))
        self.assertIn("SET SCHEMA phase1fb2_isolated", rollback)
        for token in ("online_ordenes", "online_pagos", "tracking_number", "shipping_label"):
            self.assertNotIn(token, migration)

    def test_reservation_defaults_and_database_guards_exist(self):
        migration = MIGRATION.read_text(encoding="utf-8")
        self.assertIn("vigencia_minutos INTEGER NOT NULL DEFAULT 20", migration)
        self.assertIn("stock_reservado", migration + (BACKEND_DIR / "online_fulfillment.py").read_text(encoding="utf-8"))
        self.assertIn("online_reservas_solicitud_activa_uq", migration)
        self.assertIn("online_reserva_eventos_tipo_uq", migration)

    def test_create_release_and_expiration_are_locked_and_idempotent(self):
        source = (BACKEND_DIR / "online_fulfillment.py").read_text(encoding="utf-8")
        self.assertIn('"fulfillment_reservation_create"', source)
        self.assertIn('"fulfillment_reservation_release"', source)
        self.assertIn("FOR UPDATE", source)
        self.assertIn("SKIP LOCKED", source)
        self.assertIn("reservation_expired", source)
        self.assertIn("reservation_released", source)
        self.assertIn("stock_reservado = stock_reservado + %s", source)
        self.assertIn("stock_reservado = stock_reservado - %s", source)

    def test_b2_flag_defaults_false_in_runtime_and_examples(self):
        source = (BACKEND_DIR / "online_fulfillment.py").read_text(encoding="utf-8")
        example = (BACKEND_DIR / ".env.example").read_text(encoding="utf-8")
        self.assertIn('reservations_enabled=_env_bool("PHASE_1FB2_ENABLED", False)', source)
        self.assertIn("PHASE_1FB2_ENABLED=false", example)

    def test_b2_payload_cannot_create_phase_1f_c_records(self):
        source = (BACKEND_DIR / "online_fulfillment.py").read_text(encoding="utf-8")
        self.assertIn('"orderCreated": False', source)
        self.assertIn('"paymentCreated": False', source)
        self.assertIn('"saleCreated": False', source)
        self.assertIn('"shipmentCreated": False', source)
        self.assertNotIn("INSERT INTO core.online_ordenes", source)
        self.assertNotIn("INSERT INTO core.ventas", source)


class Phase1FB2LiveTests(unittest.TestCase):
    def test_create_release_is_idempotent_and_preserves_stock(self):
        sys.path.insert(0, str(BACKEND_DIR))
        from online_commerce import CommerceOwner
        from online_fulfillment import (
            AddressInput,
            ContactInput,
            CreateFulfillmentRequest,
            FulfillmentConfig,
            FulfillmentRepository,
            ManualQuoteInput,
            FulfillmentAdminRepository,
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

            wrapper = NonCommittingConnection()
            config = FulfillmentConfig("unused", "token", True, True)
            repository = FulfillmentRepository(config, connect=lambda *_args, **_kwargs: wrapper)
            staff_repository = FulfillmentAdminRepository(config, connect=lambda *_args, **_kwargs: wrapper)
            request = repository.create_request(owner, CreateFulfillmentRequest(method="shipping", contact=ContactInput(fullName="B2 Test", email="b2@example.com", phone="5512345678"), address=AddressInput(street="Test", exteriorNumber="1", neighborhood="Centro", postalCode="77500", city="Playa del Carmen", state="Quintana Roo", country="México")), f"request-{uuid4()}")
            admin = {"username": "admin", "rol": "admin"}
            quote = staff_repository.add_quote(admin, request["requestId"], ManualQuoteInput(branchId=branch_id, carrierCode="dhl", serviceLevel="Test", amount=100, minimumDeliveryDays=1, maximumDeliveryDays=2))
            selected = repository.select_option(owner, request["requestId"], quote["options"][0]["optionId"], f"select-{uuid4()}")
            first = repository.create_reservation(owner, request["requestId"], f"reserve-{uuid4()}")
            second = repository.create_reservation(owner, request["requestId"], f"reserve-{uuid4()}")
            self.assertEqual(first["reservationId"], second["reservationId"])
            with connection.cursor() as cur:
                cur.execute("SELECT stock,stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=%s AND sucursal_id=%s", (product_id, branch_id))
                self.assertEqual((10, 1), tuple(cur.fetchone().values()))
                cur.execute("SELECT COUNT(*) AS count FROM core.online_reserva_eventos WHERE reserva_id=(SELECT reserva_id FROM core.online_reservas WHERE reserva_public_id=%s) AND evento_tipo='reservation_created'", (first["reservationId"],))
                self.assertEqual(1, cur.fetchone()["count"])
            released = repository.release_reservation(owner, request["requestId"], f"release-{uuid4()}")
            repeated_release = repository.release_reservation(owner, request["requestId"], f"release-{uuid4()}")
            self.assertEqual("released", released["status"])
            self.assertEqual(released["reservationId"], repeated_release["reservationId"])
            with connection.cursor() as cur:
                cur.execute("SELECT stock,stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=%s AND sucursal_id=%s", (product_id, branch_id))
                self.assertEqual((10, 0), tuple(cur.fetchone().values()))
                cur.execute("SELECT COUNT(*) AS count FROM core.online_reserva_eventos WHERE reserva_id=(SELECT reserva_id FROM core.online_reservas WHERE reserva_public_id=%s) AND evento_tipo='reservation_released'", (first["reservationId"],))
                self.assertEqual(1, cur.fetchone()["count"])
            expiring = repository.create_reservation(owner, request["requestId"], f"reserve-expiring-{uuid4()}")
            with connection.cursor() as cur:
                cur.execute("UPDATE core.online_reservas SET expires_at=created_at + INTERVAL '1 second' WHERE reserva_public_id=%s", (expiring["reservationId"],))
            time.sleep(2)
            with connection.cursor() as cur:
                self.assertEqual(1, repository._release_expired_reservations(cur))
                # The public ID is intentionally opaque; retrieve the row by its
                # public identifier for an exact reaper assertion.
                cur.execute("SELECT reserva_id FROM core.online_reservas WHERE reserva_public_id=%s", (expiring["reservationId"],))
                expiring_id = cur.fetchone()["reserva_id"]
                cur.execute(repository._reservation_query(), (expiring_id,))
                expired = repository._reservation_payload(cur, cur.fetchone())
                self.assertEqual("expired", expired["status"])
                cur.execute("SELECT stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=%s AND sucursal_id=%s", (product_id, branch_id))
                self.assertEqual(0, cur.fetchone()["stock_reservado"])
                cur.execute("SELECT COUNT(*) AS count FROM core.online_reserva_eventos WHERE reserva_id=(SELECT reserva_id FROM core.online_reservas WHERE reserva_public_id=%s) AND evento_tipo='reservation_expired'", (expiring["reservationId"],))
                self.assertEqual(1, cur.fetchone()["count"])
        finally:
            connection.rollback()
            connection.close()


if __name__ == "__main__":
    unittest.main()
