import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IndicatorsPanel } from './IndicatorsPanel';
import { IndicatorKey, IndicatorResult } from '../../hooks/useIndicators';

// Mock Recharts components for non-browser environment
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  const Noop: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
  return {
    ...actual,
    ResponsiveContainer: Noop,
    LineChart: Noop,
    ComposedChart: Noop,
    Line: () => null,
    Bar: () => null,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    ReferenceLine: () => null,
    Tooltip: () => null,
    Cell: () => null,
  };
});

const noop = () => {};

const makeMockData = (key: IndicatorKey): IndicatorResult => ({
  indicator: key,
  data: Array.from({ length: 10 }, (_, i) => ({
    timestamp: new Date(Date.now() - i * 86400000).toISOString(),
    value: 50 + i,
    histogram: i % 2 === 0 ? 0.5 : -0.3,
    signal: 49 + i,
  })),
});

describe('IndicatorsPanel — themed', () => {
  it('renders the Indicators toggle button', () => {
    render(
      <IndicatorsPanel
        activeKeys={new Set()}
        loadingKeys={new Set()}
        unavailableKeys={new Set()}
        onToggle={noop}
      />
    );
    expect(screen.getByRole('button', { name: /indicators/i })).toBeInTheDocument();
  });

  it('opens the dropdown and shows all 6 indicators', () => {
    render(
      <IndicatorsPanel
        activeKeys={new Set()}
        loadingKeys={new Set()}
        unavailableKeys={new Set()}
        onToggle={noop}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));
    expect(screen.getByText('SMA 50')).toBeInTheDocument();
    expect(screen.getByText('SMA 200')).toBeInTheDocument();
    expect(screen.getByText('EMA 20')).toBeInTheDocument();
    expect(screen.getByText('Bollinger Bands')).toBeInTheDocument();
    expect(screen.getByText('RSI (14)')).toBeInTheDocument();
    expect(screen.getByText('MACD')).toBeInTheDocument();
  });

  it('calls onToggle when an indicator is clicked', () => {
    const onToggle = vi.fn();
    render(
      <IndicatorsPanel
        activeKeys={new Set()}
        loadingKeys={new Set()}
        unavailableKeys={new Set()}
        onToggle={onToggle}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));
    fireEvent.click(screen.getByRole('button', { name: /SMA 50/i }));
    expect(onToggle).toHaveBeenCalledWith('sma50');
  });

  it('shows active indicator count badge', () => {
    const active = new Set<IndicatorKey>(['sma50', 'rsi']);
    render(
      <IndicatorsPanel
        activeKeys={active}
        loadingKeys={new Set()}
        unavailableKeys={new Set()}
        onToggle={noop}
      />
    );
    expect(screen.getByLabelText('2 active')).toBeInTheDocument();
  });

  it('disables unavailable indicators (RSI/MACD on 1D)', () => {
    render(
      <IndicatorsPanel
        activeKeys={new Set()}
        loadingKeys={new Set()}
        unavailableKeys={new Set(['rsi', 'macd'] as IndicatorKey[])}
        onToggle={noop}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));
    expect(screen.getByRole('button', { name: /RSI/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /MACD/i })).toBeDisabled();
  });

  it('shows legend for active indicators with --font-mono class', () => {
    const active = new Set<IndicatorKey>(['sma50']);
    render(
      <IndicatorsPanel
        activeKeys={active}
        loadingKeys={new Set()}
        unavailableKeys={new Set()}
        onToggle={noop}
      />
    );
    const legend = screen.getByLabelText('Active indicators legend');
    expect(legend).toBeInTheDocument();
    // Legend items use --font-mono via .indicators-panel__legend-item class
    const legendItem = legend.querySelector('.indicators-panel__legend-item');
    expect(legendItem).toBeInTheDocument();
  });

  it('renders RSI sub-panel when RSI is active and data provided', () => {
    const data = new Map<IndicatorKey, IndicatorResult>();
    data.set('rsi', makeMockData('rsi'));

    render(
      <IndicatorsPanel
        activeKeys={new Set<IndicatorKey>(['rsi'])}
        loadingKeys={new Set()}
        unavailableKeys={new Set()}
        onToggle={noop}
        data={data}
      />
    );
    expect(screen.getByRole('img', { name: /RSI.*sub-chart/i })).toBeInTheDocument();
  });

  it('renders MACD sub-panel when MACD is active and data provided', () => {
    const data = new Map<IndicatorKey, IndicatorResult>();
    data.set('macd', makeMockData('macd'));

    render(
      <IndicatorsPanel
        activeKeys={new Set<IndicatorKey>(['macd'])}
        loadingKeys={new Set()}
        unavailableKeys={new Set()}
        onToggle={noop}
        data={data}
      />
    );
    expect(screen.getByRole('img', { name: /MACD.*sub-chart/i })).toBeInTheDocument();
  });

  it('renders both sub-panels when RSI + MACD are both active', () => {
    const data = new Map<IndicatorKey, IndicatorResult>();
    data.set('rsi', makeMockData('rsi'));
    data.set('macd', makeMockData('macd'));

    render(
      <IndicatorsPanel
        activeKeys={new Set<IndicatorKey>(['rsi', 'macd'])}
        loadingKeys={new Set()}
        unavailableKeys={new Set()}
        onToggle={noop}
        data={data}
      />
    );
    expect(screen.getByRole('img', { name: /RSI/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /MACD/i })).toBeInTheDocument();
  });

  it('closes dropdown when toggle is clicked again', () => {
    render(
      <IndicatorsPanel
        activeKeys={new Set()}
        loadingKeys={new Set()}
        unavailableKeys={new Set()}
        onToggle={noop}
      />
    );
    const btn = screen.getByRole('button', { name: /indicators/i });
    fireEvent.click(btn);
    expect(screen.getByText('SMA 50')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('SMA 50')).not.toBeInTheDocument();
  });
});
