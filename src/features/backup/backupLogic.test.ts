import { describe, expect, it } from 'vitest';
import { db } from '../../db/db.ts';
import { defaultCategories } from '../../db/seed.ts';
import type { Category } from '../../db/types.ts';
import { addTransaction } from '../transactions/transactionRepository.ts';
import { addCategory } from '../settings/categoryRepository.ts';
import { getCurrency, setCurrency } from '../settings/settingsRepository.ts';
import { parseBackup, serializeBackup } from './backupFormat.ts';
import {
  createBackup,
  getLastBackupAt,
  ImportConflictError,
  importBackup,
  recordBackup,
} from './backupRepository.ts';
import { csvTextCell, transactionsToCsv } from './csv.ts';
import { needsBackupReminder } from './reminder.ts';
import { first } from '../../test/helpers.ts';

const DAY = 24 * 60 * 60 * 1000;

async function addLunch(note = 'Jollibee') {
  return addTransaction({
    type: 'expense',
    amountMinor: 24550,
    categoryId: 'expense-food',
    date: '2026-11-19',
    note,
  });
}

describe('backup round trip', () => {
  it('ExportThenReplace_OnFreshDevice_RestoresEverything', async () => {
    await addLunch();
    const petsId = await addCategory('expense', { name: 'Pets', emoji: '🐶' });
    await addTransaction({
      type: 'expense',
      amountMinor: 50000,
      categoryId: petsId,
      date: '2026-11-18',
      note: '',
    });
    await setCurrency('USD');
    const text = serializeBackup(await createBackup(new Date('2026-11-19T00:00:00Z')));
    const before = {
      categories: await db.categories.toArray(),
      transactions: await db.transactions.toArray(),
    };

    // "New phone": wipe everything
    await db.delete();
    await db.open();
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const summary = await importBackup(parsed.backup, 'replace');

    expect(summary.transactions).toBe(2);
    expect(await db.categories.toArray()).toEqual(expect.arrayContaining(before.categories));
    expect(await db.categories.count()).toBe(before.categories.length);
    expect(await db.transactions.toArray()).toEqual(expect.arrayContaining(before.transactions));
    expect(await getCurrency()).toBe('USD');
  });

  it('Replace_RemovesEntriesNotInBackup', async () => {
    const backup = await createBackup(); // empty
    await addLunch();

    await importBackup(backup, 'replace');

    expect(await db.transactions.count()).toBe(0);
  });

  it('Merge_KeepsExistingAndAddsNew', async () => {
    const backup = await createBackup();
    backup.transactions.push({
      id: 'from-other-phone',
      type: 'expense',
      amountMinor: 1000,
      categoryId: 'expense-transport',
      date: '2026-11-01',
      note: 'Jeep',
      createdAt: 1,
      updatedAt: 1,
    });
    const localId = await addLunch();

    const summary = await importBackup(backup, 'merge');

    expect(summary.transactions).toBe(1);
    expect(summary.transactionsAdded).toBe(1);
    expect(await db.transactions.get(localId)).toBeDefined();
    expect(await db.transactions.get('from-other-phone')).toBeDefined();
  });

  it('Merge_SameId_BackupVersionWins', async () => {
    const id = await addLunch('old note');
    const backup = await createBackup();
    first(backup.transactions).note = 'from backup';
    await db.transactions.update(id, { note: 'changed here' });

    await importBackup(backup, 'merge');

    expect((await db.transactions.get(id))?.note).toBe('from backup');
  });

  it('Merge_SameNameDifferentIdCategory_FoldsIntoExisting', async () => {
    const localPets = await addCategory('expense', { name: 'Pets', emoji: '🐶' });
    const backup = await createBackup();
    const otherPets: Category = {
      id: 'other-phone-pets',
      name: 'pets',
      type: 'expense',
      emoji: '🐱',
      color: '#000000',
      archived: false,
      sortOrder: 99,
    };
    backup.categories.push(otherPets);
    backup.transactions.push({
      id: 'cat-food',
      type: 'expense',
      amountMinor: 30000,
      categoryId: otherPets.id,
      date: '2026-11-10',
      note: '',
      createdAt: 1,
      updatedAt: 1,
    });

    const summary = await importBackup(backup, 'merge');

    expect(summary.categoriesAdded).toBe(0);
    expect(await db.categories.get(otherPets.id)).toBeUndefined();
    expect((await db.transactions.get('cat-food'))?.categoryId).toBe(localPets);
  });

  it('Merge_CategoryTypeFlipped_RejectsAndChangesNothing', async () => {
    const localId = await addLunch();
    const backup = await createBackup();
    const food = backup.categories.find((c) => c.id === 'expense-food');
    if (!food) throw new Error('seed missing');
    food.type = 'income';
    backup.transactions = [
      {
        id: 'flip',
        type: 'income',
        amountMinor: 1,
        categoryId: 'expense-food',
        date: '2026-11-01',
        note: '',
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    await expect(importBackup(backup, 'merge')).rejects.toThrow(ImportConflictError);

    expect((await db.categories.get('expense-food'))?.type).toBe('expense');
    expect(await db.transactions.get('flip')).toBeUndefined();
    expect(await db.transactions.get(localId)).toBeDefined();
  });

  it('Replace_BackupWithoutCategories_ReseedsDefaults', async () => {
    const backup = await createBackup();
    backup.categories = [];
    backup.transactions = [];

    await importBackup(backup, 'replace');

    expect(await db.categories.count()).toBe(defaultCategories.length);
  });

  it('Merge_DoesNotChangeCurrency', async () => {
    await setCurrency('USD');
    const backup = await createBackup();
    backup.currency = 'EUR';

    await importBackup(backup, 'merge');

    expect(await getCurrency()).toBe('USD');
  });
});

describe('last backup', () => {
  it('getLastBackupAt_Never_IsNull', async () => {
    expect(await getLastBackupAt()).toBeNull();
  });

  it('recordBackup_StoresTime', async () => {
    await recordBackup(123456);
    expect(await getLastBackupAt()).toBe(123456);
  });
});

describe('needsBackupReminder', () => {
  const now = 100 * DAY;

  it('needsBackupReminder_NoData_False', () => {
    expect(needsBackupReminder(now, null, null)).toBe(false);
  });

  it('needsBackupReminder_NeverBackedUp_NewUser_False', () => {
    expect(needsBackupReminder(now, null, now - 5 * DAY)).toBe(false);
  });

  it('needsBackupReminder_NeverBackedUp_DataOlderThan30Days_True', () => {
    expect(needsBackupReminder(now, null, now - 31 * DAY)).toBe(true);
  });

  it('needsBackupReminder_RecentBackup_False', () => {
    expect(needsBackupReminder(now, now - 10 * DAY, now - 90 * DAY)).toBe(false);
  });

  it('needsBackupReminder_BackupOlderThan30Days_True', () => {
    expect(needsBackupReminder(now, now - 31 * DAY, now - 90 * DAY)).toBe(true);
  });
});

describe('CSV', () => {
  const categories = new Map(defaultCategories.map((c) => [c.id, c]));

  it.each([
    ['plain', 'plain'],
    ['has, comma', '"has, comma"'],
    ['say "hi"', '"say ""hi"""'],
    ['line\nbreak', '"line\nbreak"'],
    ['=SUM(A1:A9)', "'=SUM(A1:A9)"],
    ['+63 917', "'+63 917"],
    ['-5 discount', "'-5 discount"],
    ['@home', "'@home"],
  ])('csvTextCell_%j', (input, expected) => {
    expect(csvTextCell(input)).toBe(expected);
  });

  it('transactionsToCsv_OldestFirstExpensesNegativeWithBom', () => {
    const csv = transactionsToCsv(
      [
        {
          id: 'b',
          type: 'expense',
          amountMinor: 24550,
          categoryId: 'expense-food',
          date: '2026-11-19',
          note: 'Jollibee, Makati',
          createdAt: 2,
          updatedAt: 2,
        },
        {
          id: 'a',
          type: 'income',
          amountMinor: 2500000,
          categoryId: 'income-salary',
          date: '2026-11-01',
          note: '',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      categories,
      'PHP',
    );

    expect(csv).toBe(
      '﻿Date,Type,Category,Amount,Currency,Note\r\n' +
        '2026-11-01,Income,Salary,25000.00,PHP,\r\n' +
        '2026-11-19,Expense,Food,-245.50,PHP,"Jollibee, Makati"\r\n',
    );
  });
});
