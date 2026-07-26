package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// ── Valuation rules ───────────────────────────────────────────────────────────

func TestInterpretValuation_Cheap(t *testing.T) {
	label, score := interpretValuation(8.0)
	assert.Equal(t, "cheap", label)
	assert.Equal(t, 2, score)
}

func TestInterpretValuation_Fair(t *testing.T) {
	label, score := interpretValuation(15.0)
	assert.Equal(t, "fair", label)
	assert.Equal(t, 1, score)
}

func TestInterpretValuation_Pricey(t *testing.T) {
	label, score := interpretValuation(29.5)
	assert.Equal(t, "pricey", label)
	assert.Equal(t, 0, score)
}

func TestInterpretValuation_VeryExpensive(t *testing.T) {
	label, score := interpretValuation(80.0)
	assert.Equal(t, "very_expensive", label)
	assert.Equal(t, -1, score)
}

// AC: Negative P/E → 'not_yet_profitable' override
func TestInterpretValuation_NegativePE_NotYetProfitable(t *testing.T) {
	label, score := interpretValuation(-5.2)
	assert.Equal(t, "not_yet_profitable", label)
	assert.Equal(t, -1, score)
}

// ── Profitability rules ───────────────────────────────────────────────────────

func TestInterpretProfitability_LosingMoney(t *testing.T) {
	label, score := interpretProfitability(-2.0)
	assert.Equal(t, "losing_money", label)
	assert.Equal(t, -2, score)
}

func TestInterpretProfitability_BreakingEven(t *testing.T) {
	label, score := interpretProfitability(0.3)
	assert.Equal(t, "breaking_even", label)
	assert.Equal(t, -1, score)
}

func TestInterpretProfitability_Profitable(t *testing.T) {
	label, score := interpretProfitability(2.5)
	assert.Equal(t, "profitable", label)
	assert.Equal(t, 1, score)
}

func TestInterpretProfitability_HighlyProfitable(t *testing.T) {
	label, score := interpretProfitability(10.0)
	assert.Equal(t, "highly_profitable", label)
	assert.Equal(t, 2, score)
}

// ── Debt rules ────────────────────────────────────────────────────────────────

func TestInterpretDebt_LowDebt(t *testing.T) {
	label, score := interpretDebt(0.1)
	assert.Equal(t, "low_debt", label)
	assert.Equal(t, 2, score)
}

func TestInterpretDebt_Moderate(t *testing.T) {
	label, score := interpretDebt(0.7)
	assert.Equal(t, "moderate", label)
	assert.Equal(t, 1, score)
}

func TestInterpretDebt_HighDebt(t *testing.T) {
	label, score := interpretDebt(1.5)
	assert.Equal(t, "high_debt", label)
	assert.Equal(t, -1, score)
}

func TestInterpretDebt_HeavilyLeveraged(t *testing.T) {
	label, score := interpretDebt(3.5)
	assert.Equal(t, "heavily_leveraged", label)
	assert.Equal(t, -2, score)
}

// AC: D/E boundary at 1.0 → high_debt
func TestInterpretDebt_Boundary_1(t *testing.T) {
	label, _ := interpretDebt(1.0)
	assert.Equal(t, "high_debt", label)
}

// ── Sentiment scoring ─────────────────────────────────────────────────────────

// AC: All sections negative → overallSentiment = "negative"
func TestScoreToSentiment_AllNegative(t *testing.T) {
	// total = -5, sections = 3 → avg = -1.67
	result := scoreToSentiment(-5, 3)
	assert.Equal(t, "negative", result)
}

func TestScoreToSentiment_AllPositive(t *testing.T) {
	result := scoreToSentiment(6, 3)
	assert.Equal(t, "positive", result)
}

func TestScoreToSentiment_Mixed_Neutral(t *testing.T) {
	// total = 1, sections = 3 → avg = 0.33
	result := scoreToSentiment(1, 3)
	assert.Equal(t, "neutral", result)
}

func TestScoreToSentiment_Mixed_Caution(t *testing.T) {
	// total = -1, sections = 3 → avg = -0.33
	result := scoreToSentiment(-1, 3)
	assert.Equal(t, "caution", result)
}

func TestScoreToSentiment_ZeroSections(t *testing.T) {
	result := scoreToSentiment(0, 0)
	assert.Equal(t, "neutral", result)
}

// ── ROE interpretation ────────────────────────────────────────────────────────

func TestInterpretROE_HighEfficiency(t *testing.T) {
	label, score := interpretROE(0.25) // 25%
	assert.Equal(t, "high_efficiency", label)
	assert.Equal(t, 2, score)
}

