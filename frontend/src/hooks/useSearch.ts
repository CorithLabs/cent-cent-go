import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';

export interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

interface UseSearchReturn {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  clearResults: () => void;
}

/**
 * Manages search state — debounces input at 300ms, calls /api/search,
 * and handles loading / error states. Empty queries never trigger an API call.
 */
export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    // Empty query — no API call, clear results
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = `/api/search?q=${encodeURIComponent(trimmed)}&limit=10`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();

        if (!cancelled) {
          setResults(data.results ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Search unavailable');
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchResults();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return { results, isLoading, error, query, setQuery, clearResults };
}
