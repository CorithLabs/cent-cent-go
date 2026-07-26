import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
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

// Design token values (resolved from CSS for use in Recharts props)
// These must match tokens.css — Recharts SVG props can't consume CSS vars directly.
const THEME = {
  gridColor:    'rgba(30, 37, 48, 1)',   // --color-bg-elevated
  axisColor:    '#64748B',               // --color-text-muted
  accentColor:  '#3B82F6',               // --color-accent
  positiveColor:'#22C55E',              // --color-positive
  negativeColor:'#EF4444',              // --color-negative
  tooltipBg:    '#1E2530',               // --color-bg-elevated
  fontMono:     "'JetBrains Mono', ui-monospace, monospace",
  textXs:       '11px',
};

/**
 * PriceChart — interactive OHLCV chart with range selector, line/candlestick toggle,
 * hover tooltip, and CSV download. Themed with dark design tokens.
 *
 * AC: Chart background uses --color-bg-surface; container has border-radius 8px + --shadow-card.
 * AC: Grid lines use --color-bg-elevated.
 * AC: X/Y axis ticks use --font-mono, --text-xs, --color-text-muted.
 * AC: Line: --color-accent; area fill: 10% accent gradient.
 * AC: Custom OHLCV tooltip in dark card with mono numbers.
 * AC: Range selector: pill buttons, active = --color-accent bg.
 * AC: No Recharts default borders/outer strokes.
 * AC: Responsive (width=100%, height from ref).
 */
export const PriceChart: React.FC<PriceChartProps> = ({ ticker }) => {
  const [range, setRange] = useState<ChartRange>('1m');
  const [mode, setMode] = useState<ChartMode>('line');
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(340);

  const { ohlcv, isLoading, error } = useOHLCV(ticker, range);

  // Responsive height — 340px minimum, caps at 420px
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setChartHeight(Math.min(420, Math.max(240, Math.round(width * 0.38))));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Window data for large datasets
  const chartData = useMemo(() => {
    if (!ohlcv?.data) return [];
    const data = ohlcv.data;
    if (data.length > 500) {
      const step = Math.ceil(data.length / 500);
      return data.filter((_, i) => i % step === 0);
    }
    return data;
  }, [ohlcv]);

  const hasData = chartData.length > 0;
  const isNewIPO = ohlcv && ohlcv.data.length < 5 && range === '5y';

  const formatXAxis = (timestamp: string) => {
    const d = new Date(timestamp);
    if (range === '1d' || range === '5d') {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDownloadCSV = () => {
    if (ohlcv?.data) downloadOHLCVAsCSV(ticker, range, ohlcv.data);
  };

  const accessibleRows = chartData.slice(-10);

  return (
    <section className="price-chart" aria-labelledby="chart-heading">
      <div className="price-chart__toolbar">
        <h2 id="chart-heading" className="price-chart__title">Price History</h2>

        {/* Range selector — pill buttons */}
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
            Candle
          </button>
        </div>

        <button
          className="price-chart__download-btn"
          onClick={handleDownloadCSV}
          disabled={!hasData}
          aria-label="Download chart data as CSV"
        >
          ↓ CSV
        </button>
      </div>

      {isNewIPO && (
        <p className="price-chart__notice" role="note">
          Limited history available — this stock recently went public.
        </p>
      )}

      {isLoading && (
        <div className="price-chart__loading" aria-label="Loading chart data" aria-busy="true">
          <div className="price-chart__skeleton" />
        </div>
      )}

      {error && (
        <div className="price-chart__error" role="alert">{error}</div>
      )}

      {!isLoading && !error && hasData && (
        <div className="price-chart__canvas-wrapper" ref={containerRef} style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
            >
              {/* Gradient fill for area under price line — native SVG defs, not recharts exports */}
              <defs>
                <linearGradient id={`accentGrad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={THEME.accentColor} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={THEME.accentColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={THEME.gridColor}
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                tick={{ fontSize: THEME.textXs, fill: THEME.axisColor, fontFamily: THEME.fontMono }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`}
                tick={{ fontSize: THEME.textXs, fill: THEME.axisColor, fontFamily: THEME.fontMono }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                content={<OHLCVTooltip />}
                cursor={{ stroke: THEME.axisColor, strokeWidth: 1, strokeDasharray: '4 2' }}
              />

              {mode === 'line' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={THEME.accentColor}
                    strokeWidth={2}
                    fill={`url(#accentGrad-${ticker})`}
                    dot={false}
                    activeDot={{ r: 4, fill: THEME.accentColor, stroke: 'none' }}
                    name="Close"
                  />
                </>
              ) : (
                /* Candlestick approximation — bars colored by price direction */
                <>
                  <Bar
                    dataKey="volume"
                    yAxisId={0}
                    fill={THEME.gridColor}
                    opacity={0.5}
                    name="Volume"
                    radius={[2, 2, 0, 0]}
                  />
                  {chartData.map((bar: OHLCVBar, idx) => {
                    const isUp = bar.close >= bar.open;
                    return (
                      <ReferenceLine
                        key={idx}
                        x={bar.timestamp}
                        stroke={isUp ? THEME.positiveColor : THEME.negativeColor}
                        strokeWidth={4}
                        strokeOpacity={0.8}
                        segment={[
                          { x: bar.timestamp, y: Math.min(bar.open, bar.close) },
                          { x: bar.timestamp, y: Math.max(bar.open, bar.close) },
                        ]}
                      />
                    );
                  })}
                </>
              )}

              {/* Faint volume bars */}
              {mode === 'line' && (
                <Bar
                  dataKey="volume"
                  yAxisId={0}
                  fill={THEME.gridColor}
                  opacity={0.35}
                  name="Volume"
                  radius={[2, 2, 0, 0]}
                />
              )}
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

/**
 * Custom dark tooltip — OHLCV values in --color-bg-elevated card with mono font.
 * Positioned to avoid viewport overflow on first/last data points.
 */
const OHLCVTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
}> = ({ active, payload, label }) => {
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
        {new Date(bar.timestamp).toLocaleString('en-US', {
          month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </p>
      <dl>
        <div><dt>Open</dt><dd>{formatPrice(bar.open)}</dd></div>
        <div><dt>High</dt><dd>{formatPrice(bar.high)}</dd></div>
        <div><dt>Low</dt><dd>{formatPrice(bar.low)}</dd></div>
        <div><dt>Close</dt><dd>{formatPrice(bar.close)}</dd></div>
        <div><dt>Vol</dt><dd>{bar.volume.toLocaleString()}</dd></div>
      </dl>
    </div>
  );
};

export default PriceChart;
