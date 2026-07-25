package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Response types ────────────────────────────────────────────────────────────

// ELI5Section represents a single analysed topic in the ELI5 report.
type ELI5Section struct {
	Topic                    string  `json:"topic"`
	Emoji                    string  `json:"emoji"`
	Label                    string  `json:"label"`
	RawValue                 string  `json:"rawValue"`
	SectorBenchmark          string  `json:"sectorBenchmark,omitempty"`
	SectorBenchmarkUnavailable bool   `json:"sectorBenchmarkUnavailable,omitempty"`
}

// ELI5Response is the full response for GET /api/stocks/:ticker/eli5.
// AC: No LLM call is made server-side — frontend uses structured labels to prompt window.ai.
type ELI5Response struct {
	Ticker          string        `json:"ticker"`
	GeneratedAt     string        `json:"generatedAt"`
	OverallSentiment string       `json:"overallSentiment"` // "positive" | "neutral" | "caution" | "negative"
	Headline        string        `json:"headline"`
	Sections        []ELI5Section `json:"sections"`
	DataAsOf        string        `json:"dataAsOf"`
}

// ── Service ───────────────────────────────────────────────────────────────────

// ELI5Service interprets fundamental metrics into a structured analysis.
type ELI5Service struct {
	db          *pgxpool.Pool
	metricsSvc  *MetricsService
}

// NewELI5Service creates a new ELI5Service.
func NewELI5Service(db *pgxpool.Pool) *ELI5Service {
	return &ELI5Service{
		db:         db,
		metricsSvc: NewMetricsService(db),
	}
}

// GetELI5 returns the structured analysis for a ticker.
// Checks a 1-hour cache before computing.
// AC: No LLM is called. Computation is deterministic and rules-based.
func (s *ELI5Service) GetELI5(ctx context.Context, ticker string) (*ELI5Response, error) {
	// Check cache (1 hour TTL)
	cached, err := s.getCached(ctx, ticker)
	if err == nil && cached != nil {
		generated, _ := time.Parse(time.RFC3339, cached.GeneratedAt)
		if time.Since(generated) < time.Hour {
			return cached, nil
		}
	}

	// Fetch fundamentals
	metrics, err := s.metricsSvc.GetMetrics(ctx, ticker)
	if err != nil {
		return nil, err
	}

	if metrics == nil {
		return nil, fmt.Errorf("ticker %s not found", ticker)
	}

	// Build sections using rules-based interpretation
	sections, sentimentScore := s.buildSections(metrics)

	// Overall sentiment from weighted score
	overallSentiment := scoreToSentiment(sentimentScore, len(sections))
	headline := buildHeadline(ticker, overallSentiment)

	response := &ELI5Response{
		Ticker:           ticker,
		GeneratedAt:      time.Now().UTC().Format(time.RFC3339),
		OverallSentiment: overallSentiment,
		Headline:         headline,
		Sections:         sections,
		DataAsOf:         metrics.LastUpdated,
	}

	_ = s.upsertCache(ctx, ticker, response)
	return response, nil
}

// ── Rules-based interpretation ────────────────────────────────────────────────

// buildSections constructs ELI5 sections from fundamental metrics using rules.
// Returns sections and a total sentiment score (higher = more positive).
func (s *ELI5Service) buildSections(metrics *MetricsResponse) ([]ELI5Section, int) {
	var sections []ELI5Section
	totalScore := 0

	// ── Valuation (P/E) ───────────────────────────────────────────────────
	if metrics.Metrics.PE != nil {
		pe := *metrics.Metrics.PE
		label, score := interpretValuation(pe)
		sections = append(sections, ELI5Section{
			Topic:           "Valuation",
			Emoji:           "💰",
			Label:           label,
			RawValue:        fmt.Sprintf("P/E: %.1fx", pe),
			SectorBenchmark: "20x",
		})
		totalScore += score
	}

	// ── Growth (use revenue growth if available, else skip) ───────────────
	// Note: YoY revenue growth would need 2 periods; for MVP we derive from EPS
	if metrics.Metrics.EPS != nil {
		eps := *metrics.Metrics.EPS
		label, score := interpretGrowth(eps)
		sections = append(sections, ELI5Section{
			Topic:    "Profitability",
			Emoji:    "📈",
			Label:    label,
			RawValue: fmt.Sprintf("EPS: $%.2f", eps),
		})
		totalScore += score
	}

	// ── Debt ─────────────────────────────────────────────────────────────
	if metrics.Metrics.DebtToEquity != nil {
		de := *metrics.Metrics.DebtToEquity
		label, score := interpretDebt(de)
		sections = append(sections, ELI5Section{
			Topic:           "Debt",
			Emoji:           "🏦",
			Label:           label,
			RawValue:        fmt.Sprintf("D/E: %.2fx", de),
			SectorBenchmark: "1.0x",
		})
		totalScore += score
	}

	// ── Dividends (only include if yield > 0) ─────────────────────────────
	if metrics.Metrics.DividendYield != nil && *metrics.Metrics.DividendYield > 0 {
		yield := *metrics.Metrics.DividendYield
		sections = append(sections, ELI5Section{
			Topic:    "Dividends",
			Emoji:    "💵",
			Label:    "pays_dividend",
			RawValue: fmt.Sprintf("Yield: %.2f%%", yield*100),
		})
		totalScore += 1 // slightly positive signal
	}

	// ── ROE ───────────────────────────────────────────────────────────────
	if metrics.Metrics.ROE != nil {
		roe := *metrics.Metrics.ROE
		label, score := interpretROE(roe)
		sections = append(sections, ELI5Section{
			Topic:           "Efficiency",
			Emoji:           "⚙️",
			Label:           label,
			RawValue:        fmt.Sprintf("ROE: %.1f%%", roe*100),
			SectorBenchmark: "15%",
		})
		totalScore += score
	}

	return sections, totalScore
}

