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
MIGRATION = SCRIPT_DIR / "migrations" / "20260806_phase1fc2a_payment_sessions.sql"
ROLLBACK = SCRIPT_DIR / "migrations" / "20260806_phase1fc2a_payment_sessions_rollback.sql"


class Phase1FC2ASourceTests(unittest.TestCase):
    def test_migration_is_additive_and_payment_provider_neutral(self):
        migration = MIGRATION.read_text(encoding="utf-8")
        rollback = ROLLBACK.read_text(encoding="utf-8")
        self.assertEqual([], re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", migration, re.I))
        self.assertEqual([], re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", rollback, re.I))
        self.assertIn("SET SCHEMA phase1fc2a_isolated_at_rollback", rollback)
        for token in ("online_pagos", "venta_pagos", "ventas", "card_number", "webhook"):
            self.assertNotIn(token, migration.lower())

    def test_feature_flag_and_forbidden_boundaries(self):
        source = (BACKEND_DIR / "online_fulfillment.py").read_text(encoding="utf-8")
        example = (BACKEND_DIR / ".env.example").read_text(encoding="utf-8")
        self.assertIn('payment_sessions_enabled=_env_bool("PHASE_1FC2A_ENABLED", False)', source)
        self.assertIn("PHASE_1FC2A_ENABLED=false", example)
        self.assertIn("fulfillment_payment_session_create", source)
        self.assertIn("payment_session_created", source)
        self.assertNotIn("INSERT INTO core.ventas", source)
        self.assertNotIn("INSERT INTO core.venta_pagos", source)


class Phase1FC2ALiveTests(unittest.TestCase):
    def test_session_creation_is_idempotent_and_does_not_move_money_or_stock(self):
        sys.path.insert(0, str(BACKEND_DIR))
        from online_commerce import CommerceOwner
        from online_fulfillment import FulfillmentConfig, FulfillmentRepository
        import main as backend_main

        connection = psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row)

        class NonCommittingConnection:
            def __enter__(self): return self
            def __exit__(self, *_args): return False
            def cursor(self): return connection.cursor()
            def commit(self): return None

        try:
            with connection.cursor() as cur:
                cur.execute("""
                    SELECT order_row.orden_id, order_row.propietario_tipo, order_row.propietario_ref_hash,
                           request.solicitud_public_id
                    FROM core.online_ordenes order_row
                    JOIN core.online_solicitudes_cotizacion_envio request
                      ON request.solicitud_id = order_row.solicitud_id
                    ORDER BY order_row.created_at DESC LIMIT 1
                """)
                order = cur.fetchone()
                if not order:
                    self.skipTest("No C1 pending order exists")
                owner = CommerceOwner("guest" if order["propietario_tipo"] == "invitado" else "customer", order["propietario_ref_hash"])
                cur.execute("SELECT COUNT(*) AS count FROM core.online_pago_sesiones")
                before_sessions = cur.fetchone()["count"]
                cur.execute("SELECT COUNT(*) AS count FROM core.online_pago_sesiones WHERE orden_id = %s", (order["orden_id"],))
                existing_session = cur.fetchone()["count"] > 0
                cur.execute("SELECT COUNT(*) AS count FROM core.ventas")
                before_sales = cur.fetchone()["count"]

            config = FulfillmentConfig(
                db_conninfo="unused", bearer_token="token", enabled=True,
                reservations_enabled=True, orders_enabled=True, payment_sessions_enabled=True,
            )
            repository = FulfillmentRepository(config, connect=lambda *_args, **_kwargs: NonCommittingConnection())
            request_id = str(order["solicitud_public_id"])
            first = repository.create_payment_session(owner, request_id, f"payment-{uuid4()}")
            second = repository.create_payment_session(owner, request_id, f"payment-{uuid4()}")
            self.assertEqual(first["paymentSessionId"], second["paymentSessionId"])
            self.assertEqual("conekta", first["provider"])
            self.assertEqual("pending", first["status"])
            self.assertIsNone(first["checkoutUrl"])
            self.assertFalse(first["chargeCreated"])
            self.assertFalse(first["orderMarkedPaid"])
            with connection.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS count FROM core.online_pago_sesiones")
                self.assertEqual(before_sessions + (0 if existing_session else 1), cur.fetchone()["count"])
                cur.execute("SELECT COUNT(*) AS count FROM core.ventas")
                self.assertEqual(before_sales, cur.fetchone()["count"])
        finally:
            connection.rollback()
            connection.close()


if __name__ == "__main__":
    unittest.main()
