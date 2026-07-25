import { useState, useEffect } from 'react';

export type StatementType = 'income' | 'balance' | 'cashflow';
export type Period = 'annual' | 'quarterly';

export interface StatementPeriod {
  fiscalDate: string;
  revenue?: number | null;
  grossProfit?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
  eps?: number | null;
  // Balance sheet
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  totalEquity?: number | null;
  // Cash flow
  operatingCashFlow?: number | null;
  capitalExpenditures?: number | null;
  freeCashFlow?: number | null;
}

export interface FinancialsResponse {
  ticker: string;
  statement: StatementType;
  period: Period;
  data: StatementPeriod[];
  dataSource: string;
  lastUpdated: string;
}

interface UseFinancialsReturn {
  data: FinancialsResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches financial statement data for a given ticker.
 * Re-fetches when statement type or period changes.
 */
export function useFinancials(
  ticker: string,
  statement: StatementType,
  period: Period,
  limit = 4
): UseFinancialsReturn {
  const [data, setData] = useState<FinancialsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({ statement, period, limit: String(limit) });
    fetch(`/api/stocks/${encodeURIComponent(ticker.toUpperCase())}/financials?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Server returned ${res.status}`);
        }
        const json: FinancialsResponse = await res.json();
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [ticker, statement, period, limit]);

  return { data, isLoading, error };
}
