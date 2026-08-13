from __future__ import annotations

from decimal import Decimal
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi import HTTPException
import psycopg
from psycopg.rows import dict_row, tuple_row


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main
from optical_operations import (
    PHYSICAL_ADVANCED_STATES,
    project_physical_job_status,
    sync_physical_sale_jobs,
    validate_physical_structural_edit,
)


class NonCommittingConnection:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def cursor(self):
        return self.connection.cursor(row_factory=tuple_row)

    def commit(self):
        pass

    def rollback(self):
        self.connection.rollback()


class Phase1GFPhysicalOpticalQueueTests(unittest.TestCase):
    def setUp(self) -> None:
        self.environment = patch.dict(
            os.environ, {"PHASE_1GD_ENABLED": "true", "PHASE_1GF_ENABLED": "true"}
        )
        self.environment.start()
        self.connection = psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row)
        self.connection.execute("BEGIN")
        self.proxy = NonCommittingConnection(self.connection)
        with self.connection.cursor() as cur:
            cur.execute("SELECT to_regclass('core.trabajos_opticos') AS relation")
            if cur.fetchone()["relation"] is None:
                self.skipTest("Phase 1G-D is not applied")
            cur.execute(
                """SELECT producto_id,sku FROM core.catalogo_productos
                   WHERE sku=ANY(%s::text[])""",
                (["DEMO-LENS-MONO", "DEMO-LENS-PROG", "DEMO-TRT-PHOTO"],),
            )
            self.products = {row["sku"]: int(row["producto_id"]) for row in cur.fetchall()}
            if len(self.products) != 3:
                self.skipTest("Phase 1G-B optical components are incomplete")
            cur.execute(
                """SELECT paciente_id,sucursal_id FROM core.pacientes
                   WHERE activo=TRUE AND NULLIF(BTRIM(primer_nombre),'') IS NOT NULL
                     AND (NULLIF(BTRIM(apellido_paterno),'') IS NOT NULL
                       OR NULLIF(BTRIM(apellido_materno),'') IS NOT NULL)
                     AND NULLIF(BTRIM(telefono),'') IS NOT NULL
                   ORDER BY paciente_id LIMIT 1"""
            )
            patient = cur.fetchone()
            if not patient:
                self.skipTest("No eligible registered patient exists")
            self.patient_id = int(patient["paciente_id"])
            self.branch_id = int(patient["sucursal_id"])
            cur.execute(
                """SELECT username FROM core.usuarios
                   WHERE rol='admin' AND activo=TRUE ORDER BY usuario_id LIMIT 1"""
            )
            admin = cur.fetchone()
            if not admin:
                self.skipTest("No active administrator exists")
            self.username = admin["username"]
            cur.execute(
                """INSERT INTO core.prescripciones_opticas
                   (paciente_id,sucursal_captura_id,origen,fecha_prescripcion,created_by)
                   VALUES (%s,%s,'interna',CURRENT_DATE,%s) RETURNING prescripcion_id""",
                (self.patient_id, self.branch_id, self.username),
            )
            self.prescription_id = int(cur.fetchone()["prescripcion_id"])

    def tearDown(self) -> None:
        if hasattr(self, "connection") and not self.connection.closed:
            self.connection.rollback()
            self.connection.close()
        self.environment.stop()

    def configuration(self, reference: str, *, progressive: bool = False):
        design = self.products["DEMO-LENS-PROG" if progressive else "DEMO-LENS-MONO"]
        return backend_main.VentaConfiguracionOpticaIn(
            configuracion_ref=reference, tipo_configuracion="solo_micas",
            diseno_producto_id=design, uso_visual="multifocal" if progressive else "lejos",
            prescripcion_id=self.prescription_id,
            comportamiento_abasto_usado="laboratorio_bajo_pedido",
        )

    def save(self, references=("pair-1",), *, paid: str = "0"):
        payments = [] if Decimal(paid) == 0 else [
            backend_main.VentaPagoIn(metodo="efectivo", monto=Decimal(paid))
        ]
        data = backend_main.VentaFase1BCreate(
            paciente_id=self.patient_id, sucursal_id=self.branch_id,
            configuraciones=[
                self.configuration(
                    reference,
                    progressive=Decimal(paid) > 0 or index % 2 == 1,
                )
                for index, reference in enumerate(references)
            ],
            pagos=payments,
        )
        user = {"rol": "admin", "username": self.username, "sucursal_id": None}
        with patch.object(backend_main.psycopg, "connect", return_value=self.proxy):
            return backend_main._phase1b_save_sale(data, user)

    def jobs(self, sale_id: int):
        with self.connection.cursor() as cur:
            cur.execute(
                """SELECT job.*,config.configuracion_ref
                   FROM core.trabajos_opticos job
                   JOIN core.venta_configuraciones_opticas config
                     ON config.configuracion_id=job.venta_configuracion_id
                   WHERE config.venta_id=%s ORDER BY job.trabajo_id""",
                (sale_id,),
            )
            return cur.fetchall()

    def test_one_and_multiple_configurations_create_independent_idempotent_jobs(self):
        one = self.save(("one",))
        self.assertEqual(1, len(self.jobs(one["venta_id"])))
        many = self.save(("distance", "progressive"))
        initial = self.jobs(many["venta_id"])
        self.assertEqual(2, len(initial))
        with self.connection.cursor() as cur:
            sync_physical_sale_jobs(cur, many["venta_id"], username=self.username)
        replay = self.jobs(many["venta_id"])
        self.assertEqual([row["trabajo_id"] for row in initial], [row["trabajo_id"] for row in replay])

    def test_positive_payment_releases_jobs_and_additional_sync_does_not_duplicate(self):
        sale = self.save(("distance", "near"), paid="0")
        self.assertEqual({"pendiente_requisitos"}, {row["estado_produccion"] for row in self.jobs(sale["venta_id"])})
        with self.connection.cursor() as cur:
            cur.execute(
                """INSERT INTO core.venta_pagos(venta_id,metodo,monto,created_by)
                   VALUES(%s,'efectivo',1,%s)""",
                (sale["venta_id"], self.username),
            )
            sync_physical_sale_jobs(cur, sale["venta_id"], username=self.username, reason="test_payment")
            sync_physical_sale_jobs(cur, sale["venta_id"], username=self.username, reason="test_payment_replay")
        jobs = self.jobs(sale["venta_id"])
        self.assertEqual(2, len(jobs))
        self.assertEqual({"listo_para_produccion"}, {row["estado_produccion"] for row in jobs})
        self.assertEqual({Decimal("1.00")}, {row["monto_pagado_confirmado"] for row in jobs})

    def test_direct_product_sale_without_configuration_creates_no_job(self):
        with self.connection.cursor() as cur:
            cur.execute(
                """INSERT INTO core.ventas
                   (sucursal_id,paciente_id,compra,subtotal,monto_total,metodo_pago,
                    forma_liquidacion,estado_venta,estado_pago,estado_pedido,created_by)
                   VALUES(%s,%s,'armazon_solo',0,0,'efectivo','pago_completo',
                          'confirmada','sin_pago','entregado',%s) RETURNING venta_id""",
                (self.branch_id, self.patient_id, self.username),
            )
            sale_id = int(cur.fetchone()["venta_id"])
            self.assertEqual([], sync_physical_sale_jobs(cur, sale_id, username=self.username))
        self.assertEqual([], self.jobs(sale_id))

    def test_advanced_structural_edit_is_rejected(self):
        sale = self.save(("protected",), paid="1")
        job = self.jobs(sale["venta_id"])[0]
        with self.connection.cursor() as cur:
            cur.execute(
                "UPDATE core.trabajos_opticos SET estado_produccion='enviado_laboratorio' WHERE trabajo_id=%s",
                (job["trabajo_id"],),
            )
            replacement = {
                "configuracion_ref": "protected", "tipo_configuracion": "solo_micas",
                "armazon_producto_id": None,
                "diseno_producto_id": self.products["DEMO-LENS-MONO"],
                "tratamiento_producto_id": None, "variante_id": None,
            }
            with self.assertRaises(HTTPException) as raised:
                validate_physical_structural_edit(cur, sale["venta_id"], [replacement])
        self.assertEqual(409, raised.exception.status_code)
        self.assertIn(job["estado_produccion"], PHYSICAL_ADVANCED_STATES | {"listo_para_produccion"})

    def test_preproduction_replacement_rebinds_and_preserves_job_identity(self):
        sale = self.save(("replaceable",))
        original = self.jobs(sale["venta_id"])[0]
        old_configuration_id = int(original["venta_configuracion_id"])
        with self.connection.cursor() as cur:
            cur.execute(
                "UPDATE core.venta_configuraciones_opticas SET estado_registro='reemplazado' WHERE configuracion_id=%s",
                (old_configuration_id,),
            )
            cur.execute(
                """INSERT INTO core.venta_configuraciones_opticas
                   (venta_id,configuracion_ref,tipo_configuracion,usa_armazon_cliente,
                    armazon_producto_id,diseno_producto_id,tratamiento_producto_id,
                    variante_id,uso_visual,uso_visual_otro,prescripcion_id,
                    sucursal_prescripcion_snapshot,comportamiento_abasto_usado,
                    estado_produccion,cantidad_pares,precio_armazon_snapshot,
                    precio_diseno_snapshot,precio_tratamiento_snapshot,
                    precio_variante_snapshot,costo_armazon_snapshot,
                    costo_diseno_snapshot,costo_tratamiento_snapshot,
                    costo_variante_snapshot,subtotal_bruto_snapshot,created_by)
                   SELECT venta_id,configuracion_ref,tipo_configuracion,usa_armazon_cliente,
                          armazon_producto_id,diseno_producto_id,tratamiento_producto_id,
                          variante_id,uso_visual,uso_visual_otro,prescripcion_id,
                          sucursal_prescripcion_snapshot,comportamiento_abasto_usado,
                          estado_produccion,cantidad_pares,precio_armazon_snapshot,
                          precio_diseno_snapshot,precio_tratamiento_snapshot,
                          precio_variante_snapshot,costo_armazon_snapshot,
                          costo_diseno_snapshot,costo_tratamiento_snapshot,
                          costo_variante_snapshot,subtotal_bruto_snapshot,%s
                   FROM core.venta_configuraciones_opticas WHERE configuracion_id=%s
                   RETURNING configuracion_id""",
                (self.username, old_configuration_id),
            )
            new_configuration_id = int(cur.fetchone()["configuracion_id"])
            cur.execute(
                """UPDATE core.venta_catalogo_detalles SET estado_registro='reemplazado'
                   WHERE configuracion_id=%s""",
                (old_configuration_id,),
            )
            cur.execute(
                """INSERT INTO core.venta_catalogo_detalles
                   (venta_id,configuracion_id,linea_ref,tipo_linea,producto_id,
                    variante_id,sucursal_id,sku_snapshot,nombre_snapshot,
                    descripcion_snapshot,categoria_snapshot,subcategoria_snapshot,
                    unidad_medida_snapshot,comportamiento_abasto_snapshot,
                    controla_stock_snapshot,cantidad,precio_unitario_snapshot,
                    costo_unitario_snapshot,subtotal_bruto_snapshot,created_by)
                   SELECT venta_id,%s,linea_ref,tipo_linea,producto_id,variante_id,
                          sucursal_id,sku_snapshot,nombre_snapshot,descripcion_snapshot,
                          categoria_snapshot,subcategoria_snapshot,unidad_medida_snapshot,
                          comportamiento_abasto_snapshot,controla_stock_snapshot,cantidad,
                          precio_unitario_snapshot,costo_unitario_snapshot,
                          subtotal_bruto_snapshot,%s
                   FROM core.venta_catalogo_detalles
                   WHERE configuracion_id=%s AND estado_registro='reemplazado'""",
                (new_configuration_id, self.username, old_configuration_id),
            )
            sync_physical_sale_jobs(cur, sale["venta_id"], username=self.username, reason="replacement")
        rebound = self.jobs(sale["venta_id"])[0]
        self.assertEqual(original["trabajo_id"], rebound["trabajo_id"])
        self.assertEqual(new_configuration_id, rebound["venta_configuracion_id"])

    def test_partial_configuration_cancellation_leaves_other_job_active(self):
        sale = self.save(("keep", "cancel"))
        with self.connection.cursor() as cur:
            cur.execute(
                """UPDATE core.venta_configuraciones_opticas
                   SET estado_registro='cancelado',estado_produccion='cancelado',
                       motivo_cancelacion='partial test',cancelado_by=%s,cancelado_at=NOW()
                   WHERE venta_id=%s AND configuracion_ref='cancel'""",
                (self.username, sale["venta_id"]),
            )
            sync_physical_sale_jobs(cur, sale["venta_id"], username=self.username, reason="partial_cancel")
        states = {row["configuracion_ref"]: row["estado_produccion"] for row in self.jobs(sale["venta_id"])}
        self.assertEqual("pendiente_requisitos", states["keep"])
        self.assertEqual("cancelado", states["cancel"])

    def test_refund_blocks_and_cancellation_synchronizes(self):
        sale = self.save(("refund",), paid="1")
        with self.connection.cursor() as cur:
            cur.execute("UPDATE core.ventas SET estado_pago='reembolsada' WHERE venta_id=%s", (sale["venta_id"],))
            sync_physical_sale_jobs(cur, sale["venta_id"], username=self.username, reason="refund")
        refunded = self.jobs(sale["venta_id"])[0]
        self.assertEqual("reembolsada", refunded["estado_pago"])
        self.assertEqual("pendiente_requisitos", refunded["estado_produccion"])
        with self.connection.cursor() as cur:
            cur.execute(
                """UPDATE core.venta_configuraciones_opticas
                   SET estado_registro='cancelado',estado_produccion='cancelado',
                       motivo_cancelacion='test',cancelado_by=%s,cancelado_at=NOW()
                   WHERE venta_id=%s""",
                (self.username, sale["venta_id"]),
            )
            sync_physical_sale_jobs(cur, sale["venta_id"], username=self.username, reason="cancel")
        self.assertEqual("cancelado", self.jobs(sale["venta_id"])[0]["estado_produccion"])

    def test_queue_projection_updates_physical_and_sale_status(self):
        sale = self.save(("projection",), paid="1")
        job = self.jobs(sale["venta_id"])[0]
        with self.connection.cursor() as cur:
            project_physical_job_status(cur, job["trabajo_id"], "recibido")
            cur.execute(
                "SELECT estado_produccion FROM core.venta_configuraciones_opticas WHERE configuracion_id=%s",
                (job["venta_configuracion_id"],),
            )
            self.assertEqual("listo_para_entregar", cur.fetchone()["estado_produccion"])
            cur.execute("SELECT estado_pedido FROM core.ventas WHERE venta_id=%s", (sale["venta_id"],))
            self.assertEqual("listo_entregar", cur.fetchone()["estado_pedido"])


if __name__ == "__main__":
    unittest.main()
