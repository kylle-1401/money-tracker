import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_CURRENCY } from './currencies.ts';
import { CurrencyContext } from './currencyContext.ts';
import { getCurrency } from './settingsRepository.ts';

/**
 * Reads the currency setting once (live, so a change in Settings updates every amount
 * on screen) and shares it through context instead of one database read per amount.
 */
export default function CurrencyProvider({ children }: { children: ReactNode }) {
  const currency = useLiveQuery(getCurrency, []) ?? DEFAULT_CURRENCY;
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}
