BEGIN;

-- Online checkout identity resolution. Additive only: no clinical rows are
-- created by this migration and existing sales remain untouched.
CREATE TABLE IF NOT EXISTS core.online_guest_email_verifications (
    verification_id BIGSERIAL PRIMARY KEY,
    verification_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    propietario_tipo TEXT NOT NULL DEFAULT 'invitado',
    propietario_ref_hash CHAR(64) NOT NULL,
    correo_hash CHAR(64) NOT NULL,
    codigo_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    attempts INTEGER NOT NULL DEFAULT 0,
    verified_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_guest_email_owner_check CHECK (
        propietario_tipo = 'invitado'
        AND propietario_ref_hash ~ '^[0-9a-f]{64}$'
        AND correo_hash ~ '^[0-9a-f]{64}$'
        AND codigo_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_guest_email_attempts_check CHECK (attempts >= 0 AND attempts <= 10)
);
ALTER TABLE core.online_guest_email_verifications
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL;
DROP INDEX IF EXISTS core.online_guest_email_active_uq;
CREATE UNIQUE INDEX IF NOT EXISTS online_guest_email_active_uq
    ON core.online_guest_email_verifications (propietario_ref_hash, correo_hash)
    WHERE verified_at IS NULL AND cancelled_at IS NULL;

ALTER TABLE core.online_ordenes
    ADD COLUMN IF NOT EXISTS paciente_id BIGINT NULL REFERENCES core.pacientes(paciente_id),
    ADD COLUMN IF NOT EXISTS identidad_estado TEXT NOT NULL DEFAULT 'pendiente',
    ADD COLUMN IF NOT EXISTS identidad_resuelta_at TIMESTAMPTZ NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'core.online_ordenes'::regclass
          AND conname = 'online_ordenes_identity_state_check'
    ) THEN
        ALTER TABLE core.online_ordenes
            ADD CONSTRAINT online_ordenes_identity_state_check
            CHECK (identidad_estado IN ('pendiente', 'resuelto', 'requiere_revision'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS online_ordenes_identity_idx
    ON core.online_ordenes (identidad_estado, created_at DESC);
CREATE INDEX IF NOT EXISTS online_ordenes_patient_idx
    ON core.online_ordenes (paciente_id, created_at DESC);

CREATE TABLE IF NOT EXISTS core.online_identidad_checkout (
    identidad_id BIGSERIAL PRIMARY KEY,
    identidad_public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    orden_id BIGINT NOT NULL UNIQUE REFERENCES core.online_ordenes(orden_id),
    propietario_tipo TEXT NOT NULL,
    propietario_ref_hash CHAR(64) NOT NULL,
    correo_hash CHAR(64) NOT NULL,
    telefono_hash CHAR(64) NOT NULL,
    nombre_hash CHAR(64) NOT NULL,
    identidad_fingerprint CHAR(64) NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    resultado TEXT NULL,
    paciente_id BIGINT NULL REFERENCES core.pacientes(paciente_id),
    identidad_snapshot JSONB NOT NULL,
    requiere_revision_motivo TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelta_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT online_checkout_identity_owner_check CHECK (
        propietario_tipo IN ('invitado', 'cliente')
        AND propietario_ref_hash ~ '^[0-9a-f]{64}$'
        AND correo_hash ~ '^[0-9a-f]{64}$'
        AND telefono_hash ~ '^[0-9a-f]{64}$'
        AND nombre_hash ~ '^[0-9a-f]{64}$'
        AND identidad_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT online_checkout_identity_state_check CHECK (
        estado IN ('pendiente', 'resuelto', 'requiere_revision')
    ),
    CONSTRAINT online_checkout_identity_result_check CHECK (
        resultado IS NULL OR resultado IN ('coincidencia_exacta', 'paciente_creado', 'revision_manual')
    ),
    CONSTRAINT online_checkout_identity_resolution_check CHECK (
        (estado = 'resuelto' AND paciente_id IS NOT NULL AND resultado IS NOT NULL AND resuelta_at IS NOT NULL)
        OR (estado <> 'resuelto')
    ),
    CONSTRAINT online_checkout_identity_snapshot_check CHECK (jsonb_typeof(identidad_snapshot) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS online_checkout_identity_fingerprint_uq
    ON core.online_identidad_checkout (identidad_fingerprint)
    WHERE estado = 'resuelto';
CREATE INDEX IF NOT EXISTS online_checkout_identity_review_idx
    ON core.online_identidad_checkout (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS online_checkout_identity_patient_idx
    ON core.online_identidad_checkout (paciente_id, created_at DESC);

COMMIT;
