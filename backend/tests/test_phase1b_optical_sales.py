from __future__ import annotations

import re
import sys
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import psycopg
from fastapi import HTTPException


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = BACKEND_DIR / "scripts"
PROJECT_DIR = BACKEND_DIR.parent
MIGRATION_PATH = SCRIPTS_DIR / "migrations" / "20260801_phase1b_optical_sales.sql"
ROLLBACK_PATH = SCRIPTS_DIR / "migrations" / "20260801_phase1b_optical_sales_rollback.sql"
FRONTEND_PATH = PROJECT_DIR / "frontend" / "src" / "App.tsx"

sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(SCRIPTS_DIR))

import main as backend_main
from verify_phase1b_optical_sales import PHASE1B_TABLES, verify_phase1b


def sale_line(
    line_ref: str,
    amount: str,
    *,
    config_ref: str | None = None,
) -> dict:
    return {
        "linea_ref": line_ref,
        "configuracion_ref": config_ref,
        "subtotal": Decimal(amount),
    }


def discount(
    ref: str,
    kind: str,
    value: str,
    order: int,
    *,
    scope: str = "venta",
    config_refs: list[str] | None = None,
    line_refs: list[str] | None = None,
) -> dict:
    return {
        "descuento_ref": ref,
        "tipo": kind,
        "valor": Decimal(value),
        "motivo": "promocion_especial",
        "motivo_otro": None,
        "cupon_tipo": "sin_cupon",
        "alcance": scope,
        "orden_aplicacion": order,
        "configuracion_refs": config_refs or [],
        "linea_refs": line_refs or [],
    }


class PatientCursor:
    def __init__(self, row):
        self.row = row

    def execute(self, *_args, **_kwargs):
        return None

    def fetchone(self):
        return self.row


