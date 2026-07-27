-- ── Sector Heatmap — Migration 003 ──────────────────────────────────────────
-- Do NOT modify 001_init.sql or 002_economics.sql.

CREATE TABLE IF NOT EXISTS sp500_constituents (
    ticker       TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    sector       TEXT,
    last_updated TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS heatmap_cache (
    ticker       TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    sector       TEXT,
    market_cap   NUMERIC,
    change_pct   NUMERIC,
    price        NUMERIC,
    last_updated TIMESTAMPTZ NOT NULL
);
