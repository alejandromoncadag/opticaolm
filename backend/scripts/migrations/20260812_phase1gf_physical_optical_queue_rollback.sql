BEGIN;

-- This rollback never deletes or rewrites audit history. It refuses to narrow
-- the event constraint after Phase 1G-F events have been recorded.
DO $$
DECLARE
    phase1gf_events BIGINT;
    current_definition TEXT;
BEGIN
    SELECT COUNT(*) INTO phase1gf_events
      FROM core.trabajo_optico_eventos
     WHERE evento_tipo IN ('fuente_fisica_sincronizada', 'cancelado_por_venta');

    IF phase1gf_events > 0 THEN
        RAISE EXCEPTION
            'Phase 1G-F audit history exists; disable the feature and keep the compatible expanded constraint';
    END IF;

    SELECT pg_get_constraintdef(oid)
      INTO current_definition
      FROM pg_constraint
     WHERE conrelid = 'core.trabajo_optico_eventos'::regclass
       AND conname = 'trabajo_optico_eventos_tipo_check';

    IF current_definition LIKE '%fuente_fisica_sincronizada%' THEN
        ALTER TABLE core.trabajo_optico_eventos
            DROP CONSTRAINT trabajo_optico_eventos_tipo_check;
        ALTER TABLE core.trabajo_optico_eventos
            ADD CONSTRAINT trabajo_optico_eventos_tipo_check CHECK (
                evento_tipo IN (
                    'trabajo_creado', 'estado_produccion_cambiado',
                    'costo_laboratorio_confirmado', 'enviado_laboratorio',
                    'recibido', 'cancelado', 'cancelado_por_borrador',
                    'cancelado_por_expiracion', 'notas_actualizadas'
                )
            );
    END IF;
END
$$;

COMMIT;
