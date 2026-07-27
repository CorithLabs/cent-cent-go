import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useEconomicIndicator } from '../hooks/useEconomicIndicator';
import './EconomicsDetailPage.css';

// ── Static explainer text ─────────────────────────────────────────────────────

interface ExplainerContent {
  what: string;
  howCalculated: string;
  risingMeans: string;
  fallingMeans: string;
}

const EXPLAINERS: Record<string, ExplainerContent> = {
  GDPC1: {
    what: 'Real GDP (Gross Domestic Product) measures the total value of all goods and services produced by the US economy, adjusted for inflation.',
    howCalculated: 'Calculated quarterly by the Bureau of Economic Analysis (BEA) as the sum of consumer spending, investment, government spending, and net exports — adjusted using price deflators to remove inflation.',
    risingMeans: 'The economy is growing — companies are producing more, employment tends to rise, and consumer confidence is typically strong.',
    fallingMeans: 'Economic contraction. Two consecutive quarters of negative GDP growth is the textbook definition of a recession.',
  },
  CPIAUCSL: {
    what: 'The Consumer Price Index (CPI) tracks the average change in prices paid by urban consumers for a basket of goods and services, including food, energy, housing, and transportation.',
    howCalculated: 'The Bureau of Labor Statistics (BLS) surveys prices for ~80,000 items across ~200 categories monthly. The year-over-year % change is the "inflation rate."',
    risingMeans: 'Inflation is increasing — your purchasing power is falling. The Fed may raise interest rates to cool spending and bring inflation down.',
    fallingMeans: 'Inflation is slowing (disinflation) or prices are falling (deflation). The Fed may cut rates to stimulate the economy.',
  },
  FEDFUNDS: {
    what: 'The Federal Funds Rate is the interest rate at which banks lend money to each other overnight. It\'s the primary tool the Federal Reserve uses to influence the economy.',
    howCalculated: 'Set by the Federal Open Market Committee (FOMC) at meetings every 6–8 weeks. The "effective" rate is the actual market rate, which closely tracks the target range.',
    risingMeans: 'The Fed is tightening monetary policy — borrowing becomes more expensive, which slows inflation but can also slow growth.',
    fallingMeans: 'The Fed is loosening monetary policy — cheaper borrowing stimulates consumer spending, business investment, and economic growth.',
  },
  UNRATE: {
    what: 'The Unemployment Rate measures the percentage of the labor force that is unemployed and actively seeking work.',
    howCalculated: 'The BLS conducts a monthly survey (Current Population Survey) of ~60,000 households. Unemployment rate = (unemployed / labor force) × 100.',
    risingMeans: 'Job losses are increasing — the economy may be slowing. The Fed often cuts rates in response to rising unemployment.',
    fallingMeans: 'More people are finding jobs — the labor market is strong. Very low unemployment can lead to wage inflation, prompting rate hikes.',
  },
  DGS10: {
    what: 'The 10-Year Treasury Yield is the annualized return on US government bonds maturing in 10 years. It\'s the global benchmark for "risk-free" long-term borrowing costs.',
    howCalculated: 'Determined by bond market supply and demand. When investors buy bonds (demand rises), yields fall. When investors sell (supply rises), yields rise.',
    risingMeans: 'Investors expect higher inflation or stronger growth, or they\'re selling bonds to buy riskier assets. Mortgages and corporate borrowing become more expensive.',
    fallingMeans: 'Investors are seeking safety (flight to quality), expecting lower growth, or anticipating Fed rate cuts. Mortgage rates typically fall alongside.',
  },
};

const getExplainer = (id: string): ExplainerContent => {
  return EXPLAINERS[id.toUpperCase()] ?? {
    what: 'This economic indicator tracks key macro-economic data from the Federal Reserve.',
    howCalculated: 'Sourced from FRED (Federal Reserve Economic Data), Federal Reserve Bank of St. Louis.',
    risingMeans: 'Rising values indicate increasing levels of this metric.',
    fallingMeans: 'Falling values indicate decreasing levels of this metric.',
  };
};

// ── Range selector ────────────────────────────────────────────────────────────

type RangeOption = '1y' | '5y' | '10y' | 'all';

const RANGE_OPTIONS: { label: string; value: RangeOption }[] = [
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
  { label: '10Y', value: '10y' },
  { label: 'All', value: 'all' },
];

// ── Related concept slugs to names ───────────────────────────────────────────

function conceptSlugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Page component ────────────────────────────────────────────────────────────

/**
 * EconomicsDetailPage — /economics/:indicator
 *
 * AC: Full historical chart with range selector (1Y, 5Y, 10Y, All).
 * AC: ByteByteGo-style explainer section: what the indicator is, how it's
 *     calculated, and what rising/falling values mean for markets.
 * AC: "Related Concepts" links to relevant Learn articles.
 * AC: Release history table shows past values and dates.
 * AC: Unknown indicator slug returns 404 page.
 * AC: Indicator with only 2 years of data on 10Y range shows available data
 *     with a note.
 */
