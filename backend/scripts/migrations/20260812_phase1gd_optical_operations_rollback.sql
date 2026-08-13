BEGIN;

-- Run this rollback only after PHASE_1GD_ENABLED has been disabled in the
-- application. The caller must explicitly set this session guard first:
--   SET app.phase1gd_enabled = 'false';
DO $$
BEGIN
    IF COALESCE(current_setting('app.phase1gd_enabled', TRUE), '') <> 'false' THEN
        RAISE EXCEPTION
            'Set app.phase1gd_enabled=false after disabling PHASE_1GD_ENABLED before isolating Phase 1G-D';
    END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS phase1gd_rollback;

ALTER TABLE core.trabajo_optico_eventos
    SET SCHEMA phase1gd_rollback;
ALTER TABLE core.trabajo_optico_componentes
    SET SCHEMA phase1gd_rollback;
ALTER TABLE core.trabajos_opticos
    SET SCHEMA phase1gd_rollback;

ALTER SEQUENCE core.trabajo_optico_eventos_evento_id_seq
    SET SCHEMA phase1gd_rollback;
ALTER SEQUENCE core.trabajo_optico_componentes_componente_id_seq
    SET SCHEMA phase1gd_rollback;
ALTER SEQUENCE core.trabajos_opticos_trabajo_id_seq
    SET SCHEMA phase1gd_rollback;

COMMIT;
