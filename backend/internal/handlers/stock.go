package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// StockHandler handles /api/stocks/* endpoints
type StockHandler struct {
	db *pgxpool.Pool
}

// NewStockHandler creates a new StockHandler.
func NewStockHandler(db *pgxpool.Pool) *StockHandler {
	return &StockHandler{db: db}
}

// GetQuote handles GET /api/stocks/:ticker
func (h *StockHandler) GetQuote(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
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
