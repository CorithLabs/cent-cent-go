import React from 'react';
import { useParams } from 'react-router-dom';
import { useMetrics } from '../hooks/useMetrics';
import { MetricsGrid } from '../components/MetricsGrid/MetricsGrid';

/**
 * FinancialsPage — /stock/:ticker/financials
 * Shows key valuation metrics and financial statements.
 */
const FinancialsPage: React.FC = () => {
  const { ticker = '' } = useParams<{ ticker: string }>();
  const normalizedTicker = ticker.toUpperCase();

  const { data, isLoading, error, notFound } = useMetrics(normalizedTicker);

  if (notFound) {
    return (
      <div style={{ padding: 24 }} role="alert">
        <h2>Stock not found</h2>
        <p>No financial data available for <strong>{normalizedTicker}</strong>.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 24 }} aria-busy="true" aria-label="Loading financial data">
        <div style={{ height: 200, background: '#f3f4f6', borderRadius: 8, animation: 'shimmer 1.5s infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }} role="alert">
        <p>Failed to load financial data: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MetricsGrid data={data} />
    </div>
  );
};

export default FinancialsPage;
