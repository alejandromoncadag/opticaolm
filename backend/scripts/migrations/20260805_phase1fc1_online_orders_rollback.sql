BEGIN;

CREATE SCHEMA IF NOT EXISTS phase1fc1_isolated;

ALTER TABLE core.online_orden_eventos SET SCHEMA phase1fc1_isolated;
ALTER TABLE core.online_orden_lineas SET SCHEMA phase1fc1_isolated;
ALTER TABLE core.online_ordenes SET SCHEMA phase1fc1_isolated;

ALTER SCHEMA phase1fc1_isolated RENAME TO phase1fc1_isolated_at_rollback;

COMMIT;
