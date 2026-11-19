import { createContext, useContext } from 'react';
import { DEFAULT_CURRENCY } from './currencies.ts';

/** The display currency, read once at the top of the app (see CurrencyProvider). */
export const CurrencyContext = createContext<string>(DEFAULT_CURRENCY);

/** The user's display currency code, e.g. "PHP". */
export function useCurrency(): string {
  return useContext(CurrencyContext);
}
