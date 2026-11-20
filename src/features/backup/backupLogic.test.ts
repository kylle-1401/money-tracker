import { describe, expect, it } from 'vitest';
import { db } from '../../db/db.ts';
import { CASH_WALLET_ID, defaultCategories, defaultWallet } from '../../db/seed.ts';
import type { Category, Wallet } from '../../db/types.ts';
import { addWallet, setWalletArchived } from '../wallets/walletRepository.ts';
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
    walletId: 'wallet-cash',
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
      walletId: 'wallet-cash',
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
      walletId: 'wallet-cash',
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
      walletId: 'wallet-cash',
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
        walletId: 'wallet-cash',
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

describe('backup wallets (v2)', () => {
  const otherGcash: Wallet = {
    id: 'other-phone-gcash',
    name: 'gcash',
    emoji: '📲',
    color: 'purple',
    startingBalanceMinor: 1_000,
    archived: false,
    sortOrder: 0,
  };

  it('Replace_RestoresWalletsAndTheirEntries', async () => {
    const gcash = await addWallet({
      name: 'GCash',
      emoji: '📱',
      color: 'blue',
      startingBalanceMinor: -5_000,
    });
    await addTransaction({
      type: 'expense',
      amountMinor: 100,
      categoryId: 'expense-food',
      walletId: gcash,
      date: '2026-11-20',
      note: '',
    });
    const text = serializeBackup(await createBackup());

    await db.delete();
    await db.open();
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const summary = await importBackup(parsed.backup, 'replace');

    expect(summary.walletsAdded).toBe(2);
    expect((await db.wallets.get(gcash))?.startingBalanceMinor).toBe(-5_000);
    expect(await db.transactions.where('walletId').equals(gcash).count()).toBe(1);
  });

  it('Merge_SameNameDifferentIdWallet_FoldsIntoExisting', async () => {
    const localGcash = await addWallet({
      name: 'GCash',
      emoji: '📱',
      color: 'blue',
      startingBalanceMinor: 0,
    });
    const backup = await createBackup();
    backup.wallets.push(otherGcash);
    backup.transactions.push({
      id: 'from-other',
      type: 'expense',
      amountMinor: 500,
      categoryId: 'expense-food',
      walletId: otherGcash.id,
      date: '2026-11-10',
      note: '',
      createdAt: 1,
      updatedAt: 1,
    });

    const summary = await importBackup(backup, 'merge');

    expect(summary.walletsAdded).toBe(0);
    expect(await db.wallets.get(otherGcash.id)).toBeUndefined();
    expect((await db.transactions.get('from-other'))?.walletId).toBe(localGcash);
  });

  it('Merge_NewWallet_AddedAtTheEnd', async () => {
    const backup = await createBackup();
    backup.wallets.push({ ...otherGcash, name: 'Maya', sortOrder: 0 });

    const summary = await importBackup(backup, 'merge');

    expect(summary.walletsAdded).toBe(1);
    expect(await db.wallets.get(otherGcash.id)).toMatchObject({ name: 'Maya', sortOrder: 1 });
  });

  it('Merge_BackupArchivesEveryWallet_KeepsOneActive', async () => {
    // This phone only has Cash; the backup's copy of Cash is archived (same id, so
    // the backup's version wins), which would leave no active wallet.
    const backup = await createBackup();
    backup.wallets = backup.wallets.map((w) => ({ ...w, archived: true }));

    await importBackup(backup, 'merge');

    expect((await db.wallets.get(CASH_WALLET_ID))?.archived).toBe(false);
  });

  /** A v1 file (slices 4–6) as parseBackup reads it: a made-up Cash, entries in it. */
  async function v1Backup() {
    const backup = await createBackup();
    const text = JSON.parse(serializeBackup(backup)) as Record<string, unknown>;
    text.version = 1;
    delete text.wallets;
    text.transactions = [
      {
        id: 'old-entry',
        type: 'expense',
        amountMinor: 700,
        categoryId: 'expense-food',
        date: '2026-10-01',
        note: '',
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const parsed = parseBackup(JSON.stringify(text));
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.backup;
  }

  it('Merge_V1Backup_LeavesEditedLocalCashAlone', async () => {
    await addWallet({ name: 'GCash', emoji: '📱', color: 'blue', startingBalanceMinor: 0 });
    await db.wallets.update(CASH_WALLET_ID, {
      name: 'Wallet',
      startingBalanceMinor: 500_000,
      archived: true,
      sortOrder: 5,
    });
    const before = await db.wallets.get(CASH_WALLET_ID);

    await importBackup(await v1Backup(), 'merge');

    expect(await db.wallets.get(CASH_WALLET_ID)).toEqual(before);
    expect((await db.transactions.get('old-entry'))?.walletId).toBe(CASH_WALLET_ID);
  });

  it('Merge_V1Backup_CashDeletedHere_BringsCashBack', async () => {
    await addWallet({ name: 'GCash', emoji: '📱', color: 'blue', startingBalanceMinor: 0 });
    await db.wallets.delete(CASH_WALLET_ID);

    await importBackup(await v1Backup(), 'merge');

    expect((await db.wallets.get(CASH_WALLET_ID))?.name).toBe('Cash');
    expect((await db.transactions.get('old-entry'))?.walletId).toBe(CASH_WALLET_ID);
  });

  it('Merge_SameIdWallet_KeepsThisPhonesOrder', async () => {
    const id = await addWallet({
      name: 'BDO',
      emoji: '🏦',
      color: 'blue',
      startingBalanceMinor: 0,
    });
    const backup = await createBackup();
    const bdo = backup.wallets.find((w) => w.id === id);
    if (!bdo) throw new Error('missing');
    bdo.sortOrder = 0; // collides with Cash here

    await importBackup(backup, 'merge');

    expect((await db.wallets.get(id))?.sortOrder).toBe(1);
  });

  it('Merge_WouldExceedWalletCap_RejectsAndChangesNothing', async () => {
    await db.wallets.bulkAdd(
      Array.from({ length: 99 }, (_, i) => ({ ...otherGcash, id: `w${i}`, name: `W${i}` })),
    ); // 100 with Cash
    const backup = await createBackup();
    backup.wallets.push({ ...otherGcash, id: 'one-more', name: 'One more' });

    await expect(importBackup(backup, 'merge')).rejects.toThrow(ImportConflictError);
    expect(await db.wallets.get('one-more')).toBeUndefined();
  });

  it('Merge_LocalWalletArchivedHere_StaysAsBackupSays', async () => {
    const id = await addWallet({
      name: 'BDO',
      emoji: '🏦',
      color: 'blue',
      startingBalanceMinor: 0,
    });
    const backup = await createBackup(); // BDO active in the backup
    await setWalletArchived(id, true);

    await importBackup(backup, 'merge');

    expect((await db.wallets.get(id))?.archived).toBe(false); // backup version wins
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
    ['x;=HYPERLINK("http://a","b")', '"x;=HYPERLINK(""http://a"",""b"")"'],
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
          walletId: 'wallet-cash',
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
          walletId: 'wallet-cash',
          date: '2026-11-01',
          note: '',
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'c',
          type: 'transfer',
          amountMinor: 100000,
          categoryId: '',
          walletId: 'wallet-cash',
          toWalletId: 'w-bdo',
          feeMinor: 1500,
          date: '2026-11-20',
          note: 'Rent fund',
          createdAt: 3,
          updatedAt: 3,
        },
      ],
      categories,
      new Map([
        [defaultWallet.id, defaultWallet],
        ['w-bdo', { ...defaultWallet, id: 'w-bdo', name: 'BDO' }],
      ]),
      'PHP',
    );

    expect(csv).toBe(
      '﻿Date,Type,Wallet,To wallet,Category,Amount,Fee,Currency,Note\r\n' +
        '2026-11-01,Income,Cash,,Salary,25000.00,,PHP,\r\n' +
        '2026-11-19,Expense,Cash,,Food,-245.50,,PHP,"Jollibee, Makati"\r\n' +
        '2026-11-20,Transfer,Cash,BDO,,1000.00,15.00,PHP,Rent fund\r\n',
    );
  });
});