func TestInterpretROE_GoodEfficiency(t *testing.T) {
	label, score := interpretROE(0.15) // 15%
	assert.Equal(t, "good_efficiency", label)
	assert.Equal(t, 1, score)
}

func TestInterpretROE_LowEfficiency(t *testing.T) {
	label, score := interpretROE(0.05) // 5%
	assert.Equal(t, "low_efficiency", label)
	assert.Equal(t, -1, score)
}

func TestInterpretROE_NegativeReturns(t *testing.T) {
	label, score := interpretROE(-0.10)
	assert.Equal(t, "negative_returns", label)
	assert.Equal(t, -2, score)
}

// ── Headline generation ───────────────────────────────────────────────────────

func TestBuildHeadline_Positive(t *testing.T) {
	h := buildHeadline("AAPL", "positive")
	assert.Contains(t, h, "AAPL")
	assert.Contains(t, h, "performing well")
}

func TestBuildHeadline_Neutral(t *testing.T) {
	h := buildHeadline("MSFT", "neutral")
	assert.Contains(t, h, "MSFT")
	assert.Contains(t, h, "mixed signals")
}

func TestBuildHeadline_Caution(t *testing.T) {
	h := buildHeadline("SNAP", "caution")
	assert.Contains(t, h, "SNAP")
	assert.Contains(t, h, "warrant attention")
}

func TestBuildHeadline_Negative(t *testing.T) {
	h := buildHeadline("TSLA", "negative")
	assert.Contains(t, h, "TSLA")
	assert.Contains(t, h, "challenges")
}

// ── Integration-style: buildSections with realistic metrics ──────────────────

func TestBuildSections_AllNegative_SentimentIsNegative(t *testing.T) {
	svc := &ELI5Service{db: nil, metricsSvc: nil}

	pe := -10.0         // not_yet_profitable (-1)
	eps := -5.0         // losing_money (-2)
	de := 3.0           // heavily_leveraged (-2)
	roe := -0.2         // negative_returns (-2)

	metrics := &MetricsResponse{
		Ticker:       "BADCO",
		FiscalPeriod: "Q2 2024",
		LastUpdated:  "2024-07-01",
		Metrics: FundamentalMetrics{
			PE:           &pe,
			EPS:          &eps,
			DebtToEquity: &de,
			ROE:          &roe,
		},
	}

	sections, totalScore := svc.buildSections(metrics)
	assert.Len(t, sections, 4, "should have 4 sections (Valuation, Profitability, Debt, Efficiency)")
	sentiment := scoreToSentiment(totalScore, len(sections))
	assert.Equal(t, "negative", sentiment, "all negative metrics should produce negative overall sentiment")
}

func TestBuildSections_DividendSectionOmittedWhenZero(t *testing.T) {
	svc := &ELI5Service{db: nil, metricsSvc: nil}

	yield := 0.0

	metrics := &MetricsResponse{
		Ticker:      "NODIV",
		LastUpdated: "2024-07-01",
		Metrics: FundamentalMetrics{
			DividendYield: &yield,
		},
	}

	sections, _ := svc.buildSections(metrics)
	for _, s := range sections {
		assert.NotEqual(t, "Dividends", s.Topic, "zero-yield stock should not have a Dividends section")
	}
}

func TestBuildSections_MissingMetricSkipped(t *testing.T) {
	// AC: Missing metric from Polygon.io → skip that section rather than crashing.
	svc := &ELI5Service{db: nil, metricsSvc: nil}

	// Only PE provided — no EPS, D/E, ROE, dividends
	pe := 25.0
	metrics := &MetricsResponse{
		Ticker:      "SPARSE",
		LastUpdated: "2024-07-01",
		Metrics: FundamentalMetrics{
			PE: &pe,
		},
	}

	sections, _ := svc.buildSections(metrics)
	assert.Len(t, sections, 1)
	assert.Equal(t, "Valuation", sections[0].Topic)
}

func TestBuildSections_NoDividendSectionWhenNil(t *testing.T) {
	// nil DividendYield pointer → section should be completely omitted
	svc := &ELI5Service{db: nil, metricsSvc: nil}

	metrics := &MetricsResponse{
		Ticker:      "NODIV2",
		LastUpdated: "2024-07-01",
		Metrics:     FundamentalMetrics{}, // all nil
	}

	sections, _ := svc.buildSections(metrics)
	assert.Empty(t, sections)
}
