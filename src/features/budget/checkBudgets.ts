import { db } from '../../db/db.ts';
import type { MonthKey } from '../../lib/dates.ts';
import { budgetCrossings, type BudgetCrossing } from './budget.ts';
import { showBudgetAlerts } from './budgetAlerts.ts';
import { getMonthlyBudget } from './budgetRepository.ts';

/**
 * Runs a save and then shows an alert for every budget it pushed past 80% or over,
 * for the month the entry is dated in. Checking never blocks or undoes the save:
 * if reading the budgets fails, the entry is still saved and no alert shows.
 * @returns the crossings that were shown (for tests)
 */
export async function saveAndCheckBudgets(
  month: MonthKey,
  currency: string,
  save: () => Promise<void>,
): Promise<BudgetCrossing[]> {
  const before = await db.transactions.toArray();
  await save();
  try {
    const [after, monthlyBudget, categories] = await Promise.all([
      db.transactions.toArray(),
      getMonthlyBudget(),
      db.categories.toArray(),
    ]);
    const crossings = budgetCrossings(before, after, month, monthlyBudget, categories, currency);
    showBudgetAlerts(crossings);
    return crossings;
  } catch (error) {
    // The entry is saved; a missing alert must not look like a failed save.
    console.error('Budget check failed', error);
    return [];
  }
}
