import type { Category, Transaction, Wallet } from '../../db/types.ts';
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

/**
 * Business rule (slice 7): wallet balance = starting balance + income − expenses
 * in that wallet, all time. Archived wallets are included. Transfers (slice 8) will
 * extend this.
 * @returns balance per wallet id
 */
export function walletBalances(
  wallets: readonly Wallet[],
  transactions: readonly Transaction[],
): Map<string, number> {
  const balances = new Map(wallets.map((w) => [w.id, w.startingBalanceMinor]));
  for (const t of transactions) {
    const current = balances.get(t.walletId);
    if (current === undefined) continue; // only possible with corrupt data
    balances.set(t.walletId, current + (t.type === 'income' ? t.amountMinor : -t.amountMinor));
  }
  return balances;
}

/**
 * Business rule: total balance = the sum of every wallet's balance (archived ones
 * too: the money still exists) = starting balances + all-time income − expenses.
 */
export function totalBalanceMinor(
  wallets: readonly Wallet[],
  transactions: readonly Transaction[],
): number {
  let total = 0;
  for (const balance of walletBalances(wallets, transactions).values()) total += balance;
  return total;
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
