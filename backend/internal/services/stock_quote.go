package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/CorithLabs/cent-cent-go/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// StockQuoteService fetches and caches stock quote data from Polygon.io.
type StockQuoteService struct {
	db         *pgxpool.Pool
	httpClient *http.Client
	apiKey     string
}

// NewStockQuoteService creates a new StockQuoteService.
func NewStockQuoteService(db *pgxpool.Pool) *StockQuoteService {
	return &StockQuoteService{
		db:         db,
		httpClient: &http.Client{Timeout: 8 * time.Second},
		apiKey:     os.Getenv("POLYGON_API_KEY"),
	}
}

// GetQuote returns the current quote for a ticker.
// It first checks the PostgreSQL cache (60s TTL). On cache miss or expiry,
// it fetches from Polygon.io and updates the cache.
// If Polygon.io times out, the cached value is returned with stale=true.
func (s *StockQuoteService) GetQuote(ctx context.Context, ticker string) (*models.StockQuote, error) {
	ticker = strings.ToUpper(ticker)

	// Try cache first
	cached, err := s.getCached(ctx, ticker)
	if err == nil && cached != nil {
		age := time.Since(cached.LastUpdated)
		if age < 60*time.Second {
			return cached, nil
		}
		// Cache is stale — try to refresh, fall back to cached with stale=true
		fresh, fetchErr := s.fetchFromPolygon(ctx, ticker)
		if fetchErr != nil {
			cached.Stale = true
			return cached, nil
		}
		_ = s.upsertCache(ctx, fresh)
		return fresh, nil
	}

	// No cache — must fetch
	quote, err := s.fetchFromPolygon(ctx, ticker)
	if err != nil {
		return nil, err
	}
	_ = s.upsertCache(ctx, quote)
	return quote, nil
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

func (s *StockQuoteService) getCached(ctx context.Context, ticker string) (*models.StockQuote, error) {
	const q = `
		SELECT t.ticker, t.name, t.exchange, t.asset_type,
		       sq.price, sq.change, sq.change_pct, sq.market_cap,
		       sq.volume, sq.week52_high, sq.week52_low,
		       sq.status, sq.stale, sq.last_updated, sq.source
		FROM stock_quotes sq
		JOIN tickers t ON t.ticker = sq.ticker
		WHERE sq.ticker = $1`

	row := s.db.QueryRow(ctx, q, ticker)
	var quote models.StockQuote
	err := row.Scan(
		&quote.Ticker, &quote.Name, &quote.Exchange, // ignore asset_type
		new(string),
		&quote.Price, &quote.Change, &quote.ChangePct,
		&quote.MarketCap, &quote.Volume, &quote.Week52High, &quote.Week52Low,
		&quote.Status, &quote.Stale, &quote.LastUpdated, &quote.Source,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &quote, nil
}

func (s *StockQuoteService) upsertCache(ctx context.Context, q *models.StockQuote) error {
	// Upsert the ticker first (ignoring conflict if already present)
	_, err := s.db.Exec(ctx, `
		INSERT INTO tickers (ticker, name, exchange, asset_type, active, updated_at)
		VALUES ($1, $2, $3, 'CS', true, NOW())
		ON CONFLICT (ticker) DO UPDATE SET name=$2, exchange=$3, updated_at=NOW()`,
		q.Ticker, q.Name, q.Exchange)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(ctx, `
		INSERT INTO stock_quotes (ticker, price, change, change_pct, market_cap, volume,
		                          week52_high, week52_low, status, stale, last_updated, source)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (ticker) DO UPDATE SET
		  price=$2, change=$3, change_pct=$4, market_cap=$5, volume=$6,
		  week52_high=$7, week52_low=$8, status=$9, stale=$10,
		  last_updated=$11, source=$12`,
		q.Ticker, q.Price, q.Change, q.ChangePct, q.MarketCap, q.Volume,
		q.Week52High, q.Week52Low, q.Status, q.Stale, q.LastUpdated, q.Source)
	return err
}

// ── Polygon.io fetch ──────────────────────────────────────────────────────────

// polygonSnapshotResponse is the Polygon.io /v2/snapshot/locale/us/markets/stocks/tickers/:ticker response.
type polygonSnapshotResponse struct {
	Ticker struct {
		Ticker string `json:"ticker"`
		Day    struct {
			C  float64 `json:"c"` // close
			O  float64 `json:"o"` // open
			H  float64 `json:"h"` // high
			L  float64 `json:"l"` // low
			V  float64 `json:"v"` // volume
			Vw float64 `json:"vw"` // vwap
		} `json:"day"`
		LastTrade struct {
			P float64 `json:"p"` // price
		} `json:"lastTrade"`
		LastQuote struct {
			P float64 `json:"p"` // bid
			S float64 `json:"s"` // size
		} `json:"lastQuote"`
		Min struct {
			C float64 `json:"c"`
		} `json:"min"`
		PrevDay struct {
			C float64 `json:"c"` // previous close
		} `json:"prevDay"`
		TodaysChangePerc float64 `json:"todaysChangePerc"`
		TodaysChange     float64 `json:"todaysChange"`
		Updated          int64   `json:"updated"` // unix nanoseconds
	} `json:"ticker"`
	Status    string `json:"status"`
	RequestID string `json:"request_id"`
}

// polygonTickerDetailsResponse is the Polygon.io /v3/reference/tickers/:ticker response.
type polygonTickerDetailsResponse struct {
	Results struct {
		Ticker          string `json:"ticker"`
		Name            string `json:"name"`
		PrimaryExchange string `json:"primary_exchange"`
		Type            string `json:"type"`
		Active          bool   `json:"active"`
		MarketCap       int64  `json:"market_cap"`
		WeekHigh52      float64 `json:"week_high_52"`
		WeekLow52       float64 `json:"week_low_52"`
	} `json:"results"`
	Status string `json:"status"`
}

func (s *StockQuoteService) fetchFromPolygon(ctx context.Context, ticker string) (*models.StockQuote, error) {
	// Fetch snapshot (price, change, volume) and ticker details (name, market cap, 52w range) in parallel
	type snapshotResult struct {
		snap *polygonSnapshotResponse
		err  error
	}
	type detailsResult struct {
		details *polygonTickerDetailsResponse
		err     error
	}

	snapCh := make(chan snapshotResult, 1)
	detailsCh := make(chan detailsResult, 1)

	go func() {
		snap, err := s.fetchSnapshot(ctx, ticker)
		snapCh <- snapshotResult{snap, err}
	}()

	go func() {
		details, err := s.fetchTickerDetails(ctx, ticker)
		detailsCh <- detailsResult{details, err}
	}()

	snapRes := <-snapCh
	detailsRes := <-detailsCh

	if snapRes.err != nil {
		return nil, fmt.Errorf("polygon snapshot: %w", snapRes.err)
	}
	if detailsRes.err != nil {
		return nil, fmt.Errorf("polygon ticker details: %w", detailsRes.err)
	}

	snap := snapRes.snap
	details := detailsRes.details

	// Use lastTrade price if available, fall back to day close
	price := snap.Ticker.LastTrade.P
	if price == 0 {
		price = snap.Ticker.Day.C
	}

	status := "active"
	if !details.Results.Active {
		status = "delisted"
	}

	quote := &models.StockQuote{
		Ticker:      ticker,
		Name:        details.Results.Name,
		Price:       price,
		Change:      snap.Ticker.TodaysChange,
		ChangePct:   snap.Ticker.TodaysChangePerc,
		MarketCap:   details.Results.MarketCap,
		Volume:      int64(snap.Ticker.Day.V),
		Week52High:  details.Results.WeekHigh52,
		Week52Low:   details.Results.WeekLow52,
		Exchange:    details.Results.PrimaryExchange,
		LastUpdated: time.Now().UTC(),
		Status:      status,
		Stale:       false,
		Source:      "polygon",
	}

	return quote, nil
}

func (s *StockQuoteService) fetchSnapshot(ctx context.Context, ticker string) (*polygonSnapshotResponse, error) {
	url := fmt.Sprintf(
		"https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/%s?apiKey=%s",
		ticker, s.apiKey,
	)
	resp, err := s.doGet(ctx, url)
	if err != nil {
		return nil, err
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

	var result polygonSnapshotResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *StockQuoteService) fetchTickerDetails(ctx context.Context, ticker string) (*polygonTickerDetailsResponse, error) {
	url := fmt.Sprintf(
		"https://api.polygon.io/v3/reference/tickers/%s?apiKey=%s",
		ticker, s.apiKey,
	)
	resp, err := s.doGet(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("ticker %s not found in reference data", ticker)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("polygon reference returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result polygonTickerDetailsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *StockQuoteService) doGet(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	return s.httpClient.Do(req)
}

// IsNotFound checks if the error from GetQuote indicates the ticker doesn't exist.
func IsNotFound(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "not found")
}
