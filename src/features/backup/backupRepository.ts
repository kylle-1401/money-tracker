import { db } from '../../db/db.ts';
import { CASH_WALLET_ID, defaultCategories } from '../../db/seed.ts';
import type { Category, Transaction, Wallet } from '../../db/types.ts';
import { getCurrency, setCurrency } from '../settings/settingsRepository.ts';
import { getMonthlyBudget, setMonthlyBudget } from '../budget/budgetRepository.ts';
import {
  BACKUP_APP_ID,
  BACKUP_VERSION,
  MAX_TRANSACTIONS,
  MAX_WALLETS,
  type Backup,
} from './backupFormat.ts';

const LAST_BACKUP_KEY = 'lastBackupAt';

/** Snapshot of everything on this device, ready to save as a backup file. */
export async function createBackup(now = new Date()): Promise<Backup> {
  const [categories, wallets, transactions, currency, monthlyBudget] = await Promise.all([
    db.categories.toArray(),
    db.wallets.toArray(),
    db.transactions.toArray(),
    getCurrency(),
    getMonthlyBudget(),
  ]);
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    currency,
    ...(monthlyBudget !== null ? { monthlyBudgetMinor: monthlyBudget } : {}),
    categories,
    wallets,
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
 *   devices doesn't create duplicate "Pets" categories. Wallets fold by name the
 *   same way (no duplicate "GCash").
 */
export type ImportMode = 'replace' | 'merge';

/** What an import changed, for the confirmation message. */
export interface ImportSummary {
  /** Transactions written in total. */
  transactions: number;
  /** Of those, how many were new to this device (merge only; equals `transactions` on replace). */
  transactionsAdded: number;
  categoriesAdded: number;
  walletsAdded: number;
}

/** Thrown when a merge would break existing data; the message is shown to the user. */
export class ImportConflictError extends Error {}

/**
 * Writes an already-validated backup (see parseBackup) in one database transaction:
 * if anything fails, nothing changes.
 */
export async function importBackup(backup: Backup, mode: ImportMode): Promise<ImportSummary> {
  const tables = [db.categories, db.wallets, db.transactions, db.settings];
  return db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await db.transactions.clear();
      await db.categories.clear();
      await db.wallets.clear();
      // A backup with no categories would leave the app with nothing to pick, and
      // the seed only runs when the database is first created, so re-seed.
      await db.categories.bulkAdd(
        backup.categories.length > 0 ? backup.categories : defaultCategories,
      );
      // parseBackup guarantees at least one active wallet.
      await db.wallets.bulkAdd(backup.wallets);
      await db.transactions.bulkAdd(backup.transactions);
      await setCurrency(backup.currency);
      // Replace restores the backup's monthly budget (or none); merge keeps this
      // phone's, like the currency.
      await setMonthlyBudget(backup.monthlyBudgetMinor ?? null);
      return {
        transactions: backup.transactions.length,
        transactionsAdded: backup.transactions.length,
        categoriesAdded: backup.categories.length,
        walletsAdded: backup.wallets.length,
      };
    }

    // A v1 file has no real wallets: parseBackup made up a default Cash for it. That
    // stand-in must never overwrite this phone's Cash (its name, starting balance or
    // archived state), so skip it when Cash already exists here.
    const localCash = await db.wallets.get(CASH_WALLET_ID);
    const incomingWallets =
      backup.version < 2 && localCash
        ? backup.wallets.filter((w) => w.id !== CASH_WALLET_ID)
        : backup.wallets;
    const walletMerge = await mergeWallets(incomingWallets);

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

      // Budgets are this phone's settings: merge keeps a local category budget, like the
      // monthly budget and currency (the backup's only fills in when there's none here).
      const merged = withBudget(category, local.budgetMinor ?? category.budgetMinor);
      if (owner !== undefined && owner !== category.id) {
        // Same id, renamed in the backup to a name another category already uses:
        // keep the local name so names stay unique.
        toPut.push({ ...merged, name: local.name });
      } else {
        byName.delete(nameKey(local));
        byName.set(key, category.id);
        toPut.push(merged);
      }
    }

    const transactions: Transaction[] = backup.transactions.map((t) => ({
      ...t,
      categoryId: remap.get(t.categoryId) ?? t.categoryId,
      walletId: walletMerge.remap.get(t.walletId) ?? t.walletId,
      ...(t.toWalletId ? { toWalletId: walletMerge.remap.get(t.toWalletId) ?? t.toWalletId } : {}),
    }));
    // Folding wallets by name can turn "GCash → G-Cash" into a transfer to itself.
    if (transactions.some((t) => t.type === 'transfer' && t.toWalletId === t.walletId)) {
      throw new ImportConflictError(
        'This backup has a transfer between two wallets that match one wallet here, so it can’t be merged. Use “Replace all my data” or choose another backup.',
      );
    }

    await assertWithinCaps(
      walletMerge.total,
      transactions.map((t) => t.id),
    );
    const alreadyHere = await db.transactions.bulkGet(transactions.map((t) => t.id));
    await db.categories.bulkPut(toPut);
    await db.wallets.bulkPut(walletMerge.toPut);
    await db.transactions.bulkPut(transactions);
    // A merge must never leave every wallet archived (the backup may archive the
    // wallets this phone uses): bring back the first one.
    const wallets = await db.wallets.toArray();
    if (!wallets.some((w) => !w.archived)) {
      const first = wallets.sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (first) await db.wallets.update(first.id, { archived: false });
    }
    return {
      transactions: transactions.length,
      transactionsAdded: alreadyHere.filter((t) => t === undefined).length,
      categoriesAdded: toPut.filter((c) => !existingById.has(c.id)).length,
      walletsAdded: walletMerge.added,
    };
  });
}

