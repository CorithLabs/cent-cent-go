import { useState, useEffect } from 'react';

export interface HeatmapStock {
  ticker: string;
  name: string;
  marketCap: number | null;
  change: number;
  sector: string;
  price?: number;
  halted?: boolean;
}

export interface HeatmapSector {
  name: string;
  change: number;
  stocks: HeatmapStock[];
}

export interface HeatmapResponse {
  sectors: HeatmapSector[];
  marketClosed?: boolean;
  incomplete?: boolean;
  asOf: string;
}

interface UseHeatmapReturn {
  data: HeatmapResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches sector heatmap data from GET /api/sectors/heatmap.
 * Follows the same hook pattern as useStockQuote.ts.
 */
export function useHeatmap(period: '1d' | '5d' | '1m' = '1d'): UseHeatmapReturn {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/sectors/heatmap?period=${period}`);
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const json: HeatmapResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError('Failed to load sector heatmap. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [period]);

  return { data, isLoading, error };
}
