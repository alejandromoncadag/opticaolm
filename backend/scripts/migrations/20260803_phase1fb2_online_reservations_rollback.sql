BEGIN;

-- Isolate only Phase 1F-B2 objects. Data remains recoverable in the renamed
-- schema and no operational table is removed.

CREATE SCHEMA IF NOT EXISTS phase1fb2_isolated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'phase1fb2_isolated_at_rollback') THEN
        RAISE EXCEPTION 'phase1fb2_isolated_at_rollback already exists; refusing to rename B2 objects';
    END IF;
END $$;

ALTER TABLE core.online_reserva_eventos SET SCHEMA phase1fb2_isolated;
ALTER TABLE core.online_reserva_lineas SET SCHEMA phase1fb2_isolated;
ALTER TABLE core.online_reservas SET SCHEMA phase1fb2_isolated;
ALTER TABLE core.online_reserva_configuracion SET SCHEMA phase1fb2_isolated;

ALTER SEQUENCE core.online_reserva_eventos_evento_id_seq SET SCHEMA phase1fb2_isolated;
ALTER SEQUENCE core.online_reserva_lineas_reserva_linea_id_seq SET SCHEMA phase1fb2_isolated;
ALTER SEQUENCE core.online_reservas_reserva_id_seq SET SCHEMA phase1fb2_isolated;

ALTER SCHEMA phase1fb2_isolated RENAME TO phase1fb2_isolated_at_rollback;

COMMIT;
