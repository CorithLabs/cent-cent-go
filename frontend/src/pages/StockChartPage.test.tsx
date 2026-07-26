/**
 * StockChartPage tests
 *
 * StockChartPage is a thin wrapper: it reads :ticker from the URL and renders
 * <PriceChart ticker={ticker} />. PriceChart owns all chart state internally.
 *
 * These tests verify:
 *  - PriceChart mounts and shows the loading state (aria-busy)
 *  - Range selector buttons appear (rendered by PriceChart)
 *  - Line / Candlestick mode toggle buttons appear (rendered by PriceChart)
 *  - The accessible data table is wired (via PriceChart) once data loads
 *  - CSV download button becomes enabled once data loads
 *  - Error state surfaces correctly when the API call fails
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StockChartPage from './StockChartPage';

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockOHLCV = {
  ticker: 'AAPL',
  range: '1m',
  interval: '1d',
  dataSource: 'polygon',
  lastUpdated: new Date().toISOString(),
  data: Array.from({ length: 22 }, (_, i) => ({
    timestamp: new Date(Date.now() - (21 - i) * 86400000).toISOString(),
    open: 180 + i,
    high: 185 + i,
    low: 178 + i,
    close: 182 + i,
    volume: 50_000_000 + i * 1000,
  })),
};

const renderChartPage = (ticker = 'AAPL') =>
  render(
    <MemoryRouter initialEntries={[`/stock/${ticker}/chart`]}>
      <Routes>
        <Route path="/stock/:ticker/chart" element={<StockChartPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StockChartPage', () => {
  it('renders the PriceChart heading "Price History"', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    // PriceChart renders <h2>Price History</h2>
    expect(screen.getByRole('heading', { name: /price history/i })).toBeInTheDocument();
  });

  it('shows loading state (aria-busy) while data is fetching', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders all 6 range selector buttons from PriceChart', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    ['1D', '5D', '1M', '6M', '1Y', '5Y'].forEach((label) => {
      expect(
        screen.getByRole('button', { name: new RegExp(`show ${label} range`, 'i') })
      ).toBeInTheDocument();
    });
  });

  it('renders Line and Candlestick mode toggle buttons', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    expect(screen.getByRole('button', { name: /line/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /candle/i })).toBeInTheDocument();
  });

  it('Download CSV button is disabled while data is loading', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    const csvBtn = screen.getByRole('button', { name: /download chart data as csv/i });
    expect(csvBtn).toBeDisabled();
  });

  it('enables Download CSV button after OHLCV data loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockOHLCV,
    } as Response);

    renderChartPage('AAPL');

    await waitFor(() => {
      const downloadBtn = screen.getByRole('button', { name: /download chart data as csv/i });
      expect(downloadBtn).not.toBeDisabled();
    });
  });

  it('clicking a range button updates its aria-pressed to true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockOHLCV,
    } as Response);

    renderChartPage('AAPL');

    const btn5Y = screen.getByRole('button', { name: /show 5Y range/i });
    expect(btn5Y).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(btn5Y);

    await waitFor(() => {
      expect(btn5Y).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('shows accessible data table after OHLCV data loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockOHLCV,
    } as Response);

    renderChartPage('AAPL');

    await waitFor(() => {
      // PriceChart renders a <details> element with accessible table
      expect(screen.getByText(/view data table/i)).toBeInTheDocument();
    });
  });

  it('shows error alert when OHLCV fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Ticker not found' }),
    } as Response);

    renderChartPage('UNKN');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows "no data" status when API returns empty data array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockOHLCV, data: [] }),
    } as Response);

    renderChartPage('AAPL');

    await waitFor(() => {
      expect(
        screen.getByText(/no chart data available/i)
      ).toBeInTheDocument();
    });
  });
});
