BEGIN;

-- Non-destructive Phase 1G-C isolation rollback. Active optical frame
-- reservations are released before the new objects are isolated.

DO $$
DECLARE
    reserved_row RECORD;
    current_reserved INTEGER;
BEGIN
    FOR reserved_row IN
        SELECT armazon_producto_id AS producto_id,
               sucursal_id,
               SUM(cantidad)::INTEGER AS cantidad
        FROM core.online_reservas_opticas_borrador
        WHERE estado = 'activa'
        GROUP BY armazon_producto_id, sucursal_id
        ORDER BY sucursal_id, armazon_producto_id
    LOOP
        SELECT stock_reservado
        INTO current_reserved
        FROM core.catalogo_inventario_sucursal
        WHERE producto_id = reserved_row.producto_id
          AND sucursal_id = reserved_row.sucursal_id
        FOR UPDATE;

        IF current_reserved IS NULL
           OR current_reserved < reserved_row.cantidad THEN
            RAISE EXCEPTION
                'Cannot isolate Phase 1G-C: reserved inventory is inconsistent';
        END IF;

        UPDATE core.catalogo_inventario_sucursal
        SET stock_reservado = stock_reservado - reserved_row.cantidad,
            version = version + 1,
            updated_at = NOW()
        WHERE producto_id = reserved_row.producto_id
          AND sucursal_id = reserved_row.sucursal_id;
    END LOOP;
END $$;

UPDATE core.online_reservas_opticas_borrador
SET estado = 'cancelada',
    released_at = NOW(),
    updated_at = NOW()
WHERE estado = 'activa';

UPDATE core.online_borradores_opticos
SET estado = 'cancelado',
    cancelado_at = NOW(),
    updated_at = NOW()
WHERE estado NOT IN ('cancelado', 'expirado');

CREATE SCHEMA IF NOT EXISTS phase1gc_isolated;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_namespace
        WHERE nspname = 'phase1gc_isolated_at_rollback'
    ) THEN
        RAISE EXCEPTION
            'phase1gc_isolated_at_rollback already exists; refusing to isolate Phase 1G-C';
    END IF;
END $$;

ALTER VIEW core.online_inventario_reservas_activas
    SET SCHEMA phase1gc_isolated;
ALTER TABLE core.online_borrador_optico_eventos
    SET SCHEMA phase1gc_isolated;
ALTER TABLE core.online_reservas_opticas_borrador
    SET SCHEMA phase1gc_isolated;
ALTER TABLE core.online_configuraciones_opticas_borrador
    SET SCHEMA phase1gc_isolated;
ALTER TABLE core.online_borradores_opticos
    SET SCHEMA phase1gc_isolated;

ALTER SEQUENCE core.online_borrador_optico_eventos_evento_id_seq
    SET SCHEMA phase1gc_isolated;
ALTER SEQUENCE core.online_reservas_opticas_borrador_reserva_id_seq
    SET SCHEMA phase1gc_isolated;
ALTER SEQUENCE core.online_configuraciones_opticas_borrador_configuracion_id_seq
    SET SCHEMA phase1gc_isolated;
ALTER SEQUENCE core.online_borradores_opticos_borrador_id_seq
    SET SCHEMA phase1gc_isolated;

ALTER SCHEMA phase1gc_isolated
    RENAME TO phase1gc_isolated_at_rollback;

COMMIT;
