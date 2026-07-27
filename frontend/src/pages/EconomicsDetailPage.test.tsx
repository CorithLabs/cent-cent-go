import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EconomicsDetailPage from './EconomicsDetailPage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockIndicatorData = {
  id: 'CPIAUCSL',
  name: 'CPI (Inflation)',
  description: 'Consumer Price Index, year-over-year % change',
  unit: '%',
  data: [
    { date: '2023-01-01', value: 3.7 },
    { date: '2023-06-01', value: 3.5 },
    { date: '2023-12-01', value: 3.2 },
  ],
  nextRelease: null,
  source: 'FRED / Federal Reserve Bank of St. Louis',
  relatedConcepts: ['inflation', 'monetary-policy'],
};

function renderPage(indicator = 'CPIAUCSL') {
  return render(
    <MemoryRouter initialEntries={[`/economics/${indicator}`]}>
      <Routes>
        <Route path="/economics/:indicator" element={<EconomicsDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EconomicsDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('main')).toBeInTheDocument();
    // Should show chart skeleton
    expect(document.querySelector('.econ-detail-page__chart-skeleton')).toBeTruthy();
  });

  it('renders the historical chart after fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIndicatorData,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'CPI (Inflation)' })).toBeInTheDocument();
    });

    // Chart section
    expect(screen.getByRole('img', { name: /historical chart/i })).toBeInTheDocument();
  });

  it('shows range selector buttons', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIndicatorData,
    });

    renderPage();

    await waitFor(() => screen.getByRole('heading', { name: 'CPI (Inflation)' }));

    expect(screen.getByRole('button', { name: '1Y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5Y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10Y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('changing range fetches new data', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockIndicatorData })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...mockIndicatorData, data: [] }) });

    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'CPI (Inflation)' }));

    fireEvent.click(screen.getByRole('button', { name: '5Y' }));
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('range=5y');
  });

  it('shows ByteByteGo-style explainer section', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIndicatorData,
    });

    renderPage();

    await waitFor(() => screen.getByRole('heading', { name: 'CPI (Inflation)' }));

    expect(screen.getByText('What is this indicator?')).toBeInTheDocument();
    expect(screen.getByText('How is it calculated?')).toBeInTheDocument();
    expect(screen.getByText(/Rising values mean:/i)).toBeInTheDocument();
    expect(screen.getByText(/Falling values mean:/i)).toBeInTheDocument();
  });

  it('shows related concepts links', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIndicatorData,
    });

    renderPage();

    await waitFor(() => screen.getByText('Related Concepts'));

    expect(screen.getByRole('link', { name: /Inflation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Monetary Policy/i })).toBeInTheDocument();
  });

  it('shows release history table', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIndicatorData,
    });

    renderPage();

    await waitFor(() => screen.getByText('Release History'));

    expect(screen.getByRole('table')).toBeInTheDocument();
    // Should show data values
    expect(screen.getByText(/3\.70%/)).toBeInTheDocument();
  });

  it('shows breadcrumb navigation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIndicatorData,
    });

    renderPage();

    await waitFor(() => screen.getByRole('heading', { name: 'CPI (Inflation)' }));

    const breadcrumb = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(breadcrumb).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Economics' })).toBeInTheDocument();
  });

  it('shows 404 page for unknown indicator', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'indicator not found' }),
    });

    renderPage('UNKNOWN');

    await waitFor(() => {
      expect(screen.getByText('Indicator not found')).toBeInTheDocument();
    });
  });

  it('shows note when limited data is available for wide range', async () => {
    const shortData = { ...mockIndicatorData, data: [{ date: '2023-01-01', value: 3.2 }] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => shortData });

    render(
      <MemoryRouter initialEntries={['/economics/CPIAUCSL']}>
        <Routes>
          <Route path="/economics/:indicator" element={<EconomicsDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole('heading', { name: 'CPI (Inflation)' }));

    // Switch to 10Y range
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => shortData });
    fireEvent.click(screen.getByRole('button', { name: '10Y' }));

    await waitFor(() => {
      expect(screen.getByText(/Only 1 data points available/i)).toBeInTheDocument();
    });
  });
});
