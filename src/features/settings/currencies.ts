/*
 * Currencies the user can pick. Business rule: currency is a display setting only;
 * changing it never converts amounts.
 *
 * Only currencies with exactly 2 decimal places are listed, because amounts are
 * stored as hundredths (minor units). Zero-decimal currencies such as JPY or KRW
 * would need a different scale, so they are left out on purpose.
 */
export const CURRENCIES = [
  { code: 'PHP', name: 'Philippine peso' },
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'SAR', name: 'Saudi riyal' },
] as const;

export const DEFAULT_CURRENCY = 'PHP';

/** True if `code` is one of the supported currencies. */
export function isSupportedCurrency(code: string): boolean {
  return CURRENCIES.some((c) => c.code === code);
}

/** The symbol shown next to amounts, e.g. "₱" for PHP, "$" for USD. */
export function currencySymbol(code: string): string {
  const part = new Intl.NumberFormat('en-PH', { style: 'currency', currency: code })
    .formatToParts(0)
    .find((p) => p.type === 'currency');
  return part?.value ?? code;
}
