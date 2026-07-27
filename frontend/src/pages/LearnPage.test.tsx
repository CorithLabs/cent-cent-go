import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LearnPage from './LearnPage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockArticles = [
  {
    slug: 'pe-ratio',
    title: 'P/E Ratio Explained',
    summary: 'The price-to-earnings ratio helps investors determine if a stock is overvalued or undervalued.',
    tags: ['Valuation', 'Fundamentals'],
    readTime: '5 min read',
  },
  {
    slug: 'monetary-policy',
    title: 'How Monetary Policy Works',
    summary: 'Central banks use interest rates and money supply to control inflation and employment.',
    tags: ['Macro', 'Central Banking'],
    readTime: '8 min read',
  },
  {
    slug: 'yield-curve',
    title: 'Understanding the Yield Curve',
    summary: 'The yield curve plots Treasury yields across maturities and is a key recession indicator.',
    tags: ['Macro', 'Fixed Income'],
    readTime: '6 min read',
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <LearnPage />
    </MemoryRouter>,
  );
}

describe('LearnPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    // Skeleton cards are aria-hidden, grid is aria-busy
    const grid = document.querySelector('.learn-page__grid[aria-busy="true"]');
    expect(grid).toBeTruthy();
  });

  it('renders article cards after successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ articles: mockArticles }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('P/E Ratio Explained')).toBeInTheDocument();
      expect(screen.getByText('How Monetary Policy Works')).toBeInTheDocument();
      expect(screen.getByText('Understanding the Yield Curve')).toBeInTheDocument();
    });
  });

  it('shows article summary on each card', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ articles: mockArticles }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/price-to-earnings ratio/i)).toBeInTheDocument();
    });
  });

  it('shows tags on article cards', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ articles: mockArticles }),
    });

    renderPage();

    await waitFor(() => {
      const valuationTags = screen.getAllByText('Valuation');
      expect(valuationTags.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows read time on article cards', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ articles: mockArticles }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('🕐 5 min read')).toBeInTheDocument();
    });
  });

  it('renders tag filter buttons', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ articles: mockArticles }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Macro' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Valuation' })).toBeInTheDocument();
    });
  });

  it('filters articles by tag when tag button clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ articles: mockArticles }),
    });

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'Valuation' }));

    fireEvent.click(screen.getByRole('button', { name: 'Valuation' }));

    // Only PE ratio article has 'Valuation' tag
    expect(screen.getByText('P/E Ratio Explained')).toBeInTheDocument();
    expect(screen.queryByText('How Monetary Policy Works')).not.toBeInTheDocument();
  });

  it('clicking "All" resets filter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ articles: mockArticles }),
    });

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'Macro' }));

    fireEvent.click(screen.getByRole('button', { name: 'Macro' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.getByText('P/E Ratio Explained')).toBeInTheDocument();
    expect(screen.getByText('How Monetary Policy Works')).toBeInTheDocument();
  });

  it('each card links to /learn/:slug', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ articles: mockArticles }),
    });

    renderPage();

    await waitFor(() => screen.getByText('P/E Ratio Explained'));

    const peCard = screen.getByRole('link', { name: /P\/E Ratio Explained/i });
    expect(peCard).toHaveAttribute('href', '/learn/pe-ratio');
  });

  it('shows error when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
  });
});
