package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// LearnHandler handles /api/learn endpoints
type LearnHandler struct{}

// NewLearnHandler creates a new LearnHandler.
func NewLearnHandler() *LearnHandler {
	return &LearnHandler{}
}

// List handles GET /api/learn
func (h *LearnHandler) List(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}

// GetArticle handles GET /api/learn/:slug
func (h *LearnHandler) GetArticle(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not yet implemented"})
}
