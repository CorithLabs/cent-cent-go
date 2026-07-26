import React from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { MetricsGrid } from '../components/MetricsGrid/MetricsGrid';

interface Props {
  ticker: string;
}

/**
 * StockDetailFinancialsPanel — lazy-loaded content for the Financials tab.
 * Fetches metrics data and renders MetricsGrid with skeleton loading state.
 */
const StockDetailFinancialsPanel: React.FC<Props> = ({ ticker }) => {
  const { data, isLoading, error, notFound } = useMetrics(ticker);

  if (notFound) {
    return (
      <div className="stock-detail__panel-empty" role="status">
        No financial data available for <strong>{ticker}</strong>.
      </div>
    );
  }

  if (error) {
    return (
      <div className="stock-detail__panel-error" role="alert">
        Failed to load financial data: {error}
      </div>
    );
  }

  // MetricsGrid handles the skeleton state internally via isLoading prop
  return <MetricsGrid data={data} isLoading={isLoading} />;
};

export default StockDetailFinancialsPanel;
