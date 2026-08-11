BEGIN;

-- Phase 1F-B2: temporary inventory reservations.
-- This migration is additive and assumes the Phase 1F-B1 fulfillment tables
-- and Phase 1A/1B catalog tables already exist.

CREATE TABLE IF NOT EXISTS core.online_reserva_configuracion (
    configuracion_id SMALLINT PRIMARY KEY DEFAULT 1,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    vigencia_minutos INTEGER NOT NULL DEFAULT 20,
    updated_by_usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_reserva_configuracion_unica_check CHECK (configuracion_id = 1),
    CONSTRAINT online_reserva_configuracion_vigencia_check CHECK (vigencia_minutos > 0)
);

INSERT INTO core.online_reserva_configuracion (configuracion_id)
VALUES (1)
ON CONFLICT (configuracion_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS core.online_reservas (
    reserva_id BIGSERIAL PRIMARY KEY,
    reserva_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    solicitud_id BIGINT NOT NULL REFERENCES core.online_solicitudes_cotizacion_envio(solicitud_id),
    seleccion_id BIGINT NOT NULL REFERENCES core.online_cotizacion_selecciones(seleccion_id),
    propietario_tipo TEXT NOT NULL,
    propietario_ref_hash CHAR(64) NOT NULL,
    carrito_fingerprint CHAR(64) NOT NULL,
    sucursal_id BIGINT NOT NULL REFERENCES core.sucursales(sucursal_id),
    estado TEXT NOT NULL DEFAULT 'activa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_reservas_propietario_check CHECK (propietario_tipo IN ('invitado', 'cliente')),
    CONSTRAINT online_reservas_hashes_check CHECK (
        propietario_ref_hash ~ '^[0-9a-f]{64}$'
        AND carrito_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_reservas_estado_check CHECK (estado IN ('activa', 'liberada', 'expirada', 'cancelada')),
    CONSTRAINT online_reservas_expiration_check CHECK (expires_at > created_at),
    CONSTRAINT online_reservas_release_check CHECK (
        (estado = 'activa' AND released_at IS NULL)
        OR (estado <> 'activa' AND released_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS core.online_reserva_lineas (
    reserva_linea_id BIGSERIAL PRIMARY KEY,
    reserva_id BIGINT NOT NULL REFERENCES core.online_reservas(reserva_id),
    producto_id BIGINT NOT NULL REFERENCES core.catalogo_productos(producto_id),
    sucursal_id BIGINT NOT NULL REFERENCES core.sucursales(sucursal_id),
    carrito_item_id BIGINT NULL REFERENCES core.online_carrito_items(carrito_item_id),
    configuracion_hash CHAR(64) NOT NULL,
    sku_snapshot TEXT NOT NULL,
    nombre_snapshot TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_reserva_lineas_hash_check CHECK (configuracion_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_reserva_lineas_cantidad_check CHECK (cantidad > 0)
);

CREATE TABLE IF NOT EXISTS core.online_reserva_eventos (
    evento_id BIGSERIAL PRIMARY KEY,
    reserva_id BIGINT NOT NULL REFERENCES core.online_reservas(reserva_id),
    evento_tipo TEXT NOT NULL,
    actor_tipo TEXT NOT NULL,
    actor_ref_hash CHAR(64) NULL,
    usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_reserva_eventos_actor_check CHECK (actor_tipo IN ('cliente', 'invitado', 'sistema', 'staff')),
    CONSTRAINT online_reserva_eventos_hash_check CHECK (
        actor_ref_hash IS NULL OR actor_ref_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_reserva_eventos_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS online_reservas_expiration_idx
    ON core.online_reservas (estado, expires_at);

CREATE INDEX IF NOT EXISTS online_reservas_owner_idx
    ON core.online_reservas (propietario_tipo, propietario_ref_hash, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS online_reservas_solicitud_activa_uq
    ON core.online_reservas (solicitud_id)
    WHERE estado = 'activa';

CREATE UNIQUE INDEX IF NOT EXISTS online_reserva_lineas_unique_uq
    ON core.online_reserva_lineas (reserva_id, producto_id, configuracion_hash);

CREATE INDEX IF NOT EXISTS online_reserva_lineas_inventory_idx
    ON core.online_reserva_lineas (sucursal_id, producto_id, reserva_id);

CREATE UNIQUE INDEX IF NOT EXISTS online_reserva_eventos_tipo_uq
    ON core.online_reserva_eventos (reserva_id, evento_tipo);

COMMIT;
