from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main
from online_commerce import CommerceOwner
from online_optical_drafts import CreateOpticalDraftRequest, OpticalDraftConfig, OpticalDraftRepository
from online_patient_identity import CandidateRequest, ConfirmRequest, IdentityConfig, IdentityRepository, PrescriptionSelectionRequest
from optical_preview import OpticalPreviewRepository, OpticalPreviewRequest
from public_catalog import PublicCatalogConfig


class NonCommittingConnection:
    def __init__(self, connection): self.connection = connection
    def __enter__(self): return self
    def __exit__(self, *_args): return False
    def cursor(self): return self.connection.cursor()
    def commit(self): pass


class Phase1GEIdentityTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"PHASE_1GD_ENABLED": "true", "PHASE_1GE_ENABLED": "true"})
        self.env.start()
        self.connection = psycopg.connect(backend_main.DB_CONNINFO, row_factory=dict_row)
        self.connection.execute("BEGIN")
        self.wrapper = NonCommittingConnection(self.connection)
        self.repo = IdentityRepository(IdentityConfig(backend_main.DB_CONNINFO, "test", True), connect=lambda *_a, **_k: self.wrapper)
        self.account_hash, self.guest_hash = "a" * 64, "b" * 64
        suffix = uuid4().hex[:10]
        phone_suffix = str(uuid4().int)[-8:]
        self.email, self.phone, self.full_name = f"phase1ge-{suffix}@example.test", f"55{phone_suffix}", "Fase Prueba Identidad"
        with self.connection.cursor() as cur:
            cur.execute("SELECT to_regclass('core.online_cliente_paciente_links') AS relation")
            if cur.fetchone()["relation"] is None: self.skipTest("Phase 1G-E migration is not applied")
            cur.execute("SELECT usuario_id,username FROM core.usuarios WHERE rol='admin' AND activo=TRUE ORDER BY usuario_id LIMIT 1")
            self.admin = cur.fetchone()
            cur.execute("SELECT sucursal_id FROM core.sucursales WHERE activa=TRUE ORDER BY sucursal_id LIMIT 1")
            self.branch_id = int(cur.fetchone()["sucursal_id"])
            cur.execute("""INSERT INTO core.pacientes
                (sucursal_id,primer_nombre,apellido_paterno,telefono,correo,activo)
                VALUES (%s,'Fase','Identidad',%s,%s,TRUE) RETURNING paciente_id""", (self.branch_id, self.phone, self.email))
            self.patient_id = int(cur.fetchone()["paciente_id"])
            cur.execute("""INSERT INTO core.prescripciones_opticas
                (paciente_id,sucursal_captura_id,origen,fecha_prescripcion,od_esfera,oi_esfera,activo,created_by)
                VALUES (%s,%s,'interna',CURRENT_DATE,'-1.00','-1.00',TRUE,%s) RETURNING prescripcion_id""",
                (self.patient_id, self.branch_id, self.admin["username"]))
            self.prescription_id = int(cur.fetchone()["prescripcion_id"])

    def tearDown(self):
        if hasattr(self, "connection") and not self.connection.closed:
            self.connection.rollback(); self.connection.close()
        self.env.stop()

    def _link(self):
        candidate = self.repo.candidate_check(self.account_hash, CandidateRequest(
            email=self.email, phone=self.phone, fullName=self.full_name,
            emailVerifiedAt=datetime.now(timezone.utc),
        ))
        self.assertEqual("match_available", candidate["status"])
        public = json.dumps(candidate).lower()
        self.assertNotIn("paciente", public); self.assertNotIn(self.full_name.lower(), public)
        return self.repo.confirm(self.account_hash, ConfirmRequest(linkAttemptId=candidate["linkAttemptId"]), "confirm-link")

    def _draft(self):
        with self.connection.cursor() as cur:
            cur.execute("SELECT producto_id,sku FROM core.catalogo_productos WHERE sku=ANY(%s::text[])", (["DEMO-RX-001", "DEMO-LENS-MONO"],))
            products = {row["sku"]: int(row["producto_id"]) for row in cur.fetchall()}
            if len(products) != 2: self.skipTest("Optical demo products are missing")
            cur.execute("""INSERT INTO core.catalogo_inventario_sucursal (producto_id,sucursal_id,stock,stock_reservado,disponible_venta)
                VALUES (%s,%s,5,0,TRUE) ON CONFLICT (producto_id,sucursal_id) DO UPDATE
                SET stock=GREATEST(core.catalogo_inventario_sucursal.stock,core.catalogo_inventario_sucursal.stock_reservado+5),disponible_venta=TRUE""",
                (products["DEMO-RX-001"], self.branch_id))
        catalog = PublicCatalogConfig(backend_main.DB_CONNINFO, "test", "http://127.0.0.1:8000", ("http://127.0.0.1:8000",))
        preview_repo = OpticalPreviewRepository(catalog, connect=lambda *_a, **_k: self.wrapper)
        preview = preview_repo.preview_in_transaction(self.connection.cursor(), OpticalPreviewRequest(frameProductId=products["DEMO-RX-001"], lensDesignProductId=products["DEMO-LENS-MONO"]))
        drafts = OpticalDraftRepository(OpticalDraftConfig(backend_main.DB_CONNINFO, "test", True), preview_repo, connect=lambda *_a, **_k: self.wrapper)
        return drafts.create(CommerceOwner("guest", self.guest_hash), CreateOpticalDraftRequest(
            frameProductId=products["DEMO-RX-001"], lensDesignProductId=products["DEMO-LENS-MONO"],
            previewFingerprint=preview.previewFingerprint, prescriptionMethod="later",
            branchId=self.branch_id, intendedUse="lejos",
        ), "phase1ge-draft")

    def test_verified_three_factor_match_and_confirmation_expose_no_patient_details(self):
        self.assertEqual("linked", self._link()["status"])
        self.assertEqual("linked", self.repo.current(self.account_hash)["status"])

    def test_email_without_matching_phone_never_links(self):
        result = self.repo.candidate_check(self.account_hash, CandidateRequest(
            email=self.email, phone="5511111111", fullName=self.full_name,
            emailVerifiedAt=datetime.now(timezone.utc),
        ))
        self.assertEqual("manual_review", result["status"])
        self.assertNotIn("linkAttemptId", result)

    def test_claim_and_approved_prescription_update_only_prescription_state(self):
        self._link(); draft = self._draft()
        first = self.repo.claim_drafts(self.account_hash, self.guest_hash, "claim", draft["draftPublicId"])
        second = self.repo.claim_drafts(self.account_hash, self.guest_hash, "claim", draft["draftPublicId"])
        self.assertEqual(first, second); self.assertEqual(1, first["claimed"])
        with self.connection.cursor() as cur:
            cur.execute("""INSERT INTO core.prescripcion_optica_acceso_online
                (prescripcion_id,paciente_id,aprobada_por) VALUES (%s,%s,%s)
                RETURNING acceso_public_id""", (self.prescription_id, self.patient_id, self.admin["usuario_id"]))
            access_ref = str(cur.fetchone()["acceso_public_id"])
            cur.execute("SELECT COUNT(*) AS count FROM core.historias_clinicas")
            histories_before = int(cur.fetchone()["count"])
        result = self.repo.select_prescription(self.account_hash, draft["draftPublicId"], PrescriptionSelectionRequest(prescriptionRef=access_ref), "select")
        self.assertEqual("provided", result["prescriptionStatus"])
        self.assertEqual("sin_pago", result["paymentStatus"])
        self.assertFalse(result["productionReady"])
        with self.connection.cursor() as cur:
            cur.execute("""SELECT d.prescription_status,d.estado_pago AS draft_payment,j.estado_receta,j.estado_pago AS job_payment,j.estado_produccion
                FROM core.online_borradores_opticos d JOIN core.trabajos_opticos j ON j.online_borrador_id=d.borrador_id
                WHERE d.borrador_public_id=%s""", (draft["draftPublicId"],))
            row = cur.fetchone()
            self.assertEqual(("provided", "sin_pago", "proporcionada", "sin_pago", "pendiente_requisitos"), tuple(row.values()))
            cur.execute("SELECT COUNT(*) AS count FROM core.historias_clinicas")
            self.assertEqual(histories_before, int(cur.fetchone()["count"]))


if __name__ == "__main__": unittest.main()
