BEGIN;

-- Phase 1G-F adds physical-sale synchronization events to the existing
-- shared optical operations queue. No operational table or data is replaced.
DO $$
DECLARE
    current_definition TEXT;
BEGIN
    IF to_regclass('core.trabajo_optico_eventos') IS NULL THEN
        RAISE EXCEPTION 'Phase 1G-D optical operations tables are required';
    END IF;

    SELECT pg_get_constraintdef(oid)
      INTO current_definition
      FROM pg_constraint
     WHERE conrelid = 'core.trabajo_optico_eventos'::regclass
       AND conname = 'trabajo_optico_eventos_tipo_check';

    IF current_definition IS NULL THEN
        RAISE EXCEPTION 'Expected trabajo_optico_eventos_tipo_check is missing';
    END IF;

    IF current_definition NOT LIKE '%fuente_fisica_sincronizada%'
       OR current_definition NOT LIKE '%cancelado_por_venta%' THEN
        ALTER TABLE core.trabajo_optico_eventos
            DROP CONSTRAINT trabajo_optico_eventos_tipo_check;
        ALTER TABLE core.trabajo_optico_eventos
            ADD CONSTRAINT trabajo_optico_eventos_tipo_check CHECK (
                evento_tipo IN (
                    'trabajo_creado', 'estado_produccion_cambiado',
                    'costo_laboratorio_confirmado', 'enviado_laboratorio',
                    'recibido', 'cancelado', 'cancelado_por_borrador',
                    'cancelado_por_expiracion', 'notas_actualizadas',
                    'fuente_fisica_sincronizada', 'cancelado_por_venta'
                )
            );
    END IF;
END
$$;

COMMIT;