const EconomicsDetailPage: React.FC = () => {
  const { indicator } = useParams<{ indicator: string }>();
  const [range, setRange] = useState<RangeOption>('1y');

  const { data, isLoading, error, notFound } = useEconomicIndicator(
    indicator ?? '',
    range,
  );

  if (notFound) {
    return (
      <main className="econ-detail-page econ-detail-page--notfound">
        <h1>Indicator not found</h1>
        <p>The indicator <code>{indicator}</code> does not exist.</p>
        <Link to="/economics" className="econ-detail-page__back">
          ← Back to Economics Dashboard
        </Link>
      </main>
    );
  }

  const explainer = getExplainer(indicator ?? '');
  const historyTableData = data ? [...data.data].reverse().slice(0, 20) : [];
  const hasLimitedData = data && data.data.length < 12 && (range === '5y' || range === '10y' || range === 'all');

  return (
    <main className="econ-detail-page">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="econ-detail-page__breadcrumb">
        <Link to="/">Home</Link>
        {' › '}
        <Link to="/economics">Economics</Link>
        {' › '}
        <span>{data?.name ?? indicator?.toUpperCase()}</span>
      </nav>

      {/* Header */}
      <header className="econ-detail-page__header">
        <h1 className="econ-detail-page__title">
          {isLoading ? '—' : data?.name}
        </h1>
        {data && (
          <p className="econ-detail-page__source">{data.source}</p>
        )}
      </header>

      {/* Chart */}
      <section className="econ-detail-page__chart-section" aria-label="Historical chart">
        {/* Range selector */}
        <div className="econ-detail-page__range-selector" role="group" aria-label="Chart range">
          {RANGE_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              className={`econ-detail-page__range-btn${range === value ? ' econ-detail-page__range-btn--active' : ''}`}
              onClick={() => setRange(value)}
              aria-pressed={range === value}
            >
              {label}
            </button>
          ))}
        </div>

        {hasLimitedData && (
          <p className="econ-detail-page__limited-data" role="note">
            Only {data?.data.length} data points available for this range.
          </p>
        )}

        {isLoading && (
          <div className="econ-detail-page__chart-skeleton" aria-hidden="true" />
        )}

        {error && (
          <p className="econ-detail-page__error" role="alert">{error}</p>
        )}

        {data && !isLoading && (
          <div
            className="econ-detail-page__chart"
            aria-label={`${data.name} historical chart, ${range} range`}
            role="img"
          >
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data.data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-bg-elevated)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d: string) => {
                    const dt = new Date(d);
                    return `${dt.getFullYear()}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v.toFixed(1)}${data.unit}`}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-bg-elevated)',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: 'var(--color-text-primary)',
                  }}
                  formatter={(val: number) => [`${val.toFixed(2)}${data.unit}`, data.name]}
                  labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-accent)"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ByteByteGo-style explainer */}
      <section className="econ-detail-page__explainer" aria-label="Indicator explainer">
        <h2>What is this indicator?</h2>
        <p>{explainer.what}</p>

        <h3>How is it calculated?</h3>
        <p>{explainer.howCalculated}</p>

        <div className="econ-detail-page__signals">
          <div className="econ-detail-page__signal econ-detail-page__signal--up">
            <span className="econ-detail-page__signal-icon" aria-hidden="true">▲</span>
            <div>
              <strong>Rising values mean:</strong>
              <p>{explainer.risingMeans}</p>
            </div>
          </div>
          <div className="econ-detail-page__signal econ-detail-page__signal--down">
            <span className="econ-detail-page__signal-icon" aria-hidden="true">▼</span>
            <div>
              <strong>Falling values mean:</strong>
              <p>{explainer.fallingMeans}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Concepts */}
      {data && data.relatedConcepts.length > 0 && (
        <section className="econ-detail-page__related" aria-label="Related concepts">
          <h2>Related Concepts</h2>
          <ul className="econ-detail-page__related-list">
            {data.relatedConcepts.map((slug) => (
              <li key={slug}>
                <Link to={`/learn/${slug}`} className="econ-detail-page__related-link">
                  {conceptSlugToName(slug)} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Release history table */}
      {data && historyTableData.length > 0 && (
        <section className="econ-detail-page__history" aria-label="Release history">
          <h2>Release History</h2>
          <div className="econ-detail-page__table-wrapper">
            <table className="econ-detail-page__table" aria-label={`${data.name} historical values`}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Value</th>
                </tr>
              </thead>
              <tbody>
                {historyTableData.map((point) => (
                  <tr key={point.date}>
                    <td>{new Date(point.date).toLocaleDateString()}</td>
                    <td className="font-mono">{point.value.toFixed(2)}{data.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <p className="econ-detail-page__disclaimer">
        Data sourced from FRED (Federal Reserve Economic Data). For informational
        purposes only and does not constitute financial advice.
      </p>
    </main>
  );
};

export default EconomicsDetailPage;
