import type { Category, Transaction, Wallet } from '../../db/types.ts';
import { monthKeyOf, type MonthKey } from '../../lib/dates.ts';
import { effectOnWallet, feeOf, netEffectMinor } from '../transactions/effects.ts';

/** Money in and out for one month, in minor units. */
export interface MonthTotals {
  incomeMinor: number;
  /** Expenses plus transfer fees. Transfers themselves are not spending. */
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

/** Key for the fixed "Transfer fees" row in "where the money went" (not a real category). */
export const TRANSFER_FEES_KEY = 'transfer-fees';

/**
 * Business rule: change in your money from entries, all time: income − expenses −
 * transfer fees (starting balances not included; see totalBalanceMinor).
 */
export function balanceMinor(transactions: readonly Transaction[]): number {
  return transactions.reduce((sum, t) => sum + netEffectMinor(t), 0);
}

/**
 * Business rule: wallet balance = starting balance + income − expenses − transfers
 * out − their fees + transfers in, all time. Archived wallets are included.
 * @returns balance per wallet id
 */
export function walletBalances(
  wallets: readonly Wallet[],
  transactions: readonly Transaction[],
): Map<string, number> {
  const balances = new Map(wallets.map((w) => [w.id, w.startingBalanceMinor]));
  for (const t of transactions) {
    // A Set, so a (corrupt) transfer to itself is applied once, not twice.
    for (const id of new Set(t.type === 'transfer' ? [t.walletId, t.toWalletId] : [t.walletId])) {
      const current = id === undefined ? undefined : balances.get(id);
      if (id === undefined || current === undefined) continue; // only with corrupt data
      balances.set(id, current + effectOnWallet(t, id));
    }
  }
  return balances;
}

/**
 * Business rule: total balance = the sum of every wallet's balance (archived ones
 * too: the money still exists) = starting balances + income − expenses − fees.
 */
export function totalBalanceMinor(
  wallets: readonly Wallet[],
  transactions: readonly Transaction[],
): number {
  let total = 0;
  for (const balance of walletBalances(wallets, transactions).values()) total += balance;
  return total;
}

/** Income and spending (expenses + transfer fees) for entries dated in `month`. */
export function monthTotals(transactions: readonly Transaction[], month: MonthKey): MonthTotals {
  const totals: MonthTotals = { incomeMinor: 0, expenseMinor: 0 };
  for (const t of transactions) {
    if (monthKeyOf(t.date) !== month) continue;
    if (t.type === 'income') totals.incomeMinor += t.amountMinor;
    else if (t.type === 'expense') totals.expenseMinor += t.amountMinor;
    else totals.expenseMinor += feeOf(t);
  }
  return totals;
}

/**
 * Spending in `month` per category, largest first, with transfer fees as one fixed
 * "Transfer fees" row. Ties keep a stable order (by name) so rows don't jump around.
 */
export function spendingByCategory(
  transactions: readonly Transaction[],
  month: MonthKey,
  categories: ReadonlyMap<string, Category>,
): CategorySpend[] {
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const t of transactions) {
    if (monthKeyOf(t.date) !== month) continue;
    const key =
      t.type === 'expense' ? t.categoryId : t.type === 'transfer' ? TRANSFER_FEES_KEY : null;
    const amount = t.type === 'expense' ? t.amountMinor : feeOf(t);
    if (key === null || amount === 0) continue;
    byCategory.set(key, (byCategory.get(key) ?? 0) + amount);
    total += amount;
  }

  return [...byCategory.entries()]
    .map(([categoryId, amountMinor]) => {
      const category = categories.get(categoryId);
      const isFees = categoryId === TRANSFER_FEES_KEY;
      return {
        categoryId,
        name: isFees ? 'Transfer fees' : (category?.name ?? 'Unknown category'),
        emoji: isFees ? '🔁' : (category?.emoji ?? '❔'),
        amountMinor,
        percent: total === 0 ? 0 : Math.round((amountMinor / total) * 100),
      };
    })
    .sort((a, b) => b.amountMinor - a.amountMinor || a.name.localeCompare(b.name));
}
