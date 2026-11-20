import { describe, expect, it } from 'vitest';
import { db } from '../../db/db.ts';
import { defaultCategories } from '../../db/seed.ts';
import {
  addTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
  type TransactionInput,
} from './transactionRepository.ts';

const lunch: TransactionInput = {
  type: 'expense',
  amountMinor: 24500,
  categoryId: 'expense-food',
  walletId: 'wallet-cash',
  date: '2026-11-19',
  note: ' Jollibee ',
};

describe('database', () => {
  it('Db_FirstOpen_SeedsDefaultCategories', async () => {
    const categories = await db.categories.toArray();

    expect(categories).toHaveLength(defaultCategories.length);
    expect(categories.map((c) => c.id)).toContain('expense-food');
    expect(categories.map((c) => c.id)).toContain('income-salary');
  });
});

describe('transactionRepository', () => {
  it('addTransaction_ValidInput_SavesWithIdTimestampsAndTrimmedNote', async () => {
    const id = await addTransaction(lunch, 1000);

    const saved = await db.transactions.get(id);
    expect(saved).toEqual({ ...lunch, note: 'Jollibee', id, createdAt: 1000, updatedAt: 1000 });
  });

  it.each([0, -100, 12.5, Number.NaN])(
    'addTransaction_InvalidAmount_%s_ThrowsAndSavesNothing',
    async (amountMinor) => {
      await expect(addTransaction({ ...lunch, amountMinor })).rejects.toThrow();
      expect(await db.transactions.count()).toBe(0);
    },
  );

  it('addTransaction_NoCategory_Throws', async () => {
    await expect(addTransaction({ ...lunch, categoryId: '' })).rejects.toThrow('Category');
  });

  it('updateTransaction_Existing_ChangesFieldsAndKeepsCreatedAt', async () => {
    const id = await addTransaction(lunch, 1000);

    await updateTransaction(id, { ...lunch, amountMinor: 30000, note: 'Mang Inasal' }, 2000);

    const saved = await db.transactions.get(id);
    expect(saved?.amountMinor).toBe(30000);
    expect(saved?.note).toBe('Mang Inasal');
    expect(saved?.createdAt).toBe(1000);
    expect(saved?.updatedAt).toBe(2000);
  });

  it('updateTransaction_Missing_Throws', async () => {
    await expect(updateTransaction('nope', lunch)).rejects.toThrow('no longer exists');
  });

  it('deleteTransaction_Existing_RemovesIt', async () => {
    const id = await addTransaction(lunch);

    await deleteTransaction(id);

    expect(await db.transactions.get(id)).toBeUndefined();
  });

  it('listTransactions_Mixed_NewestDateFirstThenLatestEntryWithinDay', async () => {
    const older = await addTransaction({ ...lunch, date: '2026-11-01' }, 5000);
    const todayFirst = await addTransaction(lunch, 1000);
    const todaySecond = await addTransaction(lunch, 2000);

    const ids = (await listTransactions()).map((t) => t.id);

    expect(ids).toEqual([todaySecond, todayFirst, older]);
  });
});
