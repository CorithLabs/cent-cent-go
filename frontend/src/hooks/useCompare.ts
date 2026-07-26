import { useState, useEffect } from 'react';

export interface NormalizedPrice {
  date: string;
  value: number;
}

export interface CompareMetrics {
  pe: number | null;
  marketCap: number | null;
  ytdReturn: number | null;
  revenue: number | null;
}

export interface CompareTickerResult {
  ticker: string;
  name: string;
  normalizedPrices: NormalizedPrice[];
  metrics: CompareMetrics;
}

export interface CompareResponse {
  tickers: CompareTickerResult[];
  warnings?: string[];
  startDateDisclosure?: string;
}

interface UseCompareReturn {
  data: CompareResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches normalized price history and metrics for 2–5 tickers.
 * Follows the same hook pattern as useStockQuote.ts.
 */
export function useCompare(
  tickers: string[],
  range: string,
): UseCompareReturn {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickersKey = tickers.join(',');

  useEffect(() => {
    if (tickers.length < 2) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setData(null);

    const fetchData = async () => {
      try {
        const params = new URLSearchParams({
          tickers: tickers.map((t) => t.toUpperCase()).join(','),
          range,
        });
        const res = await fetch(`/api/compare?${params}`);

        if (res.status === 400) {
          const body = await res.json();
          if (!cancelled) setError(body.error ?? 'Invalid request');
          return;
        }

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const json: CompareResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError('Failed to load comparison data. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey, range]);

  return { data, isLoading, error };
}
