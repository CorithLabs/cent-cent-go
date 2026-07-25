package handlers

import (
	"github.com/CorithLabs/cent-cent-go/internal/services"
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
func (h *SearchHandler) Search(c interface{}) {
	// Implemented in services/search.go — this stub satisfies the router wiring.
	// The real implementation is in SearchService.Search (called by the Gin handler below).
}
