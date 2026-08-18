from __future__ import annotations

from pathlib import Path
import sys
import hashlib
from decimal import Decimal
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import main
from online_commerce import CommerceOwner
from online_fulfillment import (
    AddressInput, ContactInput, CreateFulfillmentRequest, FulfillmentConfig,
    FulfillmentAdminRepository, FulfillmentRepository, ManualQuoteInput,
)
from online_optical_drafts import (
    AttachOpticalDraftToCartRequest, CreateOpticalDraftRequest,
    OpticalDraftConfig, OpticalDraftRepository,
)
from optical_preview import OpticalPreviewRepository, OpticalPreviewRequest
from public_catalog import PublicCatalogConfig


class TxConnection:
    def __init__(self, connection): self.connection = connection
    def __enter__(self): return self
    def __exit__(self, *_args): return False
    def cursor(self): return self.connection.cursor()
    def commit(self): pass


def _fixture():
    connection = psycopg.connect(main.DB_CONNINFO, row_factory=dict_row)
    connection.execute("BEGIN")
    wrapper = TxConnection(connection)
    owner = CommerceOwner("guest", uuid4().hex + uuid4().hex)
    with connection.cursor() as cur:
        cur.execute("INSERT INTO core.online_guest_email_verifications (propietario_ref_hash,correo_hash,codigo_hash,verified_at) VALUES (%s,%s,%s,NOW())", (owner.owner_hash, hashlib.sha256(b'test@example.com').hexdigest(), '0' * 64))
        cur.execute("SELECT producto_id FROM core.catalogo_productos WHERE sku='DEMO-RX-001'")
        frame = cur.fetchone()
        cur.execute("SELECT producto_id FROM core.catalogo_productos WHERE sku='DEMO-LENS-MONO'")
        lens = cur.fetchone()
        cur.execute("SELECT producto_id FROM core.catalogo_productos WHERE sku='DEMO-SUN-001'")
        normal = cur.fetchone()
        cur.execute("SELECT sucursal_id FROM core.sucursales WHERE activa=TRUE ORDER BY sucursal_id LIMIT 1")
        branch = cur.fetchone()
        assert frame and lens and normal and branch
        frame_id, lens_id, normal_id, branch_id = [int(x) for x in (frame['producto_id'], lens['producto_id'], normal['producto_id'], branch['sucursal_id'])]
        cur.execute("UPDATE core.catalogo_productos SET activo=TRUE, publicado_online=TRUE WHERE producto_id IN (%s,%s)", (frame_id, normal_id))
        cur.execute("UPDATE core.online_producto_configuracion SET comprable_online=TRUE WHERE producto_id=%s", (normal_id,))
        for product_id in (frame_id, normal_id):
            cur.execute("INSERT INTO core.catalogo_inventario_sucursal (producto_id,sucursal_id,stock,stock_reservado,stock_minimo,disponible_venta) VALUES (%s,%s,20,0,0,TRUE) ON CONFLICT (producto_id,sucursal_id) DO UPDATE SET stock=GREATEST(catalogo_inventario_sucursal.stock_reservado+5,20),disponible_venta=TRUE", (product_id, branch_id))
        cur.execute("UPDATE core.envio_configuracion_empaque SET activa=TRUE,peso_empaque_gramos=50,margen_largo_mm=10,margen_ancho_mm=10,margen_alto_mm=10,peso_maximo_gramos=5000,largo_maximo_mm=1000,ancho_maximo_mm=1000,alto_maximo_mm=1000 WHERE configuracion_id=1")
        for product_id in (frame_id, normal_id):
            cur.execute("INSERT INTO core.catalogo_producto_envio (producto_id,activo,peso_gramos,largo_mm,ancho_mm,alto_mm) VALUES (%s,TRUE,200,180,80,60) ON CONFLICT (producto_id) DO UPDATE SET activo=TRUE,peso_gramos=200,largo_mm=180,ancho_mm=80,alto_mm=60", (product_id,))
    catalog = PublicCatalogConfig(main.DB_CONNINFO, 'test', 'http://127.0.0.1:8000', ('http://127.0.0.1:8000',))
    preview_repo = OpticalPreviewRepository(catalog, connect=lambda *_a, **_k: wrapper)
    drafts = OpticalDraftRepository(OpticalDraftConfig(main.DB_CONNINFO, 'test', True), preview_repo, connect=lambda *_a, **_k: wrapper)
    with connection.cursor() as cur:
        preview = preview_repo.preview_in_transaction(cur, OpticalPreviewRequest(frameProductId=frame_id,lensDesignProductId=lens_id,treatmentProductId=None,treatmentVariantId=None))
    draft = drafts.create(owner, CreateOpticalDraftRequest(frameProductId=frame_id,lensDesignProductId=lens_id,treatmentProductId=None,treatmentVariantId=None,previewFingerprint=preview.previewFingerprint,prescriptionMethod='later',branchId=branch_id,intendedUse=None), 'fixture-draft')
    with connection.cursor() as cur:
        cur.execute("UPDATE core.online_borradores_opticos SET prescription_status='provided' WHERE borrador_public_id=%s", (draft['draftPublicId'],))
    attached = drafts.attach_to_cart(owner, draft['draftPublicId'], AttachOpticalDraftToCartRequest(previewFingerprint=draft['previewFingerprint'],configuredTotal=draft['configuredTotal']), 'fixture-cart')
    with connection.cursor() as cur:
        cur.execute("INSERT INTO core.online_carrito_items (carrito_id,producto_id,sku_snapshot,slug_snapshot,nombre_snapshot,cantidad,configuracion,configuracion_hash,precio_observado,precio_reconocido,producto_updated_at_observado) SELECT old.carrito_id, %s, product.sku, product.slug, product.nombre, 1, '{}'::jsonb, %s, product.precio, product.precio, product.updated_at FROM core.online_carrito_items old JOIN core.catalogo_productos product ON product.producto_id=%s WHERE old.carrito_item_id=%s", (normal_id, 'b' * 64, normal_id, attached['cartItemId']))
    fulfillment = FulfillmentRepository(FulfillmentConfig(main.DB_CONNINFO,'test',True), connect=lambda *_a, **_k: wrapper)
    admin = FulfillmentAdminRepository(FulfillmentConfig(main.DB_CONNINFO,'test',True), connect=lambda *_a, **_k: wrapper)
    return connection, owner, draft, branch_id, fulfillment, admin


