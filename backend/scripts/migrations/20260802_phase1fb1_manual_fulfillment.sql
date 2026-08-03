BEGIN;

CREATE TABLE core.envio_transportistas (
    transportista_id BIGSERIAL PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    requiere_nombre_personalizado BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT envio_transportistas_codigo_check CHECK (codigo ~ '^[a-z0-9_]+$')
);

INSERT INTO core.envio_transportistas (codigo, nombre, requiere_nombre_personalizado)
VALUES
    ('dhl', 'DHL', FALSE),
    ('fedex', 'FedEx', FALSE),
    ('estafeta', 'Estafeta', FALSE),
    ('other', 'Otro', TRUE);

CREATE TABLE core.envio_configuracion_empaque (
    configuracion_id SMALLINT PRIMARY KEY DEFAULT 1,
    activa BOOLEAN NOT NULL DEFAULT FALSE,
    peso_empaque_gramos INTEGER NULL,
    margen_largo_mm INTEGER NULL,
    margen_ancho_mm INTEGER NULL,
    margen_alto_mm INTEGER NULL,
    peso_maximo_gramos INTEGER NULL,
    largo_maximo_mm INTEGER NULL,
    ancho_maximo_mm INTEGER NULL,
    alto_maximo_mm INTEGER NULL,
    costo_weight NUMERIC(5,4) NOT NULL DEFAULT 0.6000,
    speed_weight NUMERIC(5,4) NOT NULL DEFAULT 0.4000,
    solicitud_vigencia_horas INTEGER NOT NULL DEFAULT 48,
    cotizacion_vigencia_horas INTEGER NOT NULL DEFAULT 24,
    updated_by_usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT envio_configuracion_unica_check CHECK (configuracion_id = 1),
    CONSTRAINT envio_configuracion_pesos_check CHECK (
        (peso_empaque_gramos IS NULL OR peso_empaque_gramos > 0)
        AND (peso_maximo_gramos IS NULL OR peso_maximo_gramos > 0)
    ),
    CONSTRAINT envio_configuracion_dimensiones_check CHECK (
        (margen_largo_mm IS NULL OR margen_largo_mm >= 0)
        AND (margen_ancho_mm IS NULL OR margen_ancho_mm >= 0)
        AND (margen_alto_mm IS NULL OR margen_alto_mm >= 0)
        AND (largo_maximo_mm IS NULL OR largo_maximo_mm > 0)
        AND (ancho_maximo_mm IS NULL OR ancho_maximo_mm > 0)
        AND (alto_maximo_mm IS NULL OR alto_maximo_mm > 0)
    ),
    CONSTRAINT envio_configuracion_weights_check CHECK (
        costo_weight >= 0 AND speed_weight >= 0
        AND costo_weight + speed_weight = 1
    ),
    CONSTRAINT envio_configuracion_vigencias_check CHECK (
        solicitud_vigencia_horas > 0 AND cotizacion_vigencia_horas > 0
    )
);

INSERT INTO core.envio_configuracion_empaque (configuracion_id) VALUES (1);

CREATE TABLE core.catalogo_producto_envio (
    producto_id BIGINT PRIMARY KEY REFERENCES core.catalogo_productos(producto_id),
    peso_gramos INTEGER NULL,
    largo_mm INTEGER NULL,
    ancho_mm INTEGER NULL,
    alto_mm INTEGER NULL,
    requiere_paquete_individual BOOLEAN NOT NULL DEFAULT FALSE,
    grupo_compatibilidad TEXT NOT NULL DEFAULT 'general',
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT catalogo_producto_envio_medidas_check CHECK (
        (peso_gramos IS NULL OR peso_gramos > 0)
        AND (largo_mm IS NULL OR largo_mm > 0)
        AND (ancho_mm IS NULL OR ancho_mm > 0)
        AND (alto_mm IS NULL OR alto_mm > 0)
    ),
    CONSTRAINT catalogo_producto_envio_activo_check CHECK (
        activo = FALSE OR (
            peso_gramos IS NOT NULL AND largo_mm IS NOT NULL
            AND ancho_mm IS NOT NULL AND alto_mm IS NOT NULL
        )
    )
);

INSERT INTO core.catalogo_producto_envio (producto_id)
SELECT producto_id FROM core.catalogo_productos;

