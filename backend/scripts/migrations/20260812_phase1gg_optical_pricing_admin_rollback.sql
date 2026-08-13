BEGIN;

DO $$
BEGIN
    IF to_regclass('core.catalogo_optico_precio_costo_auditoria') IS NOT NULL
       AND to_regclass('core.catalogo_optico_precio_costo_auditoria_phase1gg_isolated') IS NULL THEN
        ALTER TABLE core.catalogo_optico_precio_costo_auditoria
            RENAME TO catalogo_optico_precio_costo_auditoria_phase1gg_isolated;
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='core' AND table_name='catalogo_productos'
          AND column_name='costo_confirmado_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='core' AND table_name='catalogo_productos'
          AND column_name='costo_confirmado_at_phase1gg_rollback'
    ) THEN
        ALTER TABLE core.catalogo_productos
            RENAME COLUMN costo_confirmado_at TO costo_confirmado_at_phase1gg_rollback;
        ALTER TABLE core.catalogo_productos
            RENAME COLUMN costo_confirmado_by TO costo_confirmado_by_phase1gg_rollback;
        ALTER TABLE core.catalogo_productos
            RENAME COLUMN costo_confirmado_referencia TO costo_confirmado_referencia_phase1gg_rollback;
        ALTER TABLE core.catalogo_productos
            RENAME COLUMN costo_vigente_desde TO costo_vigente_desde_phase1gg_rollback;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='core' AND table_name='catalogo_producto_variantes'
          AND column_name='costo_confirmado_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='core' AND table_name='catalogo_producto_variantes'
          AND column_name='costo_confirmado_at_phase1gg_rollback'
    ) THEN
        ALTER TABLE core.catalogo_producto_variantes
            RENAME COLUMN costo_confirmado_at TO costo_confirmado_at_phase1gg_rollback;
        ALTER TABLE core.catalogo_producto_variantes
            RENAME COLUMN costo_confirmado_by TO costo_confirmado_by_phase1gg_rollback;
        ALTER TABLE core.catalogo_producto_variantes
            RENAME COLUMN costo_confirmado_referencia TO costo_confirmado_referencia_phase1gg_rollback;
        ALTER TABLE core.catalogo_producto_variantes
            RENAME COLUMN costo_vigente_desde TO costo_vigente_desde_phase1gg_rollback;
    END IF;
END
$$;

COMMIT;
