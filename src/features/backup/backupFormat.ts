import { z } from 'zod';
import { CASH_WALLET_ID, defaultWallet } from '../../db/seed.ts';
import { WALLET_COLORS, type Category, type Transaction, type Wallet } from '../../db/types.ts';
import { isValidDateString } from '../../lib/dates.ts';
import { MAX_AMOUNT_MINOR } from '../../lib/money.ts';
import { normalizeName, stripUnsafeChars } from '../../lib/text.ts';
import { DEFAULT_CURRENCY, isSupportedCurrency } from '../settings/currencies.ts';

/*
 * Backup file format (JSON). A backup is the user's whole dataset, so it can fully
 * restore the app on a new phone.
 *
 * Security: an imported file is untrusted input (it may be edited, corrupted or not
 * ours at all). Everything is validated with the schema below before anything is
 * written: types, lengths, ranges, counts, and that every transaction points to a
 * category of the same type inside the same file.
 */

/**
 * Bump when the format changes; parseBackup must keep reading older versions.
 * - v1 (slices 4–6): categories + transactions
 * - v2 (slice 7): adds wallets; every transaction has a walletId. v1 files are
 *   upgraded on read: their entries go into "Cash", like the database upgrade.
 * - v3 (slice 8): transactions may be transfers (type "transfer", no category,
 *   toWalletId, optional feeMinor). Bumped so a slice-7 app refuses these files with
 *   "made by a newer version" instead of calling them damaged.
 * - v4 (slice 9): optional monthlyBudgetMinor, and optional budgetMinor on expense
 *   categories. Bumped so an older app refuses the file instead of silently
 *   dropping the budgets.
 */
export const BACKUP_VERSION = 4;
export const BACKUP_APP_ID = 'money-tracker';

/**
 * Refuse very large files before parsing. A year of heavy use is well under 1 MB, so
 * these caps leave years of headroom while stopping a crafted file from loading
 * enough rows to freeze the list screens.
 */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_TRANSACTIONS = 50_000;
const MAX_CATEGORIES = 500;
export const MAX_WALLETS = 100;

// Same cleaning the app applies when saving (see lib/text.ts): stripped, not rejected,
// so a backup made by the app itself always restores.
const clean = stripUnsafeChars;
const nameKey = (c: { type: string; name: string }) => `${c.type}|${c.name.toLowerCase()}`;

export interface Backup {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  currency: string;
  /** Overall monthly budget (v4); absent = none. */
  monthlyBudgetMinor?: number;
  categories: Category[];
  wallets: Wallet[];
  transactions: Transaction[];
}

// Ids end up in URLs (#/transactions/<id>), so only URL-safe characters are allowed.
// Matches crypto.randomUUID() ids and the seed ids ("expense-food").
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const typeSchema = z.enum(['income', 'expense']);

const categorySchema = z.object({
  id: idSchema,
  name: z.string().transform(normalizeName).pipe(z.string().min(1).max(30)),
  type: typeSchema,
  emoji: z
    .string()
    .transform((s) => clean(s).trim())
    .pipe(z.string().min(1).max(16)),
  color: z.string().max(20).catch('#64748b'),
  archived: z.boolean(),
  sortOrder: z.number().int().min(0).max(100_000),
  budgetMinor: z.number().int().min(1).max(MAX_AMOUNT_MINOR).optional(),
});

const walletSchema = z.object({
  id: idSchema,
  name: z.string().transform(normalizeName).pipe(z.string().min(1).max(30)),
  emoji: z
    .string()
    .transform((s) => clean(s).trim())
    .pipe(z.string().min(1).max(16)),
  color: z.enum(WALLET_COLORS).catch('gray'),
  startingBalanceMinor: z.number().int().min(-MAX_AMOUNT_MINOR).max(MAX_AMOUNT_MINOR),
  archived: z.boolean(),
  sortOrder: z.number().int().min(0).max(100_000),
});

