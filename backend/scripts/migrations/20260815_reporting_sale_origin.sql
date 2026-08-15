BEGIN;

ALTER TABLE core.ventas
    ADD COLUMN IF NOT EXISTS canal_venta TEXT NOT NULL DEFAULT 'fisica',
    ADD COLUMN IF NOT EXISTS online_orden_id BIGINT NULL;

UPDATE core.ventas
SET canal_venta = 'fisica'
WHERE canal_venta IS NULL OR canal_venta = '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'core.ventas'::regclass
          AND conname = 'ventas_canal_venta_check'
    ) THEN
        ALTER TABLE core.ventas
            ADD CONSTRAINT ventas_canal_venta_check
            CHECK (canal_venta IN ('fisica', 'online'));
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('core.online_ordenes') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conrelid = 'core.ventas'::regclass
             AND conname = 'ventas_online_orden_fk'
       ) THEN
        ALTER TABLE core.ventas
            ADD CONSTRAINT ventas_online_orden_fk
            FOREIGN KEY (online_orden_id) REFERENCES core.online_ordenes(orden_id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ventas_online_orden_uq
    ON core.ventas (online_orden_id)
    WHERE online_orden_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ventas_canal_fecha_idx
    ON core.ventas (canal_venta, fecha_hora DESC);

COMMIT;
