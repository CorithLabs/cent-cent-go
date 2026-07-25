import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IndicatorsPanel } from './IndicatorsPanel';
import { IndicatorKey } from '../../hooks/useIndicators';

const noop = () => {};

describe('IndicatorsPanel', () => {
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

  it('opens the dropdown when toggle is clicked', () => {
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
    expect(screen.getByText('MACD')).toBeInTheDocument();
    expect(screen.getByText('RSI (14)')).toBeInTheDocument();
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

  it('disables unavailable indicators and shows tooltip', () => {
    render(
      <IndicatorsPanel
        activeKeys={new Set()}
        loadingKeys={new Set()}
        unavailableKeys={new Set(['rsi', 'macd'] as IndicatorKey[])}
        onToggle={noop}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /indicators/i }));
    const rsiBtn = screen.getByRole('button', { name: /RSI/i });
    expect(rsiBtn).toBeDisabled();
  });

  it('shows legend for active indicators', () => {
    const active = new Set<IndicatorKey>(['sma50']);
    render(
      <IndicatorsPanel
        activeKeys={active}
        loadingKeys={new Set()}
        unavailableKeys={new Set()}
        onToggle={noop}
      />
    );
    expect(screen.getByLabelText('Active indicators legend')).toBeInTheDocument();
    expect(screen.getAllByText('SMA 50').length).toBeGreaterThan(0);
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
