import React from 'react';
import { MetricsResponse } from '../../hooks/useMetrics';
import './MetricsGrid.css';

interface MetricsGridProps {
  data: MetricsResponse | null;
  isLoading?: boolean;
}

interface MetricDef {
  key: keyof MetricsResponse['metrics'];
  label: string;
  learnSlug: string;
  format: (v: number) => string;
  naReason: string;
  /** True if this field represents a gain/loss — coloured positive/negative */
  isChangePct?: boolean;
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: 'pe',
    label: 'P/E Ratio',
    learnSlug: 'pe-ratio',
    format: (v) => v.toFixed(2) + 'x',
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

const SKELETON_COUNT = METRIC_DEFS.length;

/**
 * MetricsGrid — displays fundamental metric cards for the Financials tab.
 *
 * AC: 2-column mobile, 4-column desktop grid.
 * AC: Each card: label (uppercase muted) → value (font-mono xl) → sub-label.
 * AC: N/A values render as — em-dash in muted color, not "N/A" text.
 * AC: % change fields use positive/negative color; other numbers do not.
 * AC: Skeleton shimmer while loading — same card height as loaded state.
 */
export const MetricsGrid: React.FC<MetricsGridProps> = ({ data, isLoading }) => {
  // Skeleton loading state
  if (isLoading || !data) {
    return (
      <section className="metrics-grid" aria-labelledby="metrics-heading" aria-busy="true">
        <header className="metrics-grid__header">
          <h2 id="metrics-heading">Key Metrics</h2>
        </header>
        <dl className="metrics-grid__list" aria-label="Loading financial metrics">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={i} className="metrics-grid__skeleton" aria-hidden="true" />
          ))}
        </dl>
      </section>
    );
  }

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
        {METRIC_DEFS.map(({ key, label, learnSlug, format, naReason, isChangePct }) => {
          const rawValue = data.metrics[key];
          const isDividend = key === 'dividendYield';
          const isNA = rawValue === null || rawValue === undefined;
          const isZeroDividend = isDividend && rawValue === 0;
          const isNegativePE = key === 'pe' && rawValue !== null && (rawValue as number) < 0;

          let displayValue: string;
          if (isNA) {
            displayValue = '—'; // em-dash, not "N/A"
          } else if (isZeroDividend) {
            displayValue = '—';
          } else {
            displayValue = format(rawValue as number);
          }

          let valueClass = 'metrics-grid__value font-mono';
          if (isNA || isZeroDividend) {
            valueClass = 'metrics-grid__value--na metrics-grid__value'; // muted, no mono needed
          } else if (isChangePct && rawValue !== null) {
            valueClass += (rawValue as number) >= 0
              ? ' text-positive'
              : ' text-negative';
          } else if (isNegativePE) {
            valueClass += ' metrics-grid__value--negative';
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
                className={valueClass}
                title={isNA ? naReason : undefined}
                aria-label={`${label}: ${displayValue}${isNA ? ` — ${naReason}` : ''}`}
              >
                {displayValue}
              </dd>
              <span className="metrics-grid__sublabel">
                {data.fiscalPeriod}
              </span>
            </div>
          );
        })}
      </dl>
    </section>
  );
};
