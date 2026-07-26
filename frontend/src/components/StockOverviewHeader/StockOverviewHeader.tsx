import React from 'react';
import { StockQuote } from '../../hooks/useStockQuote';
import {
  formatPrice,
  formatChange,
  formatPct,
  formatCurrency,
  formatVolume,
  formatLastUpdated,
  isStale,
} from '../../utils/formatters';
import './StockOverviewHeader.css';

interface StockOverviewHeaderProps {
  quote: StockQuote;
}

/**
 * StockOverviewHeader — displays the top section of the Stock Detail page.
 * AC: Shows ticker, name, price, change ($+%), market cap, volume, 52-week range, exchange.
 * AC: Shows data freshness timestamp.
 * AC: Shows disclaimer banner.
 * AC: Stale data (>15 min) shows a warning.
 * AC: Suspended market shows "Market closed" badge.
 */
export const StockOverviewHeader: React.FC<StockOverviewHeaderProps> = ({ quote }) => {
  const isPositive = quote.change >= 0;
  const staleData = quote.stale || isStale(quote.lastUpdated, 15);
  const isClosed = quote.status === 'suspended';
  const isDelisted = quote.status === 'delisted';

  const changeClass = isPositive
    ? 'stock-header__change--positive'
    : 'stock-header__change--negative';

  return (
    <article className="stock-header" aria-label={`${quote.ticker} stock overview`}>
      {/* ── Disclaimer banner ─────────────────────────────────────────── */}
      <div className="stock-header__disclaimer" role="note" aria-label="Financial disclaimer">
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" width={16} height={16}>
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        Data is for informational purposes only and does not constitute financial advice.
      </div>

      {/* ── Stale data warning ─────────────────────────────────────────── */}
      {staleData && (
        <div className="stock-header__stale-warning" role="alert">
          ⚠️ Data may be delayed. Last updated more than 15 minutes ago.
        </div>
      )}

      {/* ── Name and exchange ──────────────────────────────────────────── */}
      <div className="stock-header__identity">
        <h1 className="stock-header__ticker">{quote.ticker}</h1>
        <span className="stock-header__name">{quote.name}</span>
        <span className="stock-header__exchange">{quote.exchange}</span>

        {isClosed && (
          <span className="stock-header__badge stock-header__badge--closed" aria-label="Market closed">
            Market closed
          </span>
        )}
        {isDelisted && (
          <span className="stock-header__badge stock-header__badge--delisted" aria-label="Delisted">
            Delisted
          </span>
        )}
      </div>

      {/* ── Price block ────────────────────────────────────────────────── */}
      <div className="stock-header__price-block">
        <span className="stock-header__price" aria-label={`Current price: ${formatPrice(quote.price)}`}>
          {formatPrice(quote.price)}
        </span>
        <span
          className={`stock-header__change ${changeClass}`}
          aria-label={`Change: ${formatChange(quote.change)} (${formatPct(quote.changePct)})`}
        >
          {formatChange(quote.change)} ({formatPct(quote.changePct)})
        </span>
      </div>

      {/* ── Key stats grid ─────────────────────────────────────────────── */}
      <dl className="stock-header__stats" aria-label="Key statistics">
        <div className="stock-header__stat">
          <dt>Market Cap</dt>
          <dd>{formatCurrency(quote.marketCap)}</dd>
        </div>
        <div className="stock-header__stat">
          <dt>Volume</dt>
          <dd>{formatVolume(quote.volume)}</dd>
        </div>
        <div className="stock-header__stat">
          <dt>52-Week High</dt>
          <dd>{formatPrice(quote.week52High)}</dd>
        </div>
        <div className="stock-header__stat">
          <dt>52-Week Low</dt>
          <dd>{formatPrice(quote.week52Low)}</dd>
        </div>
      </dl>

      {/* ── Freshness ─────────────────────────────────────────────────── */}
      <p className="stock-header__freshness" aria-label="Data freshness">
        <time dateTime={quote.lastUpdated}>{formatLastUpdated(quote.lastUpdated)}</time>
        <span className="stock-header__source"> · Source: Polygon.io</span>
      </p>
    </article>
  );
};
