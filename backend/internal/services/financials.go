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

// StatementPeriod holds financial data for a single fiscal period.
type StatementPeriod struct {
	FiscalDate       string   `json:"fiscalDate"`
	Revenue          *float64 `json:"revenue,omitempty"`
	GrossProfit      *float64 `json:"grossProfit,omitempty"`
	OperatingIncome  *float64 `json:"operatingIncome,omitempty"`
	NetIncome        *float64 `json:"netIncome,omitempty"`
	EPS              *float64 `json:"eps,omitempty"`
	TotalAssets      *float64 `json:"totalAssets,omitempty"`
	TotalLiabilities *float64 `json:"totalLiabilities,omitempty"`
	TotalEquity      *float64 `json:"totalEquity,omitempty"`
	OperatingCF      *float64 `json:"operatingCashFlow,omitempty"`
	CapEx            *float64 `json:"capitalExpenditures,omitempty"`
	FreeCashFlow     *float64 `json:"freeCashFlow,omitempty"`
}

// FinancialsResponse is the full response for /api/stocks/:ticker/financials.
type FinancialsResponse struct {
	Ticker      string            `json:"ticker"`
	Statement   string            `json:"statement"`
	Period      string            `json:"period"`
	Data        []StatementPeriod `json:"data"`
	DataSource  string            `json:"dataSource"`
	LastUpdated string            `json:"lastUpdated"`
}

// validStatements is the set of allowed statement types.
var validStatements = map[string]bool{
	"income":   true,
	"balance":  true,
	"cashflow": true,
}

// IsValidStatement checks if the statement type is supported.
func IsValidStatement(s string) bool {
	return validStatements[s]
}

// FinancialsService fetches financial statement data from Polygon.io.
type FinancialsService struct {
	db         *pgxpool.Pool
	httpClient *http.Client
	apiKey     string
}

// NewFinancialsService creates a new FinancialsService.
func NewFinancialsService(db *pgxpool.Pool) *FinancialsService {
	return &FinancialsService{
		db:         db,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		apiKey:     os.Getenv("POLYGON_API_KEY"),
	}
}

// polygonFinancialsResult is the subset of the Polygon.io /vX/reference/financials response we use.
type polygonFinancialsResult struct {
	Results []struct {
		FiscalPeriod string `json:"fiscal_period"` // Q1, Q2, Q3, Q4, FY
		FiscalYear   string `json:"fiscal_year"`
		EndDate      string `json:"end_date"`
		Financials   struct {
			IncomeStatement struct {
				Revenues          struct{ Value *float64 `json:"value"` } `json:"revenues"`
				GrossProfit       struct{ Value *float64 `json:"value"` } `json:"gross_profit"`
				OperatingIncome   struct{ Value *float64 `json:"value"` } `json:"operating_income_loss"`
				NetIncome         struct{ Value *float64 `json:"value"` } `json:"net_income_loss"`
				BasicEPS          struct{ Value *float64 `json:"value"` } `json:"basic_earnings_per_share"`
			} `json:"income_statement"`
			BalanceSheet struct {
				Assets      struct{ Value *float64 `json:"value"` } `json:"assets"`
				Liabilities struct{ Value *float64 `json:"value"` } `json:"liabilities"`
				Equity      struct{ Value *float64 `json:"value"` } `json:"equity"`
			} `json:"balance_sheet"`
			CashFlowStatement struct {
				NetCashFromOps   struct{ Value *float64 `json:"value"` } `json:"net_cash_flow_from_operating_activities"`
				CapEx            struct{ Value *float64 `json:"value"` } `json:"capital_expenditure"`
				NetCashFromInv   struct{ Value *float64 `json:"value"` } `json:"net_cash_flow_from_investing_activities"`
			} `json:"cash_flow_statement"`
		} `json:"financials"`
	} `json:"results"`
	Status string `json:"status"`
}

// GetFinancials fetches and returns the requested financial statement.
func (s *FinancialsService) GetFinancials(ctx context.Context, ticker, statement, period string, limit int) (*FinancialsResponse, error) {
	// Map our period to Polygon.io timeframe
	timeframe := "annual"
	if period == "quarterly" {
		timeframe = "quarterly"
	}

	url := fmt.Sprintf(
		"https://api.polygon.io/vX/reference/financials?ticker=%s&timeframe=%s&limit=%d&sort=filing_date&order=desc&apiKey=%s",
		ticker, timeframe, limit, s.apiKey,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("polygon financials request failed: %w", err)
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

	var polygonData polygonFinancialsResult
	if err := json.Unmarshal(body, &polygonData); err != nil {
		return nil, err
	}

	periods := make([]StatementPeriod, 0, len(polygonData.Results))
	for _, r := range polygonData.Results {
		p := StatementPeriod{FiscalDate: r.EndDate}

		switch statement {
		case "income":
			p.Revenue = r.Financials.IncomeStatement.Revenues.Value
			p.GrossProfit = r.Financials.IncomeStatement.GrossProfit.Value
			p.OperatingIncome = r.Financials.IncomeStatement.OperatingIncome.Value
			p.NetIncome = r.Financials.IncomeStatement.NetIncome.Value
			p.EPS = r.Financials.IncomeStatement.BasicEPS.Value

		case "balance":
			p.TotalAssets = r.Financials.BalanceSheet.Assets.Value
			p.TotalLiabilities = r.Financials.BalanceSheet.Liabilities.Value
			p.TotalEquity = r.Financials.BalanceSheet.Equity.Value

		case "cashflow":
			p.OperatingCF = r.Financials.CashFlowStatement.NetCashFromOps.Value
			p.CapEx = r.Financials.CashFlowStatement.CapEx.Value
			// Free Cash Flow = Operating CF - CapEx
			if p.OperatingCF != nil && p.CapEx != nil {
				fcf := *p.OperatingCF - *p.CapEx
				p.FreeCashFlow = &fcf
			}
		}

		periods = append(periods, p)
	}

	return &FinancialsResponse{
		Ticker:      ticker,
		Statement:   statement,
		Period:      period,
		Data:        periods,
		DataSource:  "polygon",
		LastUpdated: time.Now().UTC().Format(time.RFC3339),
	}, nil
}
