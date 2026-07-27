import React from 'react';
import { Link } from 'react-router-dom';
import { useWatchlist } from '../hooks/useWatchlist';
import { useWatchlistQuotes, WatchlistQuote } from '../hooks/useWatchlistQuotes';
import { formatPrice, formatPct } from '../utils/formatters';
import './WatchlistPage.css';

// ── Quote row ─────────────────────────────────────────────────────────────────

interface WatchlistRowProps {
  quote: WatchlistQuote | undefined;
  ticker: string;
  onRemove: (ticker: string) => void;
}

const WatchlistRow: React.FC<WatchlistRowProps> = ({ quote, ticker, onRemove }) => {
  const isPositive = quote ? quote.changePct >= 0 : false;
  const isDelisted = quote?.delisted;

  return (
    <tr className="watchlist-row">
      <td className="watchlist-row__ticker">
        <Link to={`/stock/${ticker}`} className="watchlist-row__link">
          {ticker}
        </Link>
      </td>
      <td className="watchlist-row__price font-mono">
        {isDelisted ? (
          <span className="watchlist-row__delisted">Delisted</span>
        ) : quote ? (
          formatPrice(quote.price)
        ) : (
          <span className="watchlist-row__loading">—</span>
        )}
      </td>
      <td
        className={`watchlist-row__change font-mono ${
          quote && !isDelisted
            ? isPositive
              ? 'text-positive'
              : 'text-negative'
            : ''
        }`}
      >
        {quote && !isDelisted
          ? `${isPositive ? '+' : ''}${formatPct(quote.changePct)}`
          : '—'}
      </td>
      <td className="watchlist-row__updated">
        {quote?.lastUpdated
          ? new Date(quote.lastUpdated).toLocaleTimeString()
          : '—'}
      </td>
      <td className="watchlist-row__actions">
        <button
          className="watchlist-row__remove-btn"
          onClick={() => onRemove(ticker)}
          aria-label={`Remove ${ticker} from watchlist`}
        >
          Remove
        </button>
      </td>
    </tr>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * WatchlistPage — /watchlist
 *
 * AC: Shows all saved stocks with live mini-quotes (price, % change).
 * AC: Fetched from GET /api/stocks/quotes via useWatchlistQuotes.
 * AC: Stocks removed via remove button.
 * AC: Watchlist stored in localStorage (no account required).
 * AC: Delisted stock shows 'Delisted' badge.
 * AC: Empty watchlist shows 'Your watchlist is empty' CTA with search link.
 * AC: Watchlist limited to 50 stocks; warning shown at limit.
 */
const WatchlistPage: React.FC = () => {
  const { tickers, removeTicker, maxSize } = useWatchlist();
  const { quotes, isLoading, error } = useWatchlistQuotes(tickers);

  // Build a quote map for O(1) lookup
  const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));

  const isAtLimit = tickers.length >= maxSize;

  return (
    <main className="watchlist-page">
      <header className="watchlist-page__header">
        <h1 className="watchlist-page__title">My Watchlist</h1>
        <p className="watchlist-page__subtitle">
          Stocks you've saved for easy access. Stored locally — no account required.
        </p>
        {isAtLimit && (
          <p className="watchlist-page__limit-warning" role="alert">
            Watchlist is full ({maxSize} stocks). Remove a stock to add another.
          </p>
        )}
      </header>

      {/* Empty state */}
      {tickers.length === 0 && (
        <div className="watchlist-page__empty">
          <p className="watchlist-page__empty-text">Your watchlist is empty.</p>
          <Link to="/" className="watchlist-page__search-cta">
            🔍 Search for stocks to add →
          </Link>
        </div>
      )}

      {/* Loading state */}
      {tickers.length > 0 && isLoading && (
        <div className="watchlist-page__loading" aria-live="polite" aria-label="Loading quotes">
          <div className="watchlist-page__skeleton" aria-hidden="true" />
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <p className="watchlist-page__error" role="alert">{error}</p>
      )}

      {/* Watchlist table */}
      {tickers.length > 0 && !isLoading && (
        <div className="watchlist-page__table-wrapper">
          <table className="watchlist-page__table" aria-label="Watchlist stocks">
            <thead>
              <tr>
                <th scope="col">Ticker</th>
                <th scope="col">Price</th>
                <th scope="col">Change</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickers.map((ticker) => (
                <WatchlistRow
                  key={ticker}
                  ticker={ticker}
                  quote={quoteMap.get(ticker)}
                  onRemove={removeTicker}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="watchlist-page__disclaimer">
        Data is for informational purposes only and does not constitute financial advice.
        Watchlist data is stored locally in your browser.
      </p>
    </main>
  );
};

export default WatchlistPage;