// ── Interpretation rules ──────────────────────────────────────────────────────

// interpretValuation returns label and score for P/E ratio.
// AC: Negative P/E → 'not_yet_profitable' (override).
func interpretValuation(pe float64) (string, int) {
	if pe < 0 {
		return "not_yet_profitable", -1
	}
	switch {
	case pe < 10:
		return "cheap", 2
	case pe < 20:
		return "fair", 1
	case pe < 35:
		return "pricey", 0
	default:
		return "very_expensive", -1
	}
}

// interpretGrowth returns label and score based on EPS value as a profitability proxy.
func interpretGrowth(eps float64) (string, int) {
	switch {
	case eps < 0:
		return "losing_money", -2
	case eps < 0.5:
		return "breaking_even", -1
	case eps < 5:
		return "profitable", 1
	default:
		return "highly_profitable", 2
	}
}

// interpretDebt returns label and score for debt-to-equity ratio.
func interpretDebt(de float64) (string, int) {
	switch {
	case de < 0.3:
		return "low_debt", 2
	case de < 1.0:
		return "moderate", 1
	case de < 2.0:
		return "high_debt", -1
	default:
		return "heavily_leveraged", -2
	}
}

// interpretROE returns label and score for return on equity.
func interpretROE(roe float64) (string, int) {
	roePct := roe * 100
	switch {
	case roePct < 0:
		return "negative_returns", -2
	case roePct < 10:
		return "low_efficiency", -1
	case roePct < 20:
		return "good_efficiency", 1
	default:
		return "high_efficiency", 2
	}
}

// scoreToSentiment maps average section score to overall sentiment string.
// AC: All sections negative → overallSentiment = "negative".
func scoreToSentiment(totalScore, numSections int) string {
	if numSections == 0 {
		return "neutral"
	}
	avg := float64(totalScore) / float64(numSections)
	switch {
	case avg >= 1.5:
		return "positive"
	case avg >= 0.3:
		return "neutral"
	case avg >= -0.5:
		return "caution"
	default:
		return "negative"
	}
}

// buildHeadline generates a short summary headline.
func buildHeadline(ticker, sentiment string) string {
	switch sentiment {
	case "positive":
		return fmt.Sprintf("%s is performing well across most metrics.", ticker)
	case "neutral":
		return fmt.Sprintf("%s shows mixed signals — some strengths, some concerns.", ticker)
	case "caution":
		return fmt.Sprintf("%s has some areas that warrant attention.", ticker)
	default:
		return fmt.Sprintf("%s faces significant financial challenges.", ticker)
	}
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

func (s *ELI5Service) getCached(ctx context.Context, ticker string) (*ELI5Response, error) {
	row := s.db.QueryRow(ctx, `
		SELECT payload, generated_at FROM eli5_cache WHERE ticker = $1`, ticker)

	var payload []byte
	var generatedAt time.Time
	if err := row.Scan(&payload, &generatedAt); err != nil {
		return nil, err
	}

	var response ELI5Response
	if err := json.Unmarshal(payload, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (s *ELI5Service) upsertCache(ctx context.Context, ticker string, response *ELI5Response) error {
	payload, err := json.Marshal(response)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(ctx, `
		INSERT INTO eli5_cache (ticker, payload, generated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (ticker) DO UPDATE SET payload = $2, generated_at = NOW()`,
		ticker, payload)
	return err
}

// ── Utility ───────────────────────────────────────────────────────────────────

// float64Ptr is a helper for pointer-to-float64.
func float64Ptr(f float64) *float64 {
	return &f
}

// abs returns the absolute value of a float64.
func absFloat(f float64) float64 {
	return math.Abs(f)
}
