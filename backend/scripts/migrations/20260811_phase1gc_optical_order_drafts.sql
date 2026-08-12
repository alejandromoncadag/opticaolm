BEGIN;

-- Phase 1G-C: persistent configured optical-order drafts.
-- Additive only. No normal cart, order, payment, sale, patient, prescription,
-- laboratory or production record is created by this schema.

CREATE TABLE core.online_borradores_opticos (
    borrador_id BIGSERIAL PRIMARY KEY,
    borrador_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    propietario_tipo TEXT NOT NULL,
    propietario_ref_hash CHAR(64) NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente_receta',
    prescription_method TEXT NOT NULL,
    prescription_status TEXT NOT NULL DEFAULT 'pending',
    estado_pago TEXT NOT NULL DEFAULT 'sin_pago',
    sucursal_id BIGINT NOT NULL REFERENCES core.sucursales(sucursal_id),
    metodo_entrega TEXT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'MXN',
    total_configurado_snapshot NUMERIC(12,2) NOT NULL,
    preview_fingerprint CHAR(64) NOT NULL,
    preview_schema_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelado_at TIMESTAMPTZ NULL,
    expirado_at TIMESTAMPTZ NULL,
    CONSTRAINT online_borradores_opticos_owner_check CHECK (
        propietario_tipo IN ('invitado', 'cliente')
        AND propietario_ref_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_borradores_opticos_estado_check CHECK (
        estado IN (
            'pendiente_receta', 'listo_para_pago', 'pendiente_pago',
            'cancelado', 'expirado'
        )
    ),
    CONSTRAINT online_borradores_opticos_prescription_method_check CHECK (
        prescription_method IN ('upload', 'manual', 'later', 'exam')
    ),
    CONSTRAINT online_borradores_opticos_prescription_status_check CHECK (
        prescription_status IN ('pending', 'provided')
    ),
    CONSTRAINT online_borradores_opticos_payment_check CHECK (
        estado_pago = 'sin_pago'
    ),
    CONSTRAINT online_borradores_opticos_fulfillment_check CHECK (
        metodo_entrega IS NULL OR metodo_entrega IN ('envio', 'recoger_sucursal')
    ),
    CONSTRAINT online_borradores_opticos_amount_check CHECK (
        total_configurado_snapshot >= 0 AND moneda = 'MXN'
    ),
    CONSTRAINT online_borradores_opticos_fingerprint_check CHECK (
        preview_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_borradores_opticos_terminal_timestamp_check CHECK (
        (estado = 'cancelado' AND cancelado_at IS NOT NULL AND expirado_at IS NULL)
        OR (estado = 'expirado' AND expirado_at IS NOT NULL AND cancelado_at IS NULL)
        OR (estado NOT IN ('cancelado', 'expirado')
            AND cancelado_at IS NULL AND expirado_at IS NULL)
    )
);

CREATE INDEX online_borradores_opticos_owner_created_idx
    ON core.online_borradores_opticos (
        propietario_tipo, propietario_ref_hash, created_at DESC
    );
CREATE INDEX online_borradores_opticos_status_created_idx
    ON core.online_borradores_opticos (estado, created_at DESC);

CREATE TABLE core.online_configuraciones_opticas_borrador (
    configuracion_id BIGSERIAL PRIMARY KEY,
    configuracion_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    borrador_id BIGINT NOT NULL UNIQUE
        REFERENCES core.online_borradores_opticos(borrador_id),
    armazon_producto_id BIGINT NOT NULL
        REFERENCES core.catalogo_productos(producto_id),
    diseno_producto_id BIGINT NOT NULL
        REFERENCES core.catalogo_productos(producto_id),
    tratamiento_producto_id BIGINT NULL
        REFERENCES core.catalogo_productos(producto_id),
    variante_id BIGINT NULL
        REFERENCES core.catalogo_producto_variantes(variante_id),
    uso_visual TEXT NULL,
    cantidad_pares INTEGER NOT NULL DEFAULT 1,
    comportamiento_abasto_diseno_snapshot TEXT NOT NULL,
    comportamiento_abasto_tratamiento_snapshot TEXT NULL,
    configuracion_hash CHAR(64) NOT NULL,
    snapshot_comercial JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_configuraciones_opticas_variant_check CHECK (
        variante_id IS NULL OR tratamiento_producto_id IS NOT NULL
    ),
    CONSTRAINT online_configuraciones_opticas_uso_visual_check CHECK (
        uso_visual IS NULL OR uso_visual IN (
            'lejos', 'cerca', 'intermedio', 'multifocal',
            'sin_graduacion', 'otro'
        )
    ),
    CONSTRAINT online_configuraciones_opticas_quantity_check CHECK (
        cantidad_pares = 1
    ),
    CONSTRAINT online_configuraciones_opticas_supply_check CHECK (
        comportamiento_abasto_diseno_snapshot IN (
            'inventario', 'laboratorio_bajo_pedido',
            'fabricacion_interna', 'servicio'
        )
        AND (
            comportamiento_abasto_tratamiento_snapshot IS NULL
            OR comportamiento_abasto_tratamiento_snapshot IN (
                'inventario', 'laboratorio_bajo_pedido',
                'fabricacion_interna', 'servicio'
            )
        )
    ),
    CONSTRAINT online_configuraciones_opticas_hash_check CHECK (
        configuracion_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_configuraciones_opticas_snapshot_check CHECK (
        jsonb_typeof(snapshot_comercial) = 'object'
    )
);

CREATE INDEX online_configuraciones_opticas_components_idx
    ON core.online_configuraciones_opticas_borrador (
        armazon_producto_id, diseno_producto_id,
        tratamiento_producto_id, variante_id
    );

CREATE TABLE core.online_reservas_opticas_borrador (
    reserva_id BIGSERIAL PRIMARY KEY,
    reserva_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    borrador_id BIGINT NOT NULL UNIQUE
        REFERENCES core.online_borradores_opticos(borrador_id),
    configuracion_id BIGINT NOT NULL UNIQUE
        REFERENCES core.online_configuraciones_opticas_borrador(configuracion_id),
    armazon_producto_id BIGINT NOT NULL
        REFERENCES core.catalogo_productos(producto_id),
    sucursal_id BIGINT NOT NULL REFERENCES core.sucursales(sucursal_id),
    cantidad INTEGER NOT NULL DEFAULT 1,
    configuracion_hash CHAR(64) NOT NULL,
    sku_snapshot TEXT NOT NULL,
    nombre_snapshot TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'activa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_reservas_opticas_quantity_check CHECK (cantidad = 1),
    CONSTRAINT online_reservas_opticas_hash_check CHECK (
        configuracion_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_reservas_opticas_estado_check CHECK (
        estado IN ('activa', 'cancelada', 'expirada')
    ),
    CONSTRAINT online_reservas_opticas_expiration_check CHECK (
        expires_at > created_at
    ),
    CONSTRAINT online_reservas_opticas_release_check CHECK (
        (estado = 'activa' AND released_at IS NULL)
        OR (estado <> 'activa' AND released_at IS NOT NULL)
    )
);

CREATE INDEX online_reservas_opticas_expiration_idx
    ON core.online_reservas_opticas_borrador (estado, expires_at);
CREATE INDEX online_reservas_opticas_inventory_idx
    ON core.online_reservas_opticas_borrador (
        sucursal_id, armazon_producto_id, estado
    );

CREATE TABLE core.online_borrador_optico_eventos (
    evento_id BIGSERIAL PRIMARY KEY,
    borrador_id BIGINT NOT NULL
        REFERENCES core.online_borradores_opticos(borrador_id),
    reserva_id BIGINT NULL
        REFERENCES core.online_reservas_opticas_borrador(reserva_id),
    evento_tipo TEXT NOT NULL,
    actor_tipo TEXT NOT NULL,
    actor_ref_hash CHAR(64) NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_borrador_optico_eventos_actor_check CHECK (
        actor_tipo IN ('cliente', 'invitado', 'sistema', 'staff')
    ),
    CONSTRAINT online_borrador_optico_eventos_hash_check CHECK (
        actor_ref_hash IS NULL OR actor_ref_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_borrador_optico_eventos_metadata_check CHECK (
        jsonb_typeof(metadata) = 'object'
    )
);

CREATE UNIQUE INDEX online_borrador_optico_eventos_once_uq
    ON core.online_borrador_optico_eventos (borrador_id, evento_tipo)
    WHERE evento_tipo IN (
        'draft_created', 'reservation_created',
        'draft_cancelled', 'reservation_expired'
    );

CREATE VIEW core.online_inventario_reservas_activas AS
SELECT
    'b2'::TEXT AS fuente_tipo,
    reservation.reserva_id AS fuente_reserva_id,
    lines.reserva_linea_id AS fuente_linea_id,
    lines.producto_id,
    lines.sucursal_id,
    lines.cantidad
FROM core.online_reserva_lineas lines
JOIN core.online_reservas reservation
  ON reservation.reserva_id = lines.reserva_id
WHERE reservation.estado = 'activa'
UNION ALL
SELECT
    'optical_draft'::TEXT AS fuente_tipo,
    reservation.reserva_id AS fuente_reserva_id,
    reservation.reserva_id AS fuente_linea_id,
    reservation.armazon_producto_id AS producto_id,
    reservation.sucursal_id,
    reservation.cantidad
FROM core.online_reservas_opticas_borrador reservation
WHERE reservation.estado = 'activa';

COMMIT;
