import React, { useState, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Bar,
} from 'recharts';
import { useIndicators, IndicatorKey } from '../../hooks/useIndicators';
import { ChartRange } from '../../hooks/useOHLCV';
import './IndicatorsPanel.css';

interface IndicatorConfig {
  key: IndicatorKey;
  label: string;
  color: string;
  subPanel?: boolean; // renders in its own sub-chart rather than as main overlay
  description: string;
}

const INDICATOR_CONFIGS: IndicatorConfig[] = [
  { key: 'sma_50',       label: 'SMA 50',         color: '#F59E0B', subPanel: false, description: '50-day simple moving average' },
  { key: 'sma_200',      label: 'SMA 200',        color: '#8B5CF6', subPanel: false, description: '200-day simple moving average' },
  { key: 'ema_20',       label: 'EMA 20',         color: '#06B6D4', subPanel: false, description: '20-day exponential moving average' },
  { key: 'bollinger',    label: 'Bollinger Bands', color: '#64748B', subPanel: false, description: 'Volatility envelope (20-day, 2σ)' },
  { key: 'rsi',          label: 'RSI',            color: '#EC4899', subPanel: true,  description: 'Relative Strength Index (14-day)' },
  { key: 'macd',         label: 'MACD',           color: '#22C55E', subPanel: true,  description: 'Moving Average Convergence Divergence' },
];

interface IndicatorsPanelProps {
  ticker: string;
  range: ChartRange;
  /** Extra line series from the parent chart to extend with indicator overlays */
  chartDataKey?: string;
}

/**
 * IndicatorsPanel — toggle panel for SMA/EMA/Bollinger/RSI/MACD indicators.
 * Overlay indicators (SMA, EMA, Bollinger) are rendered as color-coded lines
 * on a shared mini-chart. Sub-panel indicators (RSI, MACD) each get their own
 * scrollable sub-chart below the toggle list.
 *
 * AC: Toggle an indicator on to fetch its data and show it with a color legend.
 * AC: Multiple indicators can be active simultaneously.
 * AC: Each indicator shows a color-coded legend entry.
 * AC: RSI/MACD render in sub-panels; SMA/EMA/Bollinger render as overlays.
 * AC: Unavailable indicator for selected range shows a notice.
 */
