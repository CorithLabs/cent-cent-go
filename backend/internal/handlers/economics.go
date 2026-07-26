package handlers

import (
	"net/http"
	"strings"

	"github.com/CorithLabs/cent-cent-go/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EconomicsHandler handles /api/economics endpoints.
type EconomicsHandler struct {
	econSvc *services.EconomicsService
}

// NewEconomicsHandler creates a new EconomicsHandler.
func NewEconomicsHandler(db *pgxpool.Pool) *EconomicsHandler {
	return &EconomicsHandler{
		econSvc: services.NewEconomicsService(db),
	}
}

// ListIndicators handles GET /api/economics
// AC: Returns all tracked indicators with latest values.
// AC: FRED_API_KEY is read from env — never included in response.
// AC: Returns stale cached data with stale=true flag if FRED is unavailable.
func (h *EconomicsHandler) ListIndicators(c *gin.Context) {
	result, err := h.econSvc.ListIndicators(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch economic indicators",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetIndicator handles GET /api/economics/:indicator?range=1y|5y|10y|all
// AC: Returns full historical data for one indicator.
// AC: 404 for unknown indicator IDs.
func (h *EconomicsHandler) GetIndicator(c *gin.Context) {
	id := strings.ToUpper(c.Param("indicator"))
	rangeStr := c.DefaultQuery("range", "1y")

	// Validate range param
	validRanges := map[string]bool{"1y": true, "5y": true, "10y": true, "all": true}
	if !validRanges[rangeStr] {
		rangeStr = "1y"
	}

	result, err := h.econSvc.GetIndicator(c.Request.Context(), id, rangeStr)
	if err != nil {
		if services.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "indicator not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch indicator data",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}
