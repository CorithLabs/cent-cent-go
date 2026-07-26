/**
 * Format a large number to a human-readable string with units.
 * e.g. 1_500_000_000 → "$1.5B", 450_000 → "$450K"
 */
export function formatCurrency(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(decimals)}`;
}

/**
 * Format a number as a price (e.g. $123.45)
 */
export function formatPrice(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a signed dollar change (e.g. +$1.23 or -$0.45)
 */
export function formatChange(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatPrice(value)}`;
}

/**
 * Format a percentage change (e.g. +1.23% or -0.45%)
 */
export function formatPct(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format a volume number (e.g. 45,678,901)
 */
export function formatVolume(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format an ISO timestamp as "Last updated: X min ago" or "Just now"
 */
export function formatLastUpdated(isoString: string): string {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Last updated: just now';
  if (diffMin === 1) return 'Last updated: 1 min ago';
  if (diffMin < 60) return `Last updated: ${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs === 1) return 'Last updated: 1 hour ago';
  return `Last updated: ${diffHrs} hours ago`;
}

/**
 * Returns true if the ISO timestamp is older than maxAgeMinutes.
 */
export function isStale(isoString: string, maxAgeMinutes = 15): boolean {
  if (!isoString) return true;
  const date = new Date(isoString);
  const diffMin = (Date.now() - date.getTime()) / 60_000;
  return diffMin > maxAgeMinutes;
}

/**
 * Format a financial statement line-item value with smart units.
 * Handles very small companies (values in thousands) correctly.
 * Never shows "$0B" for small values.
 */
export function formatFinancialValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (isNaN(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
