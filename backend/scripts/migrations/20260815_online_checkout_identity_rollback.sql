BEGIN;

-- Non-destructive rollback: isolate only this feature's objects. Existing
-- orders, patients, sales and identity history are never deleted.
SELECT set_config('app.online_checkout_identity_enabled', 'false', false);
CREATE SCHEMA IF NOT EXISTS online_checkout_identity_rollback;

ALTER TABLE IF EXISTS core.online_identidad_checkout
    SET SCHEMA online_checkout_identity_rollback;
ALTER TABLE IF EXISTS core.online_guest_email_verifications
    SET SCHEMA online_checkout_identity_rollback;

-- Columns on online_ordenes are intentionally retained so historical orders
-- remain readable and can be reconciled after rollback.

COMMIT;
