import type { Category, Transaction } from '../../db/types.ts';
import { monthKeyOf, type MonthKey } from '../../lib/dates.ts';

/** Money in and out for one month, in minor units. */
export interface MonthTotals {
  incomeMinor: number;
  expenseMinor: number;
}

/** One row of "where the money went". */
export interface CategorySpend {
  categoryId: string;
  name: string;
  emoji: string;
  amountMinor: number;
  /** Share of the month's total spending, 0-100, rounded to a whole percent. */
  percent: number;
}

/**
 * Business rule: balance = all-time income minus all-time expenses
 * (not just the selected month).
 */
export function balanceMinor(transactions: readonly Transaction[]): number {
  return transactions.reduce(
    (sum, t) => sum + (t.type === 'income' ? t.amountMinor : -t.amountMinor),
    0,
  );
}

/** Income and expense totals for transactions dated in `month`. */
export function monthTotals(transactions: readonly Transaction[], month: MonthKey): MonthTotals {
  const totals: MonthTotals = { incomeMinor: 0, expenseMinor: 0 };
  for (const t of transactions) {
    if (monthKeyOf(t.date) !== month) continue;
    if (t.type === 'income') totals.incomeMinor += t.amountMinor;
    else totals.expenseMinor += t.amountMinor;
  }
  return totals;
}

/**
 * Spending in `month` per category, largest first. Ties keep a stable order (by name)
 * so rows don't jump around between renders.
 */
export function spendingByCategory(
  transactions: readonly Transaction[],
  month: MonthKey,
  categories: ReadonlyMap<string, Category>,
): CategorySpend[] {
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== 'expense' || monthKeyOf(t.date) !== month) continue;
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amountMinor);
    total += t.amountMinor;
  }

  return [...byCategory.entries()]
    .map(([categoryId, amountMinor]) => {
      const category = categories.get(categoryId);
      return {
        categoryId,
        name: category?.name ?? 'Unknown category',
        emoji: category?.emoji ?? '❔',
        amountMinor,
        percent: total === 0 ? 0 : Math.round((amountMinor / total) * 100),
      };
    })
    .sort((a, b) => b.amountMinor - a.amountMinor || a.name.localeCompare(b.name));
}
