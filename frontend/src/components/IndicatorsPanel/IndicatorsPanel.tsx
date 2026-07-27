import React, { useState } from 'react';
import { IndicatorKey, IndicatorConfig, IndicatorResult, INDICATOR_CONFIGS } from '../../hooks/useIndicators';
import { ChartRange } from '../../hooks/useOHLCV';
import RSIPanel from './RSIPanel';
import MACDPanel from './MACDPanel';
import './IndicatorsPanel.css';

interface IndicatorsPanelProps {
  activeKeys: Set<IndicatorKey>;
  loadingKeys: Set<IndicatorKey>;
  /**
   * Keys that are not available for the current time range.
   * If `range` prop is provided, this is computed automatically and this prop
   * is ignored. Pass explicitly only when `range` is not available.
   */
  unavailableKeys?: Set<IndicatorKey>;
  onToggle: (key: IndicatorKey) => void;
  /** Map of indicator data — used to render RSI/MACD sub-panels */
  data?: Map<IndicatorKey, IndicatorResult>;
  /**
   * Current chart range (ChartRange). Used to compute which indicators are
   * unavailable (e.g. RSI/MACD require daily bars, not available on 1D intraday).
   * Must be typed as ChartRange ('1d'|'5d'|'1m'|'6m'|'1y'|'5y'), NOT ChartInterval.
   */
  range?: ChartRange;
}

/**
 * IndicatorsPanel — toggle panel for technical indicators.
 *
 * AC: "Indicators" button opens panel with SMA 50, SMA 200, EMA 20, Bollinger, RSI, MACD.
 * AC: Each active indicator shows colored swatch + label using --font-mono --text-xs.
 * AC: Bollinger Bands swatch is dashed (#64748B).
 * AC: RSI overbought/oversold lines and MACD histogram rendered in sub-panels.
 * AC: Panel height auto-expands when RSI + MACD are both active — no content clipping.
 */
export const IndicatorsPanel: React.FC<IndicatorsPanelProps> = ({
  activeKeys,
  loadingKeys,
  unavailableKeys: unavailableKeysProp,
  onToggle,
  data = new Map(),
  range,
}) => {
  const [open, setOpen] = useState(false);

  // Compute unavailable keys from range if provided; else fall back to prop
  const unavailableKeys: Set<IndicatorKey> = range !== undefined
    ? new Set<IndicatorKey>(range === '1d' ? ['rsi', 'macd'] as IndicatorKey[] : [])
    : (unavailableKeysProp ?? new Set<IndicatorKey>());

  const rsiActive = activeKeys.has('rsi');
  const macdActive = activeKeys.has('macd');
  const rsiData = data.get('rsi')?.data ?? [];
  const macdData = data.get('macd')?.data ?? [];

  return (
    <div className="indicators-panel">
      {/* ── Toggle button ─────────────────────────────────────────────── */}
      <button
        className={`indicators-panel__toggle${open ? ' indicators-panel__toggle--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="indicators-list"
      >
        <span>Indicators</span>
        {activeKeys.size > 0 && (
          <span className="indicators-panel__badge" aria-label={`${activeKeys.size} active`}>
            {activeKeys.size}
          </span>
        )}
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Dropdown ──────────────────────────────────────────────────── */}
      {open && (
        <div
          id="indicators-list"
          className="indicators-panel__dropdown"
          role="group"
          aria-label="Technical indicators"
        >
          {INDICATOR_CONFIGS.map((config: IndicatorConfig) => {
            const isActive = activeKeys.has(config.key);
            const isLoading = loadingKeys.has(config.key);
            const isUnavailable = unavailableKeys.has(config.key);

            return (
              <div key={config.key} className="indicators-panel__item">
                <button
                  className={`indicators-panel__indicator-btn${isActive ? ' indicators-panel__indicator-btn--active' : ''}${isUnavailable ? ' indicators-panel__indicator-btn--unavailable' : ''}`}
                  onClick={() => !isUnavailable && onToggle(config.key)}
                  aria-label={`Toggle ${config.label}`}
                  aria-pressed={isActive}
                  aria-disabled={isUnavailable}
                  disabled={isUnavailable}
                  title={isUnavailable ? 'Not available for this time range' : undefined}
                >
                  {/* Color swatch — dashed for Bollinger */}
                  {config.dashed ? (
                    <span
                      className="indicators-panel__color-dot indicators-panel__legend-dot--dashed"
                      style={{ color: isActive ? config.color : 'var(--color-bg-elevated)' }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="indicators-panel__color-dot"
                      style={{ background: isActive ? config.color : 'var(--color-bg-elevated)' }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="indicators-panel__label">{config.label}</span>
                  {isLoading && <span className="indicators-panel__spinner" aria-label="Loading" />}
                  {isUnavailable && (
                    <span className="indicators-panel__unavailable-badge">
                      Not available for 1D range
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Active legend ─────────────────────────────────────────────── */}
      {activeKeys.size > 0 && (
        <div className="indicators-panel__legend" aria-label="Active indicators legend">
          {INDICATOR_CONFIGS.filter((c) => activeKeys.has(c.key)).map((config) => (
            <span key={config.key} className="indicators-panel__legend-item">
              {config.dashed ? (
                <span
                  className="indicators-panel__legend-dot indicators-panel__legend-dot--dashed"
                  style={{ color: config.color }}
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="indicators-panel__legend-dot"
                  style={{ background: config.color }}
                  aria-hidden="true"
                />
              )}
              <span>{config.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Sub-panels for RSI / MACD ─────────────────────────────────── */}
      {(rsiActive || macdActive) && (
        <div className="indicators-panel__subpanels">
          {rsiActive && rsiData.length > 0 && (
            <RSIPanel data={rsiData} height={macdActive ? 100 : 120} />
          )}
          {macdActive && macdData.length > 0 && (
            <MACDPanel data={macdData} height={rsiActive ? 100 : 120} />
          )}
        </div>
      )}
    </div>
  );
};
