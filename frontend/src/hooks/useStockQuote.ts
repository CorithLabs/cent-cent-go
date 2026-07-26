import { useState, useEffect } from 'react';

export interface StockQuote {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number;
  volume: number;
  week52High: number;
  week52Low: number;
  exchange: string;
  lastUpdated: string; // ISO timestamp
  status: 'active' | 'suspended' | 'delisted';
  stale?: boolean;
}

interface UseStockQuoteReturn {
  quote: StockQuote | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

/**
 * Fetches the current stock quote for a given ticker from /api/stocks/:ticker.
 * Handles 404 (not found) and network errors gracefully.
 */
export function useStockQuote(ticker: string): UseStockQuoteReturn {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!ticker) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    setQuote(null);

    const fetchQuote = async () => {
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker.toUpperCase())}`);

        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data: StockQuote = await res.json();
        if (!cancelled) setQuote(data);
      } catch (err) {
        if (!cancelled) setError('Failed to load stock data. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchQuote();
    return () => { cancelled = true; };
  }, [ticker]);

  return { quote, isLoading, error, notFound };
}
