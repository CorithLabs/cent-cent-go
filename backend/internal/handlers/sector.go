package handlers

import (
	"net/http"

	"github.com/CorithLabs/cent-cent-go/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SectorHandler handles /api/sectors endpoints
type SectorHandler struct {
	sectorSvc *services.SectorService
}

// NewSectorHandler creates a new SectorHandler.
func NewSectorHandler(db *pgxpool.Pool) *SectorHandler {
	return &SectorHandler{
		sectorSvc: services.NewSectorService(db),
	}
}

// GetHeatmap handles GET /api/sectors/heatmap?period=1d|5d|1m
// AC: Returns pre-aggregated heatmap grouped by sector.
// AC: marketClosed=true flag when outside NYSE/NASDAQ trading hours.
// AC: incomplete=true when some tickers failed to fetch.
func (h *SectorHandler) GetHeatmap(c *gin.Context) {
	period := c.DefaultQuery("period", "1d")
	switch period {
	case "1d", "5d", "1m":
		// valid
	default:
		period = "1d"
	}

	result, err := h.sectorSvc.GetHeatmap(c.Request.Context(), period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch heatmap data",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}
