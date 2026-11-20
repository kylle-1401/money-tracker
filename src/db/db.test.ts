import { afterEach, describe, expect, it } from 'vitest';
import { Dexie } from 'dexie';
import { MoneyDb } from './db.ts';
import { CASH_WALLET_ID, defaultCategories } from './seed.ts';

const NAME = 'upgrade-test';

afterEach(async () => {
  await Dexie.delete(NAME);
});

/** Creates a database exactly as the v1 app (slices 0–6) left it on a phone. */
async function createV1Database() {
  const v1 = new Dexie(NAME);
  v1.version(1).stores({
    transactions: 'id, date, categoryId, type',
    categories: 'id, type',
    settings: 'key',
  });
  await v1.open();
  await v1.table('categories').bulkAdd(defaultCategories);
  await v1.table('transactions').bulkAdd([
    {
      id: 'a',
      type: 'expense',
      amountMinor: 24550,
      categoryId: 'expense-food',
      date: '2026-11-18',
      note: 'Lunch',
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'b',
      type: 'income',
      amountMinor: 2500000,
      categoryId: 'income-salary',
      date: '2026-11-15',
      note: '',
      createdAt: 2,
      updatedAt: 2,
    },
  ]);
  await v1.table('settings').put({ key: 'currency', value: 'USD' });
  v1.close();
}

describe('database upgrade v1 → v2', () => {
  it('Upgrade_ExistingData_MovesEveryEntryIntoCashAndKeepsEverythingElse', async () => {
    await createV1Database();

    const upgraded = new MoneyDb(NAME);
    await upgraded.open();

    expect(upgraded.verno).toBe(3); // v1 → v2 → v3 in one open
    const wallets = await upgraded.wallets.toArray();
    expect(wallets).toEqual([
      expect.objectContaining({ id: CASH_WALLET_ID, name: 'Cash', startingBalanceMinor: 0 }),
    ]);
    const transactions = await upgraded.transactions.orderBy('id').toArray();
    expect(transactions.map((t) => [t.id, t.walletId, t.amountMinor, t.note])).toEqual([
      ['a', CASH_WALLET_ID, 24550, 'Lunch'],
      ['b', CASH_WALLET_ID, 2500000, ''],
    ]);
    // The new index works on migrated rows.
    expect(await upgraded.transactions.where('walletId').equals(CASH_WALLET_ID).count()).toBe(2);
    // Untouched tables survive.
    expect(await upgraded.categories.count()).toBe(defaultCategories.length);
    expect(await upgraded.settings.get('currency')).toEqual({ key: 'currency', value: 'USD' });
    upgraded.close();
  });

  it('Upgrade_EmptyV1Database_StillCreatesCash', async () => {
    const v1 = new Dexie(NAME);
    v1.version(1).stores({ transactions: 'id', categories: 'id, type', settings: 'key' });
    await v1.open();
    v1.close();

    const upgraded = new MoneyDb(NAME);
    await upgraded.open();
    expect((await upgraded.wallets.toArray()).map((w) => w.id)).toEqual([CASH_WALLET_ID]);
    upgraded.close();
  });

  it('Upgrade_V2Database_AddsTransferIndexAndKeepsData', async () => {
    // A phone that installed slice 7 (schema v2).
    const v2 = new Dexie(NAME);
    v2.version(1).stores({
      transactions: 'id, date, categoryId, type',
      categories: 'id, type',
      settings: 'key',
    });
    v2.version(2).stores({
      transactions: 'id, date, categoryId, type, walletId',
      wallets: 'id, sortOrder',
    });
    await v2.open();
    await v2.table('wallets').add({ id: CASH_WALLET_ID, name: 'Cash' });
    await v2.table('transactions').add({ id: 'x', walletId: CASH_WALLET_ID, date: '2026-11-20' });
    v2.close();

    const upgraded = new MoneyDb(NAME);
    await upgraded.open();
    expect(upgraded.verno).toBe(3);
    expect(await upgraded.transactions.get('x')).toMatchObject({ walletId: CASH_WALLET_ID });
    expect(await upgraded.transactions.where('toWalletId').equals(CASH_WALLET_ID).count()).toBe(0);
    upgraded.close();
  });

  it('NewInstall_SeedsCashOnce', async () => {
    const fresh = new MoneyDb(NAME);
    await fresh.open();
    expect((await fresh.wallets.toArray()).map((w) => w.name)).toEqual(['Cash']);
    expect(await fresh.categories.count()).toBe(defaultCategories.length);
    fresh.close();
  });
});