def _run(method: str):
    connection, owner, draft, branch_id, fulfillment, admin = _fixture()
    try:
        data = CreateFulfillmentRequest(method=method, contact=ContactInput(fullName='Test Customer',email='test@example.com',phone='5512345678'), pickupBranchId=branch_id if method=='pickup' else None, address=None if method=='pickup' else AddressInput(street='Test',exteriorNumber='1',neighborhood='Centro',postalCode='77500',city='Playa del Carmen',state='Quintana Roo',country='México'), opticalDraftId=draft['draftPublicId'])
        request = fulfillment.create_request(owner, data, f'{method}-request')
        with connection.cursor() as cur:
            cur.execute("SELECT optical_draft_id FROM core.online_solicitudes_cotizacion_envio WHERE solicitud_public_id=%s", (request['requestId'],))
            assert cur.fetchone()['optical_draft_id'] is not None
        if method == 'shipping':
            quote = admin.add_quote({'username':'admin','rol':'admin'}, request['requestId'], ManualQuoteInput(branchId=branch_id,carrierCode='dhl',serviceLevel='Test',amount=100,minimumDeliveryDays=1,maximumDeliveryDays=2))
            fulfillment.select_option(owner, request['requestId'], quote['options'][0]['optionId'], 'shipping-select')
        else:
            fulfillment.select_option(owner, request['requestId'], request['options'][0]['optionId'], 'pickup-select')
        before = connection.execute("SELECT stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=(SELECT producto_id FROM core.catalogo_productos WHERE sku='DEMO-RX-001') AND sucursal_id=%s", (branch_id,)).fetchone()['stock_reservado']
        reservation = fulfillment.create_reservation(owner, request['requestId'], f'{method}-reservation')
        replay_reservation = fulfillment.create_reservation(owner, request['requestId'], f'{method}-reservation-replay')
        assert reservation['reservationId'] == replay_reservation['reservationId']
        order = fulfillment.create_order(owner, request['requestId'], f'{method}-order')
        replay_order = fulfillment.create_order(owner, request['requestId'], f'{method}-order-replay')
        assert order['orderId'] == replay_order['orderId']
        assert order['status'] == 'pending_payment'
        with connection.cursor() as cur:
            cur.execute("SELECT optical_draft_id, optical_configuration_snapshot, subtotal, envio, total FROM core.online_ordenes WHERE orden_public_id=%s", (order['orderId'],))
            row = cur.fetchone()
            assert row['optical_draft_id'] is not None
            assert row['optical_configuration_snapshot']
            cur.execute("SELECT precio FROM core.catalogo_productos WHERE sku='DEMO-SUN-001'")
            normal_total = Decimal(cur.fetchone()['precio'])
            assert Decimal(row['subtotal']) == Decimal(draft['configuredTotal']) + normal_total
            assert Decimal(row['total']) == Decimal(row['subtotal']) + Decimal(row['envio'])
            cur.execute("SELECT reservation.converted_reserva_id FROM core.online_reservas_opticas_borrador reservation JOIN core.online_borradores_opticos draft USING(borrador_id) WHERE draft.borrador_public_id=%s", (draft['draftPublicId'],))
            assert cur.fetchone()['converted_reserva_id'] is not None
            cur.execute("SELECT COUNT(*) AS count, orden_id FROM core.online_optical_checkout_links WHERE borrador_id=%s GROUP BY orden_id", (row['optical_draft_id'],))
            link = cur.fetchone()
            assert link and int(link['count']) == 1 and link['orden_id'] is not None
            after = connection.execute("SELECT stock_reservado FROM core.catalogo_inventario_sucursal WHERE producto_id=(SELECT producto_id FROM core.catalogo_productos WHERE sku='DEMO-RX-001') AND sucursal_id=%s", (branch_id,)).fetchone()['stock_reservado']
            assert after == before
        return row
    finally:
        connection.rollback()
        connection.close()


def test_shipping_mixed_optical_checkout():
    row = _run('shipping')
    assert row['envio'] == 100


def test_pickup_mixed_optical_checkout():
    row = _run('pickup')
    assert row['envio'] == 0
