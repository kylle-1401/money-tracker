import { describe, expect, it } from 'vitest';
import { importMessage } from './importMessage.ts';

describe('importMessage', () => {
  it.each([
    ['replace', 5, 5, 'Restored 5 transactions.'],
    ['replace', 1, 1, 'Restored 1 transaction.'],
    ['merge', 3, 3, 'Added 3 transactions.'],
    ['merge', 13, 0, 'Nothing new to add: everything in the backup is already here.'],
    ['merge', 0, 0, 'The backup had no transactions to add.'],
    ['merge', 10, 1, 'Added 1 transaction. 9 already here were updated.'],
  ] as const)(
    'importMessage_%s_%i_total_%i_new',
    (mode, transactions, transactionsAdded, expected) => {
      expect(
        importMessage(mode, {
          transactions,
          transactionsAdded,
          categoriesAdded: 0,
          walletsAdded: 0,
        }),
      ).toBe(expected);
    },
  );
});
