import { db } from '../../db/db.ts';
import type { Transaction, TxType } from '../../db/types.ts';
import { isValidDateString } from '../../lib/dates.ts';
import { MAX_AMOUNT_MINOR } from '../../lib/money.ts';
import { stripUnsafeChars } from '../../lib/text.ts';

/** Fields the user fills in; ids and timestamps are added here. */
export interface TransactionInput {
  type: TxType;
  amountMinor: number;
  /** '' for transfers. */
  categoryId: string;
  /** For a transfer: the wallet the money leaves. */
  walletId: string;
  /** Transfers only. */
  toWalletId?: string;
  /** Transfers only; 0 or omitted = no fee. */
  feeMinor?: number;
  date: string;
  note: string;
}

const MAX_NOTE = 200;

const isAmount = (n: number) => Number.isSafeInteger(n) && n > 0 && n <= MAX_AMOUNT_MINOR;

/**
 * Re-checks the rules the form already enforces. The form is UX; this is the last
 * line of defence before data is written (e.g. against a bad import later).
 */
async function assertValid(input: TransactionInput): Promise<void> {
  if (!isAmount(input.amountMinor)) {
    throw new Error('Amount must be a positive whole number of centavos.');
  }
  // Every entry must belong to a real wallet, or wallet balances stop adding up.
  if (!input.walletId || !(await db.wallets.get(input.walletId))) {
    throw new Error('Pick a wallet.');
  }
  if (input.type === 'transfer') {
    // Business rules: a transfer has no category, goes to a different real wallet,
    // and its fee (if any) is a whole number of centavos ≥ 0.
    if (input.categoryId) throw new Error('Transfers don’t have a category.');
    if (!input.toWalletId || !(await db.wallets.get(input.toWalletId))) {
      throw new Error('Pick the wallet to move the money to.');
    }
    if (input.toWalletId === input.walletId) {
      throw new Error('Pick two different wallets.');
    }
    const fee = input.feeMinor ?? 0;
    if (fee !== 0 && !isAmount(fee)) throw new Error('Enter a fee up to 2 decimals.');
  } else {
    // The category must exist and be of the same type (backup import checks the same,
    // so the app can never save something its own backup would refuse to restore).
    const category = input.categoryId ? await db.categories.get(input.categoryId) : undefined;
    if (!category) throw new Error('Category is required.');
    if (category.type !== input.type) throw new Error('That category is for a different type.');
    if (input.toWalletId !== undefined || input.feeMinor !== undefined) {
      throw new Error('Only transfers have a second wallet or a fee.');
    }
  }
  if (!isValidDateString(input.date)) throw new Error('Pick a valid date.');
  if (cleanNote(input.note).length > MAX_NOTE) {
    throw new Error(`Keep the note under ${MAX_NOTE} characters.`);
  }
}

/** Same cleaning as backup import (lib/text.ts). */
const cleanNote = (note: string) => stripUnsafeChars(note).trim();

/**
 * The stored fields for an input. Transfer-only fields are left out entirely for
 * income/expenses (and a zero fee is not stored), so switching an entry's type never
 * leaves a stale second wallet behind.
 */
function toRecord(input: TransactionInput) {
  const base = {
    type: input.type,
    amountMinor: input.amountMinor,
    categoryId: input.type === 'transfer' ? '' : input.categoryId,
    walletId: input.walletId,
    date: input.date,
    note: cleanNote(input.note),
  };
  if (input.type !== 'transfer') return base;
  const fee = input.feeMinor ?? 0;
  return { ...base, toWalletId: input.toWalletId, ...(fee > 0 ? { feeMinor: fee } : {}) };
}

/**
 * Saves a new transaction and returns its id. The wallet checks and the write share one
 * database transaction, so a wallet can't be deleted (e.g. in another tab) in between.
 */
export async function addTransaction(input: TransactionInput, now = Date.now()): Promise<string> {
  const id = crypto.randomUUID();
  await db.transaction('rw', db.wallets, db.categories, db.transactions, async () => {
    await assertValid(input);
    await db.transactions.add({ ...toRecord(input), id, createdAt: now, updatedAt: now });
  });
  return id;
}

/** Updates an existing transaction. Throws if it no longer exists. */
export async function updateTransaction(
  id: string,
  input: TransactionInput,
  now = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.wallets, db.categories, db.transactions, async () => {
    await assertValid(input);
    const existing = await db.transactions.get(id);
    if (!existing) throw new Error('This transaction no longer exists.');
    // put (not update) replaces the whole record, dropping transfer-only fields when
    // a transfer is changed into an expense or income.
    await db.transactions.put({
      ...toRecord(input),
      id,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
  });
}

/** Permanently deletes a transaction. */
export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id);
}

/**
 * All transactions, newest first: by date, then by entry time within the same day.
 */
export async function listTransactions(): Promise<Transaction[]> {
  const rows = await db.transactions.toArray();
  return rows.sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  );
}
