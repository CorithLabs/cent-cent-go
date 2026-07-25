-- ── Stock Analysis Platform — Initial Schema ────────────────────────────────
-- This file runs automatically via docker-entrypoint-initdb.d on first start.

-- Enable pg_trgm for fuzzy search support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Tickers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickers (
    ticker          TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    exchange        TEXT NOT NULL DEFAULT '',
    asset_type      TEXT NOT NULL DEFAULT 'CS',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickers_name_trgm ON tickers USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tickers_active ON tickers (active);

-- ── Stock quotes cache (60s TTL enforced at app layer) ────────────────────────
CREATE TABLE IF NOT EXISTS stock_quotes (
    ticker          TEXT PRIMARY KEY REFERENCES tickers(ticker),
    price           NUMERIC(18, 4),
    change          NUMERIC(18, 4),
    change_pct      NUMERIC(10, 4),
    market_cap      BIGINT,
    volume          BIGINT,
    week52_high     NUMERIC(18, 4),
    week52_low      NUMERIC(18, 4),
    status          TEXT NOT NULL DEFAULT 'active',  -- active | suspended | delisted
    stale           BOOLEAN NOT NULL DEFAULT FALSE,
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source          TEXT NOT NULL DEFAULT 'polygon'
);

-- ── OHLCV time-series ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ohlcv_data (
    id              BIGSERIAL PRIMARY KEY,
    ticker          TEXT NOT NULL REFERENCES tickers(ticker),
    ts              TIMESTAMPTZ NOT NULL,
    interval_key    TEXT NOT NULL,  -- '1m' | '5m' | '1h' | '1d'
    open            NUMERIC(18, 4) NOT NULL,
    high            NUMERIC(18, 4) NOT NULL,
    low             NUMERIC(18, 4) NOT NULL,
    close           NUMERIC(18, 4) NOT NULL,
    volume          BIGINT NOT NULL,
    UNIQUE (ticker, ts, interval_key)
);

CREATE INDEX IF NOT EXISTS idx_ohlcv_ticker_ts ON ohlcv_data (ticker, ts DESC);

-- ── Fundamental metrics cache ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fundamental_metrics (
    ticker          TEXT PRIMARY KEY REFERENCES tickers(ticker),
    fiscal_period   TEXT,
    pe              NUMERIC(12, 4),
    pb              NUMERIC(12, 4),
    eps             NUMERIC(12, 4),
    dividend_yield  NUMERIC(10, 4),
    beta            NUMERIC(10, 4),
    roe             NUMERIC(10, 4),
    debt_to_equity  NUMERIC(10, 4),
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source          TEXT NOT NULL DEFAULT 'polygon'
);

-- ── ELI5 analysis cache (1h TTL enforced at app layer) ───────────────────────
CREATE TABLE IF NOT EXISTS eli5_cache (
    ticker          TEXT PRIMARY KEY REFERENCES tickers(ticker),
    payload         JSONB NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Economic indicators ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS economic_indicators (
    series_id       TEXT PRIMARY KEY,  -- FRED series ID e.g. GDPC1
    name            TEXT NOT NULL,
    unit            TEXT NOT NULL,
    value           NUMERIC(18, 6),
    prev_value      NUMERIC(18, 6),
    change          NUMERIC(18, 6),
    trend           TEXT,              -- 'up' | 'down' | 'flat'
    last_updated    TIMESTAMPTZ,
    next_release    TIMESTAMPTZ,
    source          TEXT NOT NULL DEFAULT 'FRED'
);

CREATE TABLE IF NOT EXISTS economic_timeseries (
    id              BIGSERIAL PRIMARY KEY,
    series_id       TEXT NOT NULL REFERENCES economic_indicators(series_id),
    date            DATE NOT NULL,
    value           NUMERIC(18, 6) NOT NULL,
    UNIQUE(series_id, date)
);

CREATE INDEX IF NOT EXISTS idx_econ_ts_series_date ON economic_timeseries (series_id, date DESC);