/**
 * Works out how the backup's wallets fold into this device's: same id → the backup's
 * version wins (unless that would duplicate a name); a new id whose name already
 * exists → its entries move into the existing wallet. New wallets go to the end.
 */
async function mergeWallets(incoming: readonly Wallet[]) {
  const existing = await db.wallets.toArray();
  const existingById = new Map(existing.map((w) => [w.id, w]));
  const byName = new Map(existing.map((w) => [w.name.toLowerCase(), w.id]));
  let nextOrder = Math.max(-1, ...existing.map((w) => w.sortOrder)) + 1;

  const remap = new Map<string, string>();
  const toPut: Wallet[] = [];
  let added = 0;
  for (const wallet of incoming) {
    const key = wallet.name.toLowerCase();
    const owner = byName.get(key);
    const local = existingById.get(wallet.id);

    if (!local) {
      if (owner !== undefined) {
        remap.set(wallet.id, owner);
      } else {
        toPut.push({ ...wallet, sortOrder: nextOrder++ });
        byName.set(key, wallet.id);
        added += 1;
      }
      continue;
    }

    // Keep this phone's order: the backup's sortOrder could collide with local wallets.
    if (owner !== undefined && owner !== wallet.id) {
      toPut.push({ ...wallet, name: local.name, sortOrder: local.sortOrder }); // keep names unique
    } else {
      byName.delete(local.name.toLowerCase());
      byName.set(key, wallet.id);
      toPut.push({ ...wallet, sortOrder: local.sortOrder });
    }
  }
  return { remap, toPut, added, total: existing.length + added };
}

/**
 * The per-file caps in backupFormat also apply to the merged result, so repeated
 * merges can't grow the data past what the list screens are built for.
 */
async function assertWithinCaps(walletTotal: number, incomingTxIds: readonly string[]) {
  const alreadyHere = await db.transactions.bulkGet([...incomingTxIds]);
  const newTx = alreadyHere.filter((t) => t === undefined).length;
  const txTotal = (await db.transactions.count()) + newTx;
  if (walletTotal > MAX_WALLETS || txTotal > MAX_TRANSACTIONS) {
    throw new ImportConflictError(
      'Adding this backup would go over the app’s limit for wallets or transactions. Use “Replace all my data” instead.',
    );
  }
}

/** A copy of the category with this budget, or with no budget field at all. */
function withBudget(category: Category, budgetMinor: number | undefined): Category {
  const copy: Category = { ...category };
  if (budgetMinor === undefined) delete copy.budgetMinor;
  else copy.budgetMinor = budgetMinor;
  return copy;
}

function nameKey(c: Pick<Category, 'type' | 'name'>): string {
  return `${c.type}|${c.name.trim().toLowerCase()}`;
}
