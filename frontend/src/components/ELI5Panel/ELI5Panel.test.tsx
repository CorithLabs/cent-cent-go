import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ELI5Panel } from './ELI5Panel';

// Ensure window.ai is not defined (non-Chrome environment)
beforeEach(() => {
  vi.restoreAllMocks();
  // Remove window.ai if it was set by a previous test
  delete (window as any).ai;
});

const mockELI5Response = {
  ticker: 'AAPL',
  generatedAt: new Date().toISOString(),
  overallSentiment: 'positive',
  headline: 'Apple is performing well across most metrics',
  sections: [
    {
      topic: 'Valuation',
      emoji: '💰',
      label: 'pricey',
      rawValue: 'P/E: 29.5x',
      sectorBenchmark: '22x',
    },
    {
      topic: 'Growth',
      emoji: '📈',
      label: 'growing',
      rawValue: 'Revenue YoY: +8.2%',
      sectorBenchmark: '5%',
    },
  ],
  dataAsOf: '2024-12-31',
};

const renderPanel = () =>
  render(
    <MemoryRouter>
      <ELI5Panel ticker="AAPL" />
    </MemoryRouter>
  );

describe('ELI5Panel', () => {
  it('shows loading skeleton initially', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderPanel();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders sentiment badge with icon and label', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockELI5Response,
    } as Response);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /overall sentiment/i })).toBeInTheDocument();
      expect(screen.getByText('Doing well overall')).toBeInTheDocument();
    });
  });

  it('renders section cards with emoji and fallback label (no window.ai)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockELI5Response,
    } as Response);

    renderPanel();

    await waitFor(() => {
      // Fallback label format: "Valuation: Pricey"
      expect(screen.getByText('Valuation: Pricey')).toBeInTheDocument();
      expect(screen.getByText('💰')).toBeInTheDocument();
    });
  });

  it('shows AI-unavailable notice when window.ai is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockELI5Response,
    } as Response);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/enable chrome's built-in on-device AI/i)).toBeInTheDocument();
    });
  });

  it('expands and collapses section detail on click', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockELI5Response,
    } as Response);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Valuation: Pricey')).toBeInTheDocument();
    });

    // Expand
    const expandBtn = screen.getAllByRole('button', { name: /expand/i })[0];
    fireEvent.click(expandBtn);
    await waitFor(() => {
      expect(screen.getByText('P/E: 29.5x')).toBeInTheDocument();
    });

    // Collapse
    const collapseBtn = screen.getAllByRole('button', { name: /collapse/i })[0];
    fireEvent.click(collapseBtn);
    await waitFor(() => {
      expect(screen.queryByText('P/E: 29.5x')).not.toBeInTheDocument();
    });
  });

  it('shows "data as of" date and Learn link', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockELI5Response,
    } as Response);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/data as of/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /what do these mean/i })).toBeInTheDocument();
    });
  });

  it('shows limited data notice when sections are empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockELI5Response, sections: [] }),
    } as Response);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/limited data available/i)).toBeInTheDocument();
    });
  });

  it('shows error state gracefully — never blank', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    } as Response);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
    });
  });

  it('returns null (no panel) for 404 ticker', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'ticker not found' }),
    } as Response);

    const { container } = renderPanel();

    await waitFor(() => {
      // Panel should not render anything visible for unknown tickers
      expect(container.firstChild).toBeNull();
    });
  });
});
