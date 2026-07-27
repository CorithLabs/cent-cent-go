package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/CorithLabs/cent-cent-go/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// StockQuoteService fetches and caches stock quote data from Yahoo Finance.
type StockQuoteService struct {
	db *pgxpool.Pool
}

// NewStockQuoteService creates a new StockQuoteService.
func NewStockQuoteService(db *pgxpool.Pool) *StockQuoteService {
	return &StockQuoteService{db: db}
}

// GetQuote returns the current quote for a ticker.
// It first checks the PostgreSQL cache (60s TTL). On cache miss or expiry,
// it fetches from Polygon.io and updates the cache.
// If Polygon.io times out, the cached value is returned with stale=true.
func (s *StockQuoteService) GetQuote(ctx context.Context, ticker string) (*models.StockQuote, error) {
	ticker = strings.ToUpper(ticker)

	// Try cache first
	cached, err := s.getCached(ctx, ticker)
	if err == nil && cached != nil {
		age := time.Since(cached.LastUpdated)
		if age < 60*time.Second {
			return cached, nil
		}
		// Cache is stale — try to refresh, fall back to cached with stale=true
		fresh, fetchErr := s.fetchFromYahoo(ctx, ticker)
		if fetchErr != nil {
			cached.Stale = true
			return cached, nil
		}
		_ = s.upsertCache(ctx, fresh)
		return fresh, nil
	}

	// No cache — must fetch
	quote, err := s.fetchFromYahoo(ctx, ticker)
	if err != nil {
		return nil, err
	}
	_ = s.upsertCache(ctx, quote)
	return quote, nil
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

func (s *StockQuoteService) getCached(ctx context.Context, ticker string) (*models.StockQuote, error) {
	const q = `
		SELECT t.ticker, t.name, t.exchange, t.asset_type,
		       sq.price, sq.change, sq.change_pct, sq.market_cap,
		       sq.volume, sq.week52_high, sq.week52_low,
		       sq.status, sq.stale, sq.last_updated, sq.source
		FROM stock_quotes sq
		JOIN tickers t ON t.ticker = sq.ticker
		WHERE sq.ticker = $1`

	row := s.db.QueryRow(ctx, q, ticker)
	var quote models.StockQuote
	err := row.Scan(
		&quote.Ticker, &quote.Name, &quote.Exchange, // ignore asset_type
		new(string),
		&quote.Price, &quote.Change, &quote.ChangePct,
		&quote.MarketCap, &quote.Volume, &quote.Week52High, &quote.Week52Low,
		&quote.Status, &quote.Stale, &quote.LastUpdated, &quote.DataSource,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &quote, nil
}

func (s *StockQuoteService) upsertCache(ctx context.Context, q *models.StockQuote) error {
	// Upsert the ticker first (ignoring conflict if already present)
	_, err := s.db.Exec(ctx, `
		INSERT INTO tickers (ticker, name, exchange, asset_type, active, updated_at)
		VALUES ($1, $2, $3, 'CS', true, NOW())
		ON CONFLICT (ticker) DO UPDATE SET name=$2, exchange=$3, updated_at=NOW()`,
		q.Ticker, q.Name, q.Exchange)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(ctx, `
		INSERT INTO stock_quotes (ticker, price, change, change_pct, market_cap, volume,
		                          week52_high, week52_low, status, stale, last_updated, source)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (ticker) DO UPDATE SET
		  price=$2, change=$3, change_pct=$4, market_cap=$5, volume=$6,
		  week52_high=$7, week52_low=$8, status=$9, stale=$10,
		  last_updated=$11, source=$12`,
		q.Ticker, q.Price, q.Change, q.ChangePct, q.MarketCap, q.Volume,
		q.Week52High, q.Week52Low, q.Status, q.Stale, q.LastUpdated, q.DataSource)
	return err
}

// ── Yahoo Finance fetch ───────────────────────────────────────────────────────

func (s *StockQuoteService) fetchFromYahoo(ctx context.Context, ticker string) (*models.StockQuote, error) {
	quotes, err := getYahooClient().getQuotes(ctx, []string{yahooSymbol(ticker)})
	if err != nil {
		return nil, fmt.Errorf("yahoo quote: %w", err)
	}
	if len(quotes) == 0 || quotes[0].RegularMarketPrice == 0 {
		return nil, fmt.Errorf("ticker %s not found", ticker)
	}
	return yahooToStockQuote(ticker, quotes[0]), nil
}

// GetQuotes fetches quotes for multiple tickers in a single Yahoo request and
// caches each. Tickers Yahoo doesn't return are omitted from the map.
func (s *StockQuoteService) GetQuotes(ctx context.Context, tickers []string) (map[string]*models.StockQuote, error) {
	if len(tickers) == 0 {
		return map[string]*models.StockQuote{}, nil
	}
	symToTicker := make(map[string]string, len(tickers))
	syms := make([]string, 0, len(tickers))
	for _, t := range tickers {
		t = strings.ToUpper(t)
		ys := yahooSymbol(t)
		symToTicker[ys] = t
		syms = append(syms, ys)
	}
	quotes, err := getYahooClient().getQuotes(ctx, syms)
	if err != nil {
		return nil, err
	}
	out := make(map[string]*models.StockQuote, len(quotes))
	for _, q := range quotes {
		orig := symToTicker[strings.ToUpper(q.Symbol)]
		if orig == "" {
			orig = strings.ToUpper(q.Symbol)
		}
		sq := yahooToStockQuote(orig, q)
		out[orig] = sq
		_ = s.upsertCache(ctx, sq)
	}
	return out, nil
}

// yahooToStockQuote maps a Yahoo quote into the app's StockQuote model.
func yahooToStockQuote(ticker string, q yahooQuote) *models.StockQuote {
	name := q.LongName
	if name == "" {
		name = q.ShortName
	}
	if name == "" {
		name = ticker
	}
	exchange := q.FullExchangeName
	if exchange == "" {
		exchange = q.Exchange
	}
	return &models.StockQuote{
		Ticker:      ticker,
		Name:        name,
		Price:       q.RegularMarketPrice,
		Change:      q.RegularMarketChange,
		ChangePct:   q.RegularMarketChangePercent,
		MarketCap:   q.MarketCap,
		Volume:      q.RegularMarketVolume,
		Week52High:  q.FiftyTwoWeekHigh,
		Week52Low:   q.FiftyTwoWeekLow,
		Exchange:    exchange,
		LastUpdated: time.Now().UTC(),
		Status:      "active",
		Stale:       false,
		DataSource:  "yahoo",
	}
}

// IsNotFound checks if the error from GetQuote indicates the ticker doesn't exist.
func IsNotFound(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "not found")
}
