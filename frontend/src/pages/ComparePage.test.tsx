import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ComparePage from './ComparePage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockCompareResponse = {
  tickers: [
    {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      normalizedPrices: [
        { date: '2023-01-03', value: 0 },
        { date: '2023-06-01', value: 15.2 },
        { date: '2023-12-29', value: 48.5 },
      ],
      metrics: { pe: 28.5, marketCap: 2900000000000, ytdReturn: 48.5, revenue: null },
    },
    {
      ticker: 'MSFT',
      name: 'Microsoft Corp.',
      normalizedPrices: [
        { date: '2023-01-03', value: 0 },
        { date: '2023-06-01', value: 30.1 },
        { date: '2023-12-29', value: 56.7 },
      ],
      metrics: { pe: 34.2, marketCap: 2800000000000, ytdReturn: 56.7, revenue: null },
    },
  ],
  warnings: [],
  startDateDisclosure: 'Normalized from Jan 3, 2023.',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ComparePage />
    </MemoryRouter>,
  );
}

describe('ComparePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows hint when fewer than 2 tickers added', () => {
    renderPage();
    expect(screen.getByText(/Add at least 2 tickers/i)).toBeInTheDocument();
  });

  it('can add tickers via input', () => {
    renderPage();
    const input = screen.getByPlaceholderText(/Enter ticker/i);
    const addBtn = screen.getByRole('button', { name: /Add ticker/i });

    fireEvent.change(input, { target: { value: 'AAPL' } });
    fireEvent.click(addBtn);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('shows error when adding 6th ticker', () => {
    renderPage();
    const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'];
    const input = screen.getByPlaceholderText(/Enter ticker/i);
    const addBtn = screen.getByRole('button', { name: /Add ticker/i });

    tickers.forEach((ticker) => {
      fireEvent.change(input, { target: { value: ticker } });
      fireEvent.click(addBtn);
    });

    // Try to add 6th
    fireEvent.change(input, { target: { value: 'META' } });
    fireEvent.click(addBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/Max 5 stocks/i);
  });

  it('can remove a ticker via remove button', () => {
    renderPage();
    const input = screen.getByPlaceholderText(/Enter ticker/i);
    const addBtn = screen.getByRole('button', { name: /Add ticker/i });

    fireEvent.change(input, { target: { value: 'AAPL' } });
    fireEvent.click(addBtn);

    const removeBtn = screen.getByRole('button', { name: /Remove AAPL/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
  });

  it('fetches comparison data when 2 tickers are added', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCompareResponse,
    });

    renderPage();
    const input = screen.getByPlaceholderText(/Enter ticker/i);
    const addBtn = screen.getByRole('button', { name: /Add ticker/i });

    fireEvent.change(input, { target: { value: 'AAPL' } });
    fireEvent.click(addBtn);
    fireEvent.change(input, { target: { value: 'MSFT' } });
    fireEvent.click(addBtn);

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('tickers=AAPL%2CMSFT'));

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /comparison/i })).toBeInTheDocument();
    });
  });

  it('shows range selector after 2 tickers added', () => {
    renderPage();
    const input = screen.getByPlaceholderText(/Enter ticker/i);
    const addBtn = screen.getByRole('button', { name: /Add ticker/i });

    fireEvent.change(input, { target: { value: 'AAPL' } });
    fireEvent.click(addBtn);
    fireEvent.change(input, { target: { value: 'MSFT' } });
    fireEvent.click(addBtn);

    expect(screen.getByRole('button', { name: '1Y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5Y' })).toBeInTheDocument();
  });

  it('shows metrics comparison table', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCompareResponse,
    });

    renderPage();
    const input = screen.getByPlaceholderText(/Enter ticker/i);
    const addBtn = screen.getByRole('button', { name: /Add ticker/i });

    fireEvent.change(input, { target: { value: 'AAPL' } });
    fireEvent.click(addBtn);
    fireEvent.change(input, { target: { value: 'MSFT' } });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Key Metrics Comparison')).toBeInTheDocument();
      expect(screen.getByText('P/E Ratio')).toBeInTheDocument();
      expect(screen.getByText('Market Cap')).toBeInTheDocument();
    });
  });

  it('shows disclaimer', () => {
    renderPage();
    expect(screen.getByText(/informational purposes only/i)).toBeInTheDocument();
  });

  it('shows warning when backend reports skipped tickers', async () => {
    const responseWithWarning = {
      ...mockCompareResponse,
      warnings: ['skipped INVALID: ticker not found'],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => responseWithWarning,
    });

    renderPage();
    const input = screen.getByPlaceholderText(/Enter ticker/i);
    const addBtn = screen.getByRole('button', { name: /Add ticker/i });

    fireEvent.change(input, { target: { value: 'AAPL' } });
    fireEvent.click(addBtn);
    fireEvent.change(input, { target: { value: 'MSFT' } });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText(/skipped INVALID/i)).toBeInTheDocument();
    });
  });
});
