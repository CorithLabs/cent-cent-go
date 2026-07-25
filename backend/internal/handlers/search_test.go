package handlers_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/CorithLabs/cent-cent-go/internal/handlers"
	"github.com/CorithLabs/cent-cent-go/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupSearchRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// Pass nil db — SearchHandler falls back gracefully in tests
	// (SearchService uses a test-aware constructor in integration tests)
	h := handlers.NewSearchHandler(nil)
	r.GET("/api/search", middleware.RateLimiter(), h.Search)
	return r
}

func TestSearchHandler_EmptyQuery_Returns400(t *testing.T) {
	r := setupSearchRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/search?q=", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSearchHandler_MissingQuery_Returns400(t *testing.T) {
	r := setupSearchRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/search", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSearchHandler_WhitespaceOnly_Returns400(t *testing.T) {
	r := setupSearchRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/search?q=   ", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRateLimiter_ExceedsLimit_Returns429(t *testing.T) {
	// Set rate limit to 2 req/min for this test via env (not feasible to set env per test)
	// Instead, we fire 70 requests with the default 60 RPM to a single IP
	// and confirm the 61st gets 429.
	// Note: this is a unit test of the middleware — does not depend on Polygon.io.
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/search", middleware.RateLimiter(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"results": []interface{}{}})
	})

	var lastCode int
	for i := 0; i < 70; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/search?q=TEST", nil)
		req.RemoteAddr = "203.0.113.99:12345" // fixed test IP
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		lastCode = w.Code
	}

	// After 70 requests from the same IP, must have received at least one 429
	assert.Equal(t, http.StatusTooManyRequests, lastCode)
}

func TestRateLimiter_RetryAfterHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/search", middleware.RateLimiter(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"results": []interface{}{}})
	})

	var found429 bool
	for i := 0; i < 70; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/search?q=TEST", nil)
		req.RemoteAddr = "203.0.113.100:9999"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code == http.StatusTooManyRequests {
			retryAfter := w.Header().Get("Retry-After")
			require.NotEmpty(t, retryAfter, "Retry-After header must be set on 429 response")
			found429 = true
			break
		}
	}
	require.True(t, found429, "Expected to receive a 429 response after 60+ requests")
}

func TestRateLimiter_XForwardedFor(t *testing.T) {
	// Two different IPs via X-Forwarded-For should have independent rate limits
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/search", middleware.RateLimiter(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"results": []interface{}{}})
	})

	// Exhaust IP A
	for i := 0; i < 65; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/search?q=TEST", nil)
		req.Header.Set("X-Forwarded-For", "10.0.0.1")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
	}

	// IP B should still be allowed
	req := httptest.NewRequest(http.MethodGet, "/api/search?q=TEST", nil)
	req.Header.Set("X-Forwarded-For", "10.0.0.2")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code, "Different IP should not be rate-limited")
}
