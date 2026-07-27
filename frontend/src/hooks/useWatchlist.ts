import { useState, useCallback, useEffect } from 'react';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  MAX_WATCHLIST_SIZE,
} from '../utils/watchlist';

interface UseWatchlistReturn {
  tickers: string[];
  addTicker: (ticker: string) => 'added' | 'already_exists' | 'limit_exceeded';
  removeTicker: (ticker: string) => void;
  isWatching: (ticker: string) => boolean;
  maxSize: number;
}

/**
 * useWatchlist — manages a localStorage-persisted watchlist.
 * Keeps React state in sync with localStorage.
 *
 * AC: Watchlist persisted in localStorage (no account required).
 * AC: Persists across page refreshes.
 * AC: Limited to 50 stocks — adding beyond shows warning.
 */
export function useWatchlist(): UseWatchlistReturn {
  const [tickers, setTickers] = useState<string[]>(() => getWatchlist());

  // Sync when localStorage changes in another tab
  useEffect(() => {
    const handleStorage = () => {
      setTickers(getWatchlist());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const addTicker = useCallback((ticker: string): 'added' | 'already_exists' | 'limit_exceeded' => {
    const result = addToWatchlist(ticker);
    if (result === 'added') {
      setTickers(getWatchlist());
    }
    return result;
  }, []);

  const removeTicker = useCallback((ticker: string) => {
    removeFromWatchlist(ticker);
    setTickers(getWatchlist());
  }, []);

  const isWatching = useCallback((ticker: string): boolean => {
    return isInWatchlist(ticker);
  }, []);

  return { tickers, addTicker, removeTicker, isWatching, maxSize: MAX_WATCHLIST_SIZE };
}
