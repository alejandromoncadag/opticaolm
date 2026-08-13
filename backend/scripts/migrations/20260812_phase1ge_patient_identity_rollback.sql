BEGIN;

-- Non-destructive rollback: disable Phase 1G-E and isolate only its objects.
SELECT set_config('app.phase1ge_enabled', 'false', false);
CREATE SCHEMA IF NOT EXISTS phase1ge_rollback;

ALTER TABLE IF EXISTS core.online_identidad_eventos
    SET SCHEMA phase1ge_rollback;
ALTER TABLE IF EXISTS core.online_borrador_optico_prescripciones
    SET SCHEMA phase1ge_rollback;
ALTER TABLE IF EXISTS core.prescripcion_optica_acceso_online
    SET SCHEMA phase1ge_rollback;
ALTER TABLE IF EXISTS core.online_cliente_paciente_links
    SET SCHEMA phase1ge_rollback;
ALTER TABLE IF EXISTS core.online_cliente_paciente_link_intentos
    SET SCHEMA phase1ge_rollback;

COMMIT;
