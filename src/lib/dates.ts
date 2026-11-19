/*
 * Date helpers. Business rule: a transaction's date is a local calendar date
 * ("YYYY-MM-DD"), not a timestamp, so "which day/month" never shifts with time zones.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns the local calendar date of `date` as "YYYY-MM-DD". */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses "YYYY-MM-DD" into a local Date at midnight, or null if it isn't a real date. */
export function parseLocalDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  // Date rolls over invalid days (Feb 30 → Mar 2); reject those.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** True if `value` is a real calendar date in "YYYY-MM-DD" form. */
export function isValidDateString(value: string): boolean {
  return parseLocalDate(value) !== null;
}

const sameYearFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const otherYearFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/**
 * Heading for a group of transactions: "Today", "Yesterday", "Tue, Nov 3",
 * or "Thu, Dec 25, 2025" for other years.
 * @param now injectable for tests; defaults to the current time.
 */
export function dayLabel(value: string, now: Date = new Date()): string {
  const date = parseLocalDate(value);
  if (!date) return value;

  const today = toLocalDateString(now);
  const yesterday = toLocalDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );
  if (value === today) return 'Today';
  if (value === yesterday) return 'Yesterday';

  return date.getFullYear() === now.getFullYear()
    ? sameYearFormat.format(date)
    : otherYearFormat.format(date);
}
