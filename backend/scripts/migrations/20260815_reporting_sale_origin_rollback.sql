BEGIN;

-- Safe rollback: disable the reporting feature without deleting historical metadata.
-- The additive columns and indexes remain available for reconciliation and future re-enable.
CREATE TABLE IF NOT EXISTS core.reporting_sale_origin_rollback_marker (
    marker_id BOOLEAN PRIMARY KEY DEFAULT TRUE,
    disabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
