import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { HeatmapSector, HeatmapStock } from '../../hooks/useHeatmap';
import './SectorHeatmap.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  stock: HeatmapStock;
  visible: boolean;
}

interface SectorHeatmapProps {
  sectors: HeatmapSector[];
  period: '1d' | '5d' | '1m';
  onPeriodChange: (period: '1d' | '5d' | '1m') => void;
  marketClosed?: boolean;
  incomplete?: boolean;
  asOf: string;
}

// ── D3 Helpers ─────────────────────────────────────────────────────────────────

// Color scale: negative (red) → 0 (neutral gray) → positive (green)
const colorScale = d3.scaleLinear<string>()
  .domain([-5, 0, 5])
  .range(['#EF4444', '#374151', '#22C55E'])
  .clamp(true);

// Halted stock color
const HALTED_COLOR = '#4B5563';

// Minimum cell size to show text label (px)
const MIN_LABEL_WIDTH = 30;
const MIN_LABEL_HEIGHT = 20;

// ── Period toggle labels ──────────────────────────────────────────────────────

const PERIOD_OPTIONS: { label: string; value: '1d' | '5d' | '1m' }[] = [
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '1M', value: '1m' },
];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * SectorHeatmap — D3 treemap where cells are stocks, sized by market cap,
 * colored by daily % change.
 *
 * AC: d3-hierarchy: d3.treemap() for layout.
 * AC: d3-scale: d3.scaleLinear() for color scale.
 * AC: SVG sized to container via ResizeObserver.
 * AC: ResizeObserver debounced at 200ms.
 * AC: Cells grouped by sector with sector labels in SVG.
 * AC: Hover shows ticker, name, price, % change.
 * AC: Click navigates to /stock/:ticker.
 * AC: role='img' aria-label on SVG.
 * AC: Text hidden for cells < 30px wide or < 20px tall.
 */
