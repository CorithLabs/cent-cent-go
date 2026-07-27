import React, { useState, lazy, Suspense, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useStockQuote } from '../hooks/useStockQuote';
import { useWatchlist } from '../hooks/useWatchlist';
import { StockOverviewHeader } from '../components/StockOverviewHeader/StockOverviewHeader';
import { formatPrice, formatPct } from '../utils/formatters';
import './StockDetailPage.css';

// Lazy-load tab panels to avoid loading all data upfront
const PriceChart = lazy(() => import('../components/PriceChart/PriceChart'));
const ELI5Panel  = lazy(() => import('../components/ELI5Panel/ELI5Panel'));
const FinancialsPanel = lazy(() => import('./StockDetailFinancialsPanel'));

type TabKey = 'overview' | 'chart' | 'financials' | 'eli5';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',   label: 'Overview'   },
  { key: 'chart',      label: 'Chart'      },
  { key: 'financials', label: 'Financials' },
  { key: 'eli5',       label: 'ELI5'       },
];

/**
 * StockDetailPage — /stock/:ticker
 *
 * AC: Sticky compact header (≤72px) — ticker, price, % change always visible.
 * AC: Sticky tab bar directly below header.
 * AC: Tab state in ?tab= URL param — shareable and refresh-safe.
 * AC: Overview: StockOverviewHeader (full metrics) + collapsible ELI5Panel.
 * AC: Lazy-rendered panels — data already fetched is not re-fetched on tab switch.
 * AC: Page bg --color-bg-primary; cards --color-bg-surface + --shadow-card.
 * AC: 'Add to Watchlist' button shown on every stock detail page.
 * AC: Watchlist limited to 50 stocks; warning shown at limit.
 */
