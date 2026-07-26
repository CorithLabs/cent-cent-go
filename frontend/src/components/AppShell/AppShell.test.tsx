import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';

// Mock SearchBar to avoid fetch calls in unit tests
vi.mock('../SearchBar/SearchBar', () => ({
  SearchBar: ({ placeholder }: { placeholder: string }) => (
    <div data-testid="search-bar" role="search" aria-label={placeholder} />
  ),
}));

const renderShell = (initialEntry = '/') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppShell>
        <div data-testid="page-content">Page Content</div>
      </AppShell>
    </MemoryRouter>
  );

describe('AppShell', () => {
  it('renders children inside main content area', () => {
    renderShell();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('renders the logo as a home link with accessible label', () => {
    renderShell();
    const logoLink = screen.getByRole('link', { name: /cent-cent-go.*home/i });
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('renders nav links for all primary sections', () => {
    renderShell();
    const navLinks = screen.getAllByRole('link', { name: /home|watchlist|economics|compare|sectors|learn/i });
    // At least 6 links (sidebar) present
    expect(navLinks.length).toBeGreaterThanOrEqual(6);
  });

  it('renders embedded SearchBar in sidebar', () => {
    renderShell();
    expect(screen.getAllByTestId('search-bar').length).toBeGreaterThanOrEqual(1);
  });

  it('mobile search FAB button is accessible', () => {
    renderShell();
    const fab = screen.getByRole('button', { name: /open search/i });
    expect(fab).toBeInTheDocument();
  });

  it('mobile search modal opens when FAB is clicked', () => {
    renderShell();
    const fab = screen.getByRole('button', { name: /open search/i });
    fireEvent.click(fab);
    expect(screen.getByRole('dialog', { name: /search/i })).toBeInTheDocument();
  });

  it('mobile search modal closes when close button is clicked', () => {
    renderShell();
    const fab = screen.getByRole('button', { name: /open search/i });
    fireEvent.click(fab);
    const closeBtn = screen.getByRole('button', { name: /close search/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('bottom nav has accessible label', () => {
    renderShell();
    // There should be at least one nav with "Main navigation" label
    const navs = screen.getAllByRole('navigation', { name: /main navigation/i });
    expect(navs.length).toBeGreaterThanOrEqual(1);
  });
});