describe('backup transfers (v3)', () => {
  async function withTransfer() {
    const bdo = await addWallet({
      name: 'BDO',
      emoji: '🏦',
      color: 'blue',
      startingBalanceMinor: 0,
    });
    await addTransaction({
      type: 'transfer',
      amountMinor: 100_000,
      categoryId: '',
      walletId: CASH_WALLET_ID,
      toWalletId: bdo,
      feeMinor: 1_500,
      date: '2026-11-20',
      note: '',
    });
    return bdo;
  }

  it('ExportThenReplace_RestoresTransfer', async () => {
    const bdo = await withTransfer();
    const text = serializeBackup(await createBackup());
    await db.delete();
    await db.open();

    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    await importBackup(parsed.backup, 'replace');

    const [restored] = await db.transactions.toArray();
    expect(restored).toMatchObject({ type: 'transfer', toWalletId: bdo, feeMinor: 1_500 });
  });

  it('Merge_TransferIntoFoldedWallet_RemapsDestination', async () => {
    const localBdo = await addWallet({
      name: 'BDO',
      emoji: '🏦',
      color: 'blue',
      startingBalanceMinor: 0,
    });
    const backup = await createBackup();
    backup.wallets.push({ ...defaultWallet, id: 'other-bdo', name: 'bdo', sortOrder: 9 });
    backup.transactions.push({
      id: 'tr',
      type: 'transfer',
      amountMinor: 500,
      categoryId: '',
      walletId: CASH_WALLET_ID,
      toWalletId: 'other-bdo',
      date: '2026-11-20',
      note: '',
      createdAt: 1,
      updatedAt: 1,
    });

    await importBackup(backup, 'merge');

    expect((await db.transactions.get('tr'))?.toWalletId).toBe(localBdo);
  });

  it('Merge_FoldingMakesTransferToItself_RejectsAndChangesNothing', async () => {
    // Here "Cash" exists; the backup has a transfer from Cash to its own "cash" wallet
    // with another id, which folds into this Cash.
    const backup = await createBackup();
    backup.wallets.push({ ...defaultWallet, id: 'other-cash', name: 'CASH', sortOrder: 9 });
    backup.transactions.push({
      id: 'loop',
      type: 'transfer',
      amountMinor: 500,
      categoryId: '',
      walletId: CASH_WALLET_ID,
      toWalletId: 'other-cash',
      date: '2026-11-20',
      note: '',
      createdAt: 1,
      updatedAt: 1,
    });

    await expect(importBackup(backup, 'merge')).rejects.toThrow(ImportConflictError);
    expect(await db.transactions.get('loop')).toBeUndefined();
  });
});
