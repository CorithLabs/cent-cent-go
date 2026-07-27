package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Response types ─────────────────────────────────────────────────────────────

// HeatmapStock represents a single stock in the heatmap response.
type HeatmapStock struct {
	Ticker    string   `json:"ticker"`
	Name      string   `json:"name"`
	MarketCap *float64 `json:"marketCap"`
	Change    float64  `json:"change"`
	Sector    string   `json:"sector"`
	Price     float64  `json:"price,omitempty"`
	Halted    bool     `json:"halted,omitempty"`
}

// HeatmapSector represents a group of stocks in a sector.
type HeatmapSector struct {
	Name   string         `json:"name"`
	Change float64        `json:"change"`
	Stocks []HeatmapStock `json:"stocks"`
}

// HeatmapResponse is the full response for GET /api/sectors/heatmap.
type HeatmapResponse struct {
	Sectors      []HeatmapSector `json:"sectors"`
	MarketClosed bool            `json:"marketClosed,omitempty"`
	Incomplete   bool            `json:"incomplete,omitempty"` // true when some tickers failed
	AsOf         string          `json:"asOf"`
}

// BatchQuoteItem is a single quote in the batch quotes response.
type BatchQuoteItem struct {
	Ticker      string  `json:"ticker"`
	Price       float64 `json:"price"`
	Change      float64 `json:"change"`
	ChangePct   float64 `json:"changePct"`
	LastUpdated string  `json:"lastUpdated"`
	Delisted    bool    `json:"delisted,omitempty"`
}

// BatchQuotesResponse is the response for GET /api/stocks/quotes.
type BatchQuotesResponse struct {
	Quotes []BatchQuoteItem `json:"quotes"`
}

// ── Constituent ────────────────────────────────────────────────────────────────

type sp500Constituent struct {
	Ticker      string
	Name        string
	Sector      string
	LastUpdated time.Time
}

// ── Service ────────────────────────────────────────────────────────────────────

// SectorService builds the S&P 500 sector heatmap.
// AC: Reuses StockQuoteService — does not create a new Polygon HTTP client.
// AC: No background goroutine — data is assembled on-request from cached snapshots.
type SectorService struct {
	db         *pgxpool.Pool
	httpClient *http.Client
	apiKey     string
	quoteSvc   *StockQuoteService
}

// NewSectorService creates a new SectorService.
func NewSectorService(db *pgxpool.Pool) *SectorService {
	return &SectorService{
		db:         db,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		apiKey:     os.Getenv("POLYGON_API_KEY"),
		quoteSvc:   NewStockQuoteService(db),
	}
}

const constituentCacheTTL = 24 * time.Hour
const heatmapCacheTTL = 5 * time.Minute

