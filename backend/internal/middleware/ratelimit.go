package middleware

import (
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// ipLimiter holds per-IP rate limiters and their last-seen time for cleanup.
type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var (
	mu       sync.Mutex
	limiters = make(map[string]*ipLimiter)
)

// getLimiter returns (or creates) a rate.Limiter for the given IP address.
func getLimiter(ip string, r rate.Limit, burst int) *rate.Limiter {
	mu.Lock()
	defer mu.Unlock()

	if il, exists := limiters[ip]; exists {
		il.lastSeen = time.Now()
		return il.limiter
	}

	l := rate.NewLimiter(r, burst)
	limiters[ip] = &ipLimiter{limiter: l, lastSeen: time.Now()}
	return l
}

// cleanupLimiters removes stale IP entries (older than 5 minutes).
func init() {
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			mu.Lock()
			for ip, il := range limiters {
				if time.Since(il.lastSeen) > 5*time.Minute {
					delete(limiters, ip)
				}
			}
			mu.Unlock()
		}
	}()
}

// RateLimiter returns a Gin middleware that limits requests per IP.
// Reads RATE_LIMIT_RPM (default: 60) and RATE_LIMIT_WINDOW (default: 60s).
// Respects X-Forwarded-For for reverse proxy deployments.
// Returns 429 with Retry-After header when limit is exceeded.
func RateLimiter() gin.HandlerFunc {
	rpm := 60
	if v := os.Getenv("RATE_LIMIT_RPM"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			rpm = n
		}
	}

	// tokens per second = RPM / 60
	ratePerSec := rate.Limit(float64(rpm) / 60.0)
	burst := rpm // allow up to rpm tokens in a burst

	return func(c *gin.Context) {
		// Prefer X-Forwarded-For (set by load balancers / proxies)
		ip := c.GetHeader("X-Forwarded-For")
		if ip == "" {
			ip = c.ClientIP()
		}

		l := getLimiter(ip, ratePerSec, burst)
		if !l.Allow() {
			retryAfter := int(time.Minute.Seconds())
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retryAfter":  retryAfter,
			})
			return
		}

		c.Next()
	}
}
