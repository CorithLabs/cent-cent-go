import { useState, useEffect } from 'react';

export type ChartRange = '1d' | '5d' | '1m' | '6m' | '1y' | '5y';
export type ChartInterval = '1m' | '5m' | '1h' | '1d';

export interface OHLCVBar {
  timestamp: string; // ISO
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCVData {
  ticker: string;
  range: ChartRange;
  interval: ChartInterval;
  data: OHLCVBar[];
  dataSource: string;
  lastUpdated: string;
}

interface UseOHLCVReturn {
  ohlcv: OHLCVData | null;
  isLoading: boolean;
  error: string | null;
}

// Default interval for each range
export const DEFAULT_INTERVAL: Record<ChartRange, ChartInterval> = {
  '1d': '5m',
  '5d': '1h',
  '1m': '1d',
  '6m': '1d',
  '1y': '1d',
  '5y': '1d',
};

/**
 * Fetches OHLCV time-series data for a stock chart.
 * Automatically uses the appropriate interval for the selected range.
 */
export function useOHLCV(
  ticker: string,
  range: ChartRange,
  interval?: ChartInterval
): UseOHLCVReturn {
  const [ohlcv, setOhlcv] = useState<OHLCVData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveInterval = interval ?? DEFAULT_INTERVAL[range];

  useEffect(() => {
    if (!ticker) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const url = `/api/stocks/${encodeURIComponent(ticker)}/history?range=${range}&interval=${effectiveInterval}`;
        const res = await fetch(url);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Server returned ${res.status}`);
        }

        const data: OHLCVData = await res.json();
        if (!cancelled) setOhlcv(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chart data');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [ticker, range, effectiveInterval]);

  return { ohlcv, isLoading, error };
}
