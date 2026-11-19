import { Dexie, type EntityTable } from 'dexie';
import { defaultCategories } from './seed.ts';
import type { Category, Setting, Transaction } from './types.ts';

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

  constructor(name = 'money-tracker') {
    super(name);

    // Only indexed fields are listed; other fields are stored but not indexed.
    this.version(1).stores({
      transactions: 'id, date, categoryId, type',
      categories: 'id, type',
      settings: 'key',
    });

    // Runs once, when the database is first created on this device.
    this.on('populate', (tx) => {
      void tx.table('categories').bulkAdd(defaultCategories);
    });
  }
}

/** The app's single database instance. */
export const db = new MoneyDb();
