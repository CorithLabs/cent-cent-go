import React from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';
import { IndicatorDataPoint } from '../../hooks/useIndicators';

const THEME = {
  gridColor:    '#1E2530',
  axisColor:    '#64748B',
  accentColor:  '#3B82F6',
  signalColor:  '#F59E0B',
  positiveColor:'#22C55E',
  negativeColor:'#EF4444',
  fontMono:     "'JetBrains Mono', ui-monospace, monospace",
  textXs:       '11px',
};

interface MACDPanelProps {
  data: IndicatorDataPoint[];
  height?: number;
}

/**
 * MACDPanel — themed MACD sub-chart.
 *
 * AC: Same grid/axis/background style as PriceChart.
 * AC: Histogram bars: positive = --color-positive, negative = --color-negative.
 * AC: MACD line (blue) and Signal line (amber) overlaid.
 * AC: Responsive container.
 */
const MACDPanel: React.FC<MACDPanelProps> = ({ data, height = 120 }) => {
  const formatX = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div
      className="indicator-subpanel"
      role="img"
      aria-label="MACD sub-chart with histogram, MACD line, and signal line"
    >
      <div className="indicator-subpanel__label">
        <span className="indicator-subpanel__title">MACD</span>
        <span className="indicator-subpanel__legend">
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: THEME.accentColor, marginRight: 4 }} aria-hidden="true" />
          MACD
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: THEME.signalColor, margin: '0 4px 0 10px' }} aria-hidden="true" />
          Signal
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={THEME.gridColor}
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatX}
            tick={{ fontSize: THEME.textXs, fill: THEME.axisColor, fontFamily: THEME.fontMono }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: THEME.textXs, fill: THEME.axisColor, fontFamily: THEME.fontMono }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            content={<MACDTooltip />}
            cursor={{ stroke: THEME.axisColor, strokeWidth: 1, strokeDasharray: '4 2' }}
          />

          <ReferenceLine y={0} stroke={THEME.axisColor} strokeOpacity={0.5} strokeWidth={1} />

          {/* Histogram bars — colored by sign */}
          <Bar dataKey="histogram" name="Histogram" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={(entry.histogram ?? 0) >= 0 ? THEME.positiveColor : THEME.negativeColor}
                fillOpacity={0.7}
              />
            ))}
          </Bar>

          {/* MACD line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={THEME.accentColor}
            strokeWidth={1.5}
            dot={false}
            name="MACD"
          />

          {/* Signal line */}
          <Line
            type="monotone"
            dataKey="signal"
            stroke={THEME.signalColor}
            strokeWidth={1.5}
            dot={false}
            name="Signal"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

const MACDTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({
  active, payload, label,
}) => {
  if (!active || !payload?.length) return null;
  const macd = payload.find((p) => p.name === 'MACD')?.value;
  const signal = payload.find((p) => p.name === 'Signal')?.value;
  const hist = payload.find((p) => p.name === 'Histogram')?.value;

  return (
    <div className="price-chart__tooltip" role="tooltip">
      <p className="price-chart__tooltip-date">
        {label ? new Date(label).toLocaleDateString() : ''}
      </p>
      <dl>
        {macd !== undefined && <div><dt>MACD</dt><dd>{macd?.toFixed(4)}</dd></div>}
        {signal !== undefined && <div><dt>Signal</dt><dd>{signal?.toFixed(4)}</dd></div>}
        {hist !== undefined && (
          <div>
            <dt>Hist</dt>
            <dd style={{ color: hist >= 0 ? THEME.positiveColor : THEME.negativeColor }}>
              {hist?.toFixed(4)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
};

export default MACDPanel;
