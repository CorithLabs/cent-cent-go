package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EconomicsHandler handles /api/economics endpoints
type EconomicsHandler struct {
	db *pgxpool.Pool
}

// NewEconomicsHandler creates a new EconomicsHandler.
func NewEconomicsHandler(db *pgxpool.Pool) *EconomicsHandler {
	return &EconomicsHandler{db: db}
}

// ListIndicators handles GET /api/economics
func (h *EconomicsHandler) ListIndicators(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}

// GetIndicator handles GET /api/economics/:indicator
func (h *EconomicsHandler) GetIndicator(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}
