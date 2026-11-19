import type { ImportMode, ImportSummary } from './backupRepository.ts';

function plural(n: number): string {
  return `${n} ${n === 1 ? 'transaction' : 'transactions'}`;
}

/**
 * Result text after a restore. Honest about merges: entries that were already on
 * this device are "updated", not "added".
 */
export function importMessage(mode: ImportMode, summary: ImportSummary): string {
  if (mode === 'replace') return `Restored ${plural(summary.transactions)}.`;
  const updated = summary.transactions - summary.transactionsAdded;
  if (summary.transactionsAdded === 0) {
    return updated === 0
      ? 'The backup had no transactions to add.'
      : 'Nothing new to add: everything in the backup is already here.';
  }
  return updated === 0
    ? `Added ${plural(summary.transactionsAdded)}.`
    : `Added ${plural(summary.transactionsAdded)}. ${updated} already here were updated.`;
}
