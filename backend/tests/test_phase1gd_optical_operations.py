from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi import HTTPException
import psycopg
from psycopg.rows import dict_row


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main
from online_commerce import AddCartItemRequest, CommerceConfig, CommerceOwner, CommerceRepository
from online_optical_drafts import (
    CreateOpticalDraftRequest,
    OpticalDraftConfig,
    OpticalDraftRepository,
    release_expired_optical_reservations,
)
from optical_operations import (
    CostUpdate,
    OpticalOperationsConfig,
    StateUpdate,
    create_job_for_online_draft,
    create_optical_operations_router,
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


class Phase1GDOpticalOperationsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.env = patch.dict(os.environ, {"PHASE_1GD_ENABLED": "true"})
        self.env.start()
        self.connection = psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row)
        self.connection.execute("BEGIN")
        self.wrapper = NonCommittingConnection(self.connection)
        with self.connection.cursor() as cur:
            cur.execute("SELECT to_regclass('core.trabajos_opticos') AS relation")
            if cur.fetchone()["relation"] is None:
                self.skipTest("Phase 1G-D migration is not applied")
            cur.execute(
                """SELECT producto_id, sku FROM core.catalogo_productos
                   WHERE sku = ANY(%s::text[])""",
                (["DEMO-RX-001", "DEMO-LENS-MONO", "DEMO-LENS-PROG", "DEMO-TRT-PHOTO"],),
            )
            self.products = {row["sku"]: int(row["producto_id"]) for row in cur.fetchall()}
            if len(self.products) != 4:
                self.skipTest("Phase 1G-B demo products are incomplete")
            cur.execute(
                """SELECT inventory.sucursal_id FROM core.catalogo_inventario_sucursal inventory
                   JOIN core.sucursales branch USING (sucursal_id)
                   WHERE inventory.producto_id=%s AND branch.activa=TRUE
                   ORDER BY inventory.sucursal_id LIMIT 1 FOR UPDATE OF inventory""",
                (self.products["DEMO-RX-001"],),
            )
            branch = cur.fetchone()
            if not branch:
                self.skipTest("The demo frame has no active branch inventory")
            self.branch_id = int(branch["sucursal_id"])
            cur.execute(
                """UPDATE core.catalogo_inventario_sucursal
                   SET stock=GREATEST(stock, stock_reservado+10), disponible_venta=TRUE
                   WHERE producto_id=%s AND sucursal_id=%s""",
                (self.products["DEMO-RX-001"], self.branch_id),
            )
            cur.execute("SELECT usuario_id, username, rol, sucursal_id FROM core.usuarios WHERE rol='admin' AND activo=TRUE ORDER BY usuario_id LIMIT 1")
            self.admin = cur.fetchone()
            if not self.admin:
                self.skipTest("No active admin exists")

        catalog = PublicCatalogConfig(
            db_conninfo=backend_main.DB_CONNINFO, bearer_token="test",
            media_base_url="http://127.0.0.1:8000",
            allowed_image_origins=("http://127.0.0.1:8000",),
        )
        preview = OpticalPreviewRepository(catalog, connect=lambda *_a, **_k: self.wrapper)
        self.repository = OpticalDraftRepository(
            OpticalDraftConfig(backend_main.DB_CONNINFO, "test", True), preview,
            connect=lambda *_a, **_k: self.wrapper,
        )
        self.owner = CommerceOwner("guest", "d" * 64)
        self.router = self._router()
        self.routes = {
            (method, route.path): route.endpoint
            for route in self.router.routes
            for method in route.methods
        }

    def tearDown(self) -> None:
        if hasattr(self, "connection") and not self.connection.closed:
            self.connection.rollback()
            self.connection.close()
        self.env.stop()

    def _router(self):
        def current_user():
            return {"username": self.admin["username"], "rol": "admin", "sucursal_id": self.admin["sucursal_id"]}

        return create_optical_operations_router(
            backend_main.DB_CONNINFO, current_user,
            config=OpticalOperationsConfig(backend_main.DB_CONNINFO, True),
            connect=lambda *_a, **_k: self.wrapper,
        )

    def _admin_user(self):
        return {"username": self.admin["username"], "rol": "admin", "sucursal_id": self.admin["sucursal_id"]}

    def _list_jobs(self, *, include_cancelled: bool = False):
        return self.routes[("GET", "/operaciones/optica/trabajos")](
            estado_produccion=None, estado_receta=None, estado_pago=None,
            sucursal_id=None, origen=None, fecha_desde=None, fecha_hasta=None,
            buscar=None, incluir_cancelados=include_cancelled, limit=100,
            user=self._admin_user(),
        )

    def _create(self, key: str = "phase1gd-create") -> dict:
        preview = self.repository.preview_repository.preview_in_transaction(
            self.connection.cursor(),
            OpticalPreviewRequest(
                frameProductId=self.products["DEMO-RX-001"],
                lensDesignProductId=self.products["DEMO-LENS-MONO"],
            ),
        )
        request = CreateOpticalDraftRequest(
            frameProductId=self.products["DEMO-RX-001"],
            lensDesignProductId=self.products["DEMO-LENS-MONO"],
            treatmentProductId=None, treatmentVariantId=None,
            previewFingerprint=preview.previewFingerprint,
            prescriptionMethod="later", branchId=self.branch_id,
            intendedUse="lejos",
        )
        return self.repository.create(self.owner, request, key)

    def _job(self, draft_public_id: str) -> dict:
        with self.connection.cursor() as cur:
            cur.execute(
                """SELECT job.* FROM core.trabajos_opticos job
                   JOIN core.online_borradores_opticos draft
                     ON draft.borrador_id=job.online_borrador_id
                   WHERE draft.borrador_public_id=%s""",
                (draft_public_id,),
            )
            return cur.fetchone()

    def test_draft_creates_one_job_with_immutable_components_and_no_public_cost(self) -> None:
        result = self._create()
        job = self._job(result["draftPublicId"])
        self.assertIsNotNone(job)
        with self.connection.cursor() as cur:
            self.assertEqual(job["trabajo_id"], create_job_for_online_draft(cur, job["online_borrador_id"]))
            cur.execute("SELECT COUNT(*) AS count FROM core.trabajos_opticos WHERE online_borrador_id=%s", (job["online_borrador_id"],))
            self.assertEqual(1, int(cur.fetchone()["count"]))
            cur.execute("SELECT tipo_componente FROM core.trabajo_optico_componentes WHERE trabajo_id=%s ORDER BY tipo_componente", (job["trabajo_id"],))
            self.assertEqual(["armazon", "diseno"], [row["tipo_componente"] for row in cur.fetchall()])
        public_payload = json.dumps(result, default=str).lower()
        self.assertNotIn("costo", public_payload)
        self.assertNotIn("lab cost", public_payload)

    def test_direct_frame_cart_does_not_create_an_optical_job(self) -> None:
        with self.connection.cursor() as cur:
            cur.execute("UPDATE core.catalogo_productos SET activo=TRUE, publicado_online=TRUE WHERE producto_id=%s", (self.products["DEMO-RX-001"],))
            cur.execute("UPDATE core.online_producto_configuracion SET comprable_online=TRUE WHERE producto_id=%s", (self.products["DEMO-RX-001"],))
            cur.execute("SELECT COUNT(*) AS count FROM core.trabajos_opticos")
            before = int(cur.fetchone()["count"])
        commerce = CommerceRepository(
            CommerceConfig(
                db_conninfo="unused", bearer_token="test", enabled=True,
                guest_lifetime_days=30, catalog_config=None,
            ),
            connect=lambda *_a, **_k: self.wrapper,
        )
        commerce.add_cart_item(self.owner, AddCartItemRequest(productId=self.products["DEMO-RX-001"], quantity=1), "direct-frame")
        with self.connection.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS count FROM core.trabajos_opticos")
            self.assertEqual(before, int(cur.fetchone()["count"]))

    def test_gates_transitions_concurrency_and_cost_confirmation(self) -> None:
        draft = self._create("transitions")
        job = self._job(draft["draftPublicId"])
        public_id, version = str(job["trabajo_public_id"]), int(job["version"])
        update = self.routes[("PATCH", "/operaciones/optica/trabajos/{public_id}/estado")]
        with self.assertRaises(HTTPException) as skipped:
            update(public_id, StateUpdate(estado="enviado_laboratorio", version=version), self._admin_user())
        self.assertEqual(409, skipped.exception.status_code)
        with self.assertRaises(HTTPException) as blocked:
            update(public_id, StateUpdate(estado="listo_para_produccion", version=version), self._admin_user())
        self.assertEqual(409, blocked.exception.status_code)
        with self.connection.cursor() as cur:
            cur.execute("UPDATE core.trabajos_opticos SET estado_receta='proporcionada', estado_pago='anticipo', monto_pagado_confirmado=1 WHERE trabajo_id=%s", (job["trabajo_id"],))
        ready = update(public_id, StateUpdate(estado="listo_para_produccion", version=version), self._admin_user())
        with self.assertRaises(HTTPException) as stale:
            update(public_id, StateUpdate(estado="enviado_laboratorio", version=version), self._admin_user())
        self.assertEqual(409, stale.exception.status_code)
        with self.assertRaises(HTTPException) as backward_skip:
            update(public_id, StateUpdate(estado="recibido", version=ready["version"]), self._admin_user())
        self.assertEqual(409, backward_skip.exception.status_code)
        sent = update(public_id, StateUpdate(estado="enviado_laboratorio", version=ready["version"]), self._admin_user())
        update_cost = self.routes[("PATCH", "/operaciones/optica/trabajos/{public_id}/costo-laboratorio")]
        cost = update_cost(public_id, CostUpdate(costo="725.50", version=sent["version"], notas="Factura recibida"), self._admin_user())
        self.assertEqual("725.50", cost["costoLaboratorioConfirmado"])
        manufacturing = update(public_id, StateUpdate(estado="en_fabricacion", version=cost["version"]), self._admin_user())
        received = update(public_id, StateUpdate(estado="recibido", version=manufacturing["version"]), self._admin_user())
        delivered = update(public_id, StateUpdate(estado="entregado", version=received["version"]), self._admin_user())
        with self.assertRaises(HTTPException) as backward:
            update(public_id, StateUpdate(estado="en_fabricacion", version=delivered["version"]), self._admin_user())
        self.assertEqual(409, backward.exception.status_code)

    def test_draft_cancel_and_expiration_cancel_jobs_and_default_list_hides_them(self) -> None:
        cancelled = self._create("cancel-source")
        self.repository.cancel(self.owner, cancelled["draftPublicId"], "cancel-source-request")
        self.assertEqual("cancelado", self._job(cancelled["draftPublicId"])["estado_produccion"])
        expiring = self._create("expire-source")
        with self.connection.cursor() as cur:
            cur.execute("UPDATE core.online_reservas_opticas_borrador SET created_at=NOW()-INTERVAL '2 minutes', expires_at=NOW()-INTERVAL '1 second' WHERE borrador_id=%s", (self._job(expiring["draftPublicId"])["online_borrador_id"],))
            self.assertEqual(1, release_expired_optical_reservations(cur))
        self.assertEqual("cancelado", self._job(expiring["draftPublicId"])["estado_produccion"])
        listed = self._list_jobs()
        ids = {item["trabajoPublicId"] for item in listed["trabajos"]}
        self.assertNotIn(str(self._job(cancelled["draftPublicId"])["trabajo_public_id"]), ids)
        get_job = self.routes[("GET", "/operaciones/optica/trabajos/{public_id}")]
        events = json.dumps(get_job(str(self._job(expiring["draftPublicId"])["trabajo_public_id"]), self._admin_user()))
        self.assertIn("cancelado_por_expiracion", events)

    def test_non_admin_is_denied(self) -> None:
        list_route = next(route for route in self.router.routes if route.path == "/operaciones/optica/trabajos")
        admin_dependency = list_route.dependant.dependencies[-1].call
        with self.assertRaises(HTTPException) as denied:
            admin_dependency({"username": "recepcion", "rol": "recepcion", "sucursal_id": 1})
        self.assertEqual(403, denied.exception.status_code)


if __name__ == "__main__":
    unittest.main()
