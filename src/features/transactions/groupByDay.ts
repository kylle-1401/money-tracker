import type { Transaction } from '../../db/types.ts';

/** Transactions that share one calendar date. */
export interface DayGroup {
  date: string;
  items: Transaction[];
  /** Income minus expenses for the day, in minor units. */
  netMinor: number;
}

/**
 * Groups an already newest-first list into one group per date, keeping order.
 */
export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const tx of transactions) {
    let group = groups.at(-1);
    if (!group || group.date !== tx.date) {
      group = { date: tx.date, items: [], netMinor: 0 };
      groups.push(group);
    }
    group.items.push(tx);
    group.netMinor += tx.type === 'income' ? tx.amountMinor : -tx.amountMinor;
  }
  return groups;
}
