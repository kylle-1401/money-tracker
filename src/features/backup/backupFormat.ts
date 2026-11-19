import { z } from 'zod';
import type { Category, Transaction } from '../../db/types.ts';
import { isValidDateString } from '../../lib/dates.ts';
import { MAX_AMOUNT_MINOR } from '../../lib/money.ts';
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

/** Bump when the format changes; parseBackup must keep reading older versions. */
export const BACKUP_VERSION = 1;
export const BACKUP_APP_ID = 'money-tracker';

/**
 * Refuse very large files before parsing. A year of heavy use is well under 1 MB, so
 * these caps leave years of headroom while stopping a crafted file from loading
 * enough rows to freeze the list screens.
 */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_TRANSACTIONS = 50_000;
const MAX_CATEGORIES = 500;

/**
 * Control characters and bidi overrides (e.g. U+202E) can visually spoof names and
 * amounts. They are stripped (not rejected) so a backup made by the app itself always
 * restores. ZWJ (U+200D) is kept: emoji sequences need it.
 */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const UNSAFE_CHARS = /[\u0000-\u001F\u007F‪-‮⁦-⁩]/g;
const clean = (s: string) => s.replace(UNSAFE_CHARS, '');

/** Same normalization the app applies when saving a category name. */
const normalizeName = (s: string) => clean(s).trim().replace(/\s+/g, ' ');
const nameKey = (c: { type: string; name: string }) => `${c.type}|${c.name.toLowerCase()}`;

export interface Backup {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  currency: string;
  categories: Category[];
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
});

const transactionSchema = z.object({
  id: idSchema,
  type: typeSchema,
  amountMinor: z.number().int().min(1).max(MAX_AMOUNT_MINOR),
  categoryId: idSchema,
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
    categories: z.array(categorySchema).max(MAX_CATEGORIES),
    transactions: z.array(transactionSchema).max(MAX_TRANSACTIONS),
  })
  .superRefine((backup, ctx) => {
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

  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      error: 'This backup is damaged or was edited, so it can’t be restored safely.',
    };
  }
  return { ok: true, backup: { ...result.data, app: BACKUP_APP_ID } };
}

/** Builds the JSON text for a backup file. */
export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}
