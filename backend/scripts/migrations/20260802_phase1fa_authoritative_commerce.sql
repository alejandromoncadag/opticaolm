BEGIN;

CREATE TABLE core.online_producto_configuracion (
    producto_id BIGINT PRIMARY KEY REFERENCES core.catalogo_productos(producto_id),
    comprable_online BOOLEAN NOT NULL DEFAULT FALSE,
    permite_favorito BOOLEAN NOT NULL DEFAULT TRUE,
    cantidad_maxima_por_linea INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_producto_configuracion_cantidad_check
        CHECK (cantidad_maxima_por_linea IS NULL OR cantidad_maxima_por_linea > 0)
);

INSERT INTO core.online_producto_configuracion (
    producto_id,
    comprable_online,
    permite_favorito,
    cantidad_maxima_por_linea
)
SELECT producto_id, FALSE, TRUE, NULL
FROM core.catalogo_productos;

CREATE TABLE core.online_producto_configuracion_auditoria (
    auditoria_id BIGSERIAL PRIMARY KEY,
    producto_id BIGINT NOT NULL REFERENCES core.catalogo_productos(producto_id),
    valores_anteriores JSONB NOT NULL,
    valores_nuevos JSONB NOT NULL,
    admin_username TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_producto_auditoria_anteriores_check
        CHECK (jsonb_typeof(valores_anteriores) = 'object'),
    CONSTRAINT online_producto_auditoria_nuevos_check
        CHECK (jsonb_typeof(valores_nuevos) = 'object')
);

CREATE INDEX online_producto_auditoria_producto_fecha_idx
    ON core.online_producto_configuracion_auditoria (producto_id, created_at DESC);

