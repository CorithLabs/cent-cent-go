package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ── Yahoo Finance client ───────────────────────────────────────────────────────
//
// Yahoo has no official public API; these are its unofficial JSON endpoints:
//   - /v8/finance/chart/{symbol}  — OHLCV history + a quote meta block (UA only)
//   - /v7/finance/quote?symbols=  — batch quotes (requires a cookie + crumb pair)
//
// The client lazily obtains the cookie+crumb and caches it, refreshing on auth
// failure. A browser-like User-Agent is required or Yahoo rejects the request.

const yahooUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

type yahooClient struct {
	http  *http.Client
	mu    sync.Mutex
	crumb string
}

var (
	sharedYahoo     *yahooClient
	sharedYahooOnce sync.Once
)

// getYahooClient returns the process-wide Yahoo client (shared cookie jar + crumb).
func getYahooClient() *yahooClient {
	sharedYahooOnce.Do(func() {
		jar, _ := cookiejar.New(nil)
		sharedYahoo = &yahooClient{
			http: &http.Client{Timeout: 12 * time.Second, Jar: jar},
		}
	})
	return sharedYahoo
}

// yahooSymbol normalizes a ticker to Yahoo's format (e.g. BRK.B → BRK-B).
func yahooSymbol(ticker string) string {
	return strings.ReplaceAll(strings.ToUpper(ticker), ".", "-")
}

func (y *yahooClient) newRequest(ctx context.Context, rawURL string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", yahooUA)
	// Note: do NOT force Accept: application/json — the getcrumb endpoint returns
	// plain text and answers a JSON Accept header with 406 Not Acceptable.
	req.Header.Set("Accept", "*/*")
	return req, nil
}

// ensureCrumb returns a cached crumb, obtaining one (cookie + crumb) if needed.
func (y *yahooClient) ensureCrumb(ctx context.Context) (string, error) {
	y.mu.Lock()
	defer y.mu.Unlock()
	if y.crumb != "" {
		return y.crumb, nil
	}
	// Priming request sets the A3 cookie in the jar (fc.yahoo.com 404s but still
	// sets the cookie — that's expected and fine).
	if req, err := y.newRequest(ctx, "https://fc.yahoo.com/"); err == nil {
		if resp, derr := y.http.Do(req); derr == nil {
			resp.Body.Close()
		}
	}
	req, err := y.newRequest(ctx, "https://query1.finance.yahoo.com/v1/test/getcrumb")
	if err != nil {
		return "", err
	}
	resp, err := y.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	crumb := strings.TrimSpace(string(b))
	// A valid crumb is a short opaque token; reject empty or error-page bodies.
	if crumb == "" || len(crumb) > 40 || strings.ContainsAny(crumb, "<{ ") {
		return "", fmt.Errorf("yahoo: could not obtain crumb (got %d bytes)", len(crumb))
	}
	y.crumb = crumb
	return crumb, nil
}

func (y *yahooClient) resetCrumb() {
	y.mu.Lock()
	y.crumb = ""
	y.mu.Unlock()
}

// ── Quotes (v7 batch) ──────────────────────────────────────────────────────────

type yahooQuote struct {
	Symbol                     string  `json:"symbol"`
	ShortName                  string  `json:"shortName"`
	LongName                   string  `json:"longName"`
	QuoteType                  string  `json:"quoteType"`
	Currency                   string  `json:"currency"`
	MarketState                string  `json:"marketState"`
	FullExchangeName           string  `json:"fullExchangeName"`
	Exchange                   string  `json:"exchange"`
	RegularMarketPrice         float64 `json:"regularMarketPrice"`
	RegularMarketChange        float64 `json:"regularMarketChange"`
	RegularMarketChangePercent float64 `json:"regularMarketChangePercent"`
	RegularMarketVolume        int64   `json:"regularMarketVolume"`
	RegularMarketTime          int64   `json:"regularMarketTime"`
	MarketCap                  int64   `json:"marketCap"`
	FiftyTwoWeekHigh           float64 `json:"fiftyTwoWeekHigh"`
	FiftyTwoWeekLow            float64 `json:"fiftyTwoWeekLow"`
}

// getQuotes fetches quotes for one or more symbols in a single request.
func (y *yahooClient) getQuotes(ctx context.Context, symbols []string) ([]yahooQuote, error) {
	if len(symbols) == 0 {
		return nil, nil
	}
	quotes, err := y.doQuotes(ctx, symbols)
	if err != nil {
		// The crumb may have expired — reset and retry once.
		y.resetCrumb()
		return y.doQuotes(ctx, symbols)
	}
	return quotes, nil
}

func (y *yahooClient) doQuotes(ctx context.Context, symbols []string) ([]yahooQuote, error) {
	crumb, err := y.ensureCrumb(ctx)
	if err != nil {
		return nil, err
	}
	joined := strings.Join(symbols, ",")
	rawURL := fmt.Sprintf(
		"https://query1.finance.yahoo.com/v7/finance/quote?symbols=%s&crumb=%s",
		url.QueryEscape(joined), url.QueryEscape(crumb),
	)
	req, err := y.newRequest(ctx, rawURL)
	if err != nil {
		return nil, err
	}
	resp, err := y.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("yahoo quote request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("yahoo quote auth failed: %d", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yahoo quote returned %d", resp.StatusCode)
	}
	var parsed struct {
		QuoteResponse struct {
			Result []yahooQuote    `json:"result"`
			Error  json.RawMessage `json:"error"`
		} `json:"quoteResponse"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	return parsed.QuoteResponse.Result, nil
}

// ── Chart (v8, OHLCV history) ──────────────────────────────────────────────────

type yahooChart struct {
	Meta struct {
		Symbol             string  `json:"symbol"`
		Currency           string  `json:"currency"`
		ExchangeName       string  `json:"exchangeName"`
		FullExchangeName   string  `json:"fullExchangeName"`
		InstrumentType     string  `json:"instrumentType"`
		RegularMarketPrice float64 `json:"regularMarketPrice"`
		ChartPreviousClose float64 `json:"chartPreviousClose"`
		PreviousClose      float64 `json:"previousClose"`
		RegularMarketTime  int64   `json:"regularMarketTime"`
	} `json:"meta"`
	Timestamps []int64 `json:"timestamp"`
	Indicators struct {
		Quote []struct {
			Open   []float64 `json:"open"`
			High   []float64 `json:"high"`
			Low    []float64 `json:"low"`
			Close  []float64 `json:"close"`
			Volume []int64   `json:"volume"`
		} `json:"quote"`
	} `json:"indicators"`
}

// getChart fetches OHLCV data for a symbol over a Yahoo range/interval.
func (y *yahooClient) getChart(ctx context.Context, symbol, yRange, yInterval string) (*yahooChart, error) {
	rawURL := fmt.Sprintf(
		"https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=%s",
		url.PathEscape(symbol), url.QueryEscape(yRange), url.QueryEscape(yInterval),
	)
	req, err := y.newRequest(ctx, rawURL)
	if err != nil {
		return nil, err
	}
	resp, err := y.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("yahoo chart request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("ticker %s not found", symbol)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yahoo chart returned %d", resp.StatusCode)
	}
	var parsed struct {
		Chart struct {
			Result []yahooChart `json:"result"`
			Error  json.RawMessage `json:"error"`
		} `json:"chart"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if len(parsed.Chart.Result) == 0 {
		return nil, fmt.Errorf("ticker %s not found", symbol)
	}
	return &parsed.Chart.Result[0], nil
}
