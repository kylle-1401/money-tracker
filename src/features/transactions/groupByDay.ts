import type { Transaction } from '../../db/types.ts';
import { effectOnWallet, netEffectMinor } from './effects.ts';

/** Transactions that share one calendar date. */
export interface DayGroup {
  date: string;
  items: Transaction[];
  /**
   * The day's change in minor units: income − expenses − transfer fees, or, when
   * grouping for one wallet, the change to that wallet's balance.
   */
  netMinor: number;
}

/**
 * Groups an already newest-first list into one group per date, keeping order.
 * @param walletId when set (List filtered to one wallet), day totals are that wallet's.
 */
export function groupByDay(transactions: Transaction[], walletId?: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const tx of transactions) {
    let group = groups.at(-1);
    if (!group || group.date !== tx.date) {
      group = { date: tx.date, items: [], netMinor: 0 };
      groups.push(group);
    }
    group.items.push(tx);
    group.netMinor += walletId === undefined ? netEffectMinor(tx) : effectOnWallet(tx, walletId);
  }
  return groups;
}
