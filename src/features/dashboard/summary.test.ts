import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../../db/types.ts';
import { defaultCategories } from '../../db/seed.ts';
import { balanceMinor, monthTotals, spendingByCategory } from './summary.ts';

let seq = 0;
function tx(
  date: string,
  type: Transaction['type'],
  amountMinor: number,
  categoryId = type === 'income' ? 'income-salary' : 'expense-food',
): Transaction {
  seq += 1;
  return {
    id: String(seq),
    date,
    type,
    amountMinor,
    categoryId,
    walletId: 'wallet-cash',
    note: '',
    createdAt: 0,
    updatedAt: 0,
  };
}

const categories = new Map<string, Category>(defaultCategories.map((c) => [c.id, c]));

describe('balanceMinor', () => {
  it('balanceMinor_Empty_IsZero', () => {
    expect(balanceMinor([])).toBe(0);
  });

  it('balanceMinor_AllMonths_IncomeMinusExpenses', () => {
    const txs = [
      tx('2026-10-01', 'income', 2_500_000),
      tx('2026-11-02', 'expense', 24_550),
      tx('2026-11-03', 'expense', 100_000),
    ];
    expect(balanceMinor(txs)).toBe(2_375_450);
  });

  it('balanceMinor_SpentMoreThanEarned_IsNegative', () => {
    expect(balanceMinor([tx('2026-11-01', 'expense', 500)])).toBe(-500);
  });
});

describe('monthTotals', () => {
  it('monthTotals_OnlyCountsSelectedMonth', () => {
    const txs = [
      tx('2026-10-31', 'expense', 999),
      tx('2026-11-01', 'income', 10_000),
      tx('2026-11-30', 'expense', 2_500),
      tx('2026-12-01', 'expense', 777),
    ];
    expect(monthTotals(txs, '2026-11')).toEqual({ incomeMinor: 10_000, expenseMinor: 2_500 });
  });

  it('monthTotals_NoData_IsZero', () => {
    expect(monthTotals([], '2026-11')).toEqual({ incomeMinor: 0, expenseMinor: 0 });
  });
});

describe('spendingByCategory', () => {
  it('spendingByCategory_GroupsSortsAndComputesPercent', () => {
    const txs = [
      tx('2026-11-01', 'expense', 3_000, 'expense-food'),
      tx('2026-11-02', 'expense', 1_000, 'expense-food'),
      tx('2026-11-03', 'expense', 6_000, 'expense-bills-utilities'),
      tx('2026-11-04', 'income', 99_999), // income is not spending
      tx('2026-10-04', 'expense', 50_000, 'expense-transport'), // other month
    ];

    const rows = spendingByCategory(txs, '2026-11', categories);

    expect(rows).toEqual([
      {
        categoryId: 'expense-bills-utilities',
        name: 'Bills & Utilities',
        emoji: '💡',
        amountMinor: 6_000,
        percent: 60,
      },
      { categoryId: 'expense-food', name: 'Food', emoji: '🍜', amountMinor: 4_000, percent: 40 },
    ]);
  });

  it('spendingByCategory_NoSpending_ReturnsEmpty', () => {
    expect(spendingByCategory([tx('2026-11-01', 'income', 100)], '2026-11', categories)).toEqual(
      [],
    );
  });

  it('spendingByCategory_MissingCategory_ShowsUnknown', () => {
    const rows = spendingByCategory(
      [tx('2026-11-01', 'expense', 100, 'gone')],
      '2026-11',
      categories,
    );
    expect(rows[0]?.name).toBe('Unknown category');
  });

  it('spendingByCategory_Tie_SortsByName', () => {
    const rows = spendingByCategory(
      [
        tx('2026-11-01', 'expense', 100, 'expense-transport'),
        tx('2026-11-01', 'expense', 100, 'expense-food'),
      ],
      '2026-11',
      categories,
    );
    expect(rows.map((r) => r.name)).toEqual(['Food', 'Transport']);
  });
});
