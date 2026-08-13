BEGIN;

ALTER TABLE core.catalogo_productos
    ADD COLUMN IF NOT EXISTS costo_confirmado_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS costo_confirmado_by text NULL,
    ADD COLUMN IF NOT EXISTS costo_confirmado_referencia text NULL,
    ADD COLUMN IF NOT EXISTS costo_vigente_desde date NULL;

ALTER TABLE core.catalogo_producto_variantes
    ADD COLUMN IF NOT EXISTS costo_confirmado_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS costo_confirmado_by text NULL,
    ADD COLUMN IF NOT EXISTS costo_confirmado_referencia text NULL,
    ADD COLUMN IF NOT EXISTS costo_vigente_desde date NULL;

CREATE TABLE IF NOT EXISTS core.catalogo_optico_precio_costo_auditoria (
    evento_id bigserial PRIMARY KEY,
    producto_id bigint NOT NULL REFERENCES core.catalogo_productos(producto_id),
    variante_id bigint NULL REFERENCES core.catalogo_producto_variantes(variante_id),
    valores_anteriores jsonb NOT NULL,
    valores_nuevos jsonb NOT NULL,
    motivo text NULL,
    admin_username text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT catalogo_optico_auditoria_anteriores_check
        CHECK (jsonb_typeof(valores_anteriores) = 'object'),
    CONSTRAINT catalogo_optico_auditoria_nuevos_check
        CHECK (jsonb_typeof(valores_nuevos) = 'object')
);

CREATE INDEX IF NOT EXISTS catalogo_optico_auditoria_producto_fecha_idx
    ON core.catalogo_optico_precio_costo_auditoria
        (producto_id, created_at DESC, evento_id DESC);

CREATE INDEX IF NOT EXISTS catalogo_optico_auditoria_variante_fecha_idx
    ON core.catalogo_optico_precio_costo_auditoria
        (variante_id, created_at DESC, evento_id DESC)
    WHERE variante_id IS NOT NULL;

COMMIT;
