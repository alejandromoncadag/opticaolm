BEGIN;

-- Phase 1G-E: verified storefront identity, patient linking, and explicit
-- prescription access. Additive only; clinical histories are never imported.

CREATE TABLE core.online_cliente_paciente_link_intentos (
    intento_id BIGSERIAL PRIMARY KEY,
    intento_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    cuenta_ref_hash CHAR(64) NOT NULL,
    correo_hash CHAR(64) NOT NULL,
    telefono_hash CHAR(64) NOT NULL,
    nombre_hash CHAR(64) NOT NULL,
    paciente_candidato_id BIGINT NULL REFERENCES core.pacientes(paciente_id),
    resultado TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    confirmado_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_link_intentos_hash_check CHECK (
        cuenta_ref_hash ~ '^[0-9a-f]{64}$'
        AND correo_hash ~ '^[0-9a-f]{64}$'
        AND telefono_hash ~ '^[0-9a-f]{64}$'
        AND nombre_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_link_intentos_resultado_check CHECK (
        resultado IN ('coincidencia_exacta', 'sin_coincidencia', 'revision_manual')
    ),
    CONSTRAINT online_link_intentos_estado_check CHECK (
        estado IN ('pendiente', 'confirmado', 'expirado', 'cancelado')
    ),
    CONSTRAINT online_link_intentos_candidate_check CHECK (
        (resultado = 'coincidencia_exacta' AND paciente_candidato_id IS NOT NULL)
        OR (resultado <> 'coincidencia_exacta' AND paciente_candidato_id IS NULL)
    )
);

CREATE INDEX online_link_intentos_account_idx
    ON core.online_cliente_paciente_link_intentos
       (cuenta_ref_hash, created_at DESC);

CREATE TABLE core.online_cliente_paciente_links (
    link_id BIGSERIAL PRIMARY KEY,
    link_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    cuenta_ref_hash CHAR(64) NOT NULL,
    paciente_id BIGINT NOT NULL REFERENCES core.pacientes(paciente_id),
    estado TEXT NOT NULL DEFAULT 'activo',
    metodo_vinculacion TEXT NOT NULL DEFAULT 'correo_telefono_nombre',
    correo_verificado_hash CHAR(64) NOT NULL,
    telefono_verificado_hash CHAR(64) NOT NULL,
    intento_id BIGINT NULL
        REFERENCES core.online_cliente_paciente_link_intentos(intento_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revocado_at TIMESTAMPTZ NULL,
    CONSTRAINT online_patient_links_hash_check CHECK (
        cuenta_ref_hash ~ '^[0-9a-f]{64}$'
        AND correo_verificado_hash ~ '^[0-9a-f]{64}$'
        AND telefono_verificado_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_patient_links_estado_check CHECK (
        estado IN ('activo', 'revocado', 'suspendido')
    ),
    CONSTRAINT online_patient_links_revocation_check CHECK (
        (estado = 'revocado' AND revocado_at IS NOT NULL)
        OR (estado <> 'revocado' AND revocado_at IS NULL)
    )
);

CREATE UNIQUE INDEX online_patient_links_active_account_uq
    ON core.online_cliente_paciente_links (cuenta_ref_hash)
    WHERE estado = 'activo';
CREATE UNIQUE INDEX online_patient_links_active_patient_uq
    ON core.online_cliente_paciente_links (paciente_id)
    WHERE estado = 'activo';

CREATE TABLE core.prescripcion_optica_acceso_online (
    acceso_id BIGSERIAL PRIMARY KEY,
    acceso_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    prescripcion_id BIGINT NOT NULL REFERENCES core.prescripciones_opticas(prescripcion_id),
    paciente_id BIGINT NOT NULL REFERENCES core.pacientes(paciente_id),
    estado TEXT NOT NULL DEFAULT 'aprobada',
    valida_desde DATE NOT NULL DEFAULT CURRENT_DATE,
    valida_hasta DATE NULL,
    aprobada_por BIGINT NOT NULL REFERENCES core.usuarios(usuario_id),
    aprobada_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revocada_por BIGINT NULL REFERENCES core.usuarios(usuario_id),
    revocada_at TIMESTAMPTZ NULL,
    motivo_revocacion TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT prescription_access_estado_check CHECK (
        estado IN ('aprobada', 'revocada', 'expirada')
    ),
    CONSTRAINT prescription_access_dates_check CHECK (
        valida_hasta IS NULL OR valida_hasta >= valida_desde
    ),
    CONSTRAINT prescription_access_revocation_check CHECK (
        (estado = 'revocada' AND revocada_por IS NOT NULL AND revocada_at IS NOT NULL)
        OR (estado <> 'revocada' AND revocada_por IS NULL AND revocada_at IS NULL)
    ),
    CONSTRAINT prescription_access_prescription_uq UNIQUE (prescripcion_id)
);

CREATE INDEX prescription_access_patient_idx
    ON core.prescripcion_optica_acceso_online
       (paciente_id, estado, valida_hasta);

CREATE TABLE core.online_borrador_optico_prescripciones (
    seleccion_id BIGSERIAL PRIMARY KEY,
    borrador_id BIGINT NOT NULL UNIQUE
        REFERENCES core.online_borradores_opticos(borrador_id),
    link_id BIGINT NOT NULL REFERENCES core.online_cliente_paciente_links(link_id),
    acceso_id BIGINT NOT NULL
        REFERENCES core.prescripcion_optica_acceso_online(acceso_id),
    prescripcion_id BIGINT NOT NULL
        REFERENCES core.prescripciones_opticas(prescripcion_id),
    metodo TEXT NOT NULL DEFAULT 'guardada',
    fecha_prescripcion_snapshot DATE NULL,
    seleccionada_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_draft_prescription_method_check CHECK (metodo = 'guardada')
);

CREATE INDEX online_draft_prescription_access_idx
    ON core.online_borrador_optico_prescripciones (acceso_id);

CREATE TABLE core.online_identidad_eventos (
    evento_id BIGSERIAL PRIMARY KEY,
    evento_tipo TEXT NOT NULL,
    actor_tipo TEXT NOT NULL,
    cuenta_ref_hash CHAR(64) NULL,
    link_id BIGINT NULL REFERENCES core.online_cliente_paciente_links(link_id),
    intento_id BIGINT NULL
        REFERENCES core.online_cliente_paciente_link_intentos(intento_id),
    borrador_id BIGINT NULL REFERENCES core.online_borradores_opticos(borrador_id),
    acceso_id BIGINT NULL
        REFERENCES core.prescripcion_optica_acceso_online(acceso_id),
    actor_usuario_id BIGINT NULL REFERENCES core.usuarios(usuario_id),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_identity_events_actor_check CHECK (
        actor_tipo IN ('cliente', 'sistema', 'staff')
    ),
    CONSTRAINT online_identity_events_hash_check CHECK (
        cuenta_ref_hash IS NULL OR cuenta_ref_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_identity_events_json_check CHECK (
        jsonb_typeof(metadata) = 'object'
    )
);

CREATE INDEX online_identity_events_account_idx
    ON core.online_identidad_eventos (cuenta_ref_hash, created_at DESC);
CREATE INDEX online_identity_events_link_idx
    ON core.online_identidad_eventos (link_id, created_at DESC);

COMMIT;
