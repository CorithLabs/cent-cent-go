package services

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Valid ranges and their allowed intervals
var validRangeIntervalCombos = map[string][]string{
	"1d":  {"1m", "5m"},
	"5d":  {"5m", "1h"},
	"1m":  {"1h", "1d"},
	"6m":  {"1d"},
	"1y":  {"1d"},
	"5y":  {"1d"},
}

// OHLCVBar is a single OHLCV candlestick.
type OHLCVBar struct {
	Timestamp string  `json:"timestamp"` // ISO 8601
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    int64   `json:"volume"`
	Partial   bool    `json:"partial,omitempty"` // true for incomplete intraday bar
}

// OHLCVResult is the full response for /api/stocks/:ticker/history.
type OHLCVResult struct {
	Ticker      string     `json:"ticker"`
	Range       string     `json:"range"`
	Interval    string     `json:"interval"`
	Data        []OHLCVBar `json:"data"`
	DataSource  string     `json:"dataSource"`
	LastUpdated string     `json:"lastUpdated"`
}

// OHLCVService fetches and caches OHLCV data from Yahoo Finance.
type OHLCVService struct {
	db *pgxpool.Pool
}

// NewOHLCVService creates a new OHLCVService.
func NewOHLCVService(db *pgxpool.Pool) *OHLCVService {
	return &OHLCVService{db: db}
}

// IsValidRangeInterval returns true if the range+interval combo is allowed.
func IsValidRangeInterval(r, interval string) bool {
	allowed, ok := validRangeIntervalCombos[r]
	if !ok {
		return false
	}
	for _, a := range allowed {
		if a == interval {
			return true
		}
	}
	return false
}

// GetHistory returns OHLCV bars for the ticker with the specified range and interval.
func (s *OHLCVService) GetHistory(ctx context.Context, ticker, rangeStr, interval string) (*OHLCVResult, error) {
	// Try to read from PostgreSQL cache
	bars, err := s.getCached(ctx, ticker, interval, rangeStr)
	if err == nil && len(bars) > 0 {
		return &OHLCVResult{
			Ticker:      ticker,
			Range:       rangeStr,
			Interval:    interval,
			Data:        bars,
			DataSource:  "yahoo (cached)",
			LastUpdated: time.Now().UTC().Format(time.RFC3339),
		}, nil
	}

	// Cache miss — fetch from Polygon.io
	bars, err = s.fetchFromYahoo(ctx, ticker, rangeStr, interval)
	if err != nil {
		return nil, err
	}

	// Store in cache (best-effort)
	_ = s.storeCache(ctx, ticker, interval, bars)

	return &OHLCVResult{
		Ticker:      ticker,
		Range:       rangeStr,
		Interval:    interval,
		Data:        bars,
		DataSource:  "yahoo",
		LastUpdated: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// ── Cache ─────────────────────────────────────────────────────────────────────

func (s *OHLCVService) getCached(ctx context.Context, ticker, interval, rangeStr string) ([]OHLCVBar, error) {
	from := rangeStart(rangeStr)
	rows, err := s.db.Query(ctx, `
		SELECT ts, open, high, low, close, volume
		FROM ohlcv_data
		WHERE ticker = $1 AND interval_key = $2 AND ts >= $3
		ORDER BY ts ASC`,
		ticker, interval, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bars []OHLCVBar
	for rows.Next() {
		var bar OHLCVBar
		var ts time.Time
		if err := rows.Scan(&ts, &bar.Open, &bar.High, &bar.Low, &bar.Close, &bar.Volume); err != nil {
			return nil, err
		}
		bar.Timestamp = ts.UTC().Format(time.RFC3339)
		bars = append(bars, bar)
	}
	return bars, nil
}

func (s *OHLCVService) storeCache(ctx context.Context, ticker, interval string, bars []OHLCVBar) error {
	for _, bar := range bars {
		ts, err := time.Parse(time.RFC3339, bar.Timestamp)
		if err != nil {
			continue
		}
		_, err = s.db.Exec(ctx, `
			INSERT INTO ohlcv_data (ticker, ts, interval_key, open, high, low, close, volume)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (ticker, ts, interval_key) DO NOTHING`,
			ticker, ts, interval, bar.Open, bar.High, bar.Low, bar.Close, bar.Volume)
		if err != nil {
			return err
		}
	}
	return nil
}

// ── Yahoo Finance fetch ───────────────────────────────────────────────────────

// intervalToYahoo maps our interval keys to Yahoo's chart interval values.
func intervalToYahoo(interval string) string {
	switch interval {
	case "1m":
		return "1m"
	case "5m":
		return "5m"
	case "1h":
		return "60m"
	case "1d":
		return "1d"
	default:
		return "1d"
	}
}

// rangeToYahoo maps our range keys to Yahoo's chart range values.
func rangeToYahoo(rangeStr string) string {
	switch rangeStr {
	case "1d":
		return "1d"
	case "5d":
		return "5d"
	case "1m":
		return "1mo"
	case "6m":
		return "6mo"
	case "1y":
		return "1y"
	case "5y":
		return "5y"
	default:
		return "1mo"
	}
}

func (s *OHLCVService) fetchFromYahoo(ctx context.Context, ticker, rangeStr, interval string) ([]OHLCVBar, error) {
	chart, err := getYahooClient().getChart(ctx, yahooSymbol(ticker), rangeToYahoo(rangeStr), intervalToYahoo(interval))
	if err != nil {
		return nil, err
	}
	if len(chart.Indicators.Quote) == 0 {
		return []OHLCVBar{}, nil
	}
	q := chart.Indicators.Quote[0]
	now := time.Now().UTC()

	bars := make([]OHLCVBar, 0, len(chart.Timestamps))
	for i, tsSec := range chart.Timestamps {
		if i >= len(q.Open) || i >= len(q.High) || i >= len(q.Low) || i >= len(q.Close) {
			break
		}
		// Yahoo emits null (decoded as 0) for non-trading gap rows — skip them.
		if q.Open[i] == 0 && q.High[i] == 0 && q.Low[i] == 0 && q.Close[i] == 0 {
			continue
		}
		ts := time.Unix(tsSec, 0).UTC()
		partial := interval != "1d" && ts.Add(parseDuration(interval)).After(now)

		var vol int64
		if i < len(q.Volume) {
			vol = q.Volume[i]
		}
		bars = append(bars, OHLCVBar{
			Timestamp: ts.Format(time.RFC3339),
			Open:      q.Open[i],
			High:      q.High[i],
			Low:       q.Low[i],
			Close:     q.Close[i],
			Volume:    vol,
			Partial:   partial,
		})
	}

	return bars, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// rangeStart returns the start time for the given range string.
func rangeStart(rangeStr string) time.Time {
	now := time.Now().UTC()
	switch rangeStr {
	case "1d":
		return now.AddDate(0, 0, -1)
	case "5d":
		return now.AddDate(0, 0, -5)
	case "1m":
		return now.AddDate(0, -1, 0)
	case "6m":
		return now.AddDate(0, -6, 0)
	case "1y":
		return now.AddDate(-1, 0, 0)
	case "5y":
		return now.AddDate(-5, 0, 0)
	default:
		return now.AddDate(0, -1, 0)
	}
}

// parseDuration converts interval key to time.Duration for partial-bar detection.
func parseDuration(interval string) time.Duration {
	switch interval {
	case "1m":
		return time.Minute
	case "5m":
		return 5 * time.Minute
	case "1h":
		return time.Hour
	case "1d":
		return 24 * time.Hour
	default:
		return 24 * time.Hour
	}
}
