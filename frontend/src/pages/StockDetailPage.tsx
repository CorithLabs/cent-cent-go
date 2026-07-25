import React from 'react';
import { useParams, Link, NavLink } from 'react-router-dom';
import { useStockQuote } from '../hooks/useStockQuote';
import { StockOverviewHeader } from '../components/StockOverviewHeader/StockOverviewHeader';
import './StockDetailPage.css';

/**
 * StockDetailPage — renders at /stock/:ticker
 * AC: Shows price, change, market cap, volume, 52-week range, exchange.
 * AC: Shows data freshness timestamp and disclaimer.
 * AC: Unknown tickers show a 404 page.
 * AC: Ticker in URL is uppercased automatically.
 */
const StockDetailPage: React.FC = () => {
  const { ticker = '' } = useParams<{ ticker: string }>();
  const normalizedTicker = ticker.toUpperCase();

  const { quote, isLoading, error, notFound } = useStockQuote(normalizedTicker);

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

  return (
    <div className="stock-detail">
      <StockOverviewHeader quote={quote} />

      {/* ── Tab navigation ─────────────────────────────────────────────── */}
      <nav className="stock-detail__tabs" aria-label="Stock sections">
        <NavLink
          to={`/stock/${normalizedTicker}`}
          end
          className={({ isActive }) =>
            `stock-detail__tab${isActive ? ' stock-detail__tab--active' : ''}`
          }
        >
          Overview
        </NavLink>
        <NavLink
          to={`/stock/${normalizedTicker}/chart`}
          className={({ isActive }) =>
            `stock-detail__tab${isActive ? ' stock-detail__tab--active' : ''}`
          }
        >
          Chart
        </NavLink>
        <NavLink
          to={`/stock/${normalizedTicker}/financials`}
          className={({ isActive }) =>
            `stock-detail__tab${isActive ? ' stock-detail__tab--active' : ''}`
          }
        >
          Financials
        </NavLink>
      </nav>
    </div>
  );
};

export default StockDetailPage;
