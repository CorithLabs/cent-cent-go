import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { PriceChart } from '../components/PriceChart/PriceChart';
import { IndicatorsPanel } from '../components/IndicatorsPanel/IndicatorsPanel';
import { useIndicators } from '../hooks/useIndicators';
import './StockChartPage.css';

/**
 * StockChartPage — wires PriceChart and IndicatorsPanel for /stock/:ticker/chart
 *
 * AC: Chart displays on the Stock Chart page showing closing price by default.
 * AC: Range buttons (1D, 5D, 1M, 6M, 1Y, 5Y) switch the displayed data range.
 * AC: Toggle between line chart and candlestick modes.
 * AC: Hover tooltip shows OHLCV values for the hovered data point.
 * AC: A "Download CSV" button exports the visible data range.
 * AC: IndicatorsPanel is rendered below the chart for indicator toggles.
 *
 * This is a wiring file only — PriceChart and IndicatorsPanel handle
 * their own data fetching. StockChartPage only passes the ticker and
 * shares the selected range so IndicatorsPanel stays in sync.
 */
const StockChartPage: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const upperTicker = ticker?.toUpperCase() ?? '';

  // Indicator toggle state + data fetching live in useIndicators; the panel is
  // driven by it (toggling a key fetches that indicator's series).
  const { activeKeys, toggleIndicator, data: indicatorData, loadingKeys } = useIndicators(
    upperTicker,
    '1m',
  );

  if (!upperTicker) {
    return (
      <div className="stock-chart-page__error" role="alert">
        No ticker specified.{' '}
        <Link to="/">Go back to search</Link>
      </div>
    );
  }

  return (
    <main className="stock-chart-page" aria-label={`${upperTicker} price chart`}>
      <header className="stock-chart-page__header">
        <nav aria-label="Breadcrumb" className="stock-chart-page__breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link to={`/stock/${upperTicker}`}>{upperTicker}</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">Chart</span>
        </nav>

        <div className="stock-chart-page__title-row">
          <h1 className="stock-chart-page__title">{upperTicker} — Price Chart</h1>
          <Link
            to={`/stock/${upperTicker}/chart/fullscreen`}
            className="stock-chart-page__fullscreen-btn"
            aria-label={`View ${upperTicker} chart in fullscreen`}
          >
            ⛶ Fullscreen
          </Link>
        </div>
      </header>

      {/* PriceChart fetches its own data via useOHLCV and owns its range. */}
      <PriceChart ticker={upperTicker} />

      {/* Indicator toggle panel below the chart (driven by useIndicators). */}
      <IndicatorsPanel
        activeKeys={activeKeys}
        loadingKeys={loadingKeys}
        onToggle={toggleIndicator}
        data={indicatorData}
      />
    </main>
  );
};

export default StockChartPage;
