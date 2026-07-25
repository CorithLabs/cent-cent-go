import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useFinancials, StatementPeriod, Period } from '../../hooks/useFinancials';
import { formatFinancialValue } from '../../utils/formatters';
import './IncomeStatement.css';

const ROWS = [
  { key: 'revenue' as keyof StatementPeriod,        label: 'Revenue' },
  { key: 'grossProfit' as keyof StatementPeriod,    label: 'Gross Profit' },
  { key: 'operatingIncome' as keyof StatementPeriod, label: 'Operating Income' },
  { key: 'netIncome' as keyof StatementPeriod,      label: 'Net Income' },
  { key: 'eps' as keyof StatementPeriod,            label: 'EPS' },
];

const BAR_COLORS: Record<string, string> = {
  Revenue: '#3b82f6',
  'Gross Profit': '#10b981',
  'Operating Income': '#f59e0b',
  'Net Income': '#8b5cf6',
};

const DEFAULT_LIMIT = 4;
const SHOW_MORE_LIMIT = 8;

interface IncomeStatementProps {
  ticker: string;
}

type ViewMode = 'table' | 'chart';

/**
 * IncomeStatement — displays income statement data in table or bar chart form.
 * AC: Annual/quarterly toggle. Up to 4 periods by default, "Show more" loads 8.
 * AC: Rows: Revenue, Gross Profit, Operating Income, Net Income, EPS.
 * AC: Toggle between table and chart view.
 * AC: Values formatted with unit labels ($4.2B). Never shows "$0B" for small companies.
 */
export const IncomeStatement: React.FC<IncomeStatementProps> = ({ ticker }) => {
  const [period, setPeriod] = useState<Period>('annual');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  const { data, isLoading, error } = useFinancials(ticker, 'income', period, limit);

  const periods = data?.data ?? [];

  // For chart: reverse chronological → chronological
  const chartData = [...periods].reverse().map((p) => ({
    name: new Date(p.fiscalDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
    Revenue: p.revenue,
    'Gross Profit': p.grossProfit,
    'Operating Income': p.operatingIncome,
    'Net Income': p.netIncome,
  }));

  return (
    <section className="income-stmt" aria-labelledby="income-heading">
      {/* Toolbar */}
      <div className="income-stmt__toolbar">
        <h3 id="income-heading">Income Statement</h3>

        <div className="income-stmt__period-toggle" role="group" aria-label="Period">
          {(['annual', 'quarterly'] as Period[]).map((p) => (
            <button
              key={p}
              className={`income-stmt__toggle-btn${period === p ? ' income-stmt__toggle-btn--active' : ''}`}
              onClick={() => { setPeriod(p); setLimit(DEFAULT_LIMIT); }}
              aria-pressed={period === p}
            >
              {p === 'annual' ? 'Annual' : 'Quarterly'}
            </button>
          ))}
        </div>

        <div className="income-stmt__view-toggle" role="group" aria-label="View mode">
          <button
            className={`income-stmt__toggle-btn${viewMode === 'table' ? ' income-stmt__toggle-btn--active' : ''}`}
            onClick={() => setViewMode('table')}
            aria-pressed={viewMode === 'table'}
          >
            Table
          </button>
          <button
            className={`income-stmt__toggle-btn${viewMode === 'chart' ? ' income-stmt__toggle-btn--active' : ''}`}
            onClick={() => setViewMode('chart')}
            aria-pressed={viewMode === 'chart'}
          >
            Chart
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="income-stmt__loading" aria-busy="true">
          <div className="income-stmt__skeleton" />
        </div>
      )}

      {error && <div className="income-stmt__error" role="alert">{error}</div>}

      {!isLoading && !error && periods.length === 0 && (
        <div className="income-stmt__empty">No data available.</div>
      )}

      {/* Table view */}
      {!isLoading && !error && periods.length > 0 && viewMode === 'table' && (
        <div className="income-stmt__table-wrapper">
          <table className="income-stmt__table" aria-label={`${ticker} income statement, ${period}`}>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {periods.map((p) => (
                  <th key={p.fiscalDate} scope="col">
                    {new Date(p.fiscalDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ key, label }) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  {periods.map((p) => {
                    const val = p[key] as number | null | undefined;
                    // EPS: format as dollar per share with 2 decimals
                    const formatted =
                      key === 'eps'
                        ? val === null || val === undefined ? '—' : `$${(val as number).toFixed(2)}`
                        : formatFinancialValue(val);
                    // Gap detection: missing period shows em-dash
                    return (
                      <td key={p.fiscalDate} className={val === null ? 'income-stmt__gap' : ''}>
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Chart view */}
      {!isLoading && !error && periods.length > 0 && viewMode === 'chart' && (
        <div className="income-stmt__chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => formatFinancialValue(v)} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(value: number, name: string) => [formatFinancialValue(value), name]} />
              <Legend />
              {Object.entries(BAR_COLORS).map(([name, color]) => (
                <Bar key={name} dataKey={name} fill={color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Show more */}
      {!isLoading && periods.length >= limit && limit === DEFAULT_LIMIT && (
        <button
          className="income-stmt__show-more"
          onClick={() => setLimit(SHOW_MORE_LIMIT)}
        >
          Show more periods
        </button>
      )}
    </section>
  );
};
