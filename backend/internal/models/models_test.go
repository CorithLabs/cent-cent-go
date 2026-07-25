package models_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/CorithLabs/cent-cent-go/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSearchResult_JSONSerialization(t *testing.T) {
	result := models.SearchResult{
		Ticker:   "AAPL",
		Name:     "Apple Inc.",
		Exchange: "NASDAQ",
		Type:     "CS",
	}

	b, err := json.Marshal(result)
	require.NoError(t, err)

	var out models.SearchResult
	err = json.Unmarshal(b, &out)
	require.NoError(t, err)

	assert.Equal(t, "AAPL", out.Ticker)
	assert.Equal(t, "Apple Inc.", out.Name)
	assert.Equal(t, "NASDAQ", out.Exchange)
	assert.Equal(t, "CS", out.Type)
}

func TestStockQuote_NilableFields(t *testing.T) {
	// StockQuote must marshal without panicking when optional fields are zero-value
	quote := models.StockQuote{
		Ticker:      "NVDA",
		Name:        "NVIDIA Corporation",
		Price:       900.42,
		Change:      12.5,
		ChangePct:   1.41,
		MarketCap:   2_200_000_000_000,
		Volume:      45_000_000,
		Week52High:  974.00,
		Week52Low:   392.30,
		Exchange:    "NASDAQ",
		Status:      "active",
		Stale:       false,
		LastUpdated: time.Now(),
		DataSource:  "polygon",
	}

	b, err := json.Marshal(quote)
	require.NoError(t, err)
	assert.Contains(t, string(b), "NVDA")
}

func TestFundamentalMetrics_NilablePointers(t *testing.T) {
	// Nil pointer fields must serialize as JSON null, not panic
	metrics := models.FundamentalMetrics{
		Ticker:       "NEWCO",
		FiscalPeriod: "Q3 2024",
		PE:           nil, // loss-making — P/E not applicable
		PB:           nil,
		EPS:          nil,
		DividendYield: nil,
		Beta:          nil,
		ROE:           nil,
		DebtToEquity:  nil,
		LastUpdated:   time.Now(),
		DataSource:    "polygon",
	}

	b, err := json.Marshal(metrics)
	require.NoError(t, err)

	var m map[string]interface{}
	err = json.Unmarshal(b, &m)
	require.NoError(t, err)

	assert.Nil(t, m["pe"], "nil PE should serialize as JSON null")
	assert.Nil(t, m["dividendYield"], "nil dividendYield should serialize as JSON null")
}

func TestELI5Response_Structure(t *testing.T) {
	pe := 32.5
	benchmark := 20.0
	resp := models.ELI5Response{
		Ticker:           "META",
		GeneratedAt:      time.Now(),
		OverallSentiment: "neutral",
		Headline:         "Doing okay overall",
		DataAsOf:         "2024-07-01",
		Sections: []models.ELI5Section{
			{
				Topic:           "Valuation",
				Emoji:           "💰",
				Label:           "pricey",
				RawValue:        pe,
				SectorBenchmark: &benchmark,
			},
		},
	}

	b, err := json.Marshal(resp)
	require.NoError(t, err)
	assert.Contains(t, string(b), "pricey")
	assert.Contains(t, string(b), "neutral")
}

func TestEconomicIndicator_Serialization(t *testing.T) {
	ind := models.EconomicIndicator{
		ID:        "GDPC1",
		Name:      "Real GDP",
		Value:     28500.5,
		PrevValue: 28100.0,
		Unit:      "Billions of Chained 2017 Dollars",
		Change:    400.5,
		Trend:     "up",
		LastUpdated: time.Now(),
		NextRelease: nil,
		Source:    "FRED / Federal Reserve Bank of St. Louis",
	}

	b, err := json.Marshal(ind)
	require.NoError(t, err)

	var out models.EconomicIndicator
	err = json.Unmarshal(b, &out)
	require.NoError(t, err)
	assert.Equal(t, "GDPC1", out.ID)
	assert.Equal(t, "up", out.Trend)
}
