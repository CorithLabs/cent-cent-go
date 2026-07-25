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

describe('PriceChart', () => {
  it('renders range selector buttons', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChart();
    ['1D', '5D', '1M', '6M', '1Y', '5Y'].forEach((label) => {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    });
  });

  it('renders line/candlestick toggle buttons', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChart();
    expect(screen.getByRole('button', { name: /line/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /candlestick/i })).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChart();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders chart and download button after data loads', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockOHLCV,
    } as Response);

    renderChart();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download csv/i })).not.toBeDisabled();
    });
  });

  it('disables download button when no data', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    renderChart();
    const btn = screen.getByRole('button', { name: /download csv/i });
    expect(btn).toBeDisabled();
  });

  it('shows error message on fetch failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid range/interval combination' }),
    } as Response);

    renderChart();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('changes range on button click', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockOHLCV,
    } as Response);

    renderChart();

    const btn5Y = screen.getByRole('button', { name: /5Y/i });
    fireEvent.click(btn5Y);

    await waitFor(() => {
      expect(btn5Y).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
