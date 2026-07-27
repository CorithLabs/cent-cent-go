import { useState, useEffect } from 'react';

export interface LearnArticleCard {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  readTime: string;
}

export interface LearnListResponse {
  articles: LearnArticleCard[];
}

interface UseLearnListReturn {
  data: LearnListResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches all learn article cards from GET /api/learn.
 * Follows the same hook pattern as useStockQuote.ts.
 */
export function useLearnList(): UseLearnListReturn {
  const [data, setData] = useState<LearnListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const res = await fetch('/api/learn');
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const json: LearnListResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError('Failed to load concept articles. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  return { data, isLoading, error };
}
