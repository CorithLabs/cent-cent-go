import React, { useState } from 'react';
import { useHeatmap } from '../hooks/useHeatmap';
import { SectorHeatmap } from '../components/SectorHeatmap/SectorHeatmap';
import './SectorsPage.css';

/**
 * SectorsPage — /sectors
 *
 * AC: Renders a treemap-style heatmap where each cell is a stock, sized by
 *     market cap, colored by daily % change (red → neutral → green).
 * AC: D3.js treemap layout via d3-hierarchy and d3-scale.
 * AC: ResizeObserver watches container, debounced 200ms.
 * AC: Period toggle (1D, 5D, 1M) changes the data period.
 * AC: SVG has role='img' and aria-label='S&P 500 sector heatmap'.
 * AC: Hovering shows ticker, company name, price, and % change.
 * AC: Clicking navigates to /stock/:ticker.
 */
const SectorsPage: React.FC = () => {
  const [period, setPeriod] = useState<'1d' | '5d' | '1m'>('1d');
  const { data, isLoading, error } = useHeatmap(period);

  return (
    <main className="sectors-page">
      <header className="sectors-page__header">
        <h1 className="sectors-page__title">S&P 500 Sector Heatmap</h1>
        <p className="sectors-page__subtitle">
          500 stocks sized by market cap, colored by daily % change.
          Click any cell to view the stock detail page.
        </p>
      </header>

      {isLoading && (
        <div className="sectors-page__skeleton" aria-hidden="true" />
      )}

      {error && !isLoading && (
        <p className="sectors-page__error" role="alert">{error}</p>
      )}

      {data && !isLoading && (
        <div className="sectors-page__heatmap-wrapper">
          <SectorHeatmap
            sectors={data.sectors}
            period={period}
            onPeriodChange={setPeriod}
            marketClosed={data.marketClosed}
            incomplete={data.incomplete}
            asOf={data.asOf}
          />
        </div>
      )}

      <p className="sectors-page__disclaimer">
        Data for informational purposes only. Does not constitute financial advice.
        Market cap data sourced from Polygon.io.
      </p>
    </main>
  );
};

export default SectorsPage;