// GetHeatmap returns the pre-aggregated heatmap response.
// AC: S&P 500 stocks grouped by sector, sorted by market cap descending.
// AC: Lazy refresh — no background job.
func (s *SectorService) GetHeatmap(ctx context.Context, period string) (*HeatmapResponse, error) {
	// 1. Get or refresh S&P 500 constituents
	constituents, err := s.getConstituents(ctx)
	if err != nil || len(constituents) == 0 {
		return nil, fmt.Errorf("failed to get S&P 500 constituents: %w", err)
	}

	// 2. Fetch heatmap data for each ticker (with cache)
	stocks, incomplete := s.buildHeatmapData(ctx, constituents)

	// 3. Group by sector and sort by market cap
	sectorMap := make(map[string][]HeatmapStock)
	for _, stock := range stocks {
		sectorMap[stock.Sector] = append(sectorMap[stock.Sector], stock)
	}

	var sectors []HeatmapSector
	for sectorName, sectorStocks := range sectorMap {
		// Sort stocks by market cap descending
		sort.Slice(sectorStocks, func(i, j int) bool {
			if sectorStocks[i].MarketCap == nil {
				return false
			}
			if sectorStocks[j].MarketCap == nil {
				return true
			}
			return *sectorStocks[i].MarketCap > *sectorStocks[j].MarketCap
		})

		// Compute sector average change (market-cap weighted)
		var totalWeight, weightedChange float64
		for _, stock := range sectorStocks {
			weight := 1.0
			if stock.MarketCap != nil {
				weight = *stock.MarketCap
			}
			totalWeight += weight
			weightedChange += stock.Change * weight
		}
		avgChange := 0.0
		if totalWeight > 0 {
			avgChange = weightedChange / totalWeight
		}

		sectors = append(sectors, HeatmapSector{
			Name:   sectorName,
			Change: avgChange,
			Stocks: sectorStocks,
		})
	}

	// Sort sectors alphabetically
	sort.Slice(sectors, func(i, j int) bool {
		return sectors[i].Name < sectors[j].Name
	})

	marketClosed := isMarketClosed()

	return &HeatmapResponse{
		Sectors:      sectors,
		MarketClosed: marketClosed,
		Incomplete:   incomplete,
		AsOf:         time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// GetBatchQuotes fetches current quotes for a list of tickers.
// AC: Returns 400 for > 50 tickers.
// AC: Reuses StockQuoteService — no new Polygon client.
func (s *SectorService) GetBatchQuotes(ctx context.Context, tickers []string) (*BatchQuotesResponse, error) {
	type result struct {
		ticker string
		item   BatchQuoteItem
		err    error
	}

	results := make(chan result, len(tickers))

	for _, ticker := range tickers {
		tk := ticker
		go func() {
			quote, err := s.quoteSvc.GetQuote(ctx, tk)
			if err != nil {
				if IsNotFound(err) {
					results <- result{
						ticker: tk,
						item: BatchQuoteItem{
							Ticker:   tk,
							Delisted: true,
						},
					}
					return
				}
				results <- result{ticker: tk, err: err}
				return
			}
			results <- result{
				ticker: tk,
				item: BatchQuoteItem{
					Ticker:      quote.Ticker,
					Price:       quote.Price,
					Change:      quote.Change,
					ChangePct:   quote.ChangePct,
					LastUpdated: quote.LastUpdated.UTC().Format(time.RFC3339),
					Delisted:    quote.Status == "delisted",
				},
			}
		}()
	}

	var quotes []BatchQuoteItem
	for range tickers {
		r := <-results
		if r.err != nil {
			continue // silently skip errored tickers in batch
		}
		quotes = append(quotes, r.item)
	}

	return &BatchQuotesResponse{Quotes: quotes}, nil
}

// ── Constituent helpers ────────────────────────────────────────────────────────

func (s *SectorService) getConstituents(ctx context.Context) ([]sp500Constituent, error) {
	// Check DB cache
	cached, err := s.getCachedConstituents(ctx)
	if err == nil && len(cached) > 0 {
		// Check if cache is fresh (24h TTL)
		if len(cached) > 0 && time.Since(cached[0].LastUpdated) < constituentCacheTTL {
			return cached, nil
		}
	}

	// Fetch from Polygon.io
	fresh, err := s.fetchConstituentsFromPolygon(ctx)
	if err != nil {
		// Fall back to cached (even stale) if available
		if len(cached) > 0 {
			return cached, nil
		}
		return nil, err
	}

	// Upsert to DB
	_ = s.upsertConstituents(ctx, fresh)

	return fresh, nil
}

// polygonTickersResponse is the Polygon /v3/reference/tickers?index=SPX response.
type polygonTickersResponse struct {
	Results []struct {
		Ticker          string `json:"ticker"`
		Name            string `json:"name"`
		Market          string `json:"market"`
		Locale          string `json:"locale"`
		PrimaryExchange string `json:"primary_exchange"`
		Type            string `json:"type"`
		Sic             string `json:"sic_description"` // use as sector proxy
	} `json:"results"`
	NextURL string `json:"next_url"`
	Status  string `json:"status"`
}

func (s *SectorService) fetchConstituentsFromPolygon(ctx context.Context) ([]sp500Constituent, error) {
	// Polygon free tier: paginate through all results
	var allConstituents []sp500Constituent
	nextURL := fmt.Sprintf(
		"https://api.polygon.io/v3/reference/tickers?index=SPX&limit=250&apiKey=%s",
		s.apiKey,
	)

	maxPages := 10 // guard against infinite loops
	for page := 0; page < maxPages && nextURL != ""; page++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, nextURL, nil)
		if err != nil {
			return allConstituents, err
		}

		resp, err := s.httpClient.Do(req)
		if err != nil {
			return allConstituents, fmt.Errorf("polygon constituents request failed: %w", err)
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return allConstituents, err
		}

		if resp.StatusCode != http.StatusOK {
			return allConstituents, fmt.Errorf("polygon returned %d", resp.StatusCode)
		}

		var result polygonTickersResponse
		if err := json.Unmarshal(body, &result); err != nil {
			return allConstituents, err
		}

		now := time.Now().UTC()
		for _, r := range result.Results {
			sector := r.Sic
			if sector == "" {
				sector = "Other"
			}
			allConstituents = append(allConstituents, sp500Constituent{
				Ticker:      r.Ticker,
				Name:        r.Name,
				Sector:      sector,
				LastUpdated: now,
			})
		}

		// Add apiKey to next_url if present
		if result.NextURL != "" {
			nextURL = result.NextURL + "&apiKey=" + s.apiKey
		} else {
			nextURL = ""
		}
	}

	return allConstituents, nil
}

