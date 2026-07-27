import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  lastUpdated: new Date().toISOString(),
  status: 'active',
  stale: false,
};

const staleQuote = {
  ...mockQuote,
  lastUpdated: new Date(Date.now() - 20 * 60_000).toISOString(),
  stale: true,
};

const renderPage = (ticker = 'AAPL', search = '') =>
  render(
    <MemoryRouter initialEntries={[`/stock/${ticker}${search}`]}>
      <Routes>
        <Route path="/stock/:ticker" element={<StockDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('StockDetailPage — v1.5 layout', () => {
  it('renders loading skeleton initially', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders sticky header with ticker and price after data loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote,
    } as Response);

    renderPage();

    await waitFor(() => {
      // Sticky header shows ticker
      const tickers = screen.getAllByText('AAPL');
      expect(tickers.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders 4-tab tab bar', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote,
    } as Response);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /chart/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /financials/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /eli5/i })).toBeInTheDocument();
    });
  });

  it('Overview tab is active by default', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote,
    } as Response);

    renderPage();

    await waitFor(() => {
      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('clicking Chart tab makes it active', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote,
    } as Response);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /chart/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /chart/i }));

    expect(screen.getByRole('tab', { name: /chart/i }))
      .toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /overview/i }))
      .toHaveAttribute('aria-selected', 'false');
  });

  it('shows company name and disclaimer on Overview tab', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote,
    } as Response);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Apple Inc.')[0]).toBeInTheDocument();
      expect(screen.getByText(/does not constitute financial advice/i)).toBeInTheDocument();
    });
  });

  it('ELI5 section is collapsed by default in Overview', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote,
    } as Response);

    renderPage();

    await waitFor(() => {
      const toggle = screen.getByRole('button', { name: /how is this stock doing.*eli5/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('ELI5 section expands on toggle click', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote,
    } as Response);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /how is this stock doing/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /how is this stock doing/i }));

    expect(screen.getByRole('button', { name: /how is this stock doing/i }))
      .toHaveAttribute('aria-expanded', 'true');
  });

  it('shows "Stock not found" for unknown ticker', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => staleQuote,
    } as Response);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/data may be delayed/i)).toBeInTheDocument();
    });
  });

  it('uppercases the ticker from the URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQuote,
    } as Response);

    renderPage('aapl');

    await waitFor(() => {
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(/AAPL/);
    });
  });
});
