import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StockChartPage from './StockChartPage';

// Mock OHLCV data for PriceChart
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

// Mock indicator data for IndicatorsPanel
const mockIndicatorData = {
  indicator: 'sma',
  period: 50,
  data: Array.from({ length: 22 }, (_, i) => ({
    timestamp: new Date(Date.now() - (21 - i) * 86400000).toISOString(),
    value: 180 + i * 0.5,
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

describe('StockChartPage', () => {
  it('renders the page with the ticker in the heading', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    expect(screen.getByRole('heading', { name: /AAPL.*Chart/i })).toBeInTheDocument();
  });

  it('renders a breadcrumb with Home and ticker links', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AAPL/i })).toBeInTheDocument();
  });

  it('renders a fullscreen link', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    expect(
      screen.getByRole('link', { name: /fullscreen/i })
    ).toHaveAttribute('href', '/stock/AAPL/chart/fullscreen');
  });

  it('renders PriceChart range selector buttons', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    // PriceChart renders range buttons
    ['1D', '5D', '1M', '6M', '1Y', '5Y'].forEach((label) => {
      expect(
        screen.getByRole('button', { name: new RegExp(label, 'i') })
      ).toBeInTheDocument();
    });
  });

  it('renders PriceChart line/candlestick toggle buttons', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    expect(screen.getByRole('button', { name: /line/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /candlestick/i })).toBeInTheDocument();
  });

  it('renders IndicatorsPanel toggle button', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    expect(
      screen.getByRole('button', { name: /indicators/i })
    ).toBeInTheDocument();
  });

  it('shows loading state for chart initially', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders download CSV button after OHLCV data loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: RequestInfo | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('/history')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockOHLCV,
        } as Response);
      }
      // Indicator requests — return pending (not toggled yet)
      return new Promise(() => {});
    });

    renderChartPage('AAPL');

    await waitFor(() => {
      const downloadBtn = screen.getByRole('button', { name: /download.*csv/i });
      expect(downloadBtn).not.toBeDisabled();
    });
  });

  it('expands indicators panel on toggle click', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');

    const indicatorsBtn = screen.getByRole('button', { name: /indicators/i });
    fireEvent.click(indicatorsBtn);

    // Indicator checkboxes should appear
    await waitFor(() => {
      expect(screen.getByLabelText(/toggle sma 50/i)).toBeInTheDocument();
    });
  });

  it('shows all 6 indicator options when panel is expanded', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChartPage('AAPL');

    const indicatorsBtn = screen.getByRole('button', { name: /indicators/i });
    fireEvent.click(indicatorsBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/toggle sma 50/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle sma 200/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle ema 20/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle bollinger bands/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle rsi/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle macd/i)).toBeInTheDocument();
    });
  });

  it('toggling SMA 50 initiates an indicator fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (url: RequestInfo | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('/history')) {
          return Promise.resolve({ ok: true, json: async () => mockOHLCV } as Response);
        }
        if (urlStr.includes('/indicators')) {
          return Promise.resolve({ ok: true, json: async () => mockIndicatorData } as Response);
        }
        return new Promise(() => {});
      }
    );

    renderChartPage('AAPL');

    // Open panel
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/toggle sma 50/i)).toBeInTheDocument();
    });

    // Toggle SMA 50 on
    fireEvent.click(screen.getByLabelText(/toggle sma 50/i));

    await waitFor(() => {
      // Fetch should have been called for indicators
      const indicatorCalls = fetchSpy.mock.calls.filter((call) =>
        call[0].toString().includes('/indicators')
      );
      expect(indicatorCalls.length).toBeGreaterThan(0);
    });
  });

  it('switches range and IndicatorsPanel stays in sync', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes('/history')) {
        return Promise.resolve({ ok: true, json: async () => mockOHLCV } as Response);
      }
      return new Promise(() => {});
    });

    renderChartPage('AAPL');

    // Click 5Y range button
    const btn5Y = screen.getByRole('button', { name: /5Y/i });
    fireEvent.click(btn5Y);

    await waitFor(() => {
      expect(btn5Y).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('shows error message if OHLCV fetch fails', async () => {
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
});