func (s *SectorService) getCachedConstituents(ctx context.Context) ([]sp500Constituent, error) {
	rows, err := s.db.Query(ctx, `
		SELECT ticker, name, sector, last_updated
		FROM sp500_constituents
		ORDER BY ticker ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var constituents []sp500Constituent
	for rows.Next() {
		var c sp500Constituent
		if err := rows.Scan(&c.Ticker, &c.Name, &c.Sector, &c.LastUpdated); err != nil {
			continue
		}
		constituents = append(constituents, c)
	}
	return constituents, rows.Err()
}

func (s *SectorService) upsertConstituents(ctx context.Context, constituents []sp500Constituent) error {
	for _, c := range constituents {
		_, err := s.db.Exec(ctx, `
			INSERT INTO sp500_constituents (ticker, name, sector, last_updated)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (ticker) DO UPDATE SET
			  name         = $2,
			  sector       = $3,
			  last_updated = $4`,
			c.Ticker, c.Name, c.Sector, c.LastUpdated)
		if err != nil {
			return err
		}
	}
	return nil
}

// ── Heatmap data ──────────────────────────────────────────────────────────────

// buildHeatmapData fetches quote data for all constituents concurrently.
// Returns stocks and a boolean indicating if some tickers failed (incomplete).
func (s *SectorService) buildHeatmapData(ctx context.Context, constituents []sp500Constituent) ([]HeatmapStock, bool) {
	type result struct {
		stock HeatmapStock
		err   error
	}

	// Limit concurrency to avoid overwhelming Polygon.io
	const maxConcurrent = 20
	sem := make(chan struct{}, maxConcurrent)

	var mu sync.Mutex
	var stocks []HeatmapStock
	var failCount int

	wg := sync.WaitGroup{}
	for _, c := range constituents {
		wg.Add(1)
		constituent := c

		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			// Check heatmap cache first
			cached, cacheErr := s.getHeatmapCached(ctx, constituent.Ticker)
			if cacheErr == nil && cached != nil {
				if time.Since(cached.LastUpdated) < heatmapCacheTTL {
					mc := cached.MarketCap
					mu.Lock()
					stocks = append(stocks, HeatmapStock{
						Ticker:    constituent.Ticker,
						Name:      constituent.Name,
						MarketCap: &mc,
						Change:    cached.ChangePct,
						Sector:    constituent.Sector,
						Price:     cached.Price,
					})
					mu.Unlock()
					return
				}
			}

			// Fetch from quote service
			quote, err := s.quoteSvc.GetQuote(ctx, constituent.Ticker)
			if err != nil {
				mu.Lock()
				failCount++
				mu.Unlock()
				return
			}

			mc := float64(quote.MarketCap)
			stock := HeatmapStock{
				Ticker:    quote.Ticker,
				Name:      quote.Name,
				MarketCap: &mc,
				Change:    quote.ChangePct,
				Sector:    constituent.Sector,
				Price:     quote.Price,
				Halted:    quote.Status == "suspended",
			}

			mu.Lock()
			stocks = append(stocks, stock)
			mu.Unlock()

			// Update heatmap cache (best-effort)
			_ = s.upsertHeatmapCache(ctx, constituent.Ticker, constituent.Name,
				constituent.Sector, mc, quote.ChangePct, quote.Price)
		}()
	}
	wg.Wait()

	return stocks, failCount > 0
}

// ── Heatmap cache ──────────────────────────────────────────────────────────────

type heatmapCacheRow struct {
	Ticker      string
	Name        string
	Sector      string
	MarketCap   float64
	ChangePct   float64
	Price       float64
	LastUpdated time.Time
}

func (s *SectorService) getHeatmapCached(ctx context.Context, ticker string) (*heatmapCacheRow, error) {
	row := s.db.QueryRow(ctx, `
		SELECT ticker, name, sector, market_cap, change_pct, price, last_updated
		FROM heatmap_cache
		WHERE ticker = $1`, ticker)

	var r heatmapCacheRow
	var marketCap *float64
	if err := row.Scan(&r.Ticker, &r.Name, &r.Sector, &marketCap, &r.ChangePct, &r.Price, &r.LastUpdated); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if marketCap != nil {
		r.MarketCap = *marketCap
	}
	return &r, nil
}

func (s *SectorService) upsertHeatmapCache(ctx context.Context, ticker, name, sector string, marketCap, changePct, price float64) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO heatmap_cache (ticker, name, sector, market_cap, change_pct, price, last_updated)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (ticker) DO UPDATE SET
		  name         = $2,
		  sector       = $3,
		  market_cap   = $4,
		  change_pct   = $5,
		  price        = $6,
		  last_updated = NOW()`,
		ticker, name, sector, marketCap, changePct, price)
	return err
}

// ── Market hours helper ────────────────────────────────────────────────────────

// isMarketClosed checks if US markets are currently closed (simple heuristic).
func isMarketClosed() bool {
	// NYSE/NASDAQ trading hours: Mon-Fri, 9:30am–4:00pm ET
	now := time.Now().UTC()
	// Convert to ET (UTC-4 or UTC-5)
	etOffset := -4 * time.Hour // EST; approximate
	et := now.Add(etOffset)

	weekday := et.Weekday()
	if weekday == time.Saturday || weekday == time.Sunday {
		return true
	}

	hour := et.Hour()
	minute := et.Minute()
	minuteOfDay := hour*60 + minute

	marketOpen := 9*60 + 30  // 9:30 AM ET
	marketClose := 16 * 60   // 4:00 PM ET

	return minuteOfDay < marketOpen || minuteOfDay >= marketClose
}
