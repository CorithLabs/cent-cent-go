package handlers

import (
	"net/http"

	"github.com/CorithLabs/cent-cent-go/internal/services"
	"github.com/gin-gonic/gin"
)

// LearnHandler handles /api/learn endpoints.
type LearnHandler struct {
	learnSvc *services.LearnService
}

// NewLearnHandler creates a new LearnHandler.
// articlesDir is the path to the /content/learn directory (relative to working dir).
func NewLearnHandler(articlesDir string) *LearnHandler {
	return &LearnHandler{
		learnSvc: services.NewLearnService(articlesDir),
	}
}

// List handles GET /api/learn
// AC: Returns all article cards (slug, title, summary, tags, readTime).
func (h *LearnHandler) List(c *gin.Context) {
	result := h.learnSvc.ListArticles()
	c.JSON(http.StatusOK, result)
}

// GetArticle handles GET /api/learn/:slug
// AC: Returns 404 for unknown slugs.
// AC: Returns full article with sections, relatedSlugs, tags.
func (h *LearnHandler) GetArticle(c *gin.Context) {
	slug := c.Param("slug")

	article, err := h.learnSvc.GetArticle(slug)
	if err != nil {
		if services.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to load article",
		})
		return
	}

	c.JSON(http.StatusOK, article)
}
