import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LearnArticlePage from './LearnArticlePage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockArticle = {
  slug: 'pe-ratio',
  title: 'P/E Ratio Explained',
  summary: 'The price-to-earnings ratio helps investors determine if a stock is overvalued.',
  sections: [
    {
      heading: 'Basic: What is the P/E Ratio?',
      body: '<p>The P/E ratio is one of the most widely used metrics.</p>',
    },
    {
      heading: 'Intermediate: How to Interpret the P/E Ratio',
      body: '<p>P/E ratios vary significantly across sectors.</p>',
    },
    {
      heading: 'Advanced: P/E in Context of Market Cycles',
      body: '<p>The CAPE ratio uses inflation-adjusted earnings.</p>',
    },
  ],
  relatedSlugs: ['eps', 'dividend-yield'],
  tags: ['Valuation', 'Fundamentals'],
  readTime: '5 min read',
};

function renderPage(slug = 'pe-ratio') {
  return render(
    <MemoryRouter initialEntries={[`/learn/${slug}`]}>
      <Routes>
        <Route path="/learn/:slug" element={<LearnArticlePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LearnArticlePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    const skeleton = document.querySelector('.learn-article__skeleton');
    expect(skeleton).toBeTruthy();
  });

  it('renders article title after fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('P/E Ratio Explained')).toBeInTheDocument();
    });
  });

  it('renders article summary', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/price-to-earnings ratio/i)).toBeInTheDocument();
    });
  });

  it('renders progressive depth section labels', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Basic')).toBeInTheDocument();
      expect(screen.getByText('Intermediate')).toBeInTheDocument();
      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });
  });

  it('renders section headings', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Basic: What is the P/E Ratio?')).toBeInTheDocument();
    });
  });

  it('renders related concepts sidebar', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: /related concepts/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Eps/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Dividend Yield/i })).toBeInTheDocument();
    });
  });

  it('renders breadcrumb navigation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderPage();

    await waitFor(() => {
      const breadcrumb = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(breadcrumb).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Learn' })).toBeInTheDocument();
    });
  });

  it('renders tags on article header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Valuation')).toBeInTheDocument();
      expect(screen.getByText('Fundamentals')).toBeInTheDocument();
    });
  });

  it('shows 404 page with Browse CTA for unknown slug', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'article not found' }),
    });

    renderPage('unknown-slug');

    await waitFor(() => {
      expect(screen.getByText('Article not found')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Browse all concepts/i })).toBeInTheDocument();
    });
  });

  it('shows read time on article', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('🕐 5 min read')).toBeInTheDocument();
    });
  });
});
