package api

import (
	"net/http"
	"os"

	"github.com/CorithLabs/cent-cent-go/internal/handlers"
	"github.com/CorithLabs/cent-cent-go/internal/middleware"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NewRouter builds and returns the configured Gin engine.
func NewRouter(db *pgxpool.Pool) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// CORS — allow Vite dev server origin in development
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		AllowCredentials: false,
	}))

	// Health check — no auth, no rate limiting
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// ── API v1 ──────────────────────────────────────────────────────────────
	api := r.Group("/api")

	// Search — rate-limited to 60 req/min per IP
	searchHandler := handlers.NewSearchHandler(db)
	api.GET("/search", middleware.RateLimiter(), searchHandler.Search)

	// Stock endpoints
	stockHandler := handlers.NewStockHandler(db)
	api.GET("/stocks/:ticker", stockHandler.GetQuote)
	api.GET("/stocks/:ticker/history", stockHandler.GetHistory)
	api.GET("/stocks/:ticker/indicators", stockHandler.GetIndicators)
	api.GET("/stocks/:ticker/metrics", stockHandler.GetMetrics)
	api.GET("/stocks/:ticker/financials", stockHandler.GetFinancials)
	api.GET("/stocks/:ticker/eli5", stockHandler.GetELI5)
	api.GET("/stocks/quotes", stockHandler.GetBatchQuotes)

	// Economics endpoints
	econHandler := handlers.NewEconomicsHandler(db)
	api.GET("/economics", econHandler.ListIndicators)
	api.GET("/economics/:indicator", econHandler.GetIndicator)

	// Learn / concept articles
	// Content path is resolved relative to the server working directory.
	// In local dev: backend/ → ../content/learn
	// In production: content/learn (next to the binary)
	articlesDir := os.Getenv("LEARN_CONTENT_DIR")
	if articlesDir == "" {
		articlesDir = "../content/learn" // default: relative to backend/
	}
	learnHandler := handlers.NewLearnHandler(articlesDir)
	api.GET("/learn", learnHandler.List)
	api.GET("/learn/:slug", learnHandler.GetArticle)

	// Compare
	compareHandler := handlers.NewCompareHandler(db)
	api.GET("/compare", compareHandler.Compare)

	// Sectors
	sectorHandler := handlers.NewSectorHandler(db)
	api.GET("/sectors/heatmap", sectorHandler.GetHeatmap)

	return r
}
