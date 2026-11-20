import { db } from '../../db/db.ts';
import type { Transaction, TxType } from '../../db/types.ts';
import { stripUnsafeChars } from '../../lib/text.ts';

/** Fields the user fills in; ids and timestamps are added here. */
export interface TransactionInput {
  type: TxType;
  amountMinor: number;
  categoryId: string;
  walletId: string;
  date: string;
  note: string;
}

/**
 * Re-checks the rules the form already enforces. The form is UX; this is the last
 * line of defence before data is written (e.g. against a bad import later).
 */
async function assertValid(input: TransactionInput): Promise<void> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive whole number of centavos.');
  }
  if (!input.categoryId) throw new Error('Category is required.');
  // Every entry must belong to a real wallet, or wallet balances stop adding up.
  if (!input.walletId || !(await db.wallets.get(input.walletId))) {
    throw new Error('Pick a wallet.');
  }
}

/** Same cleaning as backup import (lib/text.ts). */
const cleanNote = (note: string) => stripUnsafeChars(note).trim();

/**
 * Saves a new transaction and returns its id. The wallet check and the write share one
 * database transaction, so the wallet can't be deleted (e.g. in another tab) in between.
 */
export async function addTransaction(input: TransactionInput, now = Date.now()): Promise<string> {
  const id = crypto.randomUUID();
  await db.transaction('rw', db.wallets, db.transactions, async () => {
    await assertValid(input);
    await db.transactions.add({
      ...input,
      note: cleanNote(input.note),
      id,
      createdAt: now,
      updatedAt: now,
    });
  });
  return id;
}

/** Updates an existing transaction. Throws if it no longer exists. */
export async function updateTransaction(
  id: string,
  input: TransactionInput,
  now = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.wallets, db.transactions, async () => {
    await assertValid(input);
    const changed = await db.transactions.update(id, {
      ...input,
      note: cleanNote(input.note),
      updatedAt: now,
    });
    if (changed === 0) throw new Error('This transaction no longer exists.');
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
