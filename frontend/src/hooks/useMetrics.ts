import { useState, useEffect } from 'react';

export interface FundamentalMetrics {
  pe: number | null;
  pb: number | null;
  eps: number | null;
  dividendYield: number | null;
  beta: number | null;
  roe: number | null;
  debtToEquity: number | null;
}

export interface MetricsResponse {
  ticker: string;
  fiscalPeriod: string;
  lastUpdated: string;
  metrics: FundamentalMetrics;
}

interface UseMetricsReturn {
  data: MetricsResponse | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

/**
 * Fetches key financial ratios for a given ticker from /api/stocks/:ticker/metrics.
 */
export function useMetrics(ticker: string): UseMetricsReturn {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!ticker) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    setData(null);

    fetch(`/api/stocks/${encodeURIComponent(ticker.toUpperCase())}/metrics`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json: MetricsResponse = await res.json();
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [ticker]);

  return { data, isLoading, error, notFound };
}
