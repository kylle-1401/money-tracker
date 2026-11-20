import type { Category, Transaction, Wallet } from '../../db/types.ts';
import { minorToInput } from '../../lib/money.ts';

/*
 * CSV export for spreadsheets (Excel, Google Sheets, Numbers). One-way only: the
 * JSON backup is the restorable format.
 */

/** Byte-order mark; written as a code point so it stays visible in source. */
const UTF8_BOM = String.fromCharCode(0xfeff);

/**
 * Quotes a cell per RFC 4180, and defuses spreadsheet formula injection: text that
 * starts with = + - @ (or tab/CR) would run as a formula in Excel, so it gets a
 * leading apostrophe. Cells with a semicolon are quoted too: in locales where Excel
 * splits on ";", an unquoted "x;=HYPERLINK(...)" would become a formula cell.
 * Applied to free-text cells only; amounts are plain numbers.
 */
export function csvTextCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",;\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * One row per transaction, oldest first. Expenses are negative so a SUM of the
 * Amount column equals the balance.
 */
export function transactionsToCsv(
  transactions: readonly Transaction[],
  categories: ReadonlyMap<string, Category>,
  wallets: ReadonlyMap<string, Wallet>,
  currency: string,
): string {
  const header = ['Date', 'Type', 'Wallet', 'Category', 'Amount', 'Currency', 'Note'];
  const rows = [...transactions]
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((t) => {
      const amount = minorToInput(t.amountMinor);
      return [
        t.date,
        t.type === 'income' ? 'Income' : 'Expense',
        csvTextCell(wallets.get(t.walletId)?.name ?? 'Unknown wallet'),
        csvTextCell(categories.get(t.categoryId)?.name ?? 'Unknown category'),
        t.type === 'income' ? amount : `-${amount}`,
        currency,
        csvTextCell(t.note),
      ].join(',');
    });
  // CRLF line endings and a UTF-8 BOM so Excel on Windows shows ₱ and emoji correctly.
  return `${UTF8_BOM}${[header.join(','), ...rows].join('\r\n')}\r\n`;
}
