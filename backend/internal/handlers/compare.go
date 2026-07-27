package handlers

import (
	"net/http"
	"strings"

	"github.com/CorithLabs/cent-cent-go/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CompareHandler handles /api/compare
type CompareHandler struct {
	compareSvc *services.CompareService
}

// NewCompareHandler creates a new CompareHandler.
func NewCompareHandler(db *pgxpool.Pool) *CompareHandler {
	return &CompareHandler{
		compareSvc: services.NewCompareService(db),
	}
}

// Compare handles GET /api/compare?tickers=AAPL,MSFT&range=1y
// AC: Returns 400 if fewer than 2 or more than 5 tickers are requested.
// AC: Unknown tickers omitted from response with warnings array.
// AC: Normalized price history computed server-side.
func (h *CompareHandler) Compare(c *gin.Context) {
	tickersParam := c.Query("tickers")
	if tickersParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "tickers query parameter is required (comma-separated, 2–5 tickers)",
		})
		return
	}

	// Parse and validate tickers
	rawTickers := strings.Split(tickersParam, ",")
	var tickers []string
	for _, t := range rawTickers {
		t = strings.TrimSpace(strings.ToUpper(t))
		if t != "" {
			tickers = append(tickers, t)
		}
	}

	if len(tickers) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "at least 2 tickers are required for comparison",
		})
		return
	}
	if len(tickers) > 5 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "maximum 5 tickers allowed for comparison",
		})
		return
	}

	rangeStr := c.DefaultQuery("range", "1y")

	result, err := h.compareSvc.Compare(c.Request.Context(), tickers, rangeStr)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "at least 2 tickers") ||
			strings.Contains(errMsg, "maximum 5 tickers") ||
			strings.Contains(errMsg, "insufficient valid") {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch comparison data",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}
