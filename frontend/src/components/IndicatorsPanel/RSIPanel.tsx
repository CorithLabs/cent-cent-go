import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { IndicatorDataPoint } from '../../hooks/useIndicators';

// Matches PriceChart THEME constants
const THEME = {
  gridColor:    '#1E2530',
  axisColor:    '#64748B',
  accentColor:  '#3B82F6',
  fontMono:     "'JetBrains Mono', ui-monospace, monospace",
  textXs:       '11px',
};

interface RSIPanelProps {
  data: IndicatorDataPoint[];
  height?: number;
}

/**
 * RSIPanel — themed RSI sub-chart.
 *
 * AC: Same grid/axis/background style as PriceChart.
 * AC: Overbought (70) and oversold (30) dashed reference lines with subtle labels.
 * AC: Responsive container.
 */
const RSIPanel: React.FC<RSIPanelProps> = ({ data, height = 120 }) => {
  const formatX = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div
      className="indicator-subpanel"
      role="img"
      aria-label="RSI (14) sub-chart showing overbought and oversold levels"
    >
      <div className="indicator-subpanel__label">
        <span className="indicator-subpanel__title">RSI (14)</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
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
            domain={[0, 100]}
            ticks={[0, 30, 50, 70, 100]}
            tick={{ fontSize: THEME.textXs, fill: THEME.axisColor, fontFamily: THEME.fontMono }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            content={<RSITooltip />}
            cursor={{ stroke: THEME.axisColor, strokeWidth: 1, strokeDasharray: '4 2' }}
          />

          {/* Overbought line */}
          <ReferenceLine
            y={70}
            stroke={THEME.axisColor}
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{
              value: 'OB 70',
              fill: THEME.axisColor,
              fontSize: 9,
              fontFamily: THEME.fontMono,
              position: 'right',
            }}
          />
          {/* Oversold line */}
          <ReferenceLine
            y={30}
            stroke={THEME.axisColor}
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{
              value: 'OS 30',
              fill: THEME.axisColor,
              fontSize: 9,
              fontFamily: THEME.fontMono,
              position: 'right',
            }}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke={THEME.accentColor}
            strokeWidth={1.5}
            dot={false}
            name="RSI"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const RSITooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({
  active, payload, label,
}) => {
  if (!active || !payload?.length) return null;
  const val: number = payload[0]?.value;
  return (
    <div className="price-chart__tooltip" role="tooltip">
      <p className="price-chart__tooltip-date">
        {label ? new Date(label).toLocaleDateString() : ''}
      </p>
      <dl>
        <div>
          <dt>RSI</dt>
          <dd style={{ color: val >= 70 ? '#EF4444' : val <= 30 ? '#22C55E' : undefined }}>
            {val?.toFixed(2)}
          </dd>
        </div>
      </dl>
    </div>
  );
};

export default RSIPanel;
