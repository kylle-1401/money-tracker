import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import type { Category, TxType } from '../../db/types.ts';
import { listTransactions } from './transactionRepository.ts';

/**
 * Live list of all transactions, newest first. Re-renders automatically when data changes.
 * Returns undefined while the first read is loading.
 */
export function useTransactions() {
  return useLiveQuery(listTransactions, []);
}

/** Live lookup of one transaction; null if it doesn't exist, undefined while loading. */
export function useTransaction(id: string | undefined) {
  return useLiveQuery(async () => (id ? ((await db.transactions.get(id)) ?? null) : null), [id]);
}

/**
 * Live map of every category by id, including archived ones (old transactions still
 * need their name and emoji).
 */
export function useCategoryMap() {
  return useLiveQuery(async () => {
    const all = await db.categories.toArray();
    return new Map<string, Category>(all.map((c) => [c.id, c]));
  }, []);
}

/** Live list of the non-archived categories of one type, in display order. */
export function usePickableCategories(type: TxType) {
  return useLiveQuery(async () => {
    const rows = await db.categories.where('type').equals(type).toArray();
    return rows.filter((c) => !c.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [type]);
}
