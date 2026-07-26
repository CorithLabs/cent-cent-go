import { OHLCVBar } from '../hooks/useOHLCV';

/**
 * Converts an OHLCV data array to a CSV string and triggers a browser download.
 */
export function downloadOHLCVAsCSV(ticker: string, range: string, data: OHLCVBar[]): void {
  const header = 'timestamp,open,high,low,close,volume';
  const rows = data.map((bar) =>
    [bar.timestamp, bar.open, bar.high, bar.low, bar.close, bar.volume].join(',')
  );
  const csv = [header, ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${ticker}_${range}_ohlcv.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
