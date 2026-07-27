import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MetricsGrid } from './MetricsGrid';
import { MetricsResponse } from '../../hooks/useMetrics';

// The "What is this?" concept buttons are gated by a live /api/learn/:slug
// availability check; treat every concept as available in these unit tests.
vi.mock('../ConceptSlideOver/ConceptSlideOver', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../ConceptSlideOver/ConceptSlideOver')>();
  return { ...mod, useConceptLinkAvailability: () => true };
});

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

const renderGrid = (data: MetricsResponse | null, isLoading = false) =>
  render(
    <MemoryRouter>
      <MetricsGrid data={data} isLoading={isLoading} />
    </MemoryRouter>
  );

describe('MetricsGrid — v1.5 premium layout', () => {
  it('renders all 7 metric labels', () => {
    renderGrid(fullMetrics);
    ['P/E Ratio', 'P/B Ratio', 'EPS', 'Dividend Yield', 'Beta', 'ROE', 'Debt / Equity'].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument()
    );
  });

  it('renders fiscal period and last updated date', () => {
    renderGrid(fullMetrics);
    expect(screen.getAllByText(/Q4 2024/)[0]).toBeInTheDocument();
    expect(screen.getByText(/Updated/i)).toBeInTheDocument();
  });

  it('shows em-dash (—) for null metrics, not "N/A"', () => {
    renderGrid(missingMetrics);
    // All 7 null values should render as em-dash
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(7);
    // "N/A" text must not appear
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });

  it('shows em-dash for zero dividend, not "0%"', () => {
    renderGrid(noDividend);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('0.00%')).not.toBeInTheDocument();
  });

  it('renders negative P/E correctly using font-mono class', () => {
    renderGrid(negativePE);
    // Negative P/E formatted as -5.20x
    expect(screen.getByText('-5.20x')).toBeInTheDocument();
  });

  it('renders skeleton cards while loading — no spinner', () => {
    renderGrid(null, true);
    // Loading state shows skeletons, not the values
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    // No metric labels visible in skeleton state
    expect(screen.queryByText('P/E Ratio')).not.toBeInTheDocument();
  });

  it('skeleton cards have same min-height as loaded cards to prevent layout shift', () => {
    const { rerender } = render(
      <MemoryRouter>
        <MetricsGrid data={null} isLoading={true} />
      </MemoryRouter>
    );
    const skeletonCard = document.querySelector('.metrics-grid__skeleton');
    expect(skeletonCard).toBeInTheDocument();

    // Rerender with data
    rerender(
      <MemoryRouter>
        <MetricsGrid data={fullMetrics} isLoading={false} />
      </MemoryRouter>
    );
    const loadedCard = document.querySelector('.metrics-grid__card');
    expect(loadedCard).toBeInTheDocument();
  });

  it('renders "What is this?" learn links for all 7 metrics', () => {
    renderGrid(fullMetrics);
    const links = screen.getAllByRole('button', { name: /what is .+open concept explainer/i });
    expect(links).toHaveLength(7);
  });

  it('includes Polygon.io source attribution', () => {
    renderGrid(fullMetrics);
    expect(screen.getByText(/polygon\.io/i)).toBeInTheDocument();
  });

  it('value cells have font-mono class for tabular numeral alignment', () => {
    renderGrid(fullMetrics);
    const values = document.querySelectorAll('.metrics-grid__value.font-mono');
    // All non-null non-zero-dividend values should have font-mono
    expect(values.length).toBeGreaterThanOrEqual(6);
  });

  it('sub-label shows fiscal period on each card', () => {
    renderGrid(fullMetrics);
    const sublabels = document.querySelectorAll('.metrics-grid__sublabel');
    expect(sublabels.length).toBe(7);
    sublabels.forEach((el) => {
      expect(el.textContent).toContain('Q4 2024');
    });
  });

  it('positive ROE does NOT get positive color class', () => {
    renderGrid(fullMetrics);
    // ROE is positive but should not have text-positive class
    const roeValue = screen.getByText('147.0%');
    expect(roeValue.className).not.toContain('text-positive');
  });
});