const transactionSchema = z.object({
  id: idSchema,
  type: z.enum(['income', 'expense', 'transfer']),
  amountMinor: z.number().int().min(1).max(MAX_AMOUNT_MINOR),
  // '' only for transfers (checked below)
  categoryId: z.union([idSchema, z.literal('')]),
  walletId: idSchema,
  toWalletId: idSchema.optional(),
  feeMinor: z.number().int().min(0).max(MAX_AMOUNT_MINOR).optional(),
  date: z.string().refine(isValidDateString, 'Invalid date'),
  note: z.string().transform(clean).pipe(z.string().max(200)),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const backupSchema = z
  .object({
    app: z.literal(BACKUP_APP_ID),
    version: z.number().int().min(1),
    exportedAt: z.string().max(40),
    currency: z.string().refine(isSupportedCurrency).catch(DEFAULT_CURRENCY),
    monthlyBudgetMinor: z.number().int().min(1).max(MAX_AMOUNT_MINOR).optional(),
    categories: z.array(categorySchema).max(MAX_CATEGORIES),
    wallets: z.array(walletSchema).min(1).max(MAX_WALLETS),
    transactions: z.array(transactionSchema).max(MAX_TRANSACTIONS),
  })
  .superRefine((backup, ctx) => {
    const walletIds = new Set(backup.wallets.map((w) => w.id));
    if (walletIds.size !== backup.wallets.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate wallet ids' });
    }
    // Business rule: wallet names are unique (case-insensitive).
    if (new Set(backup.wallets.map((w) => w.name.toLowerCase())).size !== backup.wallets.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate wallet names' });
    }
    if (!backup.wallets.some((w) => !w.archived)) {
      ctx.addIssue({ code: 'custom', message: 'No active wallet' });
    }
    if (backup.transactions.some((t) => !walletIds.has(t.walletId))) {
      ctx.addIssue({ code: 'custom', message: 'A transaction uses a missing wallet' });
    }
    // Same rule as setCategoryBudget: only expense categories have a budget.
    if (backup.categories.some((c) => c.budgetMinor !== undefined && c.type !== 'expense')) {
      ctx.addIssue({ code: 'custom', message: 'An income category has a budget' });
    }
    const categoryTypes = new Map(backup.categories.map((c) => [c.id, c.type]));
    if (categoryTypes.size !== backup.categories.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate category ids' });
    }
    // Business rule: category names are unique per type (case-insensitive).
    if (new Set(backup.categories.map(nameKey)).size !== backup.categories.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate category names' });
    }
    const txIds = new Set<string>();
    for (const t of backup.transactions) {
      if (txIds.has(t.id)) {
        ctx.addIssue({ code: 'custom', message: 'Duplicate transaction ids' });
        return;
      }
      txIds.add(t.id);
      if (t.type === 'transfer') {
        // Same rules as transactionRepository: no category, a different real wallet.
        if (t.categoryId !== '') {
          ctx.addIssue({ code: 'custom', message: 'A transfer has a category' });
          return;
        }
        if (!t.toWalletId || !walletIds.has(t.toWalletId) || t.toWalletId === t.walletId) {
          ctx.addIssue({ code: 'custom', message: 'A transfer has a bad destination wallet' });
          return;
        }
        continue;
      }
      if (t.toWalletId !== undefined || t.feeMinor !== undefined) {
        ctx.addIssue({ code: 'custom', message: 'Only transfers have a second wallet or a fee' });
        return;
      }
      const categoryType = categoryTypes.get(t.categoryId);
      if (categoryType === undefined) {
        ctx.addIssue({ code: 'custom', message: 'A transaction uses a missing category' });
        return;
      }
      if (categoryType !== t.type) {
        ctx.addIssue({ code: 'custom', message: 'A transaction type does not match its category' });
        return;
      }
    }
  });

/** Result of reading a backup file: the data, or a message the user can understand. */
export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

/**
 * Parses and validates the text of a backup file. Never throws.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file isn’t a Money Tracker backup (it isn’t valid JSON).' };
  }

  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== BACKUP_APP_ID) {
    return { ok: false, error: 'This file isn’t a Money Tracker backup.' };
  }
  const version = (raw as { version?: unknown }).version;
  if (typeof version === 'number' && version > BACKUP_VERSION) {
    return {
      ok: false,
      error: 'This backup was made by a newer version of the app. Update the app and try again.',
    };
  }

  const result = backupSchema.safeParse(upgradeV1(raw as Record<string, unknown>));
  if (!result.success) {
    return {
      ok: false,
      error: 'This backup is damaged or was edited, so it can’t be restored safely.',
    };
  }
  // A zero fee is stored as "no fee", the same as the app does.
  const transactions = result.data.transactions.map(({ feeMinor, ...t }) =>
    feeMinor ? { ...t, feeMinor } : t,
  );
  return { ok: true, backup: { ...result.data, transactions, app: BACKUP_APP_ID } };
}

/**
 * Brings a v1 file up to the v2 shape before validation: adds the default Cash
 * wallet and puts every entry in it (same rule as the database upgrade). Other
 * versions pass through untouched; the schema still validates everything.
 */
function upgradeV1(raw: Record<string, unknown>): unknown {
  if (raw.version !== 1) return raw;
  const transactions = Array.isArray(raw.transactions)
    ? raw.transactions.map((t: unknown) =>
        typeof t === 'object' && t !== null ? { ...t, walletId: CASH_WALLET_ID } : t,
      )
    : raw.transactions;
  return { ...raw, wallets: [defaultWallet], transactions };
}

/** Builds the JSON text for a backup file. */
export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}
