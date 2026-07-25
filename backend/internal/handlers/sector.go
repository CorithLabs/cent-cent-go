package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SectorHandler handles /api/sectors endpoints
type SectorHandler struct {
	db *pgxpool.Pool
}

// NewSectorHandler creates a new SectorHandler.
func NewSectorHandler(db *pgxpool.Pool) *SectorHandler {
	return &SectorHandler{db: db}
}

// GetHeatmap handles GET /api/sectors/heatmap
func (h *SectorHandler) GetHeatmap(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}