CREATE TABLE core.envio_categoria_fallbacks (
    categoria TEXT PRIMARY KEY,
    peso_gramos INTEGER NULL,
    largo_mm INTEGER NULL,
    ancho_mm INTEGER NULL,
    alto_mm INTEGER NULL,
    requiere_paquete_individual BOOLEAN NOT NULL DEFAULT FALSE,
    grupo_compatibilidad TEXT NOT NULL DEFAULT 'general',
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT envio_categoria_fallbacks_medidas_check CHECK (
        (peso_gramos IS NULL OR peso_gramos > 0)
        AND (largo_mm IS NULL OR largo_mm > 0)
        AND (ancho_mm IS NULL OR ancho_mm > 0)
        AND (alto_mm IS NULL OR alto_mm > 0)
    ),
    CONSTRAINT envio_categoria_fallbacks_activo_check CHECK (
        activo = FALSE OR (
            peso_gramos IS NOT NULL AND largo_mm IS NOT NULL
            AND ancho_mm IS NOT NULL AND alto_mm IS NOT NULL
        )
    )
);

INSERT INTO core.envio_categoria_fallbacks (categoria)
SELECT DISTINCT categoria
FROM core.catalogo_productos
WHERE tipo_producto = 'producto_fisico';

CREATE TABLE core.online_solicitudes_cotizacion_envio (
    solicitud_id BIGSERIAL PRIMARY KEY,
    solicitud_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    propietario_tipo TEXT NOT NULL,
    propietario_ref_hash CHAR(64) NOT NULL,
    carrito_id BIGINT NOT NULL REFERENCES core.online_carritos(carrito_id),
    carrito_fingerprint CHAR(64) NOT NULL,
    metodo_entrega TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    direccion_snapshot JSONB NULL,
    contacto_snapshot JSONB NOT NULL,
    carrito_snapshot JSONB NOT NULL,
    paquetes_snapshot JSONB NOT NULL,
    expira_at TIMESTAMPTZ NOT NULL,
    selected_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_solicitudes_propietario_tipo_check
        CHECK (propietario_tipo IN ('invitado', 'cliente')),
    CONSTRAINT online_solicitudes_propietario_hash_check
        CHECK (propietario_ref_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_solicitudes_carrito_fingerprint_check
        CHECK (carrito_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_solicitudes_metodo_check
        CHECK (metodo_entrega IN ('envio', 'recoger_sucursal')),
    CONSTRAINT online_solicitudes_estado_check
        CHECK (estado IN ('pendiente', 'cotizada', 'seleccionada', 'expirada', 'no_disponible', 'cancelada')),
    CONSTRAINT online_solicitudes_snapshots_check CHECK (
        (direccion_snapshot IS NULL OR jsonb_typeof(direccion_snapshot) = 'object')
        AND jsonb_typeof(contacto_snapshot) = 'object'
        AND jsonb_typeof(carrito_snapshot) = 'object'
        AND jsonb_typeof(paquetes_snapshot) = 'array'
    ),
    CONSTRAINT online_solicitudes_direccion_check CHECK (
        (metodo_entrega = 'envio' AND direccion_snapshot IS NOT NULL)
        OR metodo_entrega = 'recoger_sucursal'
    )
);

CREATE INDEX online_solicitudes_propietario_fecha_idx
    ON core.online_solicitudes_cotizacion_envio
    (propietario_tipo, propietario_ref_hash, created_at DESC);
CREATE INDEX online_solicitudes_estado_expira_idx
    ON core.online_solicitudes_cotizacion_envio (estado, expira_at);

CREATE TABLE core.online_solicitud_sucursales_elegibles (
    elegibilidad_id BIGSERIAL PRIMARY KEY,
    solicitud_id BIGINT NOT NULL REFERENCES core.online_solicitudes_cotizacion_envio(solicitud_id),
    sucursal_id BIGINT NOT NULL REFERENCES core.sucursales(sucursal_id),
    sucursal_snapshot JSONB NOT NULL,
    disponibilidad_snapshot JSONB NOT NULL,
    elegible BOOLEAN NOT NULL DEFAULT TRUE,
    motivo_invalidez TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    invalidated_at TIMESTAMPTZ NULL,
    CONSTRAINT online_solicitud_elegibilidad_snapshots_check CHECK (
        jsonb_typeof(sucursal_snapshot) = 'object'
        AND jsonb_typeof(disponibilidad_snapshot) = 'array'
    ),
    CONSTRAINT online_solicitud_elegibilidad_unica UNIQUE (solicitud_id, sucursal_id)
);

CREATE TABLE core.online_opciones_cotizacion_envio (
    opcion_id BIGSERIAL PRIMARY KEY,
    opcion_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    solicitud_id BIGINT NOT NULL REFERENCES core.online_solicitudes_cotizacion_envio(solicitud_id),
    sucursal_id BIGINT NOT NULL REFERENCES core.sucursales(sucursal_id),
    transportista_id BIGINT NULL REFERENCES core.envio_transportistas(transportista_id),
    transportista_codigo_snapshot TEXT NOT NULL,
    transportista_nombre_snapshot TEXT NOT NULL,
    nivel_servicio_snapshot TEXT NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'MXN',
    entrega_min_dias INTEGER NOT NULL,
    entrega_max_dias INTEGER NOT NULL,
    quote_identifier TEXT NOT NULL,
    calculada_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_at TIMESTAMPTZ NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    invalidada_at TIMESTAMPTZ NULL,
    motivo_invalidez TEXT NULL,
    ingresada_por_usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    ingresada_por_rol TEXT NOT NULL,
    autorizacion_cero_razon TEXT NULL,
    autorizada_cero_por_usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    autorizada_cero_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_opciones_monto_check CHECK (monto >= 0),
    CONSTRAINT online_opciones_moneda_check CHECK (moneda = 'MXN'),
    CONSTRAINT online_opciones_entrega_check CHECK (
        entrega_min_dias >= 0 AND entrega_max_dias >= entrega_min_dias
    ),
    CONSTRAINT online_opciones_servicio_check CHECK (btrim(nivel_servicio_snapshot) <> ''),
    CONSTRAINT online_opciones_cero_check CHECK (
        monto > 0 OR (
            transportista_codigo_snapshot = 'pickup'
            OR (
                autorizacion_cero_razon IS NOT NULL
                AND autorizada_cero_por_usuario_id IS NOT NULL
                AND autorizada_cero_at IS NOT NULL
            )
        )
    )
);

CREATE INDEX online_opciones_solicitud_activas_idx
    ON core.online_opciones_cotizacion_envio (solicitud_id, activa, expira_at);

CREATE TABLE core.online_cotizacion_selecciones (
    seleccion_id BIGSERIAL PRIMARY KEY,
    solicitud_id BIGINT NOT NULL UNIQUE REFERENCES core.online_solicitudes_cotizacion_envio(solicitud_id),
    opcion_id BIGINT NOT NULL UNIQUE REFERENCES core.online_opciones_cotizacion_envio(opcion_id),
    opcion_snapshot JSONB NOT NULL,
    selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_cotizacion_selecciones_snapshot_check
        CHECK (jsonb_typeof(opcion_snapshot) = 'object')
);

CREATE TABLE core.online_checkout_previews (
    preview_id BIGSERIAL PRIMARY KEY,
    preview_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    solicitud_id BIGINT NOT NULL UNIQUE REFERENCES core.online_solicitudes_cotizacion_envio(solicitud_id),
    seleccion_id BIGINT NOT NULL UNIQUE REFERENCES core.online_cotizacion_selecciones(seleccion_id),
    propietario_tipo TEXT NOT NULL,
    propietario_ref_hash CHAR(64) NOT NULL,
    carrito_fingerprint CHAR(64) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    envio NUMERIC(12,2) NOT NULL,
    total NUMERIC(12,2) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'MXN',
    preview_snapshot JSONB NOT NULL,
    expira_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_checkout_previews_propietario_check
        CHECK (propietario_tipo IN ('invitado', 'cliente')),
    CONSTRAINT online_checkout_previews_hashes_check CHECK (
        propietario_ref_hash ~ '^[0-9a-f]{64}$'
        AND carrito_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_checkout_previews_amounts_check CHECK (
        subtotal >= 0 AND envio >= 0 AND total = subtotal + envio
    ),
    CONSTRAINT online_checkout_previews_snapshot_check
        CHECK (jsonb_typeof(preview_snapshot) = 'object')
);

CREATE TABLE core.online_cotizacion_envio_eventos (
    evento_id BIGSERIAL PRIMARY KEY,
    solicitud_id BIGINT NULL REFERENCES core.online_solicitudes_cotizacion_envio(solicitud_id),
    opcion_id BIGINT NULL REFERENCES core.online_opciones_cotizacion_envio(opcion_id),
    evento_tipo TEXT NOT NULL,
    actor_tipo TEXT NOT NULL,
    actor_ref_hash CHAR(64) NULL,
    usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    username_snapshot TEXT NULL,
    rol_snapshot TEXT NULL,
    estado_anterior TEXT NULL,
    estado_nuevo TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_cotizacion_eventos_actor_check
        CHECK (actor_tipo IN ('invitado', 'cliente', 'staff', 'sistema')),
    CONSTRAINT online_cotizacion_eventos_actor_hash_check
        CHECK (actor_ref_hash IS NULL OR actor_ref_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT online_cotizacion_eventos_metadata_check
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX online_cotizacion_eventos_solicitud_fecha_idx
    ON core.online_cotizacion_envio_eventos (solicitud_id, created_at DESC);

COMMIT;
