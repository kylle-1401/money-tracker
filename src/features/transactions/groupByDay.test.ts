import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../db/types.ts';
import { groupByDay } from './groupByDay.ts';

function tx(id: string, date: string, type: Transaction['type'], amountMinor: number): Transaction {
  return {
    id,
    date,
    type,
    amountMinor,
    categoryId: 'c',
    walletId: 'w',
    note: '',
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('groupByDay', () => {
  it('groupByDay_Empty_ReturnsNoGroups', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('groupByDay_SeveralDays_OneGroupPerDateInOrderWithNet', () => {
    const groups = groupByDay([
      tx('a', '2026-11-19', 'expense', 24500),
      tx('b', '2026-11-19', 'income', 100000),
      tx('c', '2026-11-18', 'expense', 5000),
    ]);

    expect(groups.map((g) => g.date)).toEqual(['2026-11-19', '2026-11-18']);
    expect(groups[0]?.items.map((t) => t.id)).toEqual(['a', 'b']);
    expect(groups[0]?.netMinor).toBe(75500);
    expect(groups[1]?.netMinor).toBe(-5000);
  });
});
