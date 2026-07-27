import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WatchlistPage from './WatchlistPage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const mockQuotes = [
  { ticker: 'AAPL', price: 185.50, change: 2.30, changePct: 1.26, lastUpdated: new Date().toISOString() },
  { ticker: 'MSFT', price: 370.00, change: -1.20, changePct: -0.32, lastUpdated: new Date().toISOString() },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <WatchlistPage />
    </MemoryRouter>,
  );
}

describe('WatchlistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('shows empty watchlist CTA when no stocks saved', () => {
    renderPage();
    expect(screen.getByText('Your watchlist is empty.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Search for stocks/i })).toBeInTheDocument();
  });

  it('fetches quotes for saved tickers', async () => {
    localStorageMock.setItem('cent-cent-watchlist', JSON.stringify(['AAPL', 'MSFT']));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quotes: mockQuotes }),
    });

    renderPage();

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('tickers=AAPL%2CMSFT'));

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('MSFT')).toBeInTheDocument();
    });
  });

  it('displays prices and % changes for each ticker', async () => {
    localStorageMock.setItem('cent-cent-watchlist', JSON.stringify(['AAPL', 'MSFT']));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quotes: mockQuotes }),
    });

    renderPage();

    await waitFor(() => {
      // AAPL price
      expect(screen.getByText('$185.50')).toBeInTheDocument();
      // MSFT negative change
      expect(screen.getByText('-0.32%')).toBeInTheDocument();
    });
  });

  it('shows Delisted badge for delisted stocks', async () => {
    localStorageMock.setItem('cent-cent-watchlist', JSON.stringify(['DEAD']));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        quotes: [{ ticker: 'DEAD', price: 0, change: 0, changePct: 0, lastUpdated: new Date().toISOString(), delisted: true }],
      }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Delisted')).toBeInTheDocument();
    });
  });

  it('removes stock from watchlist when remove button clicked', async () => {
    localStorageMock.setItem('cent-cent-watchlist', JSON.stringify(['AAPL']));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quotes: [mockQuotes[0]] }),
    });

    renderPage();

    await waitFor(() => screen.getByText('AAPL'));

    const removeBtn = screen.getByRole('button', { name: /Remove AAPL/i });
    fireEvent.click(removeBtn);

    // Should show empty state
    await waitFor(() => {
      expect(screen.getByText('Your watchlist is empty.')).toBeInTheDocument();
    });
  });

  it('shows error message when quotes fetch fails', async () => {
    localStorageMock.setItem('cent-cent-watchlist', JSON.stringify(['AAPL']));

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows disclaimer', () => {
    renderPage();
    expect(screen.getByText(/informational purposes only/i)).toBeInTheDocument();
  });

  it('each ticker links to /stock/:ticker', async () => {
    localStorageMock.setItem('cent-cent-watchlist', JSON.stringify(['AAPL']));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quotes: [mockQuotes[0]] }),
    });

    renderPage();

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'AAPL' });
      expect(link).toHaveAttribute('href', '/stock/AAPL');
    });
  });

  it('shows warning when watchlist is at limit', () => {
    const fiftyTickers = Array.from({ length: 50 }, (_, i) => `TICK${i}`);
    localStorageMock.setItem('cent-cent-watchlist', JSON.stringify(fiftyTickers));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quotes: [] }),
    });

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(/Watchlist is full/i);
  });
});
