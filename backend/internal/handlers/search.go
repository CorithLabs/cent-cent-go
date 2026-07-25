package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/CorithLabs/cent-cent-go/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SearchHandler handles GET /api/search
type SearchHandler struct {
	svc *services.SearchService
}

// NewSearchHandler creates a new SearchHandler backed by the given DB pool.
func NewSearchHandler(db *pgxpool.Pool) *SearchHandler {
	return &SearchHandler{svc: services.NewSearchService(db)}
}

// Search handles GET /api/search?q=&limit=
// Returns matching stocks ranked by relevance (exact ticker → prefix → substring).
// AC: Minimum query length of 1 character; returns 400 for empty string.
// AC: Rate limiting applied upstream via RateLimiter middleware.
func (h *SearchHandler) Search(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required (min 1 character)"})
		return
	}

	limit := 10
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}

	results, err := h.svc.Search(c.Request.Context(), q, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "search temporarily unavailable"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}
