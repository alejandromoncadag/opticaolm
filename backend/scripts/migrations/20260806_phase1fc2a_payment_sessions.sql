BEGIN;

CREATE TABLE core.online_pago_sesiones (
    sesion_id BIGSERIAL PRIMARY KEY,
    sesion_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    orden_id BIGINT NOT NULL REFERENCES core.online_ordenes(orden_id),
    proveedor TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    monto NUMERIC(12,2) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'MXN',
    proveedor_sesion_ref TEXT NULL,
    checkout_url TEXT NULL,
    expira_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_pago_sesiones_provider_check CHECK (length(trim(proveedor)) BETWEEN 2 AND 40),
    CONSTRAINT online_pago_sesiones_status_check CHECK (estado IN ('pendiente', 'checkout_creado', 'fallido', 'cancelado', 'expirado', 'pagado')),
    CONSTRAINT online_pago_sesiones_amount_check CHECK (monto >= 0),
    CONSTRAINT online_pago_sesiones_currency_check CHECK (moneda = 'MXN'),
    CONSTRAINT online_pago_sesiones_no_card_data_check CHECK (
        checkout_url IS NULL OR checkout_url NOT LIKE '%card%'
    )
);

CREATE UNIQUE INDEX online_pago_sesiones_order_provider_uq
    ON core.online_pago_sesiones (orden_id, proveedor);
CREATE INDEX online_pago_sesiones_status_expiry_idx
    ON core.online_pago_sesiones (estado, expira_at);

CREATE TABLE core.online_pago_intentos (
    intento_id BIGSERIAL PRIMARY KEY,
    sesion_id BIGINT NOT NULL REFERENCES core.online_pago_sesiones(sesion_id),
    numero_intento INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    proveedor_intento_ref TEXT NULL,
    codigo_error TEXT NULL,
    mensaje_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_pago_intentos_number_check CHECK (numero_intento > 0),
    CONSTRAINT online_pago_intentos_status_check CHECK (estado IN ('pendiente', 'checkout_creado', 'fallido', 'cancelado', 'expirado', 'pagado')),
    CONSTRAINT online_pago_intentos_error_length_check CHECK (mensaje_error IS NULL OR length(mensaje_error) <= 500)
);

CREATE UNIQUE INDEX online_pago_intentos_session_number_uq
    ON core.online_pago_intentos (sesion_id, numero_intento);

CREATE TABLE core.online_pago_eventos (
    evento_id BIGSERIAL PRIMARY KEY,
    sesion_id BIGINT NOT NULL REFERENCES core.online_pago_sesiones(sesion_id),
    evento_tipo TEXT NOT NULL,
    actor_tipo TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_pago_eventos_actor_check CHECK (actor_tipo IN ('cliente', 'invitado', 'sistema', 'staff')),
    CONSTRAINT online_pago_eventos_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX online_pago_eventos_session_created_idx
    ON core.online_pago_eventos (sesion_id, created_at DESC);

COMMIT;
