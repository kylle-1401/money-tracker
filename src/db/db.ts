import { Dexie, type EntityTable } from 'dexie';
import { CASH_WALLET_ID, defaultCategories, defaultWallet } from './seed.ts';
import type { Category, Setting, Transaction, Wallet } from './types.ts';

/**
 * On-device database (IndexedDB via Dexie). Nothing here ever leaves the device.
 *
 * Schema changes: never edit an existing version. Add `this.version(n + 1)` with an
 * `.upgrade()` that migrates old rows, so users keep their data.
 */
export class MoneyDb extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  wallets!: EntityTable<Wallet, 'id'>;

  constructor(name = 'money-tracker') {
    super(name);

    // Only indexed fields are listed; other fields are stored but not indexed.
    this.version(1).stores({
      transactions: 'id, date, categoryId, type',
      categories: 'id, type',
      settings: 'key',
    });

    // v2 (slice 7): wallets. Every transaction now belongs to a wallet.
    this.version(2)
      .stores({
        transactions: 'id, date, categoryId, type, walletId',
        wallets: 'id, sortOrder',
      })
      .upgrade(async (tx) => {
        // Runs once on devices that already have v1 data, inside one IndexedDB
        // transaction: if anything fails, the database stays at v1 untouched.
        await tx.table('wallets').add(defaultWallet);
        await tx
          .table<Transaction>('transactions')
          .toCollection()
          .modify((t) => {
            t.walletId = CASH_WALLET_ID;
          });
      });

    // Runs once, when the database is first created on this device (new installs
    // skip the upgrade above, so they need the default wallet here too).
    this.on('populate', (tx) => {
      void tx.table('categories').bulkAdd(defaultCategories);
      void tx.table('wallets').add(defaultWallet);
    });
  }
}

/** The app's single database instance. */
export const db = new MoneyDb();
