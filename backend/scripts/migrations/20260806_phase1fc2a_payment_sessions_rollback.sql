BEGIN;

CREATE SCHEMA IF NOT EXISTS phase1fc2a_isolated;

ALTER TABLE core.online_pago_eventos SET SCHEMA phase1fc2a_isolated_at_rollback;
ALTER TABLE core.online_pago_intentos SET SCHEMA phase1fc2a_isolated_at_rollback;
ALTER TABLE core.online_pago_sesiones SET SCHEMA phase1fc2a_isolated_at_rollback;

COMMIT;
