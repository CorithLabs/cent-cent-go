import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MetricsGrid } from './MetricsGrid';
import { MetricsResponse } from '../../hooks/useMetrics';

const fullMetrics: MetricsResponse = {
  ticker: 'AAPL',
  fiscalPeriod: 'Q4 2024',
  lastUpdated: new Date().toISOString(),
  metrics: {
    pe: 29.5,
    pb: 45.2,
    eps: 6.43,
    dividendYield: 0.0043,
    beta: 1.24,
    roe: 1.47,
    debtToEquity: 1.76,
  },
};

const negativePE: MetricsResponse = {
  ...fullMetrics,
  metrics: { ...fullMetrics.metrics, pe: -5.2 },
};

const noDividend: MetricsResponse = {
  ...fullMetrics,
  metrics: { ...fullMetrics.metrics, dividendYield: 0 },
};

const missingMetrics: MetricsResponse = {
  ...fullMetrics,
  metrics: {
    pe: null,
    pb: null,
    eps: null,
    dividendYield: null,
    beta: null,
    roe: null,
    debtToEquity: null,
  },
};

const renderGrid = (data: MetricsResponse) =>
  render(
    <MemoryRouter>
      <MetricsGrid data={data} />
    </MemoryRouter>
  );

describe('MetricsGrid', () => {
  it('renders all 7 metric labels', () => {
    renderGrid(fullMetrics);
    ['P/E Ratio', 'P/B Ratio', 'EPS', 'Dividend Yield', 'Beta', 'ROE', 'Debt / Equity'].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument()
    );
  });

  it('renders fiscal period and last updated', () => {
    renderGrid(fullMetrics);
    expect(screen.getByText(/Q4 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Updated/i)).toBeInTheDocument();
  });

  it('shows N/A for null metrics', () => {
    renderGrid(missingMetrics);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(7);
  });

  it('shows "—" for zero dividend, not "0%"', () => {
    renderGrid(noDividend);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0.00%')).not.toBeInTheDocument();
  });

  it('renders negative P/E correctly without visual glitch', () => {
    renderGrid(negativePE);
    expect(screen.getByText('-5.20x')).toBeInTheDocument();
  });

  it('renders "What is this?" links for all metrics', () => {
    renderGrid(fullMetrics);
    const links = screen.getAllByRole('link', { name: /what is this/i });
    expect(links).toHaveLength(7);
  });

  it('includes source attribution', () => {
    renderGrid(fullMetrics);
    expect(screen.getByText(/polygon\.io/i)).toBeInTheDocument();
  });
});
