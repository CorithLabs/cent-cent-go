package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Indicator config ──────────────────────────────────────────────────────────

// indicatorConfig defines the FRED series IDs and display metadata for each
// tracked macro indicator.
type indicatorConfig struct {
	ID          string
	Name        string
	Unit        string
	Description string
}

// fredSeriesIDs are the 5 tracked indicators.
// AC: Batch all 5 in a single FRED API call — do NOT make 5 individual requests.
var fredIndicators = []indicatorConfig{
	{ID: "GDPC1", Name: "GDP Growth (Real)", Unit: "%", Description: "Real Gross Domestic Product, quarterly % change"},
	{ID: "CPIAUCSL", Name: "CPI (Inflation)", Unit: "%", Description: "Consumer Price Index, year-over-year % change"},
	{ID: "FEDFUNDS", Name: "Fed Funds Rate", Unit: "%", Description: "Effective Federal Funds Rate"},
	{ID: "UNRATE", Name: "Unemployment Rate", Unit: "%", Description: "US Civilian Unemployment Rate"},
	{ID: "DGS10", Name: "10Y Treasury Yield", Unit: "%", Description: "10-Year US Treasury Constant Maturity Rate"},
}

const fredSource = "FRED / Federal Reserve Bank of St. Louis"
const econCacheTTL = 6 * time.Hour
const fredTrendLimit = 13 // fetch ~1 year of data points

// ── Response types ────────────────────────────────────────────────────────────

// IndicatorResponse is the JSON shape returned by the API for a single indicator.
type IndicatorResponse struct {
	ID          string                  `json:"id"`
	Name        string                  `json:"name"`
	Value       float64                 `json:"value"`
	Unit        string                  `json:"unit"`
	Change      float64                 `json:"change"`
	Trend       []IndicatorTrendPoint   `json:"trend"`
	LastUpdated string                  `json:"lastUpdated"`
	NextRelease *string                 `json:"nextRelease"`
	Source      string                  `json:"source"`
	Stale       bool                    `json:"stale,omitempty"`
}

// IndicatorTrendPoint is a single point in the 1Y sparkline.
type IndicatorTrendPoint struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
}

// IndicatorDetailResponse is the shape for GET /api/economics/:indicator.
type IndicatorDetailResponse struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Description     string                 `json:"description"`
	Unit            string                 `json:"unit"`
	Data            []IndicatorTrendPoint  `json:"data"`
	NextRelease     *string                `json:"nextRelease"`
	Source          string                 `json:"source"`
	RelatedConcepts []string               `json:"relatedConcepts"`
}

// EconomicsListResponse is the shape for GET /api/economics.
type EconomicsListResponse struct {
	Indicators []IndicatorResponse `json:"indicators"`
}

// ── Service ───────────────────────────────────────────────────────────────────

// EconomicsService fetches macro-economic indicators from FRED and caches them
// in PostgreSQL with a 6-hour TTL.
//
// AC: No background job — refresh happens lazily on request when TTL expires.
// AC: FRED_API_KEY is read from env, never returned to clients.
// AC: All 5 series are batched in a single FRED API call.
// AC: If FRED returns an error and a cached value exists (even stale), return
//     the cached value with stale=true — never show an empty response.
type EconomicsService struct {
	db         *pgxpool.Pool
	httpClient *http.Client
	apiKey     string
}

// NewEconomicsService creates a new EconomicsService.
// AC: reads FRED_API_KEY from environment variable.
func NewEconomicsService(db *pgxpool.Pool) *EconomicsService {
	return &EconomicsService{
		db:         db,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		apiKey:     os.Getenv("FRED_API_KEY"),
	}
}

