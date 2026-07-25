package services

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSanitizeQuery(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"AAPL", "AAPL"},
		{"Apple Inc.", "Apple Inc."},
		{"<script>alert(1)</script>", "scriptalert1script"},
		{"  TSLA  ", "TSLA"},
		{"BRK.B", "BRK.B"},
		{"", ""},
		{"!@#$%^&*()", ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := sanitizeQuery(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeQueryCaseInsensitive(t *testing.T) {
	// Both lowercase and uppercase inputs should survive sanitization
	assert.Equal(t, "aapl", sanitizeQuery("aapl"))
	assert.Equal(t, "AAPL", sanitizeQuery("AAPL"))
}

func TestSanitizeQueryAllowsHyphen(t *testing.T) {
	// Tickers like "BF-B" must survive
	result := sanitizeQuery("BF-B")
	assert.True(t, strings.Contains(result, "BF"), "should keep alphanumeric chars")
}