export const IndicatorsPanel: React.FC<IndicatorsPanelProps> = ({ ticker, range }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Set<IndicatorKey>>(new Set());

  const toggleIndicator = useCallback((key: IndicatorKey) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const activeOverlays = INDICATOR_CONFIGS.filter(
    (c) => !c.subPanel && active.has(c.key)
  );
  const activeSubPanels = INDICATOR_CONFIGS.filter(
    (c) => c.subPanel && active.has(c.key)
  );

  return (
    <section className="indicators-panel" aria-label="Technical indicators">
      {/* Toggle button */}
      <button
        className={`indicators-panel__toggle${open ? ' indicators-panel__toggle--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="indicators-panel__list"
      >
        <span className="indicators-panel__toggle-icon" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
        Indicators
        {active.size > 0 && (
          <span className="indicators-panel__badge" aria-label={`${active.size} active`}>
            {active.size}
          </span>
        )}
      </button>

      {/* Indicator selection list */}
      {open && (
        <div id="indicators-panel__list" className="indicators-panel__list">
          {INDICATOR_CONFIGS.map((cfg) => (
            <IndicatorToggleRow
              key={cfg.key}
              config={cfg}
              isActive={active.has(cfg.key)}
              ticker={ticker}
              range={range}
              onToggle={toggleIndicator}
            />
          ))}
        </div>
      )}

      {/* Active indicator legend */}
      {active.size > 0 && (
        <div className="indicators-panel__legend" role="list" aria-label="Active indicators">
          {INDICATOR_CONFIGS.filter((c) => active.has(c.key)).map((cfg) => (
            <span
              key={cfg.key}
              className="indicators-panel__legend-item"
              role="listitem"
              style={{ '--indicator-color': cfg.color } as React.CSSProperties}
            >
              <span
                className="indicators-panel__legend-swatch"
                aria-hidden="true"
                style={{ backgroundColor: cfg.color }}
              />
              {cfg.label}
            </span>
          ))}
        </div>
      )}

      {/* Overlay chart — shown when at least one overlay indicator is active */}
      {activeOverlays.length > 0 && (
        <OverlayChart
          ticker={ticker}
          range={range}
          overlays={activeOverlays}
        />
      )}

      {/* Sub-panel charts */}
      {activeSubPanels.map((cfg) => (
        <SubPanelChart
          key={cfg.key}
          ticker={ticker}
          range={range}
          config={cfg}
        />
      ))}
    </section>
  );
};

/* ─── IndicatorToggleRow ───────────────────────────────────────────────────── */

interface IndicatorToggleRowProps {
  config: IndicatorConfig;
  isActive: boolean;
  ticker: string;
  range: ChartRange;
  onToggle: (key: IndicatorKey) => void;
}

const IndicatorToggleRow: React.FC<IndicatorToggleRowProps> = ({
  config,
  isActive,
  onToggle,
}) => {
  return (
    <label
      className={`indicators-panel__row${isActive ? ' indicators-panel__row--active' : ''}`}
      title={config.description}
    >
      <input
        type="checkbox"
        checked={isActive}
        onChange={() => onToggle(config.key)}
        aria-label={`Toggle ${config.label}`}
        className="indicators-panel__checkbox"
      />
      <span
        className="indicators-panel__color-dot"
        aria-hidden="true"
        style={{ backgroundColor: config.color }}
      />
      <span className="indicators-panel__label">{config.label}</span>
      <span className="indicators-panel__desc">{config.description}</span>
    </label>
  );
};

/* ─── OverlayChart ────────────────────────────────────────────────────────── */

interface OverlayChartProps {
  ticker: string;
  range: ChartRange;
  overlays: IndicatorConfig[];
}

const OverlayChart: React.FC<OverlayChartProps> = ({ ticker, range, overlays }) => {
  // Fetch each active overlay's data — we pick the first one to drive the x-axis
  // and merge the rest onto the same time index.
  const datasets = overlays.map((cfg) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return { config: cfg, ...useIndicators(ticker, cfg.key, range) };
  });

  const isLoading = datasets.some((d) => d.isLoading);

  // Merge datasets by timestamp
  const merged = React.useMemo(() => {
    if (datasets.length === 0) return [];
    const base = datasets[0].data ?? [];
    return base.map((point) => {
      const row: Record<string, unknown> = { timestamp: point.timestamp, value: point.value };
      datasets.slice(1).forEach((d) => {
        const match = d.data?.find((p) => p.timestamp === point.timestamp);
        row[d.config.key] = match?.value ?? null;
      });
      return row;
    });
  }, [datasets]);

  if (isLoading) {
    return (
      <div className="indicators-panel__sub-chart indicators-panel__sub-chart--loading" aria-busy="true" aria-label="Loading indicator data" />
    );
  }

  if (merged.length === 0) {
    return (
      <div className="indicators-panel__unavailable" role="status">
        Not available for this range.
      </div>
    );
  }

  const formatX = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div
      className="indicators-panel__sub-chart"
      aria-label={`Overlay indicators chart for ${ticker}`}
    >
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={merged} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatX}
            tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
            tickLine={false}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            content={<OverlayTooltip overlays={overlays} />}
          />
          {/* First overlay */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={overlays[0].color}
            strokeWidth={1.5}
            dot={false}
            name={overlays[0].label}
          />
          {/* Additional overlays */}
          {overlays.slice(1).map((cfg) => (
            <Line
              key={cfg.key}
              type="monotone"
              dataKey={cfg.key}
              stroke={cfg.color}
              strokeWidth={1.5}
              dot={false}
              name={cfg.label}
              strokeDasharray={cfg.key === 'bollinger' ? '4 2' : undefined}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

const OverlayTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
  overlays: IndicatorConfig[];
}> = ({ active, payload, label, overlays }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="indicators-panel__tooltip" role="tooltip">
      <p className="indicators-panel__tooltip-date">
        {label ? new Date(label).toLocaleDateString() : ''}
      </p>
      {payload.map((entry: any, i: number) => {
        const cfg = overlays[i];
        return (
          <div key={i} className="indicators-panel__tooltip-row">
            <span style={{ color: cfg?.color }}>{entry.name}:</span>{' '}
            <span>{typeof entry.value === 'number' ? `$${entry.value.toFixed(2)}` : '—'}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ─── SubPanelChart ───────────────────────────────────────────────────────── */

interface SubPanelChartProps {
  ticker: string;
  range: ChartRange;
  config: IndicatorConfig;
}

const SubPanelChart: React.FC<SubPanelChartProps> = ({ ticker, range, config }) => {
  const { data, isLoading, unavailable } = useIndicators(ticker, config.key, range);

  if (isLoading) {
    return (
      <div
        className="indicators-panel__sub-chart indicators-panel__sub-chart--loading"
        aria-busy="true"
        aria-label={`Loading ${config.label} data`}
      />
    );
  }

  if (unavailable || !data || data.length === 0) {
    return (
      <div className="indicators-panel__sub-panel">
        <p className="indicators-panel__sub-panel-title">{config.label}</p>
        <div className="indicators-panel__unavailable" role="status">
          Not available for this range.
        </div>
      </div>
    );
  }

  const formatX = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const isRSI = config.key === 'rsi';
  const isMACD = config.key === 'macd';

  return (
    <div
      className="indicators-panel__sub-panel"
      aria-label={`${config.label} chart for ${ticker}`}
    >
      <p className="indicators-panel__sub-panel-title">{config.label}</p>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatX}
            tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
            tickLine={false}
          />
          <YAxis
            domain={isRSI ? [0, 100] : ['auto', 'auto']}
            tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip formatter={(v: number) => v.toFixed(2)} />

          {/* RSI reference lines */}
          {isRSI && (
            <>
              <ReferenceLine
                y={70}
                stroke="var(--color-danger)"
                strokeDasharray="4 2"
                label={{ value: 'Overbought', position: 'insideTopRight', fontSize: 9, fill: 'var(--color-danger)' }}
              />
              <ReferenceLine
                y={30}
                stroke="var(--color-success)"
                strokeDasharray="4 2"
                label={{ value: 'Oversold', position: 'insideBottomRight', fontSize: 9, fill: 'var(--color-success)' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={1.5}
                dot={false}
                name="RSI"
              />
            </>
          )}

          {/* MACD bars + signal line */}
          {isMACD && (
            <>
              <Bar
                dataKey="histogram"
                fill={config.color}
                name="MACD Histogram"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={1.5}
                dot={false}
                name="MACD"
              />
              <Line
                type="monotone"
                dataKey="signal"
                stroke="#F59E0B"
                strokeWidth={1.5}
                dot={false}
                name="Signal"
              />
            </>
          )}

          {/* Generic fallback */}
          {!isRSI && !isMACD && (
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={1.5}
              dot={false}
              name={config.label}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default IndicatorsPanel;
