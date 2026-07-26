import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PriceChart } from './PriceChart';

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
    volume: 50000000 + i * 1000,
  })),
};

const renderChart = () =>
  render(
    <MemoryRouter>
      <PriceChart ticker="AAPL" />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('PriceChart — themed Recharts', () => {
  it('renders range selector pill buttons', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChart();
    ['1D', '5D', '1M', '6M', '1Y', '5Y'].forEach((label) => {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    });
  });

  it('1M range button is active by default (aria-pressed=true)', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChart();
    const btn1M = screen.getByRole('button', { name: /Show 1M range/i });
    expect(btn1M).toHaveAttribute('aria-pressed', 'true');
    expect(btn1M.className).toContain('--active');
  });

  it('renders line / candle mode toggle', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChart();
    expect(screen.getByRole('button', { name: /line/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /candle/i })).toBeInTheDocument();
  });

  it('shows loading skeleton initially', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChart();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders chart and enables download button after data loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockOHLCV,
    } as Response);

    renderChart();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download.*csv/i })).not.toBeDisabled();
    });
  });

  it('disables download button when no data', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChart();
    expect(screen.getByRole('button', { name: /download.*csv/i })).toBeDisabled();
  });

  it('shows error alert on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid range/interval combination' }),
    } as Response);

    renderChart();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('switching range updates aria-pressed on the new button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockOHLCV,
    } as Response);

    renderChart();

    const btn5Y = screen.getByRole('button', { name: /Show 5Y range/i });
    fireEvent.click(btn5Y);

    await waitFor(() => {
      expect(btn5Y).toHaveAttribute('aria-pressed', 'true');
    });
    // 1M should no longer be active
    expect(screen.getByRole('button', { name: /Show 1M range/i }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('renders accessible data table after data loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockOHLCV,
    } as Response);

    renderChart();

    await waitFor(() => {
      const table = document.querySelector('table[aria-label]');
      expect(table).toBeInTheDocument();
    });
  });
});
