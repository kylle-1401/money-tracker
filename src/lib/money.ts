/*
 * Money helpers. Business rule: amounts are stored as integer minor units
 * (centavos for PHP), never as floats, so totals never pick up rounding errors.
 * ₱12.50 is stored as 1250.
 */

/** Largest amount accepted for one transaction: 999,999,999.99 (keeps sums far below 2^53). */
export const MAX_AMOUNT_MINOR = 99_999_999_999;

// Digits with an optional 1-2 digit fraction; also allows ".5". No signs, no exponents.
const AMOUNT_PATTERN = /^(\d*)(?:\.(\d{1,2}))?$/;

/**
 * Parses what the user typed into integer minor units.
 * Accepts thousands separators, surrounding spaces and a leading peso sign.
 * @returns the amount in centavos, or null if it's empty, not a number, zero/negative,
 *          has more than 2 decimals, or exceeds {@link MAX_AMOUNT_MINOR}.
 */
export function parseAmountToMinor(input: string): number | null {
  const cleaned = input.trim().replace(/^₱/, '').replace(/,/g, '').trim();
  const match = AMOUNT_PATTERN.exec(cleaned);
  if (!match) return null;

  const whole = match[1] ?? '';
  const fraction = match[2] ?? '';
  if (whole === '' && fraction === '') return null; // "" or "."

  // Build the integer from the digit strings instead of multiplying a float by 100,
  // which would turn "0.29" into 28.999...
  const minor = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
  if (minor <= 0 || minor > MAX_AMOUNT_MINOR) return null;
  return minor;
}

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Formats minor units for display, e.g. 123456 → "₱1,234.56".
 * @param currency ISO 4217 code; display only, no conversion happens.
 */
export function formatMinor(minor: number, currency = 'PHP'): string {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(currency, formatter);
  }
  return formatter.format(minor / 100);
}

/** Converts minor units back to a plain input string for editing, e.g. 1250 → "12.50". */
export function minorToInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = String(minor % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}
