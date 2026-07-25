import { useState, useEffect } from 'react';

export type Sentiment = 'positive' | 'neutral' | 'caution' | 'negative';

export interface ELI5Section {
  topic: string;
  emoji: string;
  label: string;     // structured label from backend, e.g. 'pricey'
  rawValue: string;  // e.g. "P/E: 29.5x"
  sectorBenchmark?: string;
  sectorBenchmarkUnavailable?: boolean;
}

export interface ELI5Response {
  ticker: string;
  generatedAt: string;
  overallSentiment: Sentiment;
  headline: string;
  sections: ELI5Section[];
  dataAsOf: string;
}

interface UseELI5Return {
  data: ELI5Response | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

export function useELI5(ticker: string): UseELI5Return {
  const [data, setData] = useState<ELI5Response | null>(null);
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

    fetch(`/api/stocks/${encodeURIComponent(ticker.toUpperCase())}/eli5`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json: ELI5Response = await res.json();
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
