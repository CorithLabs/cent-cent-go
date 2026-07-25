import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IncomeStatement } from './IncomeStatement';

const makePeriods = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    fiscalDate: `202${3 - i}-12-31`,
    revenue: 383_000_000_000 - i * 1_000_000_000,
    grossProfit: 170_000_000_000 - i * 500_000_000,
    operatingIncome: 114_000_000_000 - i * 300_000_000,
    netIncome: 97_000_000_000 - i * 200_000_000,
    eps: 6.43 - i * 0.1,
  }));

const mockResponse = (n = 4) => ({
  ticker: 'AAPL',
  statement: 'income',
  period: 'annual',
  data: makePeriods(n),
  dataSource: 'polygon',
  lastUpdated: new Date().toISOString(),
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('IncomeStatement', () => {
  it('renders the table with all 5 row labels', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse(),
    } as Response);

    render(<IncomeStatement ticker="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('Gross Profit')).toBeInTheDocument();
      expect(screen.getByText('Operating Income')).toBeInTheDocument();
      expect(screen.getByText('Net Income')).toBeInTheDocument();
      expect(screen.getByText('EPS')).toBeInTheDocument();
    });
  });

  it('renders values with unit labels', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse(),
    } as Response);

    render(<IncomeStatement ticker="AAPL" />);

    await waitFor(() => {
      // Revenue 383B → $383.00B
      expect(screen.getByText('$383.00B')).toBeInTheDocument();
    });
  });

  it('toggles to chart view', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse(),
    } as Response);

    render(<IncomeStatement ticker="AAPL" />);

    await waitFor(() => { expect(screen.getByText('Revenue')).toBeInTheDocument(); });

    const chartBtn = screen.getByRole('button', { name: /chart/i });
    fireEvent.click(chartBtn);

    // Table should not be visible in chart mode
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<IncomeStatement ticker="AAPL" />);
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('shows "No data available" when empty array returned', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockResponse(), data: [] }),
    } as Response);

    render(<IncomeStatement ticker="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('No data available.')).toBeInTheDocument();
    });
  });

  it('shows "Show more" button when 4 periods loaded', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse(4),
    } as Response);

    render(<IncomeStatement ticker="AAPL" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
    });
  });

  it('renders gap indicator (—) for missing period values', async () => {
    const dataWithGap = {
      ...mockResponse(),
      data: [
        { fiscalDate: '2023-12-31', revenue: 100_000_000, grossProfit: null, operatingIncome: null, netIncome: null, eps: null },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => dataWithGap,
    } as Response);

    render(<IncomeStatement ticker="AAPL" />);

    await waitFor(() => {
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });
  });
});
