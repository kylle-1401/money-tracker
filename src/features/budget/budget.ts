import type { Category, Transaction } from '../../db/types.ts';
import { monthKeyOf, monthLabel, type MonthKey } from '../../lib/dates.ts';
import { formatMinor } from '../../lib/money.ts';
import { monthTotals } from '../dashboard/summary.ts';

/*
 * Monthly budget rules (slice 9, owner-confirmed 2026-11-20):
 * - one overall monthly budget, plus an optional budget per expense category
 * - set once, applies to every month (no rollover, no per-month history)
 * - overall spending = expenses + transfer fees in the calendar month;
 *   a category's spending = expenses in that category
 * - warn at 80%, "over" once spending is above the budget
 */

export type BudgetLevel = 'ok' | 'warning' | 'over';

const RANK: Record<BudgetLevel, number> = { ok: 0, warning: 1, over: 2 };

/**
 * Where spending stands against a budget. Integer math (no floats): warning from
 * 80% (spent × 5 ≥ budget × 4), over when spent > budget.
 */
export function budgetLevel(spentMinor: number, budgetMinor: number): BudgetLevel {
  if (spentMinor > budgetMinor) return 'over';
  if (spentMinor * 5 >= budgetMinor * 4) return 'warning'; // spent ≤ budget ≤ MAX: safe
  return 'ok';
}

/**
 * Whole percent used, for display (can exceed 100). Spending is capped at 100× the
 * budget first so the multiplication stays a safe integer even for absurd totals.
 */
export function percentUsed(spentMinor: number, budgetMinor: number): number {
  if (budgetMinor <= 0) return 0;
  const capped = Math.min(spentMinor, budgetMinor * 100);
  return Math.floor((capped * 100) / budgetMinor);
}

/** Overall spending in a month: expenses + transfer fees. */
export function monthSpending(transactions: readonly Transaction[], month: MonthKey): number {
  return monthTotals(transactions, month).expenseMinor;
}

/** Expenses in one category in a month. */
export function categorySpending(
  transactions: readonly Transaction[],
  month: MonthKey,
  categoryId: string,
): number {
  let total = 0;
  for (const t of transactions) {
    if (t.type === 'expense' && t.categoryId === categoryId && monthKeyOf(t.date) === month) {
      total += t.amountMinor;
    }
  }
  return total;
}

/** One budget line that an entry just pushed into a worse level. */
export interface BudgetCrossing {
  /** "overall" or the category's id. */
  key: string;
  level: Exclude<BudgetLevel, 'ok'>;
  message: string;
}

/**
 * Compares a month's spending before and after a save and returns a message for
 * every budget that just got worse (ok → 80%, or anything → over). Each crossing is
 * reported once: saving another entry that stays in the same level says nothing.
 */
export function budgetCrossings(
  before: readonly Transaction[],
  after: readonly Transaction[],
  month: MonthKey,
  monthlyBudgetMinor: number | null,
  categories: readonly Category[],
  currency: string,
): BudgetCrossing[] {
  const label = monthLabel(month).split(' ')[0] ?? monthLabel(month); // "November"
  const lines: Array<{ key: string; name: string; budget: number; was: number; now: number }> = [];

  if (monthlyBudgetMinor) {
    lines.push({
      key: 'overall',
      name: `${label} budget`,
      budget: monthlyBudgetMinor,
      was: monthSpending(before, month),
      now: monthSpending(after, month),
    });
  }
  for (const c of categories) {
    if (c.type !== 'expense' || !c.budgetMinor) continue;
    lines.push({
      key: c.id,
      name: `${c.name} budget`,
      budget: c.budgetMinor,
      was: categorySpending(before, month, c.id),
      now: categorySpending(after, month, c.id),
    });
  }

  const crossings: BudgetCrossing[] = [];
  for (const line of lines) {
    const was = budgetLevel(line.was, line.budget);
    const now = budgetLevel(line.now, line.budget);
    if (now === 'ok' || RANK[now] <= RANK[was]) continue;
    crossings.push({
      key: line.key,
      level: now,
      message:
        now === 'over'
          ? `You’re ${formatMinor(line.now - line.budget, currency)} over your ${line.name}.`
          : `You’ve used ${percentUsed(line.now, line.budget)}% of your ${line.name}.`,
    });
  }
  return crossings;
}
