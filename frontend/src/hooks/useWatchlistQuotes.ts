import { useState, useEffect } from 'react';

export interface WatchlistQuote {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  lastUpdated: string;
  delisted?: boolean;
}

export interface WatchlistQuotesResponse {
  quotes: WatchlistQuote[];
}

interface UseWatchlistQuotesReturn {
  quotes: WatchlistQuote[];
  isLoading: boolean;
  error: string | null;
}

/**
 * useWatchlistQuotes — fetches live mini-quotes for a list of tickers.
 *
 * AC: Reads tickers from parameter (caller reads localStorage).
 * AC: Calls GET /api/stocks/quotes?tickers=AAPL,MSFT,...
 * AC: Returns { quotes, isLoading, error }.
 * AC: Batch quotes response shape: { quotes: [{ ticker, price, change, changePct, lastUpdated }] }
 * AC: Same hook pattern as useStockQuote.ts.
 */
export function useWatchlistQuotes(tickers: string[]): UseWatchlistQuotesReturn {
  const [quotes, setQuotes] = useState<WatchlistQuote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickersKey = tickers.join(',');

  useEffect(() => {
    if (tickers.length === 0) {
      setQuotes([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchQuotes = async () => {
      try {
        const params = new URLSearchParams({
          tickers: tickers.map((t) => t.toUpperCase()).join(','),
        });
        const res = await fetch(`/api/stocks/quotes?${params}`);

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data: WatchlistQuotesResponse = await res.json();
        if (!cancelled) setQuotes(data.quotes ?? []);
      } catch (err) {
        if (!cancelled) setError('Failed to load watchlist quotes. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchQuotes();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey]);

  return { quotes, isLoading, error };
}
