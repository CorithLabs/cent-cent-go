import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import StockDetailPage from './StockDetailPage';

const mockQuote = {
  ticker: 'AAPL',
  name: 'Apple Inc.',
  price: 182.63,
  change: 1.23,
  changePct: 0.68,
  marketCap: 2_850_000_000_000,
  volume: 54_234_567,
  week52High: 199.62,
  week52Low: 143.9,
  exchange: 'NASDAQ',
  lastUpdated: new Date().toISOString(), // fresh
  status: 'active',
  stale: false,
};

const staleQuote = {
  ...mockQuote,
  lastUpdated: new Date(Date.now() - 20 * 60_000).toISOString(), // 20 min ago
  stale: true,
};

const renderPage = (ticker = 'AAPL') =>
  render(
    <MemoryRouter initialEntries={[`/stock/${ticker}`]}>
      <Routes>
        <Route path="/stock/:ticker" element={<StockDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('StockDetailPage', () => {
  it('renders loading state initially', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders stock header with all fields after successful fetch', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote,
    } as Response);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
      expect(screen.getByText('NASDAQ')).toBeInTheDocument();
    });

    // Disclaimer
    expect(
      screen.getByText(/does not constitute financial advice/i)
    ).toBeInTheDocument();

    // 52-week range
    expect(screen.getByText(/52-Week High/i)).toBeInTheDocument();
    expect(screen.getByText(/52-Week Low/i)).toBeInTheDocument();
  });

  it('uppercases the ticker from the URL', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote,
    } as Response);

    renderPage('aapl'); // lowercase in URL

    await waitFor(() => {
      // Verify fetch was called with uppercase ticker
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(/AAPL/);
    });
  });

  it('shows "Stock not found" for unknown ticker', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'ticker not found' }),
    } as Response);

    renderPage('XXXX');

    await waitFor(() => {
      expect(screen.getByText(/stock not found/i)).toBeInTheDocument();
    });
  });

  it('shows stale data warning when data is >15 min old', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => staleQuote,
    } as Response);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/data may be delayed/i)).toBeInTheDocument();
    });
  });

  it('shows "Market closed" badge for suspended status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...mockQuote, status: 'suspended' }),
    } as Response);

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/market closed/i)).toBeInTheDocument();
    });
  });
});
