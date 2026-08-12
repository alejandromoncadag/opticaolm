from __future__ import annotations

from pathlib import Path
import re
import sys
import unittest

from fastapi import HTTPException
from psycopg.rows import dict_row
import psycopg


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = BACKEND_DIR / "scripts"
PROJECT_DIR = BACKEND_DIR.parent
MIGRATION_PATH = (
    SCRIPTS_DIR / "migrations" / "20260802_phase1fa_authoritative_commerce.sql"
)
ROLLBACK_PATH = (
    SCRIPTS_DIR
    / "migrations"
    / "20260802_phase1fa_authoritative_commerce_rollback.sql"
)

sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(SCRIPTS_DIR))

import main as backend_main
from online_commerce import (
    AddCartItemRequest,
    CommerceConfig,
    CommerceOwner,
    CommerceRepository,
    CommerceRuleError,
    commerce_credentials_valid,
)
from online_product_policy import is_direct_purchase_product


class NonCommittingConnection:
    """Expose one test transaction while neutralizing repository commits."""

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


class Phase1FACommerceTests(unittest.TestCase):
    def test_only_stock_controlled_optical_frames_use_direct_purchase_exception(self) -> None:
        frame = {
            "categoria": "lentes_opticos",
            "subcategoria": "armazon",
            "tipo_producto": "producto_fisico",
            "controla_stock": True,
        }
        self.assertTrue(is_direct_purchase_product(frame))

        for blocked in (
            {**frame, "controla_stock": False},
            {**frame, "subcategoria": "mica"},
            {**frame, "tipo_producto": "componente_mica"},
            {
                "categoria": "micas",
                "subcategoria": "tratamiento",
                "tipo_producto": "componente_mica",
                "controla_stock": False,
            },
            {
                "categoria": "examen_de_la_vista",
                "subcategoria": "consulta",
                "tipo_producto": "servicio",
                "controla_stock": False,
            },
        ):
            self.assertFalse(is_direct_purchase_product(blocked))

    def test_migration_is_additive_and_rollback_only_isolates(self) -> None:
        migration = MIGRATION_PATH.read_text(encoding="utf-8")
        rollback = ROLLBACK_PATH.read_text(encoding="utf-8")
        self.assertEqual(
            [],
            re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", migration, re.I),
        )
        self.assertEqual(
            [],
            re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", rollback, re.I),
        )
        self.assertIn("RENAME TO", rollback)

    def test_constant_time_bearer_validation_contract(self) -> None:
        from fastapi.security import HTTPAuthorizationCredentials

        self.assertFalse(commerce_credentials_valid(None, "expected"))
        self.assertFalse(
            commerce_credentials_valid(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials="wrong"),
                "expected",
            )
        )
        self.assertTrue(
            commerce_credentials_valid(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials="expected"),
                "expected",
            )
        )

    def test_online_controls_are_admin_only(self) -> None:
        for role in ("recepcion", "doctor", "contador"):
            with self.assertRaises(HTTPException) as caught:
                backend_main.actualizar_comercio_online_producto(
                    1,
                    backend_main.ProductoComercioOnlineUpdate(
                        publicado_online=True,
                        comprable_online=False,
                        permite_favorito=True,
                        cantidad_maxima_por_linea=None,
                    ),
                    {"username": role, "rol": role, "sucursal_id": 1},
                )
            self.assertEqual(403, caught.exception.status_code)

    def test_live_cart_favorites_merge_and_validation_roll_back(self) -> None:
        connection = psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row)
        wrapper = NonCommittingConnection(connection)
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT to_regclass('core.online_carritos') IS NOT NULL AS ready")
                if not cur.fetchone()["ready"]:
                    self.skipTest("Phase 1F-A migration has not been applied")
                cur.execute(
                    """
                    SELECT product.producto_id
                    FROM core.catalogo_productos product
                    WHERE product.categoria IN (
                        'lentes_de_sol', 'lentes_de_contacto',
                        'accesorios_y_refacciones', 'soluciones_y_cuidado'
                    )
                      AND product.tipo_producto = 'producto_fisico'
                      AND product.controla_stock = TRUE
                    ORDER BY product.producto_id
                    LIMIT 1
                    """
                )
                product = cur.fetchone()
                if not product:
                    self.skipTest("No approved physical demo product exists")
                product_id = int(product["producto_id"])
                cur.execute(
                    """
                    UPDATE core.catalogo_productos
                    SET activo = TRUE, publicado_online = TRUE, precio = 100.00,
                        updated_at = NOW()
                    WHERE producto_id = %s
                    """,
                    (product_id,),
                )
                cur.execute(
                    """
                    UPDATE core.online_producto_configuracion
                    SET comprable_online = TRUE, permite_favorito = TRUE,
                        cantidad_maxima_por_linea = NULL
                    WHERE producto_id = %s
                    """,
                    (product_id,),
                )
                cur.execute(
                    """
                    UPDATE core.catalogo_inventario_sucursal
                    SET stock = 3, stock_reservado = 0, disponible_venta = TRUE
                    WHERE producto_id = %s
                      AND sucursal_id = (
                          SELECT MIN(sucursal_id)
                          FROM core.catalogo_inventario_sucursal
                          WHERE producto_id = %s
                      )
                    """,
                    (product_id, product_id),
                )
                tracked = {}
                for table in (
                    "ventas",
                    "venta_pagos",
                    "catalogo_inventario_movimientos",
                ):
                    cur.execute(f"SELECT COUNT(*) AS count FROM core.{table}")
                    tracked[table] = int(cur.fetchone()["count"])

            config = CommerceConfig(
                db_conninfo="unused",
                bearer_token="test-token",
                enabled=True,
                catalog_config=None,
            )
            repository = CommerceRepository(config, connect=lambda *_args, **_kwargs: wrapper)
            guest = CommerceOwner("guest", "a" * 64)
            customer = CommerceOwner("customer", "b" * 64)

            first = repository.add_cart_item(
                guest,
                AddCartItemRequest(productId=product_id, quantity=1),
                "add-once",
            )
            replay = repository.add_cart_item(
                guest,
                AddCartItemRequest(productId=product_id, quantity=1),
                "add-once",
            )
            self.assertEqual(1, first["itemCount"])
            self.assertEqual(first, replay)
            item_id = int(first["items"][0]["itemId"])

            overstock = repository.update_cart_item(
                guest, item_id, 4, "quantity-overstock"
            )
            self.assertEqual(
                "quantity_exceeds_total_availability",
                overstock["items"][0]["status"],
            )
            self.assertEqual(4, overstock["items"][0]["quantity"])

            with connection.cursor() as cur:
                cur.execute(
                    """
                    UPDATE core.catalogo_productos
                    SET precio = 90.00, updated_at = NOW()
                    WHERE producto_id = %s
                    """,
                    (product_id,),
                )
            changed = repository.get_cart(guest)
            self.assertTrue(changed["items"][0]["priceChanged"])
            self.assertEqual("100.00", changed["items"][0]["previouslyObservedPrice"])
            self.assertEqual("90.00", changed["items"][0]["currentPrice"])
            acknowledged = repository.acknowledge_price(
                guest, item_id, "ack-new-price"
            )
            self.assertFalse(acknowledged["items"][0]["priceChanged"])

            favorite = repository.add_favorite(guest, product_id, "favorite-once")
            duplicate = repository.add_favorite(guest, product_id, "favorite-replay")
            self.assertEqual(1, favorite["count"])
            self.assertEqual(1, duplicate["count"])

            with self.assertRaises(CommerceRuleError) as failed_merge:
                repository.merge_guest(guest, guest.owner_hash, "merge-invalid-owner")
            self.assertEqual(403, failed_merge.exception.status_code)
            with connection.cursor() as cur:
                cur.execute(
                    """
                    SELECT estado, fusionado_en_carrito_id
                    FROM core.online_carritos
                    WHERE propietario_tipo = 'invitado'
                      AND propietario_ref_hash = %s
                      AND estado = 'activo'
                    """,
                    (guest.owner_hash,),
                )
                unmerged_cart = cur.fetchone()
                self.assertIsNotNone(unmerged_cart)
                self.assertEqual("activo", unmerged_cart["estado"])
                self.assertIsNone(unmerged_cart["fusionado_en_carrito_id"])

            merged = repository.merge_guest(customer, guest.owner_hash, "merge-once")
            replayed_merge = repository.merge_guest(
                customer, guest.owner_hash, "merge-once"
            )
            state_replayed_merge = repository.merge_guest(
                customer, guest.owner_hash, "merge-state-replay"
            )
            self.assertEqual(4, merged["cart"]["itemCount"])
            self.assertEqual(1, merged["favorites"]["count"])
            self.assertEqual(merged, replayed_merge)
            self.assertEqual(4, state_replayed_merge["cart"]["itemCount"])
            self.assertEqual(1, state_replayed_merge["favorites"]["count"])

            with connection.cursor() as cur:
                cur.execute(
                    """
                    SELECT estado, fusionado_en_carrito_id
                    FROM core.online_carritos
                    WHERE propietario_tipo = 'invitado'
                      AND propietario_ref_hash = %s
                    ORDER BY carrito_id DESC
                    LIMIT 1
                    """,
                    (guest.owner_hash,),
                )
                merged_guest_cart = cur.fetchone()
                self.assertEqual("fusionado", merged_guest_cart["estado"])
                self.assertIsNotNone(merged_guest_cart["fusionado_en_carrito_id"])

                cur.execute(
                    """
                    SELECT COUNT(*) AS count, MAX(cantidad) AS quantity
                    FROM core.online_carrito_items item
                    JOIN core.online_carritos cart USING (carrito_id)
                    WHERE cart.propietario_tipo = 'cliente'
                      AND cart.propietario_ref_hash = %s
                      AND cart.estado = 'activo'
                      AND item.activo = TRUE
                    """,
                    (customer.owner_hash,),
                )
                customer_items = cur.fetchone()
                self.assertEqual(1, int(customer_items["count"]))
                self.assertEqual(4, int(customer_items["quantity"]))

                cur.execute(
                    """
                    SELECT COUNT(*) AS count
                    FROM core.online_favoritos
                    WHERE propietario_tipo = 'cliente'
                      AND propietario_ref_hash = %s
                      AND activo = TRUE
                    """,
                    (customer.owner_hash,),
                )
                self.assertEqual(1, int(cur.fetchone()["count"]))

                cur.execute(
                    """
                    SELECT COUNT(*) AS count
                    FROM core.online_favoritos
                    WHERE propietario_tipo = 'invitado'
                      AND propietario_ref_hash = %s
                      AND activo = TRUE
                    """,
                    (guest.owner_hash,),
                )
                self.assertEqual(0, int(cur.fetchone()["count"]))

                cur.execute(
                    """
                    SELECT COUNT(*) AS count
                    FROM core.online_comercio_eventos
                    WHERE evento_tipo = 'guest_merged'
                      AND propietario_tipo = 'cliente'
                      AND propietario_ref_hash = %s
                    """,
                    (customer.owner_hash,),
                )
                self.assertEqual(1, int(cur.fetchone()["count"]))

            cleared_cart = repository.clear_cart(customer, "clear-cart")
            cleared_favorites = repository.clear_favorites(
                customer, "clear-favorites"
            )
            self.assertEqual(0, cleared_cart["itemCount"])
            self.assertEqual(0, cleared_favorites["count"])

            with connection.cursor() as cur:
                for table, before in tracked.items():
                    cur.execute(f"SELECT COUNT(*) AS count FROM core.{table}")
                    self.assertEqual(before, int(cur.fetchone()["count"]))
                cur.execute(
                    """
                    SELECT stock
                    FROM core.catalogo_inventario_sucursal
                    WHERE producto_id = %s
                    ORDER BY sucursal_id
                    LIMIT 1
                    """,
                    (product_id,),
                )
                self.assertEqual(3, int(cur.fetchone()["stock"]))
        finally:
            connection.rollback()
            connection.close()


if __name__ == "__main__":
    unittest.main()
