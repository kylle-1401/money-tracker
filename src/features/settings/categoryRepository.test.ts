import { describe, expect, it } from 'vitest';
import { db } from '../../db/db.ts';
import { addTransaction } from '../transactions/transactionRepository.ts';
import {
  addCategory,
  countTransactionsInCategory,
  deleteCategory,
  listCategories,
  setCategoryArchived,
  updateCategory,
} from './categoryRepository.ts';
import { getCurrency, setCurrency } from './settingsRepository.ts';

describe('categoryRepository', () => {
  it('addCategory_Valid_AddsAtEndOfItsTypeWithTrimmedName', async () => {
    const id = await addCategory('expense', { name: '  Pet   food ', emoji: '🐶' });

    const saved = await db.categories.get(id);
    expect(saved).toMatchObject({
      name: 'Pet food',
      emoji: '🐶',
      type: 'expense',
      archived: false,
    });
    const expense = await listCategories('expense');
    expect(expense.at(-1)?.id).toBe(id);
  });

  it.each([
    [{ name: '', emoji: '🐶' }, 'Name is required'],
    [{ name: 'x'.repeat(31), emoji: '🐶' }, 'under 30'],
    [{ name: 'Pets', emoji: ' ' }, 'Pick an icon'],
  ])('addCategory_Invalid_%#_Throws', async (input, message) => {
    await expect(addCategory('expense', input)).rejects.toThrow(message);
  });

  it('addCategory_DuplicateNameSameType_ThrowsCaseInsensitive', async () => {
    await expect(addCategory('expense', { name: 'food', emoji: '🍔' })).rejects.toThrow(
      'already have a category called "food"',
    );
  });

  it('addCategory_SameNameOtherType_IsAllowed', async () => {
    // "Food" exists as an expense category; an income one with that name is fine.
    await expect(addCategory('income', { name: 'Food', emoji: '🍔' })).resolves.toBeTypeOf(
      'string',
    );
  });

  it('updateCategory_Rename_ChangesNameAndKeepsType', async () => {
    await updateCategory('expense-food', { name: 'Food & Drinks', emoji: '🍔' });

    expect(await db.categories.get('expense-food')).toMatchObject({
      name: 'Food & Drinks',
      emoji: '🍔',
      type: 'expense',
    });
  });

  it('updateCategory_KeepOwnName_IsNotADuplicate', async () => {
    await expect(
      updateCategory('expense-food', { name: 'Food', emoji: '🥘' }),
    ).resolves.toBeUndefined();
  });

  it('updateCategory_NameOfAnother_Throws', async () => {
    await expect(
      updateCategory('expense-food', { name: 'Transport', emoji: '🍜' }),
    ).rejects.toThrow('already have');
  });

  it('setCategoryArchived_ArchivesAndRestores', async () => {
    await setCategoryArchived('expense-food', true);
    expect((await db.categories.get('expense-food'))?.archived).toBe(true);
    expect((await listCategories('expense')).at(-1)?.id).toBe('expense-food'); // archived last

    await setCategoryArchived('expense-food', false);
    expect((await db.categories.get('expense-food'))?.archived).toBe(false);
  });

  it('deleteCategory_Unused_Deletes', async () => {
    const id = await addCategory('expense', { name: 'Pets', emoji: '🐶' });

    await deleteCategory(id);

    expect(await db.categories.get(id)).toBeUndefined();
  });

  it('deleteCategory_Used_ThrowsAndKeepsIt', async () => {
    await addTransaction({
      type: 'expense',
      amountMinor: 100,
      categoryId: 'expense-food',
      date: '2026-11-19',
      note: '',
    });

    expect(await countTransactionsInCategory('expense-food')).toBe(1);
    await expect(deleteCategory('expense-food')).rejects.toThrow('Archive it instead');
    expect(await db.categories.get('expense-food')).toBeDefined();
  });
});

describe('settingsRepository', () => {
  it('getCurrency_NothingSaved_DefaultsToPHP', async () => {
    expect(await getCurrency()).toBe('PHP');
  });

  it('setCurrency_Supported_IsSaved', async () => {
    await setCurrency('USD');
    expect(await getCurrency()).toBe('USD');
  });

  it('setCurrency_Unsupported_Throws', async () => {
    await expect(setCurrency('JPY')).rejects.toThrow('Unsupported');
    expect(await getCurrency()).toBe('PHP');
  });
});