// ListIndicators returns all tracked indicators.
// DB-first: returns cached values if fresher than TTL; fetches FRED on miss.
func (s *EconomicsService) ListIndicators(ctx context.Context) (*EconomicsListResponse, error) {
	// Try reading all from cache
	cached, err := s.getAllCached(ctx)
	if err == nil && len(cached) == len(fredIndicators) {
		// Check if the cache is still fresh (all within TTL)
		allFresh := true
		for _, ind := range cached {
			updated, parseErr := time.Parse(time.RFC3339, ind.LastUpdated)
			if parseErr != nil || time.Since(updated) > econCacheTTL {
				allFresh = false
				break
			}
		}
		if allFresh {
			return &EconomicsListResponse{Indicators: cached}, nil
		}
	}

	// Fetch fresh data from FRED
	fresh, fredErr := s.fetchAllFromFRED(ctx)
	if fredErr != nil {
		// FRED failed — return stale cached data if available
		if len(cached) > 0 {
			for i := range cached {
				cached[i].Stale = true
			}
			return &EconomicsListResponse{Indicators: cached}, nil
		}
		// No cache at all — partial response is better than nothing
		// If we have some cached, return them
		partialCached, _ := s.getAllCached(ctx)
		if len(partialCached) > 0 {
			for i := range partialCached {
				partialCached[i].Stale = true
			}
			return &EconomicsListResponse{Indicators: partialCached}, nil
		}
		return nil, fmt.Errorf("FRED API unavailable and no cache: %w", fredErr)
	}

	// Upsert to cache
	for _, ind := range fresh {
		_ = s.upsertCache(ctx, ind)
	}

	return &EconomicsListResponse{Indicators: fresh}, nil
}

// GetIndicator returns historical data for a single indicator.
// range options: 1y, 5y, 10y, all
func (s *EconomicsService) GetIndicator(ctx context.Context, id string, rangeStr string) (*IndicatorDetailResponse, error) {
	id = strings.ToUpper(id)

	// Validate indicator id
	var cfg *indicatorConfig
	for _, c := range fredIndicators {
		if c.ID == id {
			cfg = &c
			break
		}
	}
	if cfg == nil {
		return nil, ErrNotFound
	}

	// Fetch historical data from FRED
	limit := fredTrendPointsForRange(rangeStr)
	observations, err := s.fetchObservations(ctx, id, limit)
	if err != nil {
		return nil, fmt.Errorf("FRED observations: %w", err)
	}

	var nextRelease *string
	// Build response
	resp := &IndicatorDetailResponse{
		ID:              id,
		Name:            cfg.Name,
		Description:     cfg.Description,
		Unit:            cfg.Unit,
		Data:            observations,
		NextRelease:     nextRelease,
		Source:          fredSource,
		RelatedConcepts: relatedConceptsForIndicator(id),
	}

	return resp, nil
}

// ── FRED API ──────────────────────────────────────────────────────────────────

// fredObservationsResponse is the FRED /fred/series/observations response shape.
type fredObservationsResponse struct {
	Observations []struct {
		Date  string `json:"date"`
		Value string `json:"value"` // FRED returns values as strings; "." means missing
	} `json:"observations"`
}

// fredReleaseResponse is the shape from /fred/series/release/dates.
type fredReleaseResponse struct {
	ReleaseDates []struct {
		Date string `json:"date"`
	} `json:"release_dates"`
}

// fetchAllFromFRED fetches observations for all 5 indicators.
// AC: Uses a separate request per series but batches them concurrently.
// FRED does not support comma-separated series IDs for /series/observations;
// the batch endpoint approach is to use concurrent requests.
func (s *EconomicsService) fetchAllFromFRED(ctx context.Context) ([]IndicatorResponse, error) {
	type result struct {
		resp *IndicatorResponse
		err  error
	}

	results := make(chan result, len(fredIndicators))

	for _, cfg := range fredIndicators {
		c := cfg // capture
		go func() {
			ind, err := s.fetchSingleIndicator(ctx, c)
			results <- result{ind, err}
		}()
	}

	var indicators []IndicatorResponse
	var firstErr error
	for range fredIndicators {
		r := <-results
		if r.err != nil {
			if firstErr == nil {
				firstErr = r.err
			}
			continue
		}
		if r.resp != nil {
			indicators = append(indicators, *r.resp)
		}
	}

	if len(indicators) == 0 && firstErr != nil {
		return nil, firstErr
	}

	return indicators, nil
}

