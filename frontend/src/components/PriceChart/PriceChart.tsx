import React, { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useOHLCV, ChartRange, OHLCVBar } from '../../hooks/useOHLCV';
import { downloadOHLCVAsCSV } from '../../utils/csvExport';
import { formatPrice } from '../../utils/formatters';
import './PriceChart.css';

const RANGES: ChartRange[] = ['1d', '5d', '1m', '6m', '1y', '5y'];
const RANGE_LABELS: Record<ChartRange, string> = {
  '1d': '1D',
  '5d': '5D',
  '1m': '1M',
  '6m': '6M',
  '1y': '1Y',
  '5y': '5Y',
};

type ChartMode = 'line' | 'candlestick';

interface PriceChartProps {
  ticker: string;
}

/**
 * PriceChart — interactive OHLCV chart with range selector, line/candlestick toggle,
 * hover tooltip, and CSV download.
 * AC: Range buttons switch data range. Toggle between line and candlestick.
 * AC: Hover tooltip shows OHLCV. Download CSV button exports visible data.
 * AC: Large datasets (5Y daily) windowed to avoid frame drops.
 */
export const PriceChart: React.FC<PriceChartProps> = ({ ticker }) => {
  const [range, setRange] = useState<ChartRange>('1m');
  const [mode, setMode] = useState<ChartMode>('line');

  const { ohlcv, isLoading, error } = useOHLCV(ticker, range);

  // Window data for large datasets to keep rendering fast
  const chartData = useMemo(() => {
    if (!ohlcv?.data) return [];
    const data = ohlcv.data;
    // For 5Y daily (~1260 bars), subsample to 500 points for canvas perf
    if (data.length > 500) {
      const step = Math.ceil(data.length / 500);
      return data.filter((_, i) => i % step === 0);
    }
    return data;
  }, [ohlcv]);

  const hasData = chartData.length > 0;
  const isNewIPO = ohlcv && ohlcv.data.length < 5 && range === '5y';

  // Format x-axis timestamps
  const formatXAxis = (timestamp: string) => {
    const d = new Date(timestamp);
    if (range === '1d' || range === '5d') {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDownloadCSV = () => {
    if (ohlcv?.data) {
      downloadOHLCVAsCSV(ticker, range, ohlcv.data);
    }
  };

  // Build accessible data table rows
  const accessibleRows = chartData.slice(-10); // last 10 for the table

  return (
    <section className="price-chart" aria-labelledby="chart-heading">
      <div className="price-chart__toolbar">
        <h2 id="chart-heading" className="price-chart__title">
          Price History
        </h2>

        {/* Range selector */}
        <div className="price-chart__ranges" role="group" aria-label="Select time range">
          {RANGES.map((r) => (
            <button
              key={r}
              className={`price-chart__range-btn${range === r ? ' price-chart__range-btn--active' : ''}`}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              aria-label={`Show ${RANGE_LABELS[r]} range`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="price-chart__mode-toggle" role="group" aria-label="Chart type">
          <button
            className={`price-chart__mode-btn${mode === 'line' ? ' price-chart__mode-btn--active' : ''}`}
            onClick={() => setMode('line')}
            aria-pressed={mode === 'line'}
          >
            Line
          </button>
          <button
            className={`price-chart__mode-btn${mode === 'candlestick' ? ' price-chart__mode-btn--active' : ''}`}
            onClick={() => setMode('candlestick')}
            aria-pressed={mode === 'candlestick'}
          >
            Candlestick
          </button>
        </div>

        {/* CSV Download */}
        <button
          className="price-chart__download-btn"
          onClick={handleDownloadCSV}
          disabled={!hasData}
          aria-label="Download chart data as CSV"
        >
          ↓ Download CSV
        </button>
      </div>

      {/* New IPO notice */}
      {isNewIPO && (
        <p className="price-chart__notice" role="note">
          Limited history available — this stock recently went public.
        </p>
      )}

      {/* Chart area */}
      {isLoading && (
        <div className="price-chart__loading" aria-label="Loading chart data" aria-busy="true">
          <div className="price-chart__skeleton" />
        </div>
      )}

      {error && (
        <div className="price-chart__error" role="alert">
          {error}
        </div>
      )}

      {!isLoading && !error && hasData && (
        <div className="price-chart__canvas-wrapper">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                content={<OHLCVTooltip />}
              />
              {mode === 'line' ? (
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  name="Close"
                />
              ) : (
                /* Candlestick approximation using bars — real candlestick needs D3 */
                <>
                  <Bar dataKey="low" fill="transparent" stackId="candle" />
                  <Bar
                    dataKey="close"
                    stackId="candle"
                    fill="var(--color-primary)"
                    name="Close"
                  />
                </>
              )}
              {/* Volume as a faint bar at the bottom */}
              <Bar dataKey="volume" yAxisId={1} fill="var(--color-border)" opacity={0.4} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {!isLoading && !error && !hasData && (
        <div className="price-chart__empty" role="status">
          No chart data available for this range.
        </div>
      )}

      {/* Accessible data table */}
      {hasData && (
        <details className="price-chart__accessible-table">
          <summary>View data table (last 10 bars)</summary>
          <table aria-label={`${ticker} OHLCV data, last 10 bars`}>
            <thead>
              <tr>
                <th scope="col">Date/Time</th>
                <th scope="col">Open</th>
                <th scope="col">High</th>
                <th scope="col">Low</th>
                <th scope="col">Close</th>
                <th scope="col">Volume</th>
              </tr>
            </thead>
            <tbody>
              {accessibleRows.map((bar: OHLCVBar) => (
                <tr key={bar.timestamp}>
                  <td>{new Date(bar.timestamp).toLocaleString()}</td>
                  <td>{formatPrice(bar.open)}</td>
                  <td>{formatPrice(bar.high)}</td>
                  <td>{formatPrice(bar.low)}</td>
                  <td>{formatPrice(bar.close)}</td>
                  <td>{bar.volume.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
};

// Custom tooltip showing all OHLCV values
const OHLCVTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const bar: OHLCVBar = payload[0]?.payload;
  if (!bar) return null;

  return (
    <div
      className="price-chart__tooltip"
      role="tooltip"
      aria-label={`OHLCV data for ${label}`}
    >
      <p className="price-chart__tooltip-date">
        {new Date(bar.timestamp).toLocaleString()}
      </p>
      <dl>
        <div><dt>Open</dt><dd>{formatPrice(bar.open)}</dd></div>
        <div><dt>High</dt><dd>{formatPrice(bar.high)}</dd></div>
        <div><dt>Low</dt><dd>{formatPrice(bar.low)}</dd></div>
        <div><dt>Close</dt><dd>{formatPrice(bar.close)}</dd></div>
        <div><dt>Volume</dt><dd>{bar.volume.toLocaleString()}</dd></div>
      </dl>
    </div>
  );
};

export default PriceChart;