const StockDetailPage: React.FC = () => {
  const { ticker = '' } = useParams<{ ticker: string }>();
  const normalizedTicker = ticker.toUpperCase();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') ?? 'overview') as TabKey;

  const [mountedTabs, setMountedTabs] = useState<Set<TabKey>>(new Set(['overview']));
  const [eli5Expanded, setEli5Expanded] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);

  const { quote, isLoading, error, notFound } = useStockQuote(normalizedTicker);
  const { addTicker, removeTicker, isWatching } = useWatchlist();

  const watching = isWatching(normalizedTicker);

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      setSearchParams({ tab }, { replace: true });
      setMountedTabs((prev) => {
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
    },
    [setSearchParams],
  );

  const handleWatchlistToggle = () => {
    if (watching) {
      removeTicker(normalizedTicker);
      setWatchlistMessage(`${normalizedTicker} removed from watchlist.`);
    } else {
      const result = addTicker(normalizedTicker);
      if (result === 'limit_exceeded') {
        setWatchlistMessage('Watchlist is full (50 stocks). Remove one to add another.');
      } else if (result === 'added') {
        setWatchlistMessage(`${normalizedTicker} added to watchlist.`);
      }
    }
    setTimeout(() => setWatchlistMessage(null), 3000);
  };

  // ── Error states ──────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <div className="stock-detail__not-found" role="alert">
        <h1>Stock not found</h1>
        <p>
          <strong>{normalizedTicker}</strong> is not a recognized ticker symbol.
        </p>
        <Link to="/" className="stock-detail__back-link">
          ← Search for another stock
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="stock-detail__loading" aria-busy="true" aria-label="Loading stock data">
        <div className="stock-detail__skeleton" />
        <div className="stock-detail__skeleton stock-detail__skeleton--short" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="stock-detail__error" role="alert">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  if (!quote) return null;

  const isPositive = quote.change >= 0;

  return (
    <div className="stock-detail">
      {/* ── Sticky compact header ─────────────────────────────────────── */}
      <header className="stock-detail__sticky-header" aria-label="Stock summary">
        <div className="stock-detail__sticky-inner">
          <span className="stock-detail__sticky-ticker">{quote.ticker}</span>
          <span
            className={`stock-detail__sticky-price font-mono ${
              isPositive ? 'text-positive' : 'text-negative'
            }`}
            aria-label={`Price: ${formatPrice(quote.price)}, Change: ${formatPct(quote.changePct)}`}
          >
            {formatPrice(quote.price)}
            <span className="stock-detail__sticky-change">
              {' '}
              {isPositive ? '+' : ''}{formatPct(quote.changePct)}
            </span>
          </span>
          <span className="stock-detail__sticky-name">{quote.name}</span>

          {/* Add to Watchlist button */}
          <button
            className={`stock-detail__watchlist-btn${watching ? ' stock-detail__watchlist-btn--watching' : ''}`}
            onClick={handleWatchlistToggle}
            aria-label={watching ? `Remove ${normalizedTicker} from watchlist` : `Add ${normalizedTicker} to watchlist`}
            aria-pressed={watching}
          >
            {watching ? '★ Watching' : '☆ Watchlist'}
          </button>
        </div>

        {/* Watchlist feedback message */}
        {watchlistMessage && (
          <p
            className="stock-detail__watchlist-msg"
            role="status"
            aria-live="polite"
          >
            {watchlistMessage}
          </p>
        )}

        {/* ── Tab bar ───────────────────────────────────────────────── */}
        <nav
          className="stock-detail__tabs"
          role="tablist"
          aria-label="Stock detail sections"
        >
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              aria-controls={`tab-panel-${key}`}
              id={`tab-${key}`}
              className={`stock-detail__tab${activeTab === key ? ' stock-detail__tab--active' : ''}`}
              onClick={() => handleTabChange(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Tab panels ────────────────────────────────────────────────── */}
      <div className="stock-detail__content">

        {/* Overview panel */}
        <div
          id="tab-panel-overview"
          role="tabpanel"
          aria-labelledby="tab-overview"
          hidden={activeTab !== 'overview'}
          className="stock-detail__panel"
        >
          {(mountedTabs.has('overview') || activeTab === 'overview') && (
            <>
              <StockOverviewHeader quote={quote} />

              {/* ELI5 Panel — collapsed by default */}
              <div className="stock-detail__eli5-section">
                <button
                  className="stock-detail__eli5-toggle"
                  onClick={() => setEli5Expanded((v) => !v)}
                  aria-expanded={eli5Expanded}
                  aria-controls="eli5-content"
                >
                  <span>How is this stock doing? (ELI5)</span>
                  <span aria-hidden="true">{eli5Expanded ? '▲' : '▼'}</span>
                </button>
                {eli5Expanded && (
                  <div id="eli5-content">
                    <Suspense fallback={<div className="page-loading">Loading…</div>}>
                      <ELI5Panel ticker={normalizedTicker} />
                    </Suspense>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Chart panel */}
        <div
          id="tab-panel-chart"
          role="tabpanel"
          aria-labelledby="tab-chart"
          hidden={activeTab !== 'chart'}
          className="stock-detail__panel"
        >
          {mountedTabs.has('chart') && (
            <Suspense fallback={<div className="page-loading">Loading chart…</div>}>
              <PriceChart ticker={normalizedTicker} />
            </Suspense>
          )}
        </div>

        {/* Financials panel */}
        <div
          id="tab-panel-financials"
          role="tabpanel"
          aria-labelledby="tab-financials"
          hidden={activeTab !== 'financials'}
          className="stock-detail__panel"
        >
          {mountedTabs.has('financials') && (
            <Suspense fallback={<div className="page-loading">Loading financials…</div>}>
              <FinancialsPanel ticker={normalizedTicker} />
            </Suspense>
          )}
        </div>

        {/* ELI5 panel (full page tab) */}
        <div
          id="tab-panel-eli5"
          role="tabpanel"
          aria-labelledby="tab-eli5"
          hidden={activeTab !== 'eli5'}
          className="stock-detail__panel"
        >
          {mountedTabs.has('eli5') && (
            <Suspense fallback={<div className="page-loading">Loading ELI5…</div>}>
              <ELI5Panel ticker={normalizedTicker} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockDetailPage;
