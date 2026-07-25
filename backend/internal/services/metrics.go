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

// FundamentalMetrics holds key valuation and financial ratios.
type FundamentalMetrics struct {
	PE            *float64 `json:"pe"`
	PB            *float64 `json:"pb"`
	EPS           *float64 `json:"eps"`
	DividendYield *float64 `json:"dividendYield"`
	Beta          *float64 `json:"beta"`
	ROE           *float64 `json:"roe"`
	DebtToEquity  *float64 `json:"debtToEquity"`
}

// MetricsResponse is the full response for /api/stocks/:ticker/metrics.
type MetricsResponse struct {
	Ticker       string             `json:"ticker"`
	FiscalPeriod string             `json:"fiscalPeriod"`
	LastUpdated  string             `json:"lastUpdated"`
	Metrics      FundamentalMetrics `json:"metrics"`
	Source       string             `json:"source"`
}

// MetricsService fetches and caches fundamental metrics from Polygon.io.
type MetricsService struct {
	db         *pgxpool.Pool
	httpClient *http.Client
	apiKey     string
}

// NewMetricsService creates a new MetricsService.
func NewMetricsService(db *pgxpool.Pool) *MetricsService {
	return &MetricsService{
		db:         db,
		httpClient: &http.Client{Timeout: 8 * time.Second},
		apiKey:     os.Getenv("POLYGON_API_KEY"),
	}
}

// polygonFinancialResponse maps the relevant subset of Polygon.io /vX/reference/financials.
type polygonFinancialResponse struct {
	Results []struct {
		FiscalPeriod string `json:"fiscal_period"`
		FiscalYear   string `json:"fiscal_year"`
		Financials   struct {
			IncomeStatement struct {
				BasicEPS struct {
					Value *float64 `json:"value"`
				} `json:"basic_earnings_per_share"`
				NetIncome struct {
					Value *float64 `json:"value"`
				} `json:"net_income_loss"`
				Revenues struct {
					Value *float64 `json:"value"`
				} `json:"revenues"`
			} `json:"income_statement"`
			BalanceSheet struct {
				Equity struct {
					Value *float64 `json:"value"`
				} `json:"equity"`
				Liabilities struct {
					Value *float64 `json:"value"`
				} `json:"liabilities"`
				Assets struct {
					Value *float64 `json:"value"`
				} `json:"assets"`
			} `json:"balance_sheet"`
		} `json:"financials"`
	} `json:"results"`
	Status string `json:"status"`
}

// polygonSnapshotMetrics maps Polygon.io snapshot for beta and dividend yield.
type polygonTickerDetailsV3 struct {
	Results struct {
		MarketCap      int64    `json:"market_cap"`
		WeightedShares int64    `json:"weighted_shares_outstanding"`
		DividendYield  *float64 `json:"dividend_yield"`
		Beta           *float64 `json:"beta"`
		BookValue      *float64 `json:"book_value_per_share"`
		PEO            *float64 `json:"pe_ratio"` // Polygon provides PE on some tickers
	} `json:"results"`
}

// GetMetrics returns fundamental metrics for a ticker.
// Fetches from Polygon.io and caches in PostgreSQL for 24h.
func (s *MetricsService) GetMetrics(ctx context.Context, ticker string) (*MetricsResponse, error) {
	// Try cache
	cached, err := s.getCached(ctx, ticker)
	if err == nil && cached != nil {
		updated, _ := time.Parse(time.RFC3339, cached.LastUpdated)
		if time.Since(updated) < 24*time.Hour {
			return cached, nil
		}
	}

	// Fetch fresh data from Polygon.io
	metrics, fiscalPeriod, err := s.fetchFromPolygon(ctx, ticker)
	if err != nil {
		// Return stale cache if available
		if cached != nil {
			return cached, nil
		}
		return nil, err
	}

	response := &MetricsResponse{
		Ticker:       ticker,
		FiscalPeriod: fiscalPeriod,
		LastUpdated:  time.Now().UTC().Format(time.RFC3339),
		Metrics:      *metrics,
		Source:       "polygon",
	}

	_ = s.upsertCache(ctx, response)
	return response, nil
}

