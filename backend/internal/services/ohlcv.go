package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
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

// OHLCVService fetches and caches OHLCV data.
type OHLCVService struct {
	db         *pgxpool.Pool
	httpClient *http.Client
	apiKey     string
}

// NewOHLCVService creates a new OHLCVService.
func NewOHLCVService(db *pgxpool.Pool) *OHLCVService {
	return &OHLCVService{
		db:         db,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		apiKey:     os.Getenv("POLYGON_API_KEY"),
	}
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
			DataSource:  "polygon (cached)",
			LastUpdated: time.Now().UTC().Format(time.RFC3339),
		}, nil
	}

	// Cache miss — fetch from Polygon.io
	bars, err = s.fetchFromPolygon(ctx, ticker, rangeStr, interval)
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
		DataSource:  "polygon",
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

// ── Polygon.io Aggs fetch ─────────────────────────────────────────────────────

// polygonAggsResponse is the Polygon.io /v2/aggs/ticker response.
type polygonAggsResponse struct {
	Ticker       string `json:"ticker"`
	ResultsCount int    `json:"resultsCount"`
	Results      []struct {
		O  float64 `json:"o"`  // open
		H  float64 `json:"h"`  // high
		L  float64 `json:"l"`  // low
		C  float64 `json:"c"`  // close
		V  float64 `json:"v"`  // volume
		T  int64   `json:"t"`  // unix milliseconds
		VW float64 `json:"vw"` // vwap
	} `json:"results"`
	Status string `json:"status"`
}

// intervalToPolygon converts our interval keys to Polygon.io multiplier+timespan.
func intervalToPolygon(interval string) (int, string) {
	switch interval {
	case "1m":
		return 1, "minute"
	case "5m":
		return 5, "minute"
	case "1h":
		return 1, "hour"
	case "1d":
		return 1, "day"
	default:
		return 1, "day"
	}
}

func (s *OHLCVService) fetchFromPolygon(ctx context.Context, ticker, rangeStr, interval string) ([]OHLCVBar, error) {
	from := rangeStart(rangeStr)
	to := time.Now().UTC()

	multiplier, timespan := intervalToPolygon(interval)
	fromStr := from.Format("2006-01-02")
	toStr := to.Format("2006-01-02")

	url := fmt.Sprintf(
		"https://api.polygon.io/v2/aggs/ticker/%s/range/%d/%s/%s/%s?adjusted=true&sort=asc&limit=50000&apiKey=%s",
		ticker, multiplier, timespan, fromStr, toStr, s.apiKey,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("polygon aggs request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("ticker %s not found", ticker)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("polygon returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result polygonAggsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	bars := make([]OHLCVBar, 0, len(result.Results))
	now := time.Now().UTC()

	for _, r := range result.Results {
		ts := time.UnixMilli(r.T).UTC()
		// Flag partial intraday bar (last bar within current trading day)
		partial := interval != "1d" && ts.Add(parseDuration(interval)).After(now)

		bars = append(bars, OHLCVBar{
			Timestamp: ts.Format(time.RFC3339),
			Open:      r.O,
			High:      r.H,
			Low:       r.L,
			Close:     r.C,
			Volume:    int64(r.V),
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
