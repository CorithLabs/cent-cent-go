package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/CorithLabs/cent-cent-go/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// StockHandler handles /api/stocks/* endpoints
type StockHandler struct {
	quoteSvc     *services.StockQuoteService
	ohlcvSvc     *services.OHLCVService
	indicatorSvc *services.IndicatorService
	metricsSvc   *services.MetricsService
	db           *pgxpool.Pool
}

// NewStockHandler creates a new StockHandler.
func NewStockHandler(db *pgxpool.Pool) *StockHandler {
	return &StockHandler{
		quoteSvc:     services.NewStockQuoteService(db),
		ohlcvSvc:     services.NewOHLCVService(db),
		indicatorSvc: services.NewIndicatorService(db),
		metricsSvc:   services.NewMetricsService(db),
		db:           db,
	}
}

// GetQuote handles GET /api/stocks/:ticker
// AC: Returns full quote object with lastUpdated ISO timestamp.
// AC: Returns 404 for unknown ticker symbols.
// AC: POLYGON_API_KEY is read from env — never in response body.
func (h *StockHandler) GetQuote(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	if ticker == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ticker is required"})
		return
	}

	quote, err := h.quoteSvc.GetQuote(c.Request.Context(), ticker)
	if err != nil {
		if services.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "ticker not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch stock data"})
		return
	}

	if quote == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticker not found"})
		return
	}

	c.JSON(http.StatusOK, quote)
}

// GetHistory handles GET /api/stocks/:ticker/history?range=&interval=
// AC: Returns 400 for invalid range/interval combinations (e.g. 5Y with 1m interval).
// AC: Response includes dataSource and lastUpdated.
// AC: Gaps in data (weekends/holidays) represented as missing entries, not zeros.
func (h *StockHandler) GetHistory(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	rangeStr := c.DefaultQuery("range", "1m")
	interval := c.DefaultQuery("interval", "1d")

	if !services.IsValidRangeInterval(rangeStr, interval) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid range/interval combination — e.g. 5y with 1m interval is not supported",
		})
		return
	}

	result, err := h.ohlcvSvc.GetHistory(c.Request.Context(), ticker, rangeStr, interval)
	if err != nil {
		if services.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "ticker not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch price history"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetIndicators handles GET /api/stocks/:ticker/indicators?indicator=&period=&range=
// AC: Computes SMA, EMA, Bollinger, RSI, MACD server-side from stored OHLCV data.
// AC: Returns 400 for unsupported indicator names.
// AC: Insufficient data returns partial results with a warning field.
func (h *StockHandler) GetIndicators(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))
	indicator := strings.ToLower(c.Query("indicator"))
	rangeStr := c.DefaultQuery("range", "1y")

	if !services.IsValidIndicator(indicator) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "unsupported indicator — valid values: sma, ema, bollinger, rsi, macd",
		})
		return
	}

	period := 20 // sensible default
	if p := c.Query("period"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 && n <= 500 {
			period = n
		}
	}

	result, err := h.indicatorSvc.Compute(c.Request.Context(), ticker, indicator, rangeStr, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetMetrics handles GET /api/stocks/:ticker/metrics
// AC: Returns ticker, fiscalPeriod, lastUpdated, and metrics object.
// AC: Returns 404 for unknown tickers.
// AC: Fiscal period and lastUpdated shown on every metric card.
func (h *StockHandler) GetMetrics(c *gin.Context) {
	ticker := strings.ToUpper(c.Param("ticker"))

	result, err := h.metricsSvc.GetMetrics(c.Request.Context(), ticker)
	if err != nil {
		if services.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "ticker not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch metrics"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetFinancials handles GET /api/stocks/:ticker/financials
func (h *StockHandler) GetFinancials(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}

// GetELI5 handles GET /api/stocks/:ticker/eli5
func (h *StockHandler) GetELI5(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}

// GetBatchQuotes handles GET /api/stocks/quotes?tickers=
func (h *StockHandler) GetBatchQuotes(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}
