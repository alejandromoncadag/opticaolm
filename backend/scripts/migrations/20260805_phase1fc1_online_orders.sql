BEGIN;

CREATE TABLE core.online_ordenes (
    orden_id BIGSERIAL PRIMARY KEY,
    orden_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    reserva_id BIGINT NOT NULL UNIQUE REFERENCES core.online_reservas(reserva_id),
    solicitud_id BIGINT NOT NULL UNIQUE REFERENCES core.online_solicitudes_cotizacion_envio(solicitud_id),
    preview_id BIGINT NOT NULL UNIQUE REFERENCES core.online_checkout_previews(preview_id),
    propietario_tipo TEXT NOT NULL,
    propietario_ref_hash CHAR(64) NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente_pago',
    metodo_entrega TEXT NOT NULL,
    sucursal_id BIGINT NOT NULL REFERENCES core.sucursales(sucursal_id),
    sucursal_snapshot JSONB NOT NULL,
    contacto_snapshot JSONB NOT NULL,
    direccion_snapshot JSONB NULL,
    cotizacion_snapshot JSONB NULL,
    carrito_fingerprint CHAR(64) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    envio NUMERIC(12,2) NOT NULL,
    total NUMERIC(12,2) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'MXN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_ordenes_propietario_check CHECK (propietario_tipo IN ('invitado', 'cliente')),
    CONSTRAINT online_ordenes_hash_check CHECK (
        propietario_ref_hash ~ '^[0-9a-f]{64}$'
        AND carrito_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_ordenes_estado_check CHECK (estado IN ('pendiente_pago')),
    CONSTRAINT online_ordenes_metodo_check CHECK (metodo_entrega IN ('envio', 'recoger_sucursal')),
    CONSTRAINT online_ordenes_snapshots_check CHECK (
        jsonb_typeof(sucursal_snapshot) = 'object'
        AND jsonb_typeof(contacto_snapshot) = 'object'
        AND (direccion_snapshot IS NULL OR jsonb_typeof(direccion_snapshot) = 'object')
        AND (cotizacion_snapshot IS NULL OR jsonb_typeof(cotizacion_snapshot) = 'object')
    ),
    CONSTRAINT online_ordenes_amounts_check CHECK (
        subtotal >= 0 AND envio >= 0 AND total = subtotal + envio
    ),
    CONSTRAINT online_ordenes_currency_check CHECK (moneda = 'MXN'),
    CONSTRAINT online_ordenes_delivery_snapshot_check CHECK (
        (metodo_entrega = 'envio' AND direccion_snapshot IS NOT NULL AND cotizacion_snapshot IS NOT NULL)
        OR (metodo_entrega = 'recoger_sucursal' AND direccion_snapshot IS NULL)
    )
);

CREATE INDEX online_ordenes_owner_created_idx
    ON core.online_ordenes (propietario_tipo, propietario_ref_hash, created_at DESC);
CREATE INDEX online_ordenes_status_created_idx
    ON core.online_ordenes (estado, created_at DESC);

CREATE TABLE core.online_orden_lineas (
    orden_linea_id BIGSERIAL PRIMARY KEY,
    orden_id BIGINT NOT NULL REFERENCES core.online_ordenes(orden_id),
    producto_id BIGINT NOT NULL REFERENCES core.catalogo_productos(producto_id),
    sucursal_id BIGINT NOT NULL REFERENCES core.sucursales(sucursal_id),
    carrito_item_id BIGINT NULL REFERENCES core.online_carrito_items(carrito_item_id),
    configuracion_hash CHAR(64) NOT NULL,
    sku_snapshot TEXT NOT NULL,
    nombre_snapshot TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    importe_linea NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_orden_lineas_hash_check CHECK (configuracion_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_orden_lineas_quantity_check CHECK (cantidad > 0),
    CONSTRAINT online_orden_lineas_amount_check CHECK (
        precio_unitario >= 0 AND importe_linea = precio_unitario * cantidad
    )
);

CREATE UNIQUE INDEX online_orden_lineas_unique_uq
    ON core.online_orden_lineas (orden_id, producto_id, configuracion_hash);
CREATE INDEX online_orden_lineas_product_branch_idx
    ON core.online_orden_lineas (producto_id, sucursal_id, orden_id);

CREATE TABLE core.online_orden_eventos (
    evento_id BIGSERIAL PRIMARY KEY,
    orden_id BIGINT NOT NULL REFERENCES core.online_ordenes(orden_id),
    evento_tipo TEXT NOT NULL,
    actor_tipo TEXT NOT NULL,
    actor_ref_hash CHAR(64) NULL,
    usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_orden_eventos_actor_check CHECK (actor_tipo IN ('cliente', 'invitado', 'sistema', 'staff')),
    CONSTRAINT online_orden_eventos_hash_check CHECK (
        actor_ref_hash IS NULL OR actor_ref_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_orden_eventos_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX online_orden_eventos_creation_uq
    ON core.online_orden_eventos (orden_id, evento_tipo)
    WHERE evento_tipo = 'order_created';

COMMIT;
