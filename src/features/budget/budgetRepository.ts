import { db } from '../../db/db.ts';
import { MAX_AMOUNT_MINOR } from '../../lib/money.ts';

/** Settings key for the overall monthly budget (minor units as text). */
export const MONTHLY_BUDGET_KEY = 'monthlyBudget';

/** A budget must be a whole number of centavos above 0, within the amount limit. */
export function isValidBudget(minor: number): boolean {
  return Number.isSafeInteger(minor) && minor > 0 && minor <= MAX_AMOUNT_MINOR;
}

/** The overall monthly budget, or null if none is set (or the stored value is junk). */
export async function getMonthlyBudget(): Promise<number | null> {
  const row = await db.settings.get(MONTHLY_BUDGET_KEY);
  const value = row ? Number(row.value) : NaN;
  return isValidBudget(value) ? value : null;
}

/** Sets the overall monthly budget, or removes it with null. */
export async function setMonthlyBudget(minor: number | null): Promise<void> {
  if (minor === null) {
    await db.settings.delete(MONTHLY_BUDGET_KEY);
    return;
  }
  if (!isValidBudget(minor)) throw new Error('Enter a budget above 0, up to 2 decimals.');
  await db.settings.put({ key: MONTHLY_BUDGET_KEY, value: String(minor) });
}