export const SectorHeatmap: React.FC<SectorHeatmapProps> = ({
  sectors,
  period,
  onPeriodChange,
  marketClosed,
  incomplete,
  asOf,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState<TooltipState>({
    x: 0, y: 0, stock: {} as HeatmapStock, visible: false,
  });

  // Debounced resize handler (200ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  }, []);

  // Set up ResizeObserver (mocked in tests via test-setup.ts)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(handleResize, 200);
    });

    observer.observe(container);
    handleResize(); // initial measurement

    return () => {
      observer.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [handleResize]);

  // Build D3 treemap layout whenever dimensions or data change
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;
    if (!sectors || sectors.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Build hierarchical data structure: root → sectors → stocks
    const hierarchyData = {
      name: 'root',
      children: sectors.map((sector) => ({
        name: sector.name,
        children: sector.stocks.map((stock) => ({
          name: stock.ticker,
          stock,
          // Value for treemap sizing: use market cap or 1 as fallback
          value: stock.marketCap ?? 1,
        })),
      })),
    };

    // Create hierarchy and compute treemap layout
    const root = d3
      .hierarchy(hierarchyData)
      .sum((d: any) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const treemap = d3
      .treemap<typeof hierarchyData>()
      .size([dimensions.width, dimensions.height])
      .paddingOuter(3)
      .paddingInner(1)
      .paddingTop(20); // space for sector label

    treemap(root as any);

    const leaves = (root as any).leaves();
    const sectorNodes = (root as any).children ?? [];

    // Draw sector group labels
    svg
      .selectAll('.sector-label')
      .data(sectorNodes)
      .enter()
      .append('text')
      .attr('class', 'sector-label')
      .attr('x', (d: any) => d.x0 + 4)
      .attr('y', (d: any) => d.y0 + 14)
      .text((d: any) => d.data.name)
      .attr('fill', '#9CA3AF')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-ui, sans-serif)')
      .attr('pointer-events', 'none');

    // Draw stock cells
    const cells = svg
      .selectAll('.stock-cell')
      .data(leaves)
      .enter()
      .append('g')
      .attr('class', 'stock-cell')
      .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

    cells
      .append('rect')
      .attr('width', (d: any) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d: any) => Math.max(0, d.y1 - d.y0))
      .attr('fill', (d: any) => {
        const stock: HeatmapStock = d.data.stock;
        if (stock.halted) return HALTED_COLOR;
        return colorScale(stock.change);
      })
      .attr('rx', 2)
      .attr('cursor', 'pointer')
      .on('mouseenter', function (event: MouseEvent, d: any) {
        const stock: HeatmapStock = d.data.stock;
        d3.select(this).attr('opacity', 0.85);
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left + 8,
          y: event.clientY - rect.top - 10,
          stock,
          visible: true,
        });
      })
      .on('mousemove', function (event: MouseEvent) {
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip((prev) => ({
          ...prev,
          x: event.clientX - rect.left + 8,
          y: event.clientY - rect.top - 10,
        }));
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 1);
        setTooltip((prev) => ({ ...prev, visible: false }));
      })
      .on('click', (_event: MouseEvent, d: any) => {
        const stock: HeatmapStock = d.data.stock;
        navigate(`/stock/${stock.ticker}`);
      });

    // Draw ticker labels (only when cell is large enough)
    cells
      .filter((d: any) => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        return w >= MIN_LABEL_WIDTH && h >= MIN_LABEL_HEIGHT;
      })
      .append('text')
      .attr('x', (d: any) => (d.x1 - d.x0) / 2)
      .attr('y', (d: any) => (d.y1 - d.y0) / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('font-size', (d: any) => {
        const w = d.x1 - d.x0;
        return Math.min(12, w / 5) + 'px';
      })
      .attr('font-family', 'var(--font-mono, monospace)')
      .attr('pointer-events', 'none')
      .text((d: any) => d.data.name);

    // Draw % change labels (only when cell is large enough)
    cells
      .filter((d: any) => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        return w >= MIN_LABEL_WIDTH + 10 && h >= MIN_LABEL_HEIGHT + 14;
      })
      .append('text')
      .attr('x', (d: any) => (d.x1 - d.x0) / 2)
      .attr('y', (d: any) => (d.y1 - d.y0) / 2 + 14)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'rgba(255,255,255,0.8)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono, monospace)')
      .attr('pointer-events', 'none')
      .text((d: any) => {
        const stock: HeatmapStock = d.data.stock;
        if (stock.halted) return 'Halted';
        const sign = stock.change >= 0 ? '+' : '';
        return `${sign}${stock.change.toFixed(2)}%`;
      });
  }, [sectors, dimensions, navigate]);

  return (
    <div className="sector-heatmap">
      {/* Controls */}
      <div className="sector-heatmap__controls">
        <div
          className="sector-heatmap__period-selector"
          role="group"
          aria-label="Period selector"
        >
          {PERIOD_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              className={`sector-heatmap__period-btn${period === value ? ' sector-heatmap__period-btn--active' : ''}`}
              onClick={() => onPeriodChange(value)}
              aria-pressed={period === value}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="sector-heatmap__meta">
          {marketClosed && (
            <span className="sector-heatmap__market-closed">Market closed</span>
          )}
          {incomplete && (
            <span className="sector-heatmap__incomplete">Partial data</span>
          )}
          <span className="sector-heatmap__as-of">
            As of {new Date(asOf).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Color legend */}
      <div className="sector-heatmap__legend" aria-label="Color scale legend">
        <span style={{ color: '#EF4444' }}>▼ Negative</span>
        <span style={{ color: '#9CA3AF' }}>Neutral</span>
        <span style={{ color: '#22C55E' }}>▲ Positive</span>
      </div>

      {/* SVG Treemap */}
      <div
        ref={containerRef}
        className="sector-heatmap__container"
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          role="img"
          aria-label="S&P 500 sector heatmap"
          className="sector-heatmap__svg"
        />

        {/* Accessible data table alternative */}
        <details className="sector-heatmap__a11y-table">
          <summary>View data table (accessibility)</summary>
          <table aria-label="S&P 500 stocks by sector">
            <thead>
              <tr>
                <th>Sector</th>
                <th>Ticker</th>
                <th>Change %</th>
              </tr>
            </thead>
            <tbody>
              {sectors.flatMap((sector) =>
                sector.stocks.map((stock) => (
                  <tr key={stock.ticker}>
                    <td>{sector.name}</td>
                    <td>{stock.ticker}</td>
                    <td className="font-mono">
                      {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </details>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="sector-heatmap__tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
          aria-hidden="true"
          role="presentation"
        >
          <strong className="font-mono">{tooltip.stock.ticker}</strong>
          <span className="sector-heatmap__tooltip-name">{tooltip.stock.name}</span>
          {tooltip.stock.price != null && (
            <span className="font-mono">${tooltip.stock.price.toFixed(2)}</span>
          )}
          {tooltip.stock.halted ? (
            <span className="sector-heatmap__tooltip-halted">Halted</span>
          ) : (
            <span
              className={`font-mono ${tooltip.stock.change >= 0 ? 'text-positive' : 'text-negative'}`}
            >
              {tooltip.stock.change >= 0 ? '+' : ''}{tooltip.stock.change.toFixed(2)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
};
