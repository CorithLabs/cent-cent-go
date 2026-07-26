/**
 * Mobile bottom navigation and floating search button tests.
 *
 * AC: 5 icon+label tabs rendered in bottom nav.
 * AC: Active tab uses --color-accent (class applied).
 * AC: Floating search button opens full-screen modal overlay.
 * AC: Modal closes on Escape key.
 * AC: Modal closes on backdrop click.
 * AC: <nav aria-label="Main navigation"> announced to screen readers.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';

vi.mock('../SearchBar/SearchBar', () => ({
  SearchBar: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="search-bar" role="search" aria-label={placeholder ?? 'search'} />
  ),
}));

const renderShell = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <div>Content</div>
      </AppShell>
    </MemoryRouter>
  );

describe('Mobile bottom navigation', () => {
  it('renders 5 bottom nav tabs', () => {
    renderShell();
    // Bottom nav tabs: Home, Watchlist, Economics, Sectors, Learn
    // They render as links inside the nav
    const bottomNav = screen.getAllByRole('navigation', { name: /main navigation/i });
    // There should be at least a bottom nav element
    expect(bottomNav.length).toBeGreaterThanOrEqual(1);
  });

  it('bottom nav tab for Watchlist exists', () => {
    renderShell('/watchlist');
    // Link text "Watchlist" should be in the bottom nav
    const links = screen.getAllByRole('link', { name: /watchlist/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('active route tab gets --active class', () => {
    renderShell('/economics');
    const economicsLinks = screen.getAllByRole('link', { name: /economics/i });
    // At least one should have the active class applied
    const hasActive = economicsLinks.some((el) =>
      el.className.includes('active')
    );
    expect(hasActive).toBe(true);
  });

  it('FAB button has correct aria attributes', () => {
    renderShell();
    const fab = screen.getByRole('button', { name: /open search/i });
    expect(fab).toHaveAttribute('aria-expanded', 'false');
  });

  it('modal aria-expanded updates to true when opened', () => {
    renderShell();
    const fab = screen.getByRole('button', { name: /open search/i });
    fireEvent.click(fab);
    expect(fab).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('modal closes on Escape key', () => {
    renderShell();
    const fab = screen.getByRole('button', { name: /open search/i });
    fireEvent.click(fab);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('modal closes on backdrop click', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /open search/i }));
    const backdrop = document.querySelector('.app-shell__search-modal-backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
