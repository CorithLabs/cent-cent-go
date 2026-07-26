/**
 * Watchlist utilities — localStorage-based watchlist persistence.
 *
 * AC: No account required — stored in localStorage.
 * AC: Persists across page refreshes.
 * AC: Limited to 50 stocks.
 */

const WATCHLIST_KEY = 'cent-cent-watchlist';
const MAX_WATCHLIST_SIZE = 50;

/**
 * Get all tickers in the watchlist.
 */
export function getWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => typeof t === 'string');
  } catch {
    return [];
  }
}

/**
 * Add a ticker to the watchlist.
 * Returns 'added' | 'already_exists' | 'limit_exceeded'.
 */
export function addToWatchlist(ticker: string): 'added' | 'already_exists' | 'limit_exceeded' {
  const current = getWatchlist();
  const upper = ticker.toUpperCase();

  if (current.includes(upper)) {
    return 'already_exists';
  }

  if (current.length >= MAX_WATCHLIST_SIZE) {
    return 'limit_exceeded';
  }

  localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...current, upper]));
  return 'added';
}

/**
 * Remove a ticker from the watchlist.
 */
export function removeFromWatchlist(ticker: string): void {
  const current = getWatchlist();
  const upper = ticker.toUpperCase();
  localStorage.setItem(
    WATCHLIST_KEY,
    JSON.stringify(current.filter((t) => t !== upper)),
  );
}

/**
 * Check if a ticker is in the watchlist.
 */
export function isInWatchlist(ticker: string): boolean {
  return getWatchlist().includes(ticker.toUpperCase());
}

/**
 * Returns the maximum watchlist size.
 */
export { MAX_WATCHLIST_SIZE };
