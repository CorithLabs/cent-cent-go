package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestIsValidRangeInterval(t *testing.T) {
	tests := []struct {
		rangeStr string
		interval string
		valid    bool
	}{
		{"1d", "5m", true},
		{"1d", "1m", true},
		{"1d", "1d", false}, // daily interval not valid for intraday range
		{"5y", "1d", true},
		{"5y", "1m", false}, // 1min bars for 5y = too many points, not allowed
		{"6m", "1d", true},
		{"unknown", "1d", false},
	}

	for _, tt := range tests {
		t.Run(tt.rangeStr+"_"+tt.interval, func(t *testing.T) {
			result := IsValidRangeInterval(tt.rangeStr, tt.interval)
			assert.Equal(t, tt.valid, result)
		})
	}
}

func TestRangeStart_ReturnsCorrectDates(t *testing.T) {
	now := time.Now().UTC()

	t.Run("1d returns ~yesterday", func(t *testing.T) {
		start := rangeStart("1d")
		diff := now.Sub(start)
		assert.True(t, diff >= 23*time.Hour && diff <= 25*time.Hour,
			"1d range should start ~1 day ago, got %v", diff)
	})

	t.Run("5y returns ~5 years ago", func(t *testing.T) {
		start := rangeStart("5y")
		diff := now.Sub(start)
		// ~5 years = 1826 days, allow a few days tolerance
		expectedDays := float64(diff.Hours() / 24)
		assert.InDelta(t, 1826, expectedDays, 5)
	})

	t.Run("unknown range defaults to 1 month", func(t *testing.T) {
		start := rangeStart("unknown")
		diff := now.Sub(start)
		assert.True(t, diff >= 29*24*time.Hour && diff <= 32*24*time.Hour)
	})
}

func TestParseDuration(t *testing.T) {
	assert.Equal(t, time.Minute, parseDuration("1m"))
	assert.Equal(t, 5*time.Minute, parseDuration("5m"))
	assert.Equal(t, time.Hour, parseDuration("1h"))
	assert.Equal(t, 24*time.Hour, parseDuration("1d"))
	assert.Equal(t, 24*time.Hour, parseDuration("unknown"))
}

func TestIntervalToPolygon(t *testing.T) {
	mul, span := intervalToPolygon("5m")
	assert.Equal(t, 5, mul)
	assert.Equal(t, "minute", span)

	mul, span = intervalToPolygon("1d")
	assert.Equal(t, 1, mul)
	assert.Equal(t, "day", span)

	mul, span = intervalToPolygon("1h")
	assert.Equal(t, 1, mul)
	assert.Equal(t, "hour", span)
}
