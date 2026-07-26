import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IndicatorsPanel } from './IndicatorsPanel';

const mockIndicatorData = {
  indicator: 'sma',
  period: 50,
  data: Array.from({ length: 20 }, (_, i) => ({
    timestamp: new Date(Date.now() - (19 - i) * 86400000).toISOString(),
    value: 180 + i * 0.5,
  })),
};

const renderPanel = (range = '1m' as const) =>
  render(
    <MemoryRouter>
      <IndicatorsPanel ticker="AAPL" range={range} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('IndicatorsPanel', () => {
  it('renders the Indicators toggle button', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /indicators/i })).toBeInTheDocument();
  });

  it('panel is collapsed by default', () => {
    renderPanel();
    expect(screen.queryByLabelText(/toggle sma 50/i)).not.toBeInTheDocument();
  });

  it('expands to show 6 indicator options when toggled', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));
    expect(screen.getByLabelText(/toggle sma 50/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle sma 200/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle ema 20/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle bollinger bands/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle rsi/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle macd/i)).toBeInTheDocument();
  });

  it('activating an indicator shows its badge count', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockIndicatorData,
    } as Response);

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));
    fireEvent.click(screen.getByLabelText(/toggle sma 50/i));

    // Badge showing count 1 should appear on the toggle button
    expect(screen.getByLabelText('1 active')).toBeInTheDocument();
  });

  it('deactivating an indicator removes the legend item', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockIndicatorData,
    } as Response);

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));

    // Activate
    fireEvent.click(screen.getByLabelText(/toggle sma 50/i));
    await waitFor(() => {
      expect(screen.getByLabelText('1 active')).toBeInTheDocument();
    });

    // Deactivate
    fireEvent.click(screen.getByLabelText(/toggle sma 50/i));
    await waitFor(() => {
      expect(screen.queryByLabelText('1 active')).not.toBeInTheDocument();
    });
  });

  it('multiple indicators can be active simultaneously', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockIndicatorData,
    } as Response);

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));
    fireEvent.click(screen.getByLabelText(/toggle sma 50/i));
    fireEvent.click(screen.getByLabelText(/toggle ema 20/i));

    expect(screen.getByLabelText('2 active')).toBeInTheDocument();
  });

  it('renders the legend for each active indicator', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockIndicatorData,
    } as Response);

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));
    fireEvent.click(screen.getByLabelText(/toggle sma 50/i));

    const legend = screen.getByRole('list', { name: /active indicators/i });
    expect(legend).toBeInTheDocument();
    expect(legend.textContent).toMatch(/SMA 50/i);
  });

  it('shows unavailable notice for RSI on 1D range', () => {
    renderPanel('1d');
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));
    fireEvent.click(screen.getByLabelText(/toggle rsi/i));

    // RSI is unavailable for 1d range — the sub-panel shows the notice
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toMatch(/not available/i);
  });
});
