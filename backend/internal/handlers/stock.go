package handlers

import (
	"net/http"
	"strings"

	"github.com/CorithLabs/cent-cent-go/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// StockHandler handles /api/stocks/* endpoints
type StockHandler struct {
	quoteSvc *services.StockQuoteService
	db       *pgxpool.Pool
}

// NewStockHandler creates a new StockHandler.
func NewStockHandler(db *pgxpool.Pool) *StockHandler {
	return &StockHandler{
		quoteSvc: services.NewStockQuoteService(db),
		db:       db,
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

// GetHistory handles GET /api/stocks/:ticker/history
func (h *StockHandler) GetHistory(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}

// GetIndicators handles GET /api/stocks/:ticker/indicators
func (h *StockHandler) GetIndicators(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}

// GetMetrics handles GET /api/stocks/:ticker/metrics
func (h *StockHandler) GetMetrics(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
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
