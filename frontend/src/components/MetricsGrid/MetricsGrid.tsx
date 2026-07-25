import React from 'react';
import { MetricsResponse } from '../../hooks/useMetrics';
import './MetricsGrid.css';

interface MetricsGridProps {
  data: MetricsResponse;
}

interface MetricDef {
  key: keyof MetricsResponse['metrics'];
  label: string;
  learnSlug: string;
  format: (v: number) => string;
  naReason: string; // shown in tooltip when value is null
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: 'pe',
    label: 'P/E Ratio',
    learnSlug: 'pe-ratio',
    format: (v) => (v < 0 ? v.toFixed(2) : v.toFixed(2) + 'x'),
    naReason: 'P/E is unavailable when earnings are zero or negative',
  },
  {
    key: 'pb',
    label: 'P/B Ratio',
    learnSlug: 'pb-ratio',
    format: (v) => v.toFixed(2) + 'x',
    naReason: 'P/B is unavailable for this company',
  },
  {
    key: 'eps',
    label: 'EPS',
    learnSlug: 'eps',
    format: (v) => `$${v.toFixed(2)}`,
    naReason: 'EPS data not available',
  },
  {
    key: 'dividendYield',
    label: 'Dividend Yield',
    learnSlug: 'dividend-yield',
    format: (v) => (v === 0 ? '—' : `${(v * 100).toFixed(2)}%`),
    naReason: 'This company does not pay a dividend',
  },
  {
    key: 'beta',
    label: 'Beta',
    learnSlug: 'beta',
    format: (v) => v.toFixed(2),
    naReason: 'Beta is unavailable for this security',
  },
  {
    key: 'roe',
    label: 'ROE',
    learnSlug: 'return-on-equity',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    naReason: 'ROE data not available',
  },
  {
    key: 'debtToEquity',
    label: 'Debt / Equity',
    learnSlug: 'debt-to-equity',
    format: (v) => v.toFixed(2) + 'x',
    naReason: 'Debt-to-equity data not available',
  },
];

/**
 * MetricsGrid — displays fundamental metric cards for the Financials tab.
 * AC: Shows P/E, P/B, EPS, dividend yield, beta, ROE, debt-to-equity.
 * AC: Each card shows fiscal period and "What is this?" link.
 * AC: Null values show "N/A" with tooltip explaining why.
 * AC: Negative P/E renders correctly.
 * AC: Zero dividend shows "—" not "0%".
 */
export const MetricsGrid: React.FC<MetricsGridProps> = ({ data }) => {
  return (
    <section className="metrics-grid" aria-labelledby="metrics-heading">
      <header className="metrics-grid__header">
        <h2 id="metrics-heading">Key Metrics</h2>
        <p className="metrics-grid__period">
          Fiscal period: <strong>{data.fiscalPeriod}</strong>
          {' · '}
          <time dateTime={data.lastUpdated}>
            Updated: {new Date(data.lastUpdated).toLocaleDateString()}
          </time>
          {' · '}
          <span className="metrics-grid__source">Source: Polygon.io</span>
        </p>
      </header>

      <dl className="metrics-grid__list" aria-label="Financial metrics">
        {METRIC_DEFS.map(({ key, label, learnSlug, format, naReason }) => {
          const rawValue = data.metrics[key];
          const isDividend = key === 'dividendYield';
          const isNA = rawValue === null || rawValue === undefined;
          const isZeroDividend = isDividend && rawValue === 0;

          let displayValue: string;
          if (isNA) {
            displayValue = 'N/A';
          } else if (isZeroDividend) {
            displayValue = '—';
          } else {
            displayValue = format(rawValue as number);
          }

          return (
            <div key={key} className="metrics-grid__card">
              <dt className="metrics-grid__label">
                {label}
                <a
                  href={`/learn/${learnSlug}`}
                  className="metrics-grid__learn-link"
                  aria-label={`What is ${label}? — Learn more`}
                >
                  What is this?
                </a>
              </dt>
              <dd
                className={`metrics-grid__value${isNA ? ' metrics-grid__value--na' : ''}${
                  key === 'pe' && rawValue !== null && rawValue < 0
                    ? ' metrics-grid__value--negative'
                    : ''
                }`}
                title={isNA ? naReason : undefined}
                aria-label={`${label}: ${displayValue}${isNA ? ` — ${naReason}` : ''}`}
              >
                {displayValue}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};
