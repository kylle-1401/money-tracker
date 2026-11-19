import { db } from '../../db/db.ts';
import { defaultCategories } from '../../db/seed.ts';
import type { Category, Transaction } from '../../db/types.ts';
import { getCurrency, setCurrency } from '../settings/settingsRepository.ts';
import { BACKUP_APP_ID, BACKUP_VERSION, type Backup } from './backupFormat.ts';

const LAST_BACKUP_KEY = 'lastBackupAt';

/** Snapshot of everything on this device, ready to save as a backup file. */
export async function createBackup(now = new Date()): Promise<Backup> {
  const [categories, transactions, currency] = await Promise.all([
    db.categories.toArray(),
    db.transactions.toArray(),
    getCurrency(),
  ]);
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    currency,
    categories,
    transactions,
  };
}

/** Remembers when the last JSON backup was saved (drives the 30-day reminder). */
export async function recordBackup(now = Date.now()): Promise<void> {
  await db.settings.put({ key: LAST_BACKUP_KEY, value: String(now) });
}

/** When the last JSON backup was saved (epoch ms), or null if never. */
export async function getLastBackupAt(): Promise<number | null> {
  const row = await db.settings.get(LAST_BACKUP_KEY);
  const value = row ? Number(row.value) : NaN;
  return Number.isFinite(value) ? value : null;
}

/**
 * - replace: wipe this device's categories and transactions, then load the backup
 *   (including its currency). For moving to a new phone.
 * - merge: keep what's here and add the backup's entries. Same id = same entry, so
 *   the backup's version wins. A backup category whose name matches an existing
 *   category of the same type is folded into the existing one, so merging two
 *   devices doesn't create duplicate "Pets" categories.
 */
export type ImportMode = 'replace' | 'merge';

/** What an import changed, for the confirmation message. */
export interface ImportSummary {
  /** Transactions written in total. */
  transactions: number;
  /** Of those, how many were new to this device (merge only; equals `transactions` on replace). */
  transactionsAdded: number;
  categoriesAdded: number;
}

/** Thrown when a merge would break existing data; the message is shown to the user. */
export class ImportConflictError extends Error {}

/**
 * Writes an already-validated backup (see parseBackup) in one database transaction:
 * if anything fails, nothing changes.
 */
export async function importBackup(backup: Backup, mode: ImportMode): Promise<ImportSummary> {
  return db.transaction('rw', db.categories, db.transactions, db.settings, async () => {
    if (mode === 'replace') {
      await db.transactions.clear();
      await db.categories.clear();
      // A backup with no categories would leave the app with nothing to pick, and
      // the seed only runs when the database is first created, so re-seed.
      await db.categories.bulkAdd(
        backup.categories.length > 0 ? backup.categories : defaultCategories,
      );
      await db.transactions.bulkAdd(backup.transactions);
      await setCurrency(backup.currency);
      return {
        transactions: backup.transactions.length,
        transactionsAdded: backup.transactions.length,
        categoriesAdded: backup.categories.length,
      };
    }

    const existing = await db.categories.toArray();
    const existingById = new Map(existing.map((c) => [c.id, c]));
    // name key → id of the category that owns that name (updated as we accept rows,
    // so duplicates within the same backup are folded too)
    const byName = new Map(existing.map((c) => [nameKey(c), c.id]));

    const remap = new Map<string, string>();
    const toPut: Category[] = [];
    for (const category of backup.categories) {
      const local = existingById.get(category.id);
      // Business rule: a category's type never changes, because its transactions
      // rely on it. A backup that flips one would corrupt local entries.
      if (local && local.type !== category.type) {
        throw new ImportConflictError(
          'This backup conflicts with your categories (one changed between income and expense), so it can’t be merged. Use “Replace all my data” or choose another backup.',
        );
      }
      const key = nameKey(category);
      const owner = byName.get(key);

      if (!local) {
        if (owner !== undefined) {
          remap.set(category.id, owner); // fold into the category that has this name
        } else {
          toPut.push(category);
          byName.set(key, category.id);
        }
        continue;
      }

      if (owner !== undefined && owner !== category.id) {
        // Same id, renamed in the backup to a name another category already uses:
        // keep the local name so names stay unique.
        toPut.push({ ...category, name: local.name });
      } else {
        byName.delete(nameKey(local));
        byName.set(key, category.id);
        toPut.push(category);
      }
    }

    const transactions: Transaction[] = backup.transactions.map((t) => ({
      ...t,
      categoryId: remap.get(t.categoryId) ?? t.categoryId,
    }));

    const alreadyHere = await db.transactions.bulkGet(transactions.map((t) => t.id));
    await db.categories.bulkPut(toPut);
    await db.transactions.bulkPut(transactions);
    return {
      transactions: transactions.length,
      transactionsAdded: alreadyHere.filter((t) => t === undefined).length,
      categoriesAdded: toPut.filter((c) => !existingById.has(c.id)).length,
    };
  });
}

function nameKey(c: Pick<Category, 'type' | 'name'>): string {
  return `${c.type}|${c.name.trim().toLowerCase()}`;
}
