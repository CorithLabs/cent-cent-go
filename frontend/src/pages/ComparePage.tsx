import React, { useState, useRef, KeyboardEvent } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useCompare, CompareTickerResult } from '../hooks/useCompare';
import { formatCurrency } from '../utils/formatters';
import './ComparePage.css';

// ── Color palette for up to 5 tickers ────────────────────────────────────────

const TICKER_COLORS = [
  '#3B82F6', // blue — accent
  '#F59E0B', // amber
  '#22C55E', // green
  '#8B5CF6', // violet
  '#EF4444', // red
];

// ── Range options ─────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: '1M', value: '1m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
];

// ── Metrics table ─────────────────────────────────────────────────────────────

const MetricsTable: React.FC<{ results: CompareTickerResult[] }> = ({ results }) => (
  <div className="compare-page__metrics">
    <h2 className="compare-page__section-title">Key Metrics Comparison</h2>
    <div className="compare-page__table-wrapper">
      <table
        className="compare-page__table"
        aria-label="Stock metrics comparison"
      >
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {results.map((r) => (
              <th key={r.ticker} scope="col">{r.ticker}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Company</td>
            {results.map((r) => <td key={r.ticker}>{r.name}</td>)}
          </tr>
          <tr>
            <td>P/E Ratio</td>
            {results.map((r) => (
              <td key={r.ticker} className="font-mono">
                {r.metrics.pe != null ? `${r.metrics.pe.toFixed(1)}x` : '—'}
              </td>
            ))}
          </tr>
          <tr>
            <td>Market Cap</td>
            {results.map((r) => (
              <td key={r.ticker} className="font-mono">
                {r.metrics.marketCap != null ? formatCurrency(r.metrics.marketCap) : '—'}
              </td>
            ))}
          </tr>
          <tr>
            <td>YTD Return</td>
            {results.map((r) => {
              const ytd = r.metrics.ytdReturn;
              return (
                <td
                  key={r.ticker}
                  className={`font-mono ${ytd == null ? '' : ytd >= 0 ? 'text-positive' : 'text-negative'}`}
                >
                  {ytd != null ? `${ytd >= 0 ? '+' : ''}${ytd.toFixed(2)}%` : '—'}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

// ── Normalized chart data builder ─────────────────────────────────────────────

/**
 * Merges normalized price series from multiple tickers into a single array
 * of { date, TICKER1: value, TICKER2: value, ... } objects for Recharts.
 */
function buildChartData(results: CompareTickerResult[]) {
  const dateMap = new Map<string, { date: string; [ticker: string]: string | number }>();

  for (const result of results) {
    for (const point of result.normalizedPrices) {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, { date: point.date });
      }
      const entry = dateMap.get(point.date)!;
      entry[result.ticker] = point.value;
    }
  }

  return Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

/**
 * ComparePage — /compare
 *
 * AC: GET /api/compare fetches normalized price history for 2–5 tickers.
 * AC: Backend reuses StockQuoteService — no duplicated Polygon logic.
 * AC: Normalized % return computed server-side.
 * AC: Returns 400 for <2 or >5 tickers.
 * AC: Adding 6th ticker shows 'Max 5 stocks' error.
 * AC: Unknown tickers omitted with warnings.
 */
const ComparePage: React.FC = () => {
  const [tickers, setTickers] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [range, setRange] = useState('1y');
  const [inputError, setInputError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useCompare(tickers, range);

  const addTicker = () => {
    const ticker = inputValue.trim().toUpperCase();
    if (!ticker) return;

    if (tickers.length >= 5) {
      setInputError('Max 5 stocks can be compared at once.');
      return;
    }

    if (tickers.includes(ticker)) {
      setInputError(`${ticker} is already in the comparison.`);
      return;
    }

    setTickers((prev) => [...prev, ticker]);
    setInputValue('');
    setInputError(null);
  };

  const removeTicker = (ticker: string) => {
    setTickers((prev) => prev.filter((t) => t !== ticker));
    setInputError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      addTicker();
    }
  };

  const chartData = data ? buildChartData(data.tickers) : [];

  return (
    <main className="compare-page">
      <header className="compare-page__header">
        <h1 className="compare-page__title">Compare Stocks</h1>
        <p className="compare-page__subtitle">
          Add 2–5 tickers to compare normalized price performance side by side.
        </p>
      </header>

      {/* Ticker input */}
      <section className="compare-page__input-section" aria-label="Add stocks to compare">
        <div className="compare-page__input-row">
          <input
            ref={inputRef}
            type="text"
            className="compare-page__input"
            placeholder="Enter ticker (e.g. AAPL)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            aria-label="Stock ticker to add"
            maxLength={10}
          />
          <button
            className="compare-page__add-btn"
            onClick={addTicker}
            disabled={!inputValue.trim()}
            aria-label="Add ticker to comparison"
          >
            Add
          </button>
        </div>

        {inputError && (
          <p className="compare-page__input-error" role="alert">{inputError}</p>
        )}

        {/* Selected tickers */}
        {tickers.length > 0 && (
          <div className="compare-page__ticker-chips" aria-label="Selected tickers">
            {tickers.map((ticker, i) => (
              <span
                key={ticker}
                className="compare-page__chip"
                style={{ borderColor: TICKER_COLORS[i] }}
              >
                <span style={{ color: TICKER_COLORS[i] }}>{ticker}</span>
                <button
                  className="compare-page__chip-remove"
                  onClick={() => removeTicker(ticker)}
                  aria-label={`Remove ${ticker} from comparison`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {tickers.length < 2 && (
        <p className="compare-page__hint">
          Add at least 2 tickers to see a comparison.
        </p>
      )}

      {/* Warnings from backend */}
      {data?.warnings && data.warnings.length > 0 && (
        <div className="compare-page__warnings" role="alert">
          {data.warnings.map((w, i) => (
            <p key={i} className="compare-page__warning">{w}</p>
          ))}
        </div>
      )}

      {/* Range selector */}
      {tickers.length >= 2 && (
        <div className="compare-page__range-selector" role="group" aria-label="Chart range">
          {RANGE_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              className={`compare-page__range-btn${range === value ? ' compare-page__range-btn--active' : ''}`}
              onClick={() => setRange(value)}
              aria-pressed={range === value}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="compare-page__loading" aria-live="polite">
          <div className="compare-page__chart-skeleton" aria-hidden="true" />
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <p className="compare-page__error" role="alert">{error}</p>
      )}

      {/* Chart */}
      {data && !isLoading && data.tickers.length >= 2 && (
        <>
          {data.startDateDisclosure && (
            <p className="compare-page__disclosure">{data.startDateDisclosure}</p>
          )}

          <section className="compare-page__chart-section" aria-label="Normalized price comparison chart">
            <div
              className="compare-page__chart"
              role="img"
              aria-label={`Normalized price comparison for ${data.tickers.map((t) => t.ticker).join(', ')}`}
            >
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
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
                      return `${dt.getMonth() + 1}/${dt.getFullYear().toString().slice(2)}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                    width={65}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-bg-elevated)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'var(--color-text-primary)',
                    }}
                    formatter={(val: number, name: string) => [
                      `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`,
                      name,
                    ]}
                    labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                  />
                  {data.tickers.map((result, i) => (
                    <Line
                      key={result.ticker}
                      type="monotone"
                      dataKey={result.ticker}
                      stroke={TICKER_COLORS[i]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Metrics comparison table */}
          <MetricsTable results={data.tickers} />
        </>
      )}

      <p className="compare-page__disclaimer">
        Data is for informational purposes only and does not constitute financial advice.
        Normalized returns calculated from the earliest common data point.
      </p>
    </main>
  );
};

export default ComparePage;
