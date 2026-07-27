import { useState, useEffect } from 'react';

export interface EconomicIndicator {
  id: string;
  name: string;
  value: number;
  unit: string;
  change: number;
  trend: { date: string; value: number }[];
  lastUpdated: string;  // ISO timestamp
  nextRelease: string | null; // ISO timestamp or null
  source: string;
  stale?: boolean;
}

export interface EconomicsResponse {
  indicators: EconomicIndicator[];
}

interface UseEconomicsReturn {
  data: EconomicsResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches all economic indicators from GET /api/economics.
 * Follows the same hook pattern as useStockQuote.ts.
 */
export function useEconomics(): UseEconomicsReturn {
  const [data, setData] = useState<EconomicsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const res = await fetch('/api/economics');
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const json: EconomicsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError('Failed to load economic indicators. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  return { data, isLoading, error };
}
