import { useState, useEffect } from 'react';
import { ChartRange } from './useOHLCV';

export type IndicatorKey =
  | 'sma_50'
  | 'sma_200'
  | 'ema_20'
  | 'bollinger'
  | 'rsi'
  | 'macd';

// Map from our UI key to what the backend `indicator` param expects
const INDICATOR_PARAM: Record<IndicatorKey, string> = {
  sma_50:    'sma',
  sma_200:   'sma',
  ema_20:    'ema',
  bollinger: 'bollinger',
  rsi:       'rsi',
  macd:      'macd',
};

// Period to use for each indicator type
const INDICATOR_PERIOD: Partial<Record<IndicatorKey, number>> = {
  sma_50:  50,
  sma_200: 200,
  ema_20:  20,
};

// Ranges for which an indicator is not meaningful
const UNSUPPORTED_RANGE: Partial<Record<IndicatorKey, ChartRange[]>> = {
  sma_200: ['1d', '5d', '1m'],
  sma_50:  ['1d', '5d'],
  macd:    ['1d'],
  rsi:     ['1d'],
};

export interface IndicatorPoint {
  timestamp: string;
  value: number;
  // MACD extras
  signal?: number;
  histogram?: number;
  // Bollinger extras
  upper?: number;
  lower?: number;
}

interface UseIndicatorsReturn {
  data: IndicatorPoint[] | null;
  isLoading: boolean;
  error: string | null;
  unavailable: boolean;
}

/**
 * Fetches technical indicator data for a given ticker, indicator key, and range.
 * Returns `unavailable: true` for combinations that are unsupported (e.g. RSI on 1D).
 */
export function useIndicators(
  ticker: string,
  key: IndicatorKey,
  range: ChartRange
): UseIndicatorsReturn {
  const [data, setData] = useState<IndicatorPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unsupportedRanges = UNSUPPORTED_RANGE[key] ?? [];
  const unavailable = unsupportedRanges.includes(range);

  useEffect(() => {
    if (!ticker || unavailable) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const params = new URLSearchParams({
          indicator: INDICATOR_PARAM[key],
          range,
        });
        const period = INDICATOR_PERIOD[key];
        if (period != null) params.set('period', String(period));

        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/indicators?${params.toString()}`
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Server returned ${res.status}`);
        }

        const json = await res.json();
        // Backend returns { indicator, period, data: [...] }
        if (!cancelled) setData(json.data ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load indicator data');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [ticker, key, range, unavailable]);

  return { data, isLoading, error, unavailable };
}
