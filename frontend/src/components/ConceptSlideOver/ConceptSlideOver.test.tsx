import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConceptSlideOver } from './ConceptSlideOver';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockArticle = {
  slug: 'pe-ratio',
  title: 'P/E Ratio Explained',
  summary: 'The price-to-earnings ratio helps investors determine if a stock is overvalued.',
  sections: [
    {
      heading: 'Basic: What is the P/E Ratio?',
      body: '<p>The P/E ratio is one of the most widely used metrics in stock investing.</p>',
    },
    {
      heading: 'Intermediate',
      body: '<p>Advanced content here.</p>',
    },
  ],
  relatedSlugs: ['eps'],
  tags: ['Valuation'],
  readTime: '5 min read',
};

const mockOnClose = vi.fn();

function renderSlideOver(slug = 'pe-ratio') {
  return render(
    <MemoryRouter>
      <ConceptSlideOver slug={slug} label="What is P/E ratio?" onClose={mockOnClose} />
    </MemoryRouter>,
  );
}

describe('ConceptSlideOver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the panel with dialog role', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderSlideOver();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows skeleton loading state while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderSlideOver();
    const skeletons = document.querySelectorAll('.concept-slide-over__skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders article title and summary after fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderSlideOver();

    await waitFor(() => {
      expect(screen.getByText('P/E Ratio Explained')).toBeInTheDocument();
      expect(screen.getByText(/price-to-earnings ratio/i)).toBeInTheDocument();
    });
  });

  it('shows first section (Basic) as preview', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderSlideOver();

    await waitFor(() => {
      expect(screen.getByText('Basic: What is the P/E Ratio?')).toBeInTheDocument();
    });
  });

  it('shows "Open full article" link', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticle,
    });

    renderSlideOver();

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /Open full article/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/learn/pe-ratio');
    });
  });

  it('calls onClose when close button clicked', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderSlideOver();

    const closeBtn = screen.getByRole('button', { name: /close concept panel/i });
    fireEvent.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key pressed', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderSlideOver();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows error message with fallback link on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderSlideOver();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load article/i)).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /Open full article/i })[0]).toBeInTheDocument();
    });
  });

  it('shows backdrop overlay', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderSlideOver();
    expect(document.querySelector('.concept-slide-over__backdrop')).toBeTruthy();
  });

  it('closes when backdrop is clicked', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderSlideOver();

    const backdrop = document.querySelector('.concept-slide-over__backdrop') as HTMLElement;
    fireEvent.click(backdrop);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('has aria-modal="true" for accessibility', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderSlideOver();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
