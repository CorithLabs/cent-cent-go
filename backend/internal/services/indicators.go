package services

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// IndicatorDataPoint is a single computed indicator value aligned to a price timestamp.
type IndicatorDataPoint struct {
	Timestamp string   `json:"timestamp"`
	Value     *float64 `json:"value,omitempty"`
	Upper     *float64 `json:"upper,omitempty"`     // Bollinger upper band
	Lower     *float64 `json:"lower,omitempty"`     // Bollinger lower band
	Signal    *float64 `json:"signal,omitempty"`    // MACD signal line
	Histogram *float64 `json:"histogram,omitempty"` // MACD histogram
}

// IndicatorResult is the full response for /api/stocks/:ticker/indicators.
type IndicatorResult struct {
	Indicator string               `json:"indicator"`
	Period    int                  `json:"period,omitempty"`
	Data      []IndicatorDataPoint `json:"data"`
	Warning   string               `json:"warning,omitempty"`
}

// validIndicators is the set of supported indicator names.
var validIndicators = map[string]bool{
	"sma":      true,
	"ema":      true,
	"bollinger": true,
	"rsi":      true,
	"macd":     true,
}

// IsValidIndicator checks if the indicator name is supported.
func IsValidIndicator(name string) bool {
	return validIndicators[name]
}

// IndicatorService computes technical indicators from stored OHLCV data.
type IndicatorService struct {
	db *pgxpool.Pool
}

// NewIndicatorService creates a new IndicatorService.
func NewIndicatorService(db *pgxpool.Pool) *IndicatorService {
	return &IndicatorService{db: db}
}

// Compute calculates the requested indicator from the stored OHLCV data.
func (s *IndicatorService) Compute(ctx context.Context, ticker, indicator, rangeStr string, period int) (*IndicatorResult, error) {
	// Load closing prices from DB for the range
	closes, timestamps, err := s.loadCloses(ctx, ticker, rangeStr)
	if err != nil {
		return nil, fmt.Errorf("loading OHLCV data: %w", err)
	}

	switch indicator {
	case "sma":
		return computeSMA(timestamps, closes, period)
	case "ema":
		return computeEMA(timestamps, closes, period)
	case "bollinger":
		return computeBollinger(timestamps, closes, period)
	case "rsi":
		return computeRSI(timestamps, closes, period)
	case "macd":
		return computeMACD(timestamps, closes)
	default:
		return nil, fmt.Errorf("unsupported indicator: %s", indicator)
	}
}

// loadCloses fetches close prices and timestamps from the DB for the given range.
func (s *IndicatorService) loadCloses(ctx context.Context, ticker, rangeStr string) ([]float64, []string, error) {
	from := rangeStart(rangeStr)
	rows, err := s.db.Query(ctx, `
		SELECT ts, close
		FROM ohlcv_data
		WHERE ticker = $1 AND interval_key = '1d' AND ts >= $2
		ORDER BY ts ASC`,
		ticker, from)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var closes []float64
	var timestamps []string
	for rows.Next() {
		var ts time.Time
		var close float64
		if err := rows.Scan(&ts, &close); err != nil {
			return nil, nil, err
		}
		closes = append(closes, close)
		timestamps = append(timestamps, ts.UTC().Format(time.RFC3339))
	}
	return closes, timestamps, nil
}

// ── SMA ───────────────────────────────────────────────────────────────────────

func computeSMA(timestamps []string, closes []float64, period int) (*IndicatorResult, error) {
	n := len(closes)
	result := &IndicatorResult{Indicator: "sma", Period: period}

	if n < period {
		result.Warning = fmt.Sprintf("Insufficient data: only %d data points, need %d for SMA %d. Partial data returned.", n, period, period)
	}

	points := make([]IndicatorDataPoint, 0, n)
	for i := 0; i < n; i++ {
		point := IndicatorDataPoint{Timestamp: timestamps[i]}
		if i >= period-1 {
			sum := 0.0
			for j := i - period + 1; j <= i; j++ {
				sum += closes[j]
			}
			val := sum / float64(period)
			point.Value = &val
		}
		points = append(points, point)
	}

	result.Data = points
	return result, nil
}

// ── EMA ───────────────────────────────────────────────────────────────────────