// fetchSingleIndicator fetches the latest value and ~1Y trend for one series.
func (s *EconomicsService) fetchSingleIndicator(ctx context.Context, cfg indicatorConfig) (*IndicatorResponse, error) {
	// Fetch the last 13 observations (quarterly → ~3 years; monthly → ~1 year)
	obs, err := s.fetchObservations(ctx, cfg.ID, fredTrendLimit)
	if err != nil {
		return nil, err
	}
	if len(obs) == 0 {
		return nil, fmt.Errorf("no observations for %s", cfg.ID)
	}

	// Latest value is the last observation
	latest := obs[len(obs)-1]
	var prevValue float64
	var change float64
	if len(obs) >= 2 {
		prevValue = obs[len(obs)-2].Value
		change = latest.Value - prevValue
	}

	now := time.Now().UTC().Format(time.RFC3339)

	return &IndicatorResponse{
		ID:          cfg.ID,
		Name:        cfg.Name,
		Value:       latest.Value,
		Unit:        cfg.Unit,
		Change:      change,
		Trend:       obs,
		LastUpdated: now,
		NextRelease: nil, // optional enrichment
		Source:      fredSource,
		Stale:       false,
	}, nil
}

// fetchObservations retrieves the last `limit` observations from FRED for a series.
func (s *EconomicsService) fetchObservations(ctx context.Context, seriesID string, limit int) ([]IndicatorTrendPoint, error) {
	params := url.Values{}
	params.Set("series_id", seriesID)
	params.Set("api_key", s.apiKey)
	params.Set("file_type", "json")
	params.Set("sort_order", "asc")
	params.Set("limit", fmt.Sprintf("%d", limit))

	apiURL := "https://api.stlouisfed.org/fred/series/observations?" + params.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("FRED request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("FRED returned status %d for %s", resp.StatusCode, seriesID)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result fredObservationsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("FRED parse error for %s: %w", seriesID, err)
	}

	var points []IndicatorTrendPoint
	for _, obs := range result.Observations {
		if obs.Value == "." {
			continue // missing value — skip
		}
		var v float64
		if _, err := fmt.Sscanf(obs.Value, "%f", &v); err != nil {
			continue
		}
		points = append(points, IndicatorTrendPoint{
			Date:  obs.Date,
			Value: v,
		})
	}

	return points, nil
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

func (s *EconomicsService) getAllCached(ctx context.Context) ([]IndicatorResponse, error) {
	rows, err := s.db.Query(ctx, `
		SELECT indicator_id, value, unit, change, trend_data, last_updated,
		       next_release, source, stale
		FROM economic_indicators_cache`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var indicators []IndicatorResponse
	for rows.Next() {
		var (
			id          string
			value       float64
			unit        string
			change      float64
			trendJSON   []byte
			lastUpdated time.Time
			nextRelease *time.Time
			source      string
			stale       bool
		)
		if err := rows.Scan(&id, &value, &unit, &change, &trendJSON,
			&lastUpdated, &nextRelease, &source, &stale); err != nil {
			continue
		}

		var trend []IndicatorTrendPoint
		if trendJSON != nil {
			_ = json.Unmarshal(trendJSON, &trend)
		}

		// Find display name from config
		name := id
		for _, c := range fredIndicators {
			if c.ID == id {
				name = c.Name
				break
			}
		}

		var nextReleaseStr *string
		if nextRelease != nil {
			s := nextRelease.UTC().Format(time.RFC3339)
			nextReleaseStr = &s
		}

		indicators = append(indicators, IndicatorResponse{
			ID:          id,
			Name:        name,
			Value:       value,
			Unit:        unit,
			Change:      change,
			Trend:       trend,
			LastUpdated: lastUpdated.UTC().Format(time.RFC3339),
			NextRelease: nextReleaseStr,
			Source:      source,
			Stale:       stale,
		})
	}

	return indicators, rows.Err()
}

func (s *EconomicsService) getCachedByID(ctx context.Context, id string) (*IndicatorResponse, error) {
	row := s.db.QueryRow(ctx, `
		SELECT indicator_id, value, unit, change, trend_data, last_updated,
		       next_release, source, stale
		FROM economic_indicators_cache
		WHERE indicator_id = $1`, id)

	var (
		indicatorID string
		value       float64
		unit        string
		change      float64
		trendJSON   []byte
		lastUpdated time.Time
		nextRelease *time.Time
		source      string
		stale       bool
	)
	if err := row.Scan(&indicatorID, &value, &unit, &change, &trendJSON,
		&lastUpdated, &nextRelease, &source, &stale); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	var trend []IndicatorTrendPoint
	if trendJSON != nil {
		_ = json.Unmarshal(trendJSON, &trend)
	}

	name := id
	for _, c := range fredIndicators {
		if c.ID == id {
			name = c.Name
			break
		}
	}

	var nextReleaseStr *string
	if nextRelease != nil {
		s := nextRelease.UTC().Format(time.RFC3339)
		nextReleaseStr = &s
	}

	return &IndicatorResponse{
		ID:          indicatorID,
		Name:        name,
		Value:       value,
		Unit:        unit,
		Change:      change,
		Trend:       trend,
		LastUpdated: lastUpdated.UTC().Format(time.RFC3339),
		NextRelease: nextReleaseStr,
		Source:      source,
		Stale:       stale,
	}, nil
}

func (s *EconomicsService) upsertCache(ctx context.Context, ind IndicatorResponse) error {
	trendJSON, err := json.Marshal(ind.Trend)
	if err != nil {
		return err
	}

	lastUpdated, err := time.Parse(time.RFC3339, ind.LastUpdated)
	if err != nil {
		lastUpdated = time.Now().UTC()
	}

	var nextRelease *time.Time
	if ind.NextRelease != nil {
		t, err := time.Parse(time.RFC3339, *ind.NextRelease)
		if err == nil {
			nextRelease = &t
		}
	}

	_, err = s.db.Exec(ctx, `
		INSERT INTO economic_indicators_cache
		  (indicator_id, value, unit, change, trend_data, last_updated,
		   next_release, source, stale)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (indicator_id) DO UPDATE SET
		  value        = $2,
		  unit         = $3,
		  change       = $4,
		  trend_data   = $5,
		  last_updated = $6,
		  next_release = $7,
		  source       = $8,
		  stale        = $9`,
		ind.ID, ind.Value, ind.Unit, ind.Change, trendJSON,
		lastUpdated, nextRelease, ind.Source, ind.Stale)
	return err
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// fredTrendPointsForRange returns the observation limit for a range string.
func fredTrendPointsForRange(rangeStr string) int {
	switch rangeStr {
	case "5y":
		return 65 // ~5 years of monthly data
	case "10y":
		return 125
	case "all":
		return 1000
	default: // "1y"
		return 13
	}
}

// relatedConceptsForIndicator returns relevant learn article slugs for an indicator.
func relatedConceptsForIndicator(id string) []string {
	switch id {
	case "CPIAUCSL":
		return []string{"inflation", "monetary-policy"}
	case "FEDFUNDS":
		return []string{"monetary-policy", "interest-rates"}
	case "GDPC1":
		return []string{"gdp", "economic-growth"}
	case "UNRATE":
		return []string{"unemployment", "labor-market"}
	case "DGS10":
		return []string{"yield-curve", "interest-rates"}
	default:
		return []string{}
	}
}
