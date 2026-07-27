import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EconomicsPage from './EconomicsPage';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockIndicators = [
  {
    id: 'GDPC1',
    name: 'GDP Growth',
    value: 2.8,
    unit: '%',
    change: 0.3,
    trend: [
      { date: '2023-01-01', value: 2.1 },
      { date: '2023-04-01', value: 2.5 },
      { date: '2023-07-01', value: 2.8 },
    ],
    lastUpdated: new Date().toISOString(),
    nextRelease: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'FRED / Federal Reserve Bank of St. Louis',
    stale: false,
  },
  {
    id: 'CPIAUCSL',
    name: 'CPI (Inflation)',
    value: 3.2,
    unit: '%',
    change: -0.3,
    trend: [
      { date: '2023-01-01', value: 3.7 },
      { date: '2023-06-01', value: 3.5 },
      { date: '2023-12-01', value: 3.2 },
    ],
    lastUpdated: new Date().toISOString(),
    nextRelease: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'FRED / Federal Reserve Bank of St. Louis',
    stale: false,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <EconomicsPage />
    </MemoryRouter>,
  );
}

describe('EconomicsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    // Skeleton cards have aria-hidden but the grid has aria-busy
    expect(screen.getByRole('region', { name: /loading economic indicators/i })).toBeInTheDocument();
  });

  it('renders indicator cards after successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ indicators: mockIndicators }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('GDP Growth')).toBeInTheDocument();
      expect(screen.getByText('CPI (Inflation)')).toBeInTheDocument();
    });

    // Each card shows current value
    expect(screen.getByText(/2\.80%/)).toBeInTheDocument();
    expect(screen.getByText(/3\.20%/)).toBeInTheDocument();
  });

  it('shows a plain-English summary on each card', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ indicators: mockIndicators }),
    });

    renderPage();

    await waitFor(() => {
      // CPI card summary
      expect(screen.getByText(/Inflation is running at/i)).toBeInTheDocument();
    });
  });

  it('shows detail links for each indicator', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ indicators: mockIndicators }),
    });

    renderPage();

    await waitFor(() => {
      const links = screen.getAllByRole('link', { name: /View full chart/i });
      expect(links.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows next release date on each card', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ indicators: mockIndicators }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Next release:/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows stale badge when data is stale', async () => {
    const staleIndicators = [{ ...mockIndicators[0], stale: true }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ indicators: staleIndicators }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Stale data')).toBeInTheDocument();
    });
  });

  it('shows error message on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
  });

  it('shows disclaimer about informational data', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/informational purposes only/i)).toBeInTheDocument();
  });
});
