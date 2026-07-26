-- ── Economics Cache — Migration 002 ─────────────────────────────────────────
-- Caches FRED API responses with a 6h TTL (enforced at app layer).
-- Do NOT modify 001_init.sql — schema additions go in numbered files.

CREATE TABLE IF NOT EXISTS economic_indicators_cache (
    indicator_id   TEXT PRIMARY KEY,
    value          NUMERIC NOT NULL,
    unit           TEXT NOT NULL,
    change         NUMERIC,
    trend_data     JSONB,
    last_updated   TIMESTAMPTZ NOT NULL,
    next_release   TIMESTAMPTZ,
    source         TEXT NOT NULL,
    stale          BOOLEAN NOT NULL DEFAULT FALSE
);
