package services

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── Test helpers ──────────────────────────────────────────────────────────────

func makeTimestamps(n int) []string {
	ts := make([]string, n)
	for i := range ts {
		ts[i] = "2024-01-01T00:00:00Z"
	}
	return ts
}

func assertClose(t *testing.T, expected, actual float64, msg string) {
	t.Helper()
	assert.InDelta(t, expected, actual, 0.001, msg)
}

// ── SMA tests ─────────────────────────────────────────────────────────────────

func TestComputeSMA_KnownValues(t *testing.T) {
	closes := []float64{10, 20, 30, 40, 50}
	ts := makeTimestamps(5)
	result, err := computeSMA(ts, closes, 3)
	require.NoError(t, err)
	assert.Len(t, result.Data, 5)

	// SMA(3) for index 2: (10+20+30)/3 = 20
	require.NotNil(t, result.Data[2].Value)
	assertClose(t, 20.0, *result.Data[2].Value, "SMA(3) at index 2")

	// SMA(3) for index 4: (30+40+50)/3 = 40
	require.NotNil(t, result.Data[4].Value)
	assertClose(t, 40.0, *result.Data[4].Value, "SMA(3) at index 4")

	// Before period — no value
	assert.Nil(t, result.Data[0].Value, "SMA not available before first full period")
}

func TestComputeSMA_InsufficientData_HasWarning(t *testing.T) {
	closes := []float64{100, 200} // only 2 points, SMA 200 needs 200
	ts := makeTimestamps(2)
	result, err := computeSMA(ts, closes, 200)
	require.NoError(t, err)
	assert.NotEmpty(t, result.Warning)
}

// ── EMA tests ─────────────────────────────────────────────────────────────────

func TestComputeEMA_Monotonic(t *testing.T) {
	// A monotonically increasing series — EMA should also increase
	closes := make([]float64, 30)
	for i := range closes {
		closes[i] = float64(i + 1)
	}
	ts := makeTimestamps(30)
	result, err := computeEMA(ts, closes, 10)
	require.NoError(t, err)

	// All EMA values after seeding should be non-nil
	var last float64
	for i, p := range result.Data {
		if i < 9 {
			assert.Nil(t, p.Value)
			continue
		}
		require.NotNil(t, p.Value)
		if i > 9 {
			assert.Greater(t, *p.Value, last, "EMA should increase for increasing inputs")
		}
		last = *p.Value
	}
}

// ── Bollinger Bands tests ─────────────────────────────────────────────────────

func TestComputeBollinger_UpperGreaterThanLower(t *testing.T) {
	closes := []float64{
		100, 102, 101, 103, 104, 102, 105, 107, 106, 108,
		110, 109, 111, 112, 110, 113, 115, 114, 116, 118,
	}
	ts := makeTimestamps(20)
	result, err := computeBollinger(ts, closes, 10)
	require.NoError(t, err)

	for _, p := range result.Data {
		if p.Upper == nil {
			continue
		}
		assert.Greater(t, *p.Upper, *p.Lower, "Upper band must be greater than lower band")
		assert.NotNil(t, p.Value, "Middle band (SMA) must be set")
	}
}

func TestComputeBollinger_ConstantSeries_BandsEqual(t *testing.T) {
	// If all prices are the same, std dev = 0, so upper = lower = middle
	closes := make([]float64, 20)
	for i := range closes {
		closes[i] = 100.0
	}
	ts := makeTimestamps(20)
	result, err := computeBollinger(ts, closes, 10)
	require.NoError(t, err)

	for _, p := range result.Data {
		if p.Upper == nil {
			continue
		}
		assert.InDelta(t, *p.Upper, *p.Lower, 0.0001)
		assert.InDelta(t, 100.0, *p.Value, 0.0001)
	}
}

// ── RSI tests ─────────────────────────────────────────────────────────────────

func TestComputeRSI_AllGains_RSI100(t *testing.T) {
	// Monotonically increasing prices — RSI should approach 100
	closes := make([]float64, 20)
	for i := range closes {
		closes[i] = float64(100 + i)
	}
	ts := makeTimestamps(20)
	result, err := computeRSI(ts, closes, 14)
	require.NoError(t, err)

	last := result.Data[len(result.Data)-1]
	require.NotNil(t, last.Value)
	// Should be very high — close to 100
	assert.Greater(t, *last.Value, 90.0)
	assert.LessOrEqual(t, *last.Value, 100.0)
}

func TestComputeRSI_AllLosses_RSI0(t *testing.T) {
	// Monotonically decreasing — RSI should approach 0
	closes := make([]float64, 20)
	for i := range closes {
		closes[i] = float64(100 - i)
	}
	ts := makeTimestamps(20)
	result, err := computeRSI(ts, closes, 14)
	require.NoError(t, err)

	last := result.Data[len(result.Data)-1]
	require.NotNil(t, last.Value)
	assert.Less(t, *last.Value, 10.0)
	assert.GreaterOrEqual(t, *last.Value, 0.0)
}

// ── MACD tests ────────────────────────────────────────────────────────────────

func TestComputeMACD_ProducesValues(t *testing.T) {
	closes := make([]float64, 40)
	for i := range closes {
		closes[i] = 100 + math.Sin(float64(i)*0.3)*10
	}
	ts := makeTimestamps(40)
	result, err := computeMACD(ts, closes)
	require.NoError(t, err)

	// At least some data points should have a MACD value after index 26
	hasValue := false
	for _, p := range result.Data[26:] {
		if p.Value != nil {
			hasValue = true
			break
		}
	}
	assert.True(t, hasValue, "MACD should produce values after the slow EMA period")
}

func TestComputeMACD_InsufficientData_HasWarning(t *testing.T) {
	closes := []float64{100, 102, 101}
	ts := makeTimestamps(3)
	result, err := computeMACD(ts, closes)
	require.NoError(t, err)
	assert.NotEmpty(t, result.Warning)
}

// ── IsValidIndicator ──────────────────────────────────────────────────────────

func TestIsValidIndicator(t *testing.T) {
	assert.True(t, IsValidIndicator("sma"))
	assert.True(t, IsValidIndicator("ema"))
	assert.True(t, IsValidIndicator("bollinger"))
	assert.True(t, IsValidIndicator("rsi"))
	assert.True(t, IsValidIndicator("macd"))
	assert.False(t, IsValidIndicator("stochastic"))
	assert.False(t, IsValidIndicator(""))
	assert.False(t, IsValidIndicator("SMA")) // case-sensitive
}
