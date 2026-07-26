import React from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { EconomicIndicator } from '../../hooks/useEconomics';
import './EconomicsGrid.css';

// ── Plain-English summary generator ──────────────────────────────────────────

function buildSummary(indicator: EconomicIndicator): string {
  const { id, name, value, unit, change } = indicator;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'unchanged';
  const absPrev = Math.abs(value - change);

  switch (id) {
    case 'CPIAUCSL':
      return `Inflation is running at ${value.toFixed(1)}${unit}, ${direction} from ${absPrev.toFixed(1)}${unit} last month.`;
    case 'FEDFUNDS':
      return `The Fed Funds Rate is ${value.toFixed(2)}${unit}, ${direction} from ${absPrev.toFixed(2)}${unit}.`;
    case 'UNRATE':
      return `Unemployment stands at ${value.toFixed(1)}${unit}, ${direction} from ${absPrev.toFixed(1)}${unit} last month.`;
    case 'DGS10':
      return `The 10-Year Treasury Yield is ${value.toFixed(2)}${unit}, ${direction} from ${absPrev.toFixed(2)}${unit}.`;
    default:
      // Generic for GDPC1 and others
      return `${name} is at ${value.toFixed(1)} ${unit}, ${direction} from the prior period.`;
  }
}

// ── Trend sparkline ───────────────────────────────────────────────────────────

interface SparklineProps {
  data: { date: string; value: number }[];
  positive: boolean;
}

const Sparkline: React.FC<SparklineProps> = ({ data, positive }) => {
  const color = positive ? 'var(--color-positive)' : 'var(--color-negative)';
  return (
    <div
      className="economics-card__sparkline"
      aria-label="1-year trend sparkline"
      role="img"
    >
      <ResponsiveContainer width="100%" height={40}>
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            dot={false}
            strokeWidth={1.5}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-bg-elevated)',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'var(--color-text-primary)',
            }}
            formatter={(val: number) => [val.toFixed(2), '']}
            labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Single indicator card ─────────────────────────────────────────────────────

interface IndicatorCardProps {
  indicator: EconomicIndicator;
}

const IndicatorCard: React.FC<IndicatorCardProps> = ({ indicator }) => {
  const { id, name, value, unit, change, trend, lastUpdated, nextRelease, source, stale } = indicator;
  const isPositive = change >= 0;
  const prevValue = value - change;
  const pending = !lastUpdated || new Date(lastUpdated).getTime() === 0;
  const summary = buildSummary(indicator);

  return (
    <article
      className="economics-card"
      aria-label={`${name} indicator card`}
    >
      {stale && (
        <span className="economics-card__stale-badge" role="alert">
          Stale data
        </span>
      )}
      {pending && (
        <span className="economics-card__pending-badge" role="status">
          Pending
        </span>
      )}

      <header className="economics-card__header">
        <h3 className="economics-card__name">{name}</h3>
        <span className="economics-card__source">{source}</span>
      </header>

      <div className="economics-card__values">
        <span
          className="economics-card__current font-mono"
          aria-label={`Current value: ${value.toFixed(2)} ${unit}`}
        >
          {value.toFixed(2)}{unit}
        </span>
        <span
          className={`economics-card__change font-mono ${isPositive ? 'text-positive' : 'text-negative'}`}
          aria-label={`Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)}${unit}`}
        >
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}{unit}
        </span>
      </div>

      <p className="economics-card__prev">
        Prev: <span className="font-mono">{prevValue.toFixed(2)}{unit}</span>
      </p>

      {trend && trend.length > 0 && (
        <Sparkline data={trend} positive={isPositive} />
      )}

      <p className="economics-card__summary">{summary}</p>

      <footer className="economics-card__footer">
        {nextRelease && (
          <p className="economics-card__next-release">
            Next release:{' '}
            <time dateTime={nextRelease}>
              {new Date(nextRelease).toLocaleDateString()}
            </time>
          </p>
        )}
        <time
          dateTime={lastUpdated}
          className="economics-card__updated"
        >
          Updated: {new Date(lastUpdated).toLocaleDateString()}
        </time>
      </footer>

      <Link
        to={`/economics/${id.toLowerCase()}`}
        className="economics-card__link"
        aria-label={`View full chart for ${name}`}
      >
        View details →
      </Link>
    </article>
  );
};

// ── Grid ──────────────────────────────────────────────────────────────────────

interface EconomicsGridProps {
  indicators: EconomicIndicator[];
}

/**
 * EconomicsGrid renders a grid of macro indicator cards.
 * Each card shows: current value, previous value, change, trend sparkline (1Y),
 * next release date, and a plain-English summary sentence.
 *
 * AC: /economics shows a grid of macro indicator cards.
 * AC: Each card links to its detail page.
 * AC: Failed fetch for one indicator does not break the rest.
 */
export const EconomicsGrid: React.FC<EconomicsGridProps> = ({ indicators }) => (
  <section
    className="economics-grid"
    aria-label="Macro economic indicators"
  >
    {indicators.map((ind) => (
      <IndicatorCard key={ind.id} indicator={ind} />
    ))}
  </section>
);

// ── Skeleton ──────────────────────────────────────────────────────────────────

export const EconomicsGridSkeleton: React.FC = () => (
  <section className="economics-grid" aria-label="Loading economic indicators" aria-busy="true">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="economics-card economics-card--skeleton" aria-hidden="true" />
    ))}
  </section>
);
