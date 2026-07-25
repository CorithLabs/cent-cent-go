package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SearchResult represents a single ticker search result.
type SearchResult struct {
	Ticker   string `json:"ticker"`
	Name     string `json:"name"`
	Exchange string `json:"exchange"`
	Type     string `json:"type"`
}

// SearchService queries the Polygon.io Ticker Search API.
type SearchService struct {
	db         *pgxpool.Pool
	httpClient *http.Client
	apiKey     string
}

// NewSearchService creates a SearchService backed by the given DB pool.
func NewSearchService(db *pgxpool.Pool) *SearchService {
	return &SearchService{
		db:         db,
		httpClient: &http.Client{Timeout: 5 * time.Second},
		apiKey:     os.Getenv("POLYGON_API_KEY"),
	}
}

// polygonTickerResponse is the relevant subset of the Polygon /v3/reference/tickers response.
type polygonTickerResponse struct {
	Results []struct {
		Ticker          string `json:"ticker"`
		Name            string `json:"name"`
		PrimaryExchange string `json:"primary_exchange"`
		Type            string `json:"type"`
		Active          bool   `json:"active"`
	} `json:"results"`
}

// Search queries Polygon.io for tickers matching q, returns up to limit results
// sorted by relevance (exact match first, then prefix, then substring).
// Special characters are sanitized before the query is sent.
func (s *SearchService) Search(ctx context.Context, q string, limit int) ([]SearchResult, error) {
	// Sanitize — keep only alphanumeric and safe characters
	q = sanitizeQuery(q)
	if q == "" {
		return []SearchResult{}, nil
	}

	// Call Polygon.io Ticker Search API
	endpoint := fmt.Sprintf(
		"https://api.polygon.io/v3/reference/tickers?search=%s&limit=50&active=true&apiKey=%s",
		url.QueryEscape(q),
		s.apiKey,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("building search request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("polygon search request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("polygon returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading polygon response: %w", err)
	}

	var polygonResp polygonTickerResponse
	if err := json.Unmarshal(body, &polygonResp); err != nil {
		return nil, fmt.Errorf("parsing polygon response: %w", err)
	}

	// Map and rank results
	qUpper := strings.ToUpper(q)
	type ranked struct {
		result SearchResult
		score  int // lower = better
	}
	ranked_results := make([]ranked, 0, len(polygonResp.Results))

	for _, r := range polygonResp.Results {
		if !r.Active {
			continue
		}
		tickerUpper := strings.ToUpper(r.Ticker)
		nameUpper := strings.ToUpper(r.Name)

		score := 3 // substring match
		if tickerUpper == qUpper {
			score = 0 // exact ticker match
		} else if strings.HasPrefix(tickerUpper, qUpper) {
			score = 1 // prefix match
		} else if strings.HasPrefix(nameUpper, qUpper) {
			score = 2 // name prefix
		}

		ranked_results = append(ranked_results, ranked{
			result: SearchResult{
				Ticker:   r.Ticker,
				Name:     r.Name,
				Exchange: r.PrimaryExchange,
				Type:     r.Type,
			},
			score: score,
		})
	}

	sort.Slice(ranked_results, func(i, j int) bool {
		return ranked_results[i].score < ranked_results[j].score
	})

	results := make([]SearchResult, 0, limit)
	for i, r := range ranked_results {
		if i >= limit {
			break
		}
		results = append(results, r.result)
	}

	return results, nil
}

// sanitizeQuery removes characters that could cause API issues.
func sanitizeQuery(q string) string {
	var b strings.Builder
	for _, r := range q {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == ' ' || r == '.' || r == '-' {
			b.WriteRune(r)
		}
	}
	return strings.TrimSpace(b.String())
}
