import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SearchBar } from './SearchBar';

// ── Helpers ──────────────────────────────────────────────────────
const renderSearchBar = (variant: 'hero' | 'nav' = 'nav') =>
  render(
    <MemoryRouter>
      <SearchBar variant={variant} />
    </MemoryRouter>
  );

const mockResults = [
  { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'CS' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', type: 'CS' },
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────

describe('SearchBar', () => {
  it('renders a search input', () => {
    renderSearchBar();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('does not fire API call for empty input', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    renderSearchBar();
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, ' ');
    act(() => { vi.advanceTimersByTime(400); });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows loading spinner while fetching', async () => {
    // Fetch that never resolves — stays loading
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    renderSearchBar();
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'A');
    act(() => { vi.advanceTimersByTime(350); });
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows up to 10 results with ticker, name, and exchange', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    } as Response);

    renderSearchBar();
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'A');
    act(() => { vi.advanceTimersByTime(350); });

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
      expect(screen.getAllByText('NASDAQ')).toHaveLength(2);
    });
  });

  it('shows "Search unavailable" on network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    renderSearchBar();
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'ERR');
    act(() => { vi.advanceTimersByTime(350); });

    await waitFor(() => {
      expect(screen.getByText('Search unavailable')).toBeInTheDocument();
    });
  });

  it('closes the dropdown on Escape', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    } as Response);

    renderSearchBar();
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'AP');
    act(() => { vi.advanceTimersByTime(350); });

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    });
  });

  it('does not show dropdown for empty query after debounce', async () => {
    renderSearchBar();
    const input = screen.getByRole('searchbox');
    // Type then clear
    await userEvent.type(input, 'A');
    await userEvent.clear(input);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
