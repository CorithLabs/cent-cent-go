import React, { useState } from 'react';
import { IndicatorKey, IndicatorConfig, INDICATOR_CONFIGS } from '../../hooks/useIndicators';
import './IndicatorsPanel.css';

interface IndicatorsPanelProps {
  activeKeys: Set<IndicatorKey>;
  loadingKeys: Set<IndicatorKey>;
  unavailableKeys: Set<IndicatorKey>;
  onToggle: (key: IndicatorKey) => void;
}

/**
 * IndicatorsPanel — toggle panel for technical indicators.
 * AC: "Indicators" button opens panel with SMA 50, SMA 200, EMA 20, Bollinger, RSI, MACD.
 * AC: Toggling on fetches and overlays data.
 * AC: Color-coded legend for active indicators.
 * AC: "Not available for this range" tooltip for unavailable indicators.
 */
export const IndicatorsPanel: React.FC<IndicatorsPanelProps> = ({
  activeKeys,
  loadingKeys,
  unavailableKeys,
  onToggle,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="indicators-panel">
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

      {open && (
        <div id="indicators-list" className="indicators-panel__dropdown" role="group" aria-label="Technical indicators">
          {INDICATOR_CONFIGS.map((config: IndicatorConfig) => {
            const isActive = activeKeys.has(config.key);
            const isLoading = loadingKeys.has(config.key);
            const isUnavailable = unavailableKeys.has(config.key);

            return (
              <div key={config.key} className="indicators-panel__item">
                <button
                  className={`indicators-panel__indicator-btn${isActive ? ' indicators-panel__indicator-btn--active' : ''}${isUnavailable ? ' indicators-panel__indicator-btn--unavailable' : ''}`}
                  onClick={() => !isUnavailable && onToggle(config.key)}
                  aria-pressed={isActive}
                  aria-disabled={isUnavailable}
                  disabled={isUnavailable}
                  title={isUnavailable ? 'Not available for this time range' : undefined}
                >
                  {/* Color swatch */}
                  <span
                    className="indicators-panel__color-dot"
                    style={{ background: isActive ? config.color : 'var(--color-border)' }}
                    aria-hidden="true"
                  />
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

      {/* Active legend below the chart toolbar */}
      {activeKeys.size > 0 && (
        <div className="indicators-panel__legend" aria-label="Active indicators legend">
          {INDICATOR_CONFIGS.filter((c) => activeKeys.has(c.key)).map((config) => (
            <span key={config.key} className="indicators-panel__legend-item">
              <span
                className="indicators-panel__legend-dot"
                style={{ background: config.color }}
                aria-hidden="true"
              />
              <span>{config.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
