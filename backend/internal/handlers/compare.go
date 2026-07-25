package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CompareHandler handles /api/compare
type CompareHandler struct {
	db *pgxpool.Pool
}

// NewCompareHandler creates a new CompareHandler.
func NewCompareHandler(db *pgxpool.Pool) *CompareHandler {
	return &CompareHandler{db: db}
}

// Compare handles GET /api/compare?tickers=AAPL,MSFT&range=1y
func (h *CompareHandler) Compare(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}
