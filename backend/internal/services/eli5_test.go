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

// ── Growth / profitability rules ──────────────────────────────────────────────

func TestInterpretGrowth_LosingMoney(t *testing.T) {
	label, score := interpretGrowth(-2.0)
	assert.Equal(t, "losing_money", label)
	assert.Equal(t, -2, score)
}

func TestInterpretGrowth_HighlyProfitable(t *testing.T) {
	label, score := interpretGrowth(10.0)
	assert.Equal(t, "highly_profitable", label)
	assert.Equal(t, 2, score)
}

// ── Debt rules ────────────────────────────────────────────────────────────────

func TestInterpretDebt_LowDebt(t *testing.T) {
	label, score := interpretDebt(0.1)
	assert.Equal(t, "low_debt", label)
	assert.Equal(t, 2, score)
}

func TestInterpretDebt_HeavilyLeveraged(t *testing.T) {
	label, score := interpretDebt(3.5)
	assert.Equal(t, "heavily_leveraged", label)
	assert.Equal(t, -2, score)
}

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

func TestScoreToSentiment_Mixed(t *testing.T) {
	// total = 1, sections = 3 → avg = 0.33
	result := scoreToSentiment(1, 3)
	assert.Equal(t, "neutral", result)
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

func TestInterpretROE_NegativeReturns(t *testing.T) {
	label, score := interpretROE(-0.10)
	assert.Equal(t, "negative_returns", label)
	assert.Equal(t, -2, score)
}

// ── Headline ─────────────────────────────────────────────────────────────────

func TestBuildHeadline_Positive(t *testing.T) {
	h := buildHeadline("AAPL", "positive")
	assert.Contains(t, h, "AAPL")
	assert.Contains(t, h, "performing well")
}

func TestBuildHeadline_Negative(t *testing.T) {
	h := buildHeadline("TSLA", "negative")
	assert.Contains(t, h, "TSLA")
	assert.Contains(t, h, "challenges")
}
