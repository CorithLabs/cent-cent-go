import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderSearchBar();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: ' ' } });
    act(() => { vi.advanceTimersByTime(400); });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows loading spinner while fetching', async () => {
    // Fetch that never resolves — stays loading
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderSearchBar();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'A' } });
    act(() => { vi.advanceTimersByTime(350); });
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows up to 10 results with ticker, name, and exchange', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    } as Response);

    renderSearchBar();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'A' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getAllByText('NASDAQ')).toHaveLength(2);
  });

  it('shows "Search unavailable" on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    renderSearchBar();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'ERR' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });

    expect(screen.getByText('Search unavailable')).toBeInTheDocument();
  });

  it('closes the dropdown on Escape', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    } as Response);

    renderSearchBar();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'AP' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });

    expect(screen.getByText('AAPL')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
  });

  it('does not show dropdown for empty query after debounce', async () => {
    renderSearchBar();
    const input = screen.getByRole('searchbox');
    // Type then clear
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.change(input, { target: { value: '' } });
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
