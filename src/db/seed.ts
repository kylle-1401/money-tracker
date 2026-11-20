import type { Category, TxType, Wallet } from './types.ts';

/**
 * The wallet every install starts with. Existing entries are moved into it by the
 * v2 upgrade (business rule confirmed by the owner, 2026-11-20). Stable id so backups
 * from different devices fold together.
 */
export const CASH_WALLET_ID = 'wallet-cash';

export const defaultWallet: Wallet = {
  id: CASH_WALLET_ID,
  name: 'Cash',
  emoji: '💵',
  color: 'green',
  startingBalanceMinor: 0,
  archived: false,
  sortOrder: 0,
};

type SeedRow = [name: string, emoji: string, color: string];

// Starter categories for a first launch, chosen for everyday spending in the Philippines.
// Users can rename/archive them in Settings (slice 3).
const expense: SeedRow[] = [
  ['Food', '🍜', '#f97316'],
  ['Transport', '🚌', '#3b82f6'],
  ['Bills & Utilities', '💡', '#eab308'],
  ['Load/Internet', '📱', '#8b5cf6'],
  ['Shopping', '🛍️', '#ec4899'],
  ['Health', '💊', '#10b981'],
  ['Entertainment', '🎬', '#06b6d4'],
  ['Other', '📦', '#64748b'],
];

const income: SeedRow[] = [
  ['Salary', '💼', '#16a34a'],
  ['Business/Sideline', '🏪', '#0ea5e9'],
  ['Gifts', '🎁', '#d946ef'],
  ['Other', '💰', '#64748b'],
];

function toCategories(rows: SeedRow[], type: TxType): Category[] {
  return rows.map(([name, emoji, color], i) => ({
    // Stable ids (not random) so seeded categories match across devices and backups.
    id: `${type}-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    name,
    type,
    emoji,
    color,
    archived: false,
    sortOrder: i,
  }));
}

/** The categories inserted when the database is first created. */
export const defaultCategories: Category[] = [
  ...toCategories(expense, 'expense'),
  ...toCategories(income, 'income'),
];
