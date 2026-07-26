import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SectorHeatmap } from './SectorHeatmap';
import { HeatmapSector } from '../../hooks/useHeatmap';

// ResizeObserver is already mocked in test-setup.ts

const mockSectors: HeatmapSector[] = [
  {
    name: 'Technology',
    change: 1.2,
    stocks: [
      { ticker: 'AAPL', name: 'Apple Inc.', marketCap: 2900000000000, change: 2.1, sector: 'Technology', price: 185.50 },
      { ticker: 'MSFT', name: 'Microsoft Corp.', marketCap: 2800000000000, change: 0.9, sector: 'Technology', price: 370.00 },
    ],
  },
  {
    name: 'Healthcare',
    change: -0.5,
    stocks: [
      { ticker: 'JNJ', name: 'Johnson & Johnson', marketCap: 400000000000, change: -0.5, sector: 'Healthcare', price: 155.00 },
    ],
  },
];

const mockOnPeriodChange = vi.fn();

function renderHeatmap(sectors = mockSectors) {
  return render(
    <MemoryRouter>
      <SectorHeatmap
        sectors={sectors}
        period="1d"
        onPeriodChange={mockOnPeriodChange}
        marketClosed={false}
        incomplete={false}
        asOf="2024-01-15T15:00:00Z"
      />
    </MemoryRouter>,
  );
}

describe('SectorHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders period toggle buttons', () => {
    renderHeatmap();
    expect(screen.getByRole('button', { name: '1D' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5D' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1M' })).toBeInTheDocument();
  });

  it('calls onPeriodChange when period button clicked', () => {
    renderHeatmap();
    fireEvent.click(screen.getByRole('button', { name: '5D' }));
    expect(mockOnPeriodChange).toHaveBeenCalledWith('5d');
  });

  it('renders SVG with correct accessibility attributes', () => {
    renderHeatmap();
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('S&P 500 sector heatmap');
  });

  it('renders accessible data table alternative', () => {
    renderHeatmap();
    // The accessibility table is present (in a details element)
    const table = screen.getByRole('table', { name: /S&P 500 stocks by sector/i });
    expect(table).toBeInTheDocument();
  });

  it('shows market closed indicator when market is closed', () => {
    render(
      <MemoryRouter>
        <SectorHeatmap
          sectors={mockSectors}
          period="1d"
          onPeriodChange={mockOnPeriodChange}
          marketClosed={true}
          incomplete={false}
          asOf="2024-01-15T20:00:00Z"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Market closed')).toBeInTheDocument();
  });

  it('shows incomplete indicator when data is partial', () => {
    render(
      <MemoryRouter>
        <SectorHeatmap
          sectors={mockSectors}
          period="1d"
          onPeriodChange={mockOnPeriodChange}
          marketClosed={false}
          incomplete={true}
          asOf="2024-01-15T15:00:00Z"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Partial data')).toBeInTheDocument();
  });

  it('shows color legend', () => {
    renderHeatmap();
    expect(screen.getByLabelText('Color scale legend')).toBeInTheDocument();
  });

  it('renders period group with correct ARIA label', () => {
    renderHeatmap();
    expect(screen.getByRole('group', { name: /period selector/i })).toBeInTheDocument();
  });

  it('renders empty gracefully with no sectors', () => {
    expect(() => renderHeatmap([])).not.toThrow();
  });
});
