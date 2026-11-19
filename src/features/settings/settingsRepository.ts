import { db } from '../../db/db.ts';
import { DEFAULT_CURRENCY, isSupportedCurrency } from './currencies.ts';

const CURRENCY_KEY = 'currency';

/** The saved currency, or the default (PHP) if none is saved or the saved one is unknown. */
export async function getCurrency(): Promise<string> {
  const row = await db.settings.get(CURRENCY_KEY);
  return row && isSupportedCurrency(row.value) ? row.value : DEFAULT_CURRENCY;
}

/** Saves the display currency. Throws for unsupported codes. */
export async function setCurrency(code: string): Promise<void> {
  if (!isSupportedCurrency(code)) throw new Error(`Unsupported currency: ${code}`);
  await db.settings.put({ key: CURRENCY_KEY, value: code });
}
