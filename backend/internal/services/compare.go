package services

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Response types ────────────────────────────────────────────────────────────

// NormalizedPrice is a single % return data point.
type NormalizedPrice struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"` // % return from first data point
}

// CompareMetrics holds key metrics for comparison display.
type CompareMetrics struct {
	PE        *float64 `json:"pe"`
	MarketCap *int64   `json:"marketCap"`
	YTDReturn *float64 `json:"ytdReturn"`
	Revenue   *float64 `json:"revenue"`
}

// CompareTickerResult is the per-ticker data in the compare response.
type CompareTickerResult struct {
	Ticker           string            `json:"ticker"`
	Name             string            `json:"name"`
	NormalizedPrices []NormalizedPrice `json:"normalizedPrices"`
	Metrics          CompareMetrics    `json:"metrics"`
}

// CompareResponse is the full response for GET /api/compare.
type CompareResponse struct {
	Tickers  []CompareTickerResult `json:"tickers"`
	Warnings []string              `json:"warnings,omitempty"`
	// Disclosure note when tickers have different IPO dates (different start periods)
	StartDateDisclosure *string `json:"startDateDisclosure,omitempty"`
}

// ── Service ───────────────────────────────────────────────────────────────────

// CompareService handles side-by-side ticker comparison.
// AC: Reuses StockQuoteService and OHLCVService — does not create new Polygon clients.
type CompareService struct {
	db       *pgxpool.Pool
	quoteSvc *StockQuoteService
	ohlcvSvc *OHLCVService
}

// NewCompareService creates a new CompareService.
func NewCompareService(db *pgxpool.Pool) *CompareService {
	return &CompareService{
		db:       db,
		quoteSvc: NewStockQuoteService(db),
		ohlcvSvc: NewOHLCVService(db),
	}
}

// Compare fetches normalized price history and metrics for 2–5 tickers.
// AC: Returns error if fewer than 2 or more than 5 tickers are requested.
// AC: Unknown tickers are omitted with a warnings array entry.
// AC: Different IPO dates → normalize from the most recent IPO date.
func (s *CompareService) Compare(ctx context.Context, tickers []string, rangeStr string) (*CompareResponse, error) {
	if len(tickers) < 2 {
		return nil, fmt.Errorf("at least 2 tickers required")
	}
	if len(tickers) > 5 {
		return nil, fmt.Errorf("maximum 5 tickers allowed")
	}

	// Default range
	if rangeStr == "" {
		rangeStr = "1y"
	}

	type tickerData struct {
		ticker string
		bars   []OHLCVBar
		quote  interface{} // *models.StockQuote — use interface to avoid import cycle
		name   string
		err    error
	}

	results := make(chan tickerData, len(tickers))

	for _, tk := range tickers {
		tk := strings.ToUpper(tk)
		go func() {
			bars, err := s.ohlcvSvc.GetHistory(ctx, tk, rangeStr, "1d")
			if err != nil {
				results <- tickerData{ticker: tk, err: err}
				return
			}

			quote, quoteErr := s.quoteSvc.GetQuote(ctx, tk)
			name := tk
			if quoteErr == nil && quote != nil {
				name = quote.Name
			}

			results <- tickerData{
				ticker: tk,
				bars:   bars.Data,
				name:   name,
			}
		}()
	}

	// Collect results
	type collected struct {
		ticker string
		bars   []OHLCVBar
		name   string
	}

	var successfulTickers []collected
	var warnings []string

	for range tickers {
		r := <-results
		if r.err != nil || len(r.bars) == 0 {
			warnings = append(warnings, fmt.Sprintf("skipped %s: %v", r.ticker, r.err))
			continue
		}
		successfulTickers = append(successfulTickers, collected{
			ticker: r.ticker,
			bars:   r.bars,
			name:   r.name,
		})
	}

	if len(successfulTickers) < 2 {
		return nil, fmt.Errorf("insufficient valid tickers for comparison")
	}

	// Find the common start date (most recent first bar across all tickers)
	// AC: Stocks with different IPO dates: normalize from most recent IPO date.
	var commonStart time.Time
	for _, tc := range successfulTickers {
		if len(tc.bars) == 0 {
			continue
		}
		firstBar, err := time.Parse(time.RFC3339, tc.bars[0].Timestamp)
		if err != nil {
			continue
		}
		if commonStart.IsZero() || firstBar.After(commonStart) {
			commonStart = firstBar
		}
	}

	var startDisclosure *string
	if !commonStart.IsZero() {
		d := fmt.Sprintf("Normalized from %s — the most recent available start date across compared tickers.", commonStart.Format("Jan 2, 2006"))
		startDisclosure = &d
	}

	// Build normalized results
	var compareResults []CompareTickerResult

	for _, tc := range successfulTickers {
		// Filter bars to commonStart
		var filteredBars []OHLCVBar
		for _, bar := range tc.bars {
			ts, err := time.Parse(time.RFC3339, bar.Timestamp)
			if err != nil {
				continue
			}
			if !ts.Before(commonStart) {
				filteredBars = append(filteredBars, bar)
			}
		}

		// Sort chronologically
		sort.Slice(filteredBars, func(i, j int) bool {
			return filteredBars[i].Timestamp < filteredBars[j].Timestamp
		})

		// Normalize prices to % return from first data point
		var normalizedPrices []NormalizedPrice
		var baseClose float64
		if len(filteredBars) > 0 {
			baseClose = filteredBars[0].Close
		}

		for _, bar := range filteredBars {
			var pctReturn float64
			if baseClose != 0 {
				pctReturn = ((bar.Close - baseClose) / baseClose) * 100
			}
			ts, err := time.Parse(time.RFC3339, bar.Timestamp)
			if err != nil {
				continue
			}
			normalizedPrices = append(normalizedPrices, NormalizedPrice{
				Date:  ts.Format("2006-01-02"),
				Value: pctReturn,
			})
		}

		// Build metrics from quote
		var metrics CompareMetrics
		quote, quoteErr := s.quoteSvc.GetQuote(ctx, tc.ticker)
		if quoteErr == nil && quote != nil {
			mc := quote.MarketCap
			metrics.MarketCap = &mc
			// YTD return is not directly available from the quote;
			// compute from filtered bars if we have YTD data
			if len(normalizedPrices) > 0 {
				ytd := normalizedPrices[len(normalizedPrices)-1].Value
				metrics.YTDReturn = &ytd
			}
		}

		compareResults = append(compareResults, CompareTickerResult{
			Ticker:           tc.ticker,
			Name:             tc.name,
			NormalizedPrices: normalizedPrices,
			Metrics:          metrics,
		})
	}

	return &CompareResponse{
		Tickers:             compareResults,
		Warnings:            warnings,
		StartDateDisclosure: startDisclosure,
	}, nil
}
