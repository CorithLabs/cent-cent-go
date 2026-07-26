import { useState, useEffect } from 'react';

export interface IndicatorDataPoint {
  date: string;
  value: number;
}

export interface IndicatorDetail {
  id: string;
  name: string;
  description: string;
  unit: string;
  data: IndicatorDataPoint[];
  nextRelease: string | null;
  source: string;
  relatedConcepts: string[];
}

interface UseEconomicIndicatorReturn {
  data: IndicatorDetail | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

/**
 * Fetches historical data for a specific economic indicator.
 * Follows the same hook pattern as useStockQuote.ts.
 */
export function useEconomicIndicator(
  id: string,
  range: '1y' | '5y' | '10y' | 'all' = '1y',
): UseEconomicIndicatorReturn {
  const [data, setData] = useState<IndicatorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    setData(null);

    const fetchData = async () => {
      try {
        const res = await fetch(
          `/api/economics/${encodeURIComponent(id.toUpperCase())}?range=${range}`,
        );

        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const json: IndicatorDetail = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError('Failed to load indicator data. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [id, range]);

  return { data, isLoading, error, notFound };
}