func computeEMA(timestamps []string, closes []float64, period int) (*IndicatorResult, error) {
	n := len(closes)
	result := &IndicatorResult{Indicator: "ema", Period: period}

	if n < period {
		result.Warning = fmt.Sprintf("Insufficient data for EMA %d. Partial data returned.", period)
	}

	k := 2.0 / float64(period+1)
	points := make([]IndicatorDataPoint, n)
	var ema float64
	initialized := false

	for i := 0; i < n; i++ {
		points[i] = IndicatorDataPoint{Timestamp: timestamps[i]}
		if !initialized && i >= period-1 {
			// Seed EMA with SMA of first `period` values
			sum := 0.0
			for j := i - period + 1; j <= i; j++ {
				sum += closes[j]
			}
			ema = sum / float64(period)
			initialized = true
		} else if initialized {
			ema = closes[i]*k + ema*(1-k)
		}
		if initialized {
			val := ema
			points[i].Value = &val
		}
	}

	result.Data = points
	return result, nil
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────

func computeBollinger(timestamps []string, closes []float64, period int) (*IndicatorResult, error) {
	n := len(closes)
	result := &IndicatorResult{Indicator: "bollinger", Period: period}

	if n < period {
		result.Warning = fmt.Sprintf("Insufficient data for Bollinger Bands (%d). Partial data returned.", period)
	}

	const stdDevMultiplier = 2.0
	points := make([]IndicatorDataPoint, n)

	for i := 0; i < n; i++ {
		points[i] = IndicatorDataPoint{Timestamp: timestamps[i]}
		if i >= period-1 {
			// Mean
			sum := 0.0
			for j := i - period + 1; j <= i; j++ {
				sum += closes[j]
			}
			mean := sum / float64(period)

			// Std dev
			variance := 0.0
			for j := i - period + 1; j <= i; j++ {
				diff := closes[j] - mean
				variance += diff * diff
			}
			stdDev := math.Sqrt(variance / float64(period))

			upper := mean + stdDevMultiplier*stdDev
			lower := mean - stdDevMultiplier*stdDev
			points[i].Value = &mean
			points[i].Upper = &upper
			points[i].Lower = &lower
		}
	}

	result.Data = points
	return result, nil
}

// ── RSI ───────────────────────────────────────────────────────────────────────

func computeRSI(timestamps []string, closes []float64, period int) (*IndicatorResult, error) {
	n := len(closes)
	result := &IndicatorResult{Indicator: "rsi", Period: period}

	if n <= period {
		result.Warning = fmt.Sprintf("Insufficient data for RSI %d.", period)
		result.Data = make([]IndicatorDataPoint, n)
		for i, ts := range timestamps {
			result.Data[i] = IndicatorDataPoint{Timestamp: ts}
		}
		return result, nil
	}

	points := make([]IndicatorDataPoint, n)
	for i := range points {
		points[i] = IndicatorDataPoint{Timestamp: timestamps[i]}
	}

	// Initial average gain and loss over first `period` bars
	avgGain, avgLoss := 0.0, 0.0
	for i := 1; i <= period; i++ {
		change := closes[i] - closes[i-1]
		if change > 0 {
			avgGain += change
		} else {
			avgLoss -= change
		}
	}
	avgGain /= float64(period)
	avgLoss /= float64(period)

	rsi := 100.0 - (100.0 / (1.0 + avgGain/avgLoss))
	points[period].Value = &rsi

	// Smooth subsequent values
	for i := period + 1; i < n; i++ {
		change := closes[i] - closes[i-1]
		gain, loss := 0.0, 0.0
		if change > 0 {
			gain = change
		} else {
			loss = -change
		}
		avgGain = (avgGain*float64(period-1) + gain) / float64(period)
		avgLoss = (avgLoss*float64(period-1) + loss) / float64(period)

		if avgLoss == 0 {
			rsi = 100.0
		} else {
			rsi = 100.0 - (100.0 / (1.0 + avgGain/avgLoss))
		}
		v := rsi
		points[i].Value = &v
	}

	result.Data = points
	return result, nil
}

// ── MACD ─────────────────────────────────────────────────────────────────────

func computeMACD(timestamps []string, closes []float64) (*IndicatorResult, error) {
	// Standard MACD: 12-period EMA minus 26-period EMA; 9-period signal line
	const fast, slow, signal = 12, 26, 9

	result := &IndicatorResult{Indicator: "macd"}

	n := len(closes)
	if n < slow {
		result.Warning = "Insufficient data for MACD. Need at least 26 data points."
		result.Data = make([]IndicatorDataPoint, n)
		for i, ts := range timestamps {
			result.Data[i] = IndicatorDataPoint{Timestamp: ts}
		}
		return result, nil
	}

	// Compute fast EMA, slow EMA
	fastEMA := emaSlice(closes, fast)
	slowEMA := emaSlice(closes, slow)

	// MACD line = fast - slow (aligned to slower EMA start)
	macdLine := make([]float64, n)
	for i := slow - 1; i < n; i++ {
		macdLine[i] = fastEMA[i] - slowEMA[i]
	}

	// Signal line = 9-period EMA of MACD line (starting at index slow-1)
	macdValues := macdLine[slow-1:]
	signalSlice := emaSlice(macdValues, signal)

	points := make([]IndicatorDataPoint, n)
	for i, ts := range timestamps {
		points[i] = IndicatorDataPoint{Timestamp: ts}
		if i >= slow-1 {
			macdVal := macdLine[i]
			points[i].Value = &macdVal

			sigIdx := i - (slow - 1)
			if sigIdx >= signal-1 && sigIdx < len(signalSlice) {
				sigVal := signalSlice[sigIdx]
				histVal := macdVal - sigVal
				points[i].Signal = &sigVal
				points[i].Histogram = &histVal
			}
		}
	}

	result.Data = points
	return result, nil
}

// emaSlice computes an EMA over a slice of values, returns aligned slice of same length.
func emaSlice(values []float64, period int) []float64 {
	n := len(values)
	result := make([]float64, n)
	k := 2.0 / float64(period+1)

	// Seed with SMA of first `period` values
	sum := 0.0
	for i := 0; i < period && i < n; i++ {
		sum += values[i]
	}
	if n < period {
		return result
	}

	ema := sum / float64(period)
	result[period-1] = ema

	for i := period; i < n; i++ {
		ema = values[i]*k + ema*(1-k)
		result[i] = ema
	}

	return result
}
