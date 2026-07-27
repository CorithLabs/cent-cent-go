import React from 'react';
import { useEconomics } from '../hooks/useEconomics';
import { EconomicsGrid, EconomicsGridSkeleton } from '../components/EconomicsGrid/EconomicsGrid';
import './EconomicsPage.css';

/**
 * EconomicsPage — /economics
 *
 * AC: Displays a grid of macro indicator cards: GDP growth, CPI (inflation),
 *     Fed Funds Rate, Unemployment Rate, and 10Y Treasury Yield.
 * AC: Each card shows current value, previous value, change, trend sparkline (1Y),
 *     and next release date.
 * AC: Each card links to its detail page.
 * AC: A plain-English summary sentence is shown on each card.
 * AC: Indicator data not yet released shows previous value with a "Pending" badge.
 * AC: Failed fetch for one indicator does not break the rest of the grid
 *     (the backend filters out failed indicators and returns remaining ones).
 */
const EconomicsPage: React.FC = () => {
  const { data, isLoading, error } = useEconomics();

  return (
    <main className="economics-page">
      <header className="economics-page__header">
        <h1 className="economics-page__title">Economic Indicators</h1>
        <p className="economics-page__subtitle">
          Key macro indicators tracked by the Federal Reserve and related agencies.
          Data sourced from FRED (Federal Reserve Bank of St. Louis).
        </p>
        <p className="economics-page__disclaimer">
          Data is for informational purposes only and does not constitute financial advice.
        </p>
      </header>

      {isLoading && <EconomicsGridSkeleton />}

      {error && !isLoading && (
        <div className="economics-page__error" role="alert">
          <p>{error}</p>
          <button
            className="economics-page__retry"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}

      {data && !isLoading && (
        <EconomicsGrid indicators={data.indicators} />
      )}
    </main>
  );
};

export default EconomicsPage;
