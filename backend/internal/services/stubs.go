package services

// ── Stub services ─────────────────────────────────────────────────────────────
// These stubs exist so that this branch compiles independently of other flow
// branches. Each real service is implemented in its own flow branch and will
// be merged to main before production. The stubs return ErrNotFound so that
// handler tests can assert correct HTTP behavior without live data.

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Validation helpers ────────────────────────────────────────────────────────

// IsValidRangeInterval reports whether the range/interval combination is
// supported for historical price data.
func IsValidRangeInterval(rangeStr, interval string) bool {
	validRanges := map[string]bool{"1d": true, "5d": true, "1m": true, "6m": true, "1y": true, "5y": true}
	validIntervals := map[string]bool{"1m": true, "5m": true, "1h": true, "1d": true}
	if !validRanges[rangeStr] || !validIntervals[interval] {
		return false
	}
	// Intraday intervals only for short ranges
	if (interval == "1m" || interval == "5m") && (rangeStr == "1y" || rangeStr == "5y" || rangeStr == "6m") {
		return false
	}
	return true
}

// IsValidIndicator reports whether the technical indicator name is supported.
func IsValidIndicator(indicator string) bool {
	switch indicator {
	case "sma", "ema", "bollinger", "rsi", "macd":
		return true
	}
	return false
}

// IsValidStatement reports whether the financial statement type is supported.
func IsValidStatement(statement string) bool {
	switch statement {
	case "income", "balance", "cashflow":
		return true
	}
	return false
}

// ── StockQuoteService stub ────────────────────────────────────────────────────

// StockQuoteResult is a minimal quote struct for the stub.
type StockQuoteResult struct {
	Ticker string `json:"ticker"`
}

// StockQuoteService fetches real-time stock quotes.
// Full implementation is in the stock-detail-page-load flow branch.
type StockQuoteService struct {
	db *pgxpool.Pool
}

func NewStockQuoteService(db *pgxpool.Pool) *StockQuoteService {
	return &StockQuoteService{db: db}
}

func (s *StockQuoteService) GetQuote(ctx context.Context, ticker string) (*StockQuoteResult, error) {
	return nil, ErrNotFound
}

// ── OHLCVService stub ─────────────────────────────────────────────────────────

// OHLCVResult is a minimal OHLCV response struct for the stub.
type OHLCVResult struct {
	Ticker string `json:"ticker"`
}

// OHLCVService fetches historical OHLCV data.
// Full implementation is in the fetch-ohlcv-chart-data flow branch.
type OHLCVService struct {
	db *pgxpool.Pool
}

func NewOHLCVService(db *pgxpool.Pool) *OHLCVService {
	return &OHLCVService{db: db}
}

func (s *OHLCVService) GetHistory(ctx context.Context, ticker, rangeStr, interval string) (*OHLCVResult, error) {
	return nil, ErrNotFound
}

// ── IndicatorService stub ─────────────────────────────────────────────────────

// IndicatorResult is a minimal indicator response struct for the stub.
type IndicatorResult struct {
	Indicator string `json:"indicator"`
}

// IndicatorService computes technical indicators over OHLCV data.
// Full implementation is in the technical-indicators-overlay flow branch.
type IndicatorService struct {
	db *pgxpool.Pool
}

func NewIndicatorService(db *pgxpool.Pool) *IndicatorService {
	return &IndicatorService{db: db}
}

func (s *IndicatorService) Compute(ctx context.Context, ticker, indicator, rangeStr string, period int) (*IndicatorResult, error) {
	return nil, ErrNotFound
}

// ── MetricsService stub ───────────────────────────────────────────────────────

// MetricsValues holds the raw metric values returned by the metrics service.
type MetricsValues struct {
	PE            *float64 `json:"pe"`
	PB            *float64 `json:"pb"`
	EPS           *float64 `json:"eps"`
	DividendYield *float64 `json:"dividendYield"`
	Beta          *float64 `json:"beta"`
	ROE           *float64 `json:"roe"`
	DebtToEquity  *float64 `json:"debtToEquity"`
}

// MetricsResponse is the payload returned by the metrics service.
type MetricsResponse struct {
	Ticker       string        `json:"ticker"`
	FiscalPeriod string        `json:"fiscalPeriod"`
	LastUpdated  string        `json:"lastUpdated"`
	Metrics      MetricsValues `json:"metrics"`
}

// MetricsService fetches fundamental valuation metrics.
// Full implementation is in the key-metrics-display flow branch.
type MetricsService struct {
	db *pgxpool.Pool
}

func NewMetricsService(db *pgxpool.Pool) *MetricsService {
	return &MetricsService{db: db}
}

func (s *MetricsService) GetMetrics(ctx context.Context, ticker string) (*MetricsResponse, error) {
	return nil, ErrNotFound
}

// ── FinancialsService stub ────────────────────────────────────────────────────

// FinancialsResult is a minimal financial statements response struct.
type FinancialsResult struct {
	Ticker    string `json:"ticker"`
	Statement string `json:"statement"`
}

// FinancialsService fetches income statement, balance sheet, and cash flow data.
// Full implementation is in the financial-statements flow branch.
type FinancialsService struct {
	db *pgxpool.Pool
}

func NewFinancialsService(db *pgxpool.Pool) *FinancialsService {
	return &FinancialsService{db: db}
}

func (s *FinancialsService) GetFinancials(ctx context.Context, ticker, statement, period string, limit int) (*FinancialsResult, error) {
	return nil, ErrNotFound
}