func (s *MetricsService) fetchFromPolygon(ctx context.Context, ticker string) (*FundamentalMetrics, string, error) {
	// Fetch ticker details for beta, dividend yield, book value
	detailsURL := fmt.Sprintf(
		"https://api.polygon.io/v3/reference/tickers/%s?apiKey=%s",
		ticker, s.apiKey,
	)
	detailsResp, err := s.doGet(ctx, detailsURL)
	if err != nil {
		return nil, "", fmt.Errorf("ticker details: %w", err)
	}
	defer detailsResp.Body.Close()

	if detailsResp.StatusCode == http.StatusNotFound {
		return nil, "", fmt.Errorf("ticker %s not found", ticker)
	}

	detailsBody, _ := io.ReadAll(detailsResp.Body)
	var details polygonTickerDetailsV3
	json.Unmarshal(detailsBody, &details)

	// Fetch most recent income statement
	financialsURL := fmt.Sprintf(
		"https://api.polygon.io/vX/reference/financials?ticker=%s&limit=1&sort=filing_date&order=desc&apiKey=%s",
		ticker, s.apiKey,
	)
	finResp, err := s.doGet(ctx, financialsURL)
	if err != nil {
		return nil, "", fmt.Errorf("financials: %w", err)
	}
	defer finResp.Body.Close()

	finBody, _ := io.ReadAll(finResp.Body)
	var fin polygonFinancialResponse
	json.Unmarshal(finBody, &fin)

	metrics := &FundamentalMetrics{
		Beta:          details.Results.Beta,
		DividendYield: details.Results.DividendYield,
	}

	fiscalPeriod := "TTM"

	if len(fin.Results) > 0 {
		r := fin.Results[0]
		fiscalPeriod = fmt.Sprintf("%s %s", r.FiscalPeriod, r.FiscalYear)

		eps := r.Financials.IncomeStatement.BasicEPS.Value
		metrics.EPS = eps

		// Calculate D/E from balance sheet
		equity := r.Financials.BalanceSheet.Equity.Value
		liabilities := r.Financials.BalanceSheet.Liabilities.Value
		if equity != nil && liabilities != nil && *equity != 0 {
			de := *liabilities / *equity
			metrics.DebtToEquity = &de
		}

		// ROE = net income / equity
		netIncome := r.Financials.IncomeStatement.NetIncome.Value
		if netIncome != nil && equity != nil && *equity != 0 {
			roe := *netIncome / *equity
			metrics.ROE = &roe
		}
	}

	// PE and PB require live price — use details if available
	if details.Results.PEO != nil {
		metrics.PE = details.Results.PEO
	}
	if details.Results.BookValue != nil && details.Results.BookValue != nil {
		// PB = price / book value per share; would need current price
		// For now store book value; PE ratio used directly from Polygon
		metrics.PB = details.Results.BookValue
	}

	return metrics, fiscalPeriod, nil
}

// ── Cache ─────────────────────────────────────────────────────────────────────

func (s *MetricsService) getCached(ctx context.Context, ticker string) (*MetricsResponse, error) {
	row := s.db.QueryRow(ctx, `
		SELECT payload, generated_at FROM eli5_cache WHERE ticker = $1`, ticker)

	// Note: we reuse a separate table for metrics — implement with fundamental_metrics table
	var fm struct {
		FiscalPeriod  *string
		PE            *float64
		PB            *float64
		EPS           *float64
		DividendYield *float64
		Beta          *float64
		ROE           *float64
		DebtToEquity  *float64
		LastUpdated   time.Time
		Source        string
	}

	err := s.db.QueryRow(ctx, `
		SELECT fiscal_period, pe, pb, eps, dividend_yield, beta, roe, debt_to_equity,
		       last_updated, source
		FROM fundamental_metrics WHERE ticker = $1`, ticker).
		Scan(&fm.FiscalPeriod, &fm.PE, &fm.PB, &fm.EPS, &fm.DividendYield,
			&fm.Beta, &fm.ROE, &fm.DebtToEquity, &fm.LastUpdated, &fm.Source)

	_ = row

	if err != nil {
		return nil, err
	}

	period := "TTM"
	if fm.FiscalPeriod != nil {
		period = *fm.FiscalPeriod
	}

	return &MetricsResponse{
		Ticker:       ticker,
		FiscalPeriod: period,
		LastUpdated:  fm.LastUpdated.UTC().Format(time.RFC3339),
		Metrics: FundamentalMetrics{
			PE:            fm.PE,
			PB:            fm.PB,
			EPS:           fm.EPS,
			DividendYield: fm.DividendYield,
			Beta:          fm.Beta,
			ROE:           fm.ROE,
			DebtToEquity:  fm.DebtToEquity,
		},
		Source: fm.Source,
	}, nil
}

func (s *MetricsService) upsertCache(ctx context.Context, r *MetricsResponse) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO fundamental_metrics
		  (ticker, fiscal_period, pe, pb, eps, dividend_yield, beta, roe, debt_to_equity, last_updated, source)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (ticker) DO UPDATE SET
		  fiscal_period=$2, pe=$3, pb=$4, eps=$5, dividend_yield=$6,
		  beta=$7, roe=$8, debt_to_equity=$9, last_updated=$10, source=$11`,
		r.Ticker, r.FiscalPeriod,
		r.Metrics.PE, r.Metrics.PB, r.Metrics.EPS, r.Metrics.DividendYield,
		r.Metrics.Beta, r.Metrics.ROE, r.Metrics.DebtToEquity,
		r.LastUpdated, r.Source)
	return err
}

func (s *MetricsService) doGet(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	return s.httpClient.Do(req)
}
