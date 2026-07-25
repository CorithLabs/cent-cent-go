// Package models defines the shared data transfer objects (DTOs) and domain
// types used across handlers and services.
//
// These structs are the canonical shapes for stock, economic indicator,
// and search data flowing through the application — from external APIs
// (Polygon.io, FRED) through the backend to the frontend.
package models

import "time"

// ── Stock ─────────────────────────────────────────────────────────────────────

// StockQuote represents the current price snapshot for a single ticker.
type StockQuote struct {
	Ticker    string    `json:"ticker"`
	Name      string    `json:"name"`
	Price     float64   `json:"price"`
	Change    float64   `json:"change"`
	ChangePct float64   `json:"changePct"`
	MarketCap int64     `json:"marketCap"`
	Volume    int64     `json:"volume"`
	Week52High float64  `json:"week52High"`
	Week52Low  float64  `json:"week52Low"`
	Exchange  string    `json:"exchange"`
	Status    string    `json:"status"` // "active" | "suspended" | "delisted"
	Stale     bool      `json:"stale"`
	LastUpdated time.Time `json:"lastUpdated"`
	DataSource  string  `json:"dataSource"`
}

// OHLCVBar represents one OHLCV data point in a time series.
type OHLCVBar struct {
	Timestamp time.Time `json:"timestamp"`
	Open      float64   `json:"open"`
	High      float64   `json:"high"`
	Low       float64   `json:"low"`
	Close     float64   `json:"close"`
	Volume    int64     `json:"volume"`
}

// OHLCVResponse is the payload returned by GET /api/stocks/:ticker/history.
type OHLCVResponse struct {
	Ticker      string     `json:"ticker"`
	Range       string     `json:"range"`
	Interval    string     `json:"interval"`
	DataSource  string     `json:"dataSource"`
	LastUpdated time.Time  `json:"lastUpdated"`
	Data        []OHLCVBar `json:"data"`
}

// ── Fundamentals ──────────────────────────────────────────────────────────────

// FundamentalMetrics holds the key valuation and financial ratios for a stock.
type FundamentalMetrics struct {
	Ticker       string    `json:"ticker"`
	FiscalPeriod string    `json:"fiscalPeriod"`
	PE           *float64  `json:"pe"`           // nil when not available (e.g. negative earnings)
	PB           *float64  `json:"pb"`
	EPS          *float64  `json:"eps"`
	DividendYield *float64 `json:"dividendYield"`
	Beta         *float64  `json:"beta"`
	ROE          *float64  `json:"roe"`
	DebtToEquity *float64  `json:"debtToEquity"`
	LastUpdated  time.Time `json:"lastUpdated"`
	DataSource   string    `json:"dataSource"`
}

// ── Search ────────────────────────────────────────────────────────────────────

// SearchResult represents a single ticker in an autocomplete search response.
type SearchResult struct {
	Ticker   string `json:"ticker"`
	Name     string `json:"name"`
	Exchange string `json:"exchange"`
	Type     string `json:"type"` // "CS" (common stock), "ETF", "ADRC", etc.
}

// ── ELI5 Analysis ─────────────────────────────────────────────────────────────

// ELI5Section is one topic in a structured ELI5 analysis response.
// The frontend uses these labels to prompt window.ai — no prose is generated server-side.
type ELI5Section struct {
	Topic          string  `json:"topic"`
	Emoji          string  `json:"emoji"`
	Label          string  `json:"label"`          // e.g. "pricey", "growing_fast"
	RawValue       float64 `json:"rawValue"`
	SectorBenchmark *float64 `json:"sectorBenchmark"` // nil when unavailable
}

// ELI5Response is the payload returned by GET /api/stocks/:ticker/eli5.
type ELI5Response struct {
	Ticker           string        `json:"ticker"`
	GeneratedAt      time.Time     `json:"generatedAt"`
	OverallSentiment string        `json:"overallSentiment"` // "positive"|"neutral"|"caution"|"negative"
	Headline         string        `json:"headline"`
	Sections         []ELI5Section `json:"sections"`
	DataAsOf         string        `json:"dataAsOf"`
}

// ── Economic Indicators ───────────────────────────────────────────────────────

// EconomicIndicator holds the latest value and metadata for a macro indicator.
type EconomicIndicator struct {
	ID          string     `json:"id"`   // FRED series ID e.g. "GDPC1"
	Name        string     `json:"name"`
	Value       float64    `json:"value"`
	PrevValue   float64    `json:"prevValue"`
	Unit        string     `json:"unit"`
	Change      float64    `json:"change"`
	Trend       string     `json:"trend"` // "up" | "down" | "flat"
	LastUpdated time.Time  `json:"lastUpdated"`
	NextRelease *time.Time `json:"nextRelease"`
	Source      string     `json:"source"` // "FRED / Federal Reserve Bank of St. Louis"
}

// EconomicDataPoint is one value in an indicator's historical time series.
type EconomicDataPoint struct {
	Date  string  `json:"date"`  // ISO 8601 date string, e.g. "2024-01-01"
	Value float64 `json:"value"`
}
