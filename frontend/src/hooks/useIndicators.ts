import { useState, useEffect, useCallback } from 'react';

export type IndicatorKey = 'sma50' | 'sma200' | 'ema20' | 'bollinger' | 'rsi' | 'macd';

export interface IndicatorDataPoint {
  timestamp: string;
  value?: number;
  upper?: number; // Bollinger upper band
  lower?: number; // Bollinger lower band
  signal?: number; // MACD signal line
  histogram?: number; // MACD histogram
}

export interface IndicatorResult {
  indicator: IndicatorKey;
  period?: number;
  data: IndicatorDataPoint[];
  warning?: string; // e.g. "Insufficient data for full SMA 200"
}

export interface IndicatorConfig {
  key: IndicatorKey;
  label: string;
  color: string;
  subPanel: boolean; // RSI and MACD render in a sub-panel, not overlaid
  apiIndicator: string; // maps to backend enum
  period?: number;
}

export const INDICATOR_CONFIGS: IndicatorConfig[] = [
  { key: 'sma50',     label: 'SMA 50',         color: '#f59e0b', subPanel: false, apiIndicator: 'sma',       period: 50 },
  { key: 'sma200',    label: 'SMA 200',         color: '#8b5cf6', subPanel: false, apiIndicator: 'sma',       period: 200 },
  { key: 'ema20',     label: 'EMA 20',          color: '#10b981', subPanel: false, apiIndicator: 'ema',       period: 20 },
  { key: 'bollinger', label: 'Bollinger Bands', color: '#6366f1', subPanel: false, apiIndicator: 'bollinger', period: 20 },
  { key: 'rsi',       label: 'RSI (14)',         color: '#ef4444', subPanel: true,  apiIndicator: 'rsi',       period: 14 },
  { key: 'macd',      label: 'MACD',             color: '#3b82f6', subPanel: true,  apiIndicator: 'macd' },
];

interface UseIndicatorsReturn {
  activeKeys: Set<IndicatorKey>;
  toggleIndicator: (key: IndicatorKey) => void;
  data: Map<IndicatorKey, IndicatorResult>;
  loadingKeys: Set<IndicatorKey>;
  unavailableKeys: Set<IndicatorKey>; // e.g. RSI on 1D intraday
}

/**
 * Manages indicator toggle state and fetches indicator data on demand.
 * Indicators are fetched individually as they are toggled on.
 */
export function useIndicators(
  ticker: string,
  range: string
): UseIndicatorsReturn {
  const [activeKeys, setActiveKeys] = useState<Set<IndicatorKey>>(new Set());
  const [data, setData] = useState<Map<IndicatorKey, IndicatorResult>>(new Map());
  const [loadingKeys, setLoadingKeys] = useState<Set<IndicatorKey>>(new Set());

  // RSI and MACD require daily data — not available on 1D intraday
  const unavailableKeys = new Set<IndicatorKey>(
    range === '1d' ? ['rsi', 'macd'] as IndicatorKey[] : []
  );

  const fetchIndicator = useCallback(
    async (key: IndicatorKey) => {
      const config = INDICATOR_CONFIGS.find((c) => c.key === key);
      if (!config) return;

      setLoadingKeys((prev) => new Set(prev).add(key));

      try {
        const params = new URLSearchParams({
          indicator: config.apiIndicator,
          range,
        });
        if (config.period) params.set('period', String(config.period));

        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/indicators?${params}`);

        if (!res.ok) {
          console.warn(`Indicator ${key} fetch failed:`, res.status);
          return;
        }

        const result: IndicatorResult = await res.json();

        setData((prev) => {
          const next = new Map(prev);
          next.set(key, { ...result, indicator: key });
          return next;
        });
      } catch (err) {
        console.warn(`Indicator ${key} error:`, err);
      } finally {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [ticker, range]
  );

  const toggleIndicator = useCallback(
    (key: IndicatorKey) => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
          // Fetch if not already loaded
          if (!data.has(key)) {
            fetchIndicator(key);
          }
        }
        return next;
      });
    },
    [data, fetchIndicator]
  );

  // Re-fetch active indicators when range changes
  useEffect(() => {
    if (activeKeys.size === 0) return;
    activeKeys.forEach((key) => {
      if (!unavailableKeys.has(key)) {
        fetchIndicator(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return { activeKeys, toggleIndicator, data, loadingKeys, unavailableKeys };
}
