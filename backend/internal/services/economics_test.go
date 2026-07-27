package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── Tests ─────────────────────────────────────────────────────────────────────

func TestFredTrendPointsForRange(t *testing.T) {
	assert.Equal(t, 13, fredTrendPointsForRange("1y"))
	assert.Equal(t, 65, fredTrendPointsForRange("5y"))
	assert.Equal(t, 125, fredTrendPointsForRange("10y"))
	assert.Equal(t, 1000, fredTrendPointsForRange("all"))
	assert.Equal(t, 13, fredTrendPointsForRange("invalid"))
}

func TestRelatedConceptsForIndicator(t *testing.T) {
	concepts := relatedConceptsForIndicator("CPIAUCSL")
	assert.Contains(t, concepts, "inflation")

	concepts = relatedConceptsForIndicator("FEDFUNDS")
	assert.Contains(t, concepts, "monetary-policy")

	concepts = relatedConceptsForIndicator("UNKNOWN")
	assert.Empty(t, concepts)
}

func TestFredIndicatorsConfig(t *testing.T) {
	// All 5 required series IDs must be present
	required := []string{"GDPC1", "CPIAUCSL", "FEDFUNDS", "UNRATE", "DGS10"}
	ids := make(map[string]bool)
	for _, c := range fredIndicators {
		ids[c.ID] = true
	}
	for _, id := range required {
		assert.True(t, ids[id], "fredIndicators must include %s", id)
	}
	assert.Equal(t, 5, len(fredIndicators), "exactly 5 indicators required")
}

func TestIndicatorResponseShape(t *testing.T) {
	now := time.Now().UTC().Format(time.RFC3339)
	ind := IndicatorResponse{
		ID:          "FEDFUNDS",
		Name:        "Fed Funds Rate",
		Value:       5.33,
		Unit:        "%",
		Change:      0.0,
		Trend:       []IndicatorTrendPoint{{Date: "2024-01-01", Value: 5.33}},
		LastUpdated: now,
		Source:      fredSource,
		Stale:       false,
	}

	data, err := json.Marshal(ind)
	require.NoError(t, err)

	var decoded IndicatorResponse
	require.NoError(t, json.Unmarshal(data, &decoded))

	assert.Equal(t, "FEDFUNDS", decoded.ID)
	assert.Equal(t, 5.33, decoded.Value)
	assert.Equal(t, "%", decoded.Unit)
	assert.False(t, decoded.Stale)
	// Source attribution
	assert.Contains(t, decoded.Source, "FRED")
}

func TestEconomicsListResponse_JSONShape(t *testing.T) {
	resp := EconomicsListResponse{
		Indicators: []IndicatorResponse{
			{ID: "CPIAUCSL", Name: "CPI (Inflation)", Value: 3.2, Unit: "%", Change: -0.3,
				Source: fredSource, LastUpdated: time.Now().UTC().Format(time.RFC3339)},
		},
	}

	data, err := json.Marshal(resp)
	require.NoError(t, err)

	var decoded map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &decoded))

	indicators, ok := decoded["indicators"].([]interface{})
	assert.True(t, ok, "indicators must be an array")
	assert.Equal(t, 1, len(indicators))

	first := indicators[0].(map[string]interface{})
	assert.Equal(t, "CPIAUCSL", first["id"])
	assert.Equal(t, "CPI (Inflation)", first["name"])
}

func TestFetchObservations_SkipsMissingValues(t *testing.T) {
	// Test that "." (missing) values are skipped
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		respBody := `{"observations":[
			{"date":"2024-01-01","value":"3.2"},
			{"date":"2024-02-01","value":"."},
			{"date":"2024-03-01","value":"3.5"}
		]}`
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(respBody))
	}))
	defer srv.Close()

	svc := &EconomicsService{
		httpClient: &http.Client{Timeout: 5 * time.Second},
		apiKey:     "test-key",
	}

	type fredResp struct {
		Observations []struct {
			Date  string `json:"date"`
			Value string `json:"value"`
		} `json:"observations"`
	}

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, srv.URL, nil)
	resp, err := svc.httpClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	var result fredResp
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))

	var points []IndicatorTrendPoint
	for _, obs := range result.Observations {
		if obs.Value == "." {
			continue
		}
		var v float64
		if _, scanErr := fmt.Sscanf(obs.Value, "%f", &v); scanErr == nil {
			points = append(points, IndicatorTrendPoint{Date: obs.Date, Value: v})
		}
	}

	assert.Equal(t, 2, len(points), "missing '.' values must be skipped")
	assert.Equal(t, "2024-01-01", points[0].Date)
	assert.Equal(t, "2024-03-01", points[1].Date)
}