class Phase1BOpticalSalesTests(unittest.TestCase):
    def test_migration_is_additive_and_rollback_only_isolates(self) -> None:
        migration = MIGRATION_PATH.read_text(encoding="utf-8")
        rollback = ROLLBACK_PATH.read_text(encoding="utf-8")
        self.assertEqual(
            [],
            re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", migration, re.IGNORECASE),
        )
        self.assertEqual(
            [],
            re.findall(r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b", rollback, re.IGNORECASE),
        )
        self.assertIn("RENAME TO", rollback)
        self.assertNotRegex(migration, r"(?i)\bmontaje\b")

    def test_database_objects_and_invariants(self) -> None:
        with psycopg.connect(backend_main.DB_CONNINFO) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION READ ONLY")
                checks = verify_phase1b(cursor)
        self.assertEqual(5, len(checks))
        self.assertEqual(12, len(PHASE1B_TABLES))

    def test_discount_order_percentage_then_fixed(self) -> None:
        result = backend_main._phase1b_calculate_discounts(
            [sale_line("line-1", "1000.00")],
            [
                discount("percent", "porcentaje", "10", 1),
                discount("fixed", "monto_fijo", "200", 2),
            ],
        )
        self.assertEqual(Decimal("700"), result["total"])
        self.assertEqual(Decimal("100"), result["descuentos"][0]["monto_aplicado"])
        self.assertEqual(Decimal("200"), result["descuentos"][1]["monto_aplicado"])

    def test_discount_order_fixed_then_percentage(self) -> None:
        result = backend_main._phase1b_calculate_discounts(
            [sale_line("line-1", "1000.00")],
            [
                discount("fixed", "monto_fijo", "200", 1),
                discount("percent", "porcentaje", "10", 2),
            ],
        )
        self.assertEqual(Decimal("720"), result["total"])
        self.assertEqual(Decimal("200"), result["descuentos"][0]["monto_aplicado"])
        self.assertEqual(Decimal("80"), result["descuentos"][1]["monto_aplicado"])

    def test_fixed_discount_above_remaining_balance_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            backend_main._phase1b_calculate_discounts(
                [sale_line("line-1", "100.00")],
                [discount("too-large", "monto_fijo", "100.01", 1)],
            )
        self.assertEqual(400, raised.exception.status_code)
        self.assertIn("supera", str(raised.exception.detail).lower())

    def test_line_allocations_are_exact_and_never_negative(self) -> None:
        result = backend_main._phase1b_calculate_discounts(
            [
                sale_line("config-1:frame", "333.33", config_ref="config-1"),
                sale_line("config-1:design", "666.67", config_ref="config-1"),
            ],
            [discount("config", "porcentaje", "10", 1, scope="configuracion", config_refs=["config-1"])],
        )
        allocations = result["descuentos"][0]["asignaciones"]
        self.assertEqual(Decimal("100"), sum(item["monto_asignado"] for item in allocations))
        self.assertTrue(all(item["base_despues"] >= 0 for item in allocations))
        self.assertEqual(Decimal("900"), result["total"])

    def test_patient_accepts_maternal_last_name_without_paternal(self) -> None:
        row = (10, 1, "María", None, "López", "5512345678", True)
        self.assertEqual(row, backend_main._phase1b_patient_row(PatientCursor(row), 10))

    def test_patient_without_any_last_name_is_rejected(self) -> None:
        row = (10, 1, "María", None, "", "5512345678", True)
        with self.assertRaises(HTTPException) as raised:
            backend_main._phase1b_patient_row(PatientCursor(row), 10)
        self.assertIn("apellido", str(raised.exception.detail).lower())

    def test_positive_payment_promotes_only_pending_configuration(self) -> None:
        class InsertCursor:
            def __init__(self):
                self.params = []

            def execute(self, _query, params):
                self.params.append(params)

            def fetchone(self):
                return (len(self.params),)

        cursor = InsertCursor()
        base = {
            "configuracion_ref": "config-1",
            "tipo_configuracion": "solo_micas",
            "usa_armazon_cliente": True,
            "armazon_producto_id": None,
            "diseno_producto_id": 1,
            "tratamiento_producto_id": None,
            "variante_id": None,
            "uso_visual": "lejos",
            "uso_visual_otro": None,
            "prescripcion_id": 1,
            "sucursal_prescripcion_snapshot": 1,
            "comportamiento_abasto_usado": "laboratorio_bajo_pedido",
            "estado_produccion": "pendiente_anticipo",
            "precio_armazon_snapshot": None,
            "precio_diseno_snapshot": Decimal("0"),
            "precio_tratamiento_snapshot": None,
            "precio_variante_snapshot": None,
            "costo_armazon_snapshot": None,
            "costo_diseno_snapshot": None,
            "costo_tratamiento_snapshot": None,
            "costo_variante_snapshot": None,
            "subtotal_bruto_snapshot": Decimal("0"),
        }
        backend_main._phase1b_insert_configuration_rows(
            cursor,
            venta_id=9,
            configs=[base],
            paid=Decimal("0.01"),
            username="admin",
        )
        self.assertEqual("listo_para_produccion", cursor.params[0][13])

    def test_frontend_uses_global_catalog_and_explicit_discount_order(self) -> None:
        source = FRONTEND_PATH.read_text(encoding="utf-8")
        self.assertIn('apiFetch(`/catalogo/inventario?sucursal_id=', source)
        self.assertIn('apiFetch("/ventas/fase1b/preview"', source)
        self.assertIn("moverDescuentoFase1B", source)
        self.assertIn("orden_aplicacion: index + 1", source)
        self.assertIn("+ Registrar receta", source)
        self.assertNotIn("cargo_montaje_snapshot", source)

    def test_inventory_endpoint_smoke_is_read_only_and_role_filtered(self) -> None:
        admin_rows = backend_main.listar_inventario_catalogo(
            sucursal_id=1,
            categoria=None,
            incluir_inactivos=False,
            user={"rol": "admin", "username": "phase1b-smoke", "sucursal_id": None},
        )
        reception_rows = backend_main.listar_inventario_catalogo(
            sucursal_id=1,
            categoria=None,
            incluir_inactivos=False,
            user={"rol": "recepcion", "username": "phase1b-smoke", "sucursal_id": 1},
        )
        self.assertEqual(14, len(admin_rows))
        self.assertEqual(
            {row["producto_id"] for row in admin_rows},
            {row["producto_id"] for row in reception_rows},
        )
        self.assertTrue(all(row["costo_unitario"] is None for row in reception_rows))
        self.assertTrue(
            all(row["stock"] >= 0 and row["version"] >= 0 for row in admin_rows if row["controla_stock"]),
        )

    def test_stock_endpoint_changes_only_selected_branch_and_records_movement(self) -> None:
        class TransactionConnectionProxy:
            def __init__(self, connection):
                self.connection = connection

            def __enter__(self):
                return self

            def __exit__(self, _exc_type, _exc, _traceback):
                return False

            def cursor(self):
                return self.connection.cursor()

            def commit(self):
                # Keep the endpoint work inside the test transaction so cleanup is a rollback.
                return None

        connection = psycopg.connect(backend_main.DB_CONNINFO)
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT sucursal_id FROM core.sucursales WHERE activa = true ORDER BY sucursal_id LIMIT 2;"
                )
                branches = [int(row[0]) for row in cursor.fetchall()]
                self.assertGreaterEqual(len(branches), 2)
                selected_branch, other_branch = branches

                cursor.execute(
                    """
                    SELECT producto_id
                    FROM core.catalogo_productos
                    WHERE controla_stock = true AND activo = true
                    ORDER BY producto_id
                    LIMIT 1;
                    """
                )
                product_id = int(cursor.fetchone()[0])
                cursor.execute(
                    """
                    INSERT INTO core.catalogo_inventario_sucursal (
                        producto_id, sucursal_id, stock, stock_reservado,
                        stock_minimo, disponible_venta, version
                    ) VALUES (%s, %s, 0, 0, 0, true, 0)
                    ON CONFLICT (producto_id, sucursal_id) DO UPDATE
                    SET stock = 0, stock_reservado = 0, version = core.catalogo_inventario_sucursal.version + 1
                    RETURNING version;
                    """,
                    (product_id, selected_branch),
                )
                starting_version = int(cursor.fetchone()[0])
                cursor.execute(
                    """
                    SELECT stock
                    FROM core.catalogo_inventario_sucursal
                    WHERE producto_id = %s AND sucursal_id = %s;
                    """,
                    (product_id, other_branch),
                )
                other_row = cursor.fetchone()
                other_stock_before = int(other_row[0]) if other_row else None
                cursor.execute(
                    """
                    SELECT COUNT(*), COALESCE(MAX(movimiento_id), 0)
                    FROM core.catalogo_inventario_movimientos
                    WHERE producto_id = %s AND sucursal_id = %s;
                    """,
                    (product_id, selected_branch),
                )
                movements_before, movement_max_id_before = cursor.fetchone()
                movements_before = int(movements_before)
                movement_max_id_before = int(movement_max_id_before)

            user = {
                "rol": "admin",
                "username": "phase1b-regression",
                "sucursal_id": None,
            }
            proxy = TransactionConnectionProxy(connection)
            with patch.object(backend_main.psycopg, "connect", return_value=proxy):
                response = backend_main.actualizar_stock_catalogo(
                    producto_id=product_id,
                    data=backend_main.InventarioStockUpdate(stock=3, expected_stock=0),
                    sucursal_id=selected_branch,
                    user=user,
                )

            route = next(
                route
                for route in backend_main.app.routes
                if getattr(route, "path", None) == "/catalogo/inventario/{producto_id}/stock"
                and "PATCH" in getattr(route, "methods", set())
            )
            self.assertEqual(200, route.status_code or 200)
            self.assertEqual(3, response["stock"])
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT stock, version
                    FROM core.catalogo_inventario_sucursal
                    WHERE producto_id = %s AND sucursal_id = %s;
                    """,
                    (product_id, selected_branch),
                )
                selected_stock, selected_version = cursor.fetchone()
                self.assertEqual(3, int(selected_stock))
                self.assertEqual(starting_version + 1, int(selected_version))

                cursor.execute(
                    """
                    SELECT stock
                    FROM core.catalogo_inventario_sucursal
                    WHERE producto_id = %s AND sucursal_id = %s;
                    """,
                    (product_id, other_branch),
                )
                other_row = cursor.fetchone()
                other_stock_after = int(other_row[0]) if other_row else None
                self.assertEqual(other_stock_before, other_stock_after)

                cursor.execute(
                    """
                    SELECT movimiento_id, stock_anterior, stock_nuevo, cantidad
                    FROM core.catalogo_inventario_movimientos
                    WHERE producto_id = %s AND sucursal_id = %s AND movimiento_id > %s
                    ORDER BY movimiento_id;
                    """,
                    (product_id, selected_branch, movement_max_id_before),
                )
                new_movements = cursor.fetchall()
                self.assertEqual(1, len(new_movements))
                _, stock_before, stock_after, quantity = new_movements[0]
                self.assertEqual(0, int(stock_before))
                self.assertEqual(3, int(stock_after))
                self.assertEqual(3, int(quantity))
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM core.catalogo_inventario_movimientos
                    WHERE producto_id = %s AND sucursal_id = %s;
                    """,
                    (product_id, selected_branch),
                )
                self.assertEqual(movements_before + 1, int(cursor.fetchone()[0]))
        finally:
            connection.rollback()
            connection.close()

    def test_preview_and_creation_normalize_all_sale_input_types_transactionally(self) -> None:
        class TransactionConnectionProxy:
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

            def rollback(self):
                return None

        tracked_tables = (
            "ventas",
            "venta_pagos",
            "catalogo_inventario_movimientos",
            "venta_catalogo_contextos",
            "venta_catalogo_detalles",
            "venta_configuraciones_opticas",
            "venta_calculo_revisiones",
        )

        def table_counts(cursor) -> dict[str, int]:
            counts: dict[str, int] = {}
            for table_name in tracked_tables:
                cursor.execute(f'SELECT COUNT(*) FROM core."{table_name}";')
                counts[table_name] = int(cursor.fetchone()[0])
            return counts

        connection = psycopg.connect(backend_main.DB_CONNINFO)
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT sucursal_id FROM core.sucursales WHERE activa = true ORDER BY sucursal_id LIMIT 1;"
                )
                branch_id = int(cursor.fetchone()[0])
                cursor.execute(
                    """
                    INSERT INTO core.pacientes (
                        sucursal_id, primer_nombre, apellido_paterno,
                        fecha_nacimiento, sexo, telefono
                    ) VALUES (%s, 'Preview', 'Phase1B', DATE '1990-01-01', 'M', '5512345678')
                    RETURNING paciente_id;
                    """,
                    (branch_id,),
                )
                patient_id = int(cursor.fetchone()[0])
                cursor.execute(
                    """
                    SELECT sku, producto_id, precio, controla_stock
                    FROM core.catalogo_productos
                    WHERE sku IN ('DEMO-SVC-EYE-001', 'DEMO-LC-001', 'DEMO-LENS-NONRX')
                    ORDER BY sku;
                    """
                )
                products = {
                    row[0]: {
                        "producto_id": int(row[1]),
                        "precio": Decimal(str(row[2])),
                        "controla_stock": bool(row[3]),
                    }
                    for row in cursor.fetchall()
                }
                self.assertEqual(
                    {"DEMO-SVC-EYE-001", "DEMO-LC-001", "DEMO-LENS-NONRX"},
                    set(products),
                )
                self.assertFalse(products["DEMO-SVC-EYE-001"]["controla_stock"])
                cursor.execute("SELECT COUNT(*) FROM core.consultas WHERE paciente_id = %s;", (patient_id,))
                self.assertEqual(0, int(cursor.fetchone()[0]))
                counts_before = table_counts(cursor)
                cursor.execute(
                    """
                    SELECT producto_id, sucursal_id, stock, version
                    FROM core.catalogo_inventario_sucursal
                    WHERE sucursal_id = %s
                    ORDER BY producto_id;
                    """,
                    (branch_id,),
                )
                inventory_before = cursor.fetchall()

            user = {"rol": "admin", "username": "phase1b-preview-regression", "sucursal_id": None}

            def eye_exam_sale() -> backend_main.VentaFase1BCreate:
                price = products["DEMO-SVC-EYE-001"]["precio"]
                return backend_main.VentaFase1BCreate(
                    paciente_id=patient_id,
                    sucursal_id=branch_id,
                    forma_liquidacion="pago_completo",
                    estado_venta="confirmada",
                    productos_catalogo=[
                        backend_main.VentaCatalogoProductoIn(
                            linea_ref="eye-exam",
                            producto_id=products["DEMO-SVC-EYE-001"]["producto_id"],
                            cantidad=1,
                        )
                    ],
                    pagos=[backend_main.VentaPagoIn(metodo="efectivo", monto=price)],
                )

            standalone_sale = backend_main.VentaFase1BCreate(
                paciente_id=patient_id,
                sucursal_id=branch_id,
                productos_catalogo=[
                    backend_main.VentaCatalogoProductoIn(
                        linea_ref="standalone-contact-lenses",
                        producto_id=products["DEMO-LC-001"]["producto_id"],
                        cantidad=1,
                    )
                ],
            )
            optical_sale = backend_main.VentaFase1BCreate(
                paciente_id=patient_id,
                sucursal_id=branch_id,
                configuraciones=[
                    backend_main.VentaConfiguracionOpticaIn(
                        configuracion_ref="non-rx-pair",
                        tipo_configuracion="solo_micas",
                        diseno_producto_id=products["DEMO-LENS-NONRX"]["producto_id"],
                        uso_visual="sin_graduacion",
                        comportamiento_abasto_usado="laboratorio_bajo_pedido",
                    )
                ],
            )

            proxy = TransactionConnectionProxy(connection)
            with patch.object(backend_main.psycopg, "connect", return_value=proxy):
                eye_preview = backend_main.previsualizar_venta_fase1b(eye_exam_sale(), user=user)
                standalone_preview = backend_main.previsualizar_venta_fase1b(standalone_sale, user=user)
                optical_preview = backend_main.previsualizar_venta_fase1b(optical_sale, user=user)

            preview_route = next(
                route
                for route in backend_main.app.routes
                if getattr(route, "path", None) == "/ventas/fase1b/preview"
                and "POST" in getattr(route, "methods", set())
            )
            self.assertEqual(200, preview_route.status_code or 200)
            self.assertEqual(float(products["DEMO-SVC-EYE-001"]["precio"]), eye_preview["total"])
            self.assertEqual(1, len(eye_preview["lineas"]))
            self.assertEqual(1, len(standalone_preview["lineas"]))
            self.assertEqual(1, len(optical_preview["configuraciones"]))
            self.assertEqual(1, len(optical_preview["lineas"]))

            with connection.cursor() as cursor:
                self.assertEqual(counts_before, table_counts(cursor))
                cursor.execute(
                    """
                    SELECT producto_id, sucursal_id, stock, version
                    FROM core.catalogo_inventario_sucursal
                    WHERE sucursal_id = %s
                    ORDER BY producto_id;
                    """,
                    (branch_id,),
                )
                self.assertEqual(inventory_before, cursor.fetchall())

            with patch.object(backend_main.psycopg, "connect", return_value=proxy):
                created_sale = backend_main.crear_venta_fase1b(eye_exam_sale(), user=user)

            create_route = next(
                route
                for route in backend_main.app.routes
                if getattr(route, "path", None) == "/ventas/fase1b"
                and "POST" in getattr(route, "methods", set())
            )
            self.assertEqual(200, create_route.status_code or 200)
            self.assertEqual(eye_preview["total"], created_sale["monto_total"])
            self.assertEqual("pagada", created_sale["estado_pago"])
            self.assertEqual(0, created_sale["saldo_pendiente"])
            sale_id = int(created_sale["venta_id"])

            with connection.cursor() as cursor:
                counts_after = table_counts(cursor)
                self.assertEqual(counts_before["ventas"] + 1, counts_after["ventas"])
                self.assertEqual(counts_before["venta_pagos"] + 1, counts_after["venta_pagos"])
                self.assertEqual(
                    counts_before["catalogo_inventario_movimientos"],
                    counts_after["catalogo_inventario_movimientos"],
                )
                self.assertEqual(
                    counts_before["venta_catalogo_contextos"] + 1,
                    counts_after["venta_catalogo_contextos"],
                )
                self.assertEqual(
                    counts_before["venta_catalogo_detalles"] + 1,
                    counts_after["venta_catalogo_detalles"],
                )
                self.assertEqual(
                    counts_before["venta_configuraciones_opticas"],
                    counts_after["venta_configuraciones_opticas"],
                )
                self.assertEqual(
                    counts_before["venta_calculo_revisiones"] + 1,
                    counts_after["venta_calculo_revisiones"],
                )
                for table_name in (
                    "ventas",
                    "venta_pagos",
                    "venta_catalogo_contextos",
                    "venta_catalogo_detalles",
                    "venta_calculo_revisiones",
                ):
                    sale_column = "venta_id"
                    cursor.execute(
                        f'SELECT COUNT(*) FROM core."{table_name}" WHERE {sale_column} = %s;',
                        (sale_id,),
                    )
                    self.assertEqual(1, int(cursor.fetchone()[0]), table_name)
                cursor.execute(
                    """
                    SELECT producto_id, sucursal_id, stock, version
                    FROM core.catalogo_inventario_sucursal
                    WHERE sucursal_id = %s
                    ORDER BY producto_id;
                    """,
                    (branch_id,),
                )
                self.assertEqual(inventory_before, cursor.fetchall())
        finally:
            connection.rollback()
            connection.close()


if __name__ == "__main__":
    unittest.main()