CREATE TABLE core.online_carritos (
    carrito_id BIGSERIAL PRIMARY KEY,
    propietario_tipo TEXT NOT NULL,
    propietario_ref_hash CHAR(64) NOT NULL,
    estado TEXT NOT NULL DEFAULT 'activo',
    moneda CHAR(3) NOT NULL DEFAULT 'MXN',
    version INTEGER NOT NULL DEFAULT 1,
    expira_at TIMESTAMPTZ NULL,
    fusionado_en_carrito_id BIGINT NULL REFERENCES core.online_carritos(carrito_id),
    ultima_actividad_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_carritos_propietario_tipo_check
        CHECK (propietario_tipo IN ('invitado', 'cliente')),
    CONSTRAINT online_carritos_propietario_hash_check
        CHECK (propietario_ref_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_carritos_estado_check
        CHECK (estado IN ('activo', 'fusionado', 'convertido', 'abandonado', 'expirado')),
    CONSTRAINT online_carritos_version_check CHECK (version > 0),
    CONSTRAINT online_carritos_expiracion_check
        CHECK (
            (propietario_tipo = 'invitado' AND expira_at IS NOT NULL)
            OR (propietario_tipo = 'cliente' AND expira_at IS NULL)
        )
);

CREATE UNIQUE INDEX online_carritos_propietario_activo_uq
    ON core.online_carritos (propietario_tipo, propietario_ref_hash)
    WHERE estado = 'activo';

CREATE INDEX online_carritos_actividad_idx
    ON core.online_carritos (estado, ultima_actividad_at);

CREATE TABLE core.online_carrito_items (
    carrito_item_id BIGSERIAL PRIMARY KEY,
    carrito_id BIGINT NOT NULL REFERENCES core.online_carritos(carrito_id),
    producto_id BIGINT NOT NULL REFERENCES core.catalogo_productos(producto_id),
    sku_snapshot TEXT NOT NULL,
    slug_snapshot TEXT NOT NULL,
    nombre_snapshot TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    configuracion JSONB NOT NULL DEFAULT '{}'::JSONB,
    configuracion_hash CHAR(64) NOT NULL,
    precio_observado NUMERIC(12,2) NOT NULL,
    precio_reconocido NUMERIC(12,2) NOT NULL,
    producto_updated_at_observado TIMESTAMPTZ NOT NULL,
    precio_reconocido_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    requiere_revision BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    removed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_carrito_items_cantidad_check CHECK (cantidad > 0),
    CONSTRAINT online_carrito_items_configuracion_check
        CHECK (jsonb_typeof(configuracion) = 'object'),
    CONSTRAINT online_carrito_items_configuracion_hash_check
        CHECK (configuracion_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_carrito_items_precio_observado_check CHECK (precio_observado >= 0),
    CONSTRAINT online_carrito_items_precio_reconocido_check CHECK (precio_reconocido >= 0)
);

CREATE UNIQUE INDEX online_carrito_items_activo_uq
    ON core.online_carrito_items (carrito_id, producto_id, configuracion_hash)
    WHERE activo = TRUE;

CREATE INDEX online_carrito_items_carrito_idx
    ON core.online_carrito_items (carrito_id, activo, created_at);

CREATE TABLE core.online_favoritos (
    favorito_id BIGSERIAL PRIMARY KEY,
    propietario_tipo TEXT NOT NULL,
    propietario_ref_hash CHAR(64) NOT NULL,
    producto_id BIGINT NOT NULL REFERENCES core.catalogo_productos(producto_id),
    sku_snapshot TEXT NOT NULL,
    slug_snapshot TEXT NOT NULL,
    nombre_snapshot TEXT NOT NULL,
    expira_at TIMESTAMPTZ NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    removed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_favoritos_propietario_tipo_check
        CHECK (propietario_tipo IN ('invitado', 'cliente')),
    CONSTRAINT online_favoritos_propietario_hash_check
        CHECK (propietario_ref_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_favoritos_expiracion_check
        CHECK (
            (propietario_tipo = 'invitado' AND expira_at IS NOT NULL)
            OR (propietario_tipo = 'cliente' AND expira_at IS NULL)
        )
);

CREATE UNIQUE INDEX online_favoritos_activo_uq
    ON core.online_favoritos (propietario_tipo, propietario_ref_hash, producto_id)
    WHERE activo = TRUE;

CREATE INDEX online_favoritos_propietario_idx
    ON core.online_favoritos (propietario_tipo, propietario_ref_hash, activo, created_at DESC);

CREATE TABLE core.online_comercio_eventos (
    evento_id BIGSERIAL PRIMARY KEY,
    entidad_tipo TEXT NOT NULL,
    entidad_id BIGINT NULL,
    evento_tipo TEXT NOT NULL,
    propietario_tipo TEXT NULL,
    propietario_ref_hash CHAR(64) NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_comercio_eventos_entidad_check
        CHECK (entidad_tipo IN ('carrito', 'carrito_item', 'favorito', 'sesion')),
    CONSTRAINT online_comercio_eventos_propietario_check
        CHECK (propietario_tipo IS NULL OR propietario_tipo IN ('invitado', 'cliente')),
    CONSTRAINT online_comercio_eventos_hash_check
        CHECK (propietario_ref_hash IS NULL OR propietario_ref_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_comercio_eventos_metadata_check
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX online_comercio_eventos_entidad_fecha_idx
    ON core.online_comercio_eventos (entidad_tipo, entidad_id, created_at DESC);

CREATE TABLE core.online_idempotencia (
    idempotencia_id BIGSERIAL PRIMARY KEY,
    alcance TEXT NOT NULL,
    clave_hash CHAR(64) NOT NULL,
    propietario_ref_hash CHAR(64) NOT NULL,
    solicitud_hash CHAR(64) NOT NULL,
    estado TEXT NOT NULL DEFAULT 'procesando',
    recurso_id BIGINT NULL,
    codigo_respuesta INTEGER NULL,
    respuesta JSONB NULL,
    expira_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_idempotencia_clave_hash_check CHECK (clave_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_idempotencia_propietario_hash_check CHECK (propietario_ref_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_idempotencia_solicitud_hash_check CHECK (solicitud_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_idempotencia_estado_check
        CHECK (estado IN ('procesando', 'completado', 'fallido')),
    CONSTRAINT online_idempotencia_respuesta_check
        CHECK (respuesta IS NULL OR jsonb_typeof(respuesta) = 'object')
);

CREATE UNIQUE INDEX online_idempotencia_alcance_clave_uq
    ON core.online_idempotencia (alcance, clave_hash);

CREATE INDEX online_idempotencia_expiracion_idx
    ON core.online_idempotencia (expira_at);

COMMIT;
