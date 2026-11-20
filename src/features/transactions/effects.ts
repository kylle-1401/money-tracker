import type { Transaction } from '../../db/types.ts';

/*
 * How one entry changes the money. Every total in the app (wallet balances, the
 * total balance, day totals) goes through these two functions so they always agree.
 *
 * Business rules (slice 8, owner-confirmed 2026-11-20):
 * - income adds to its wallet; an expense takes from it
 * - a transfer takes amount + fee from the "from" wallet and adds amount to the
 *   "to" wallet, so overall only the fee leaves your money
 */

/** Fee on a transfer (0 when none, and for income/expenses). */
export function feeOf(t: Transaction): number {
  return t.type === 'transfer' ? (t.feeMinor ?? 0) : 0;
}

/** Change to your total money: +income, −expense, −fee for a transfer. */
export function netEffectMinor(t: Transaction): number {
  switch (t.type) {
    case 'income':
      return t.amountMinor;
    case 'expense':
      return -t.amountMinor;
    case 'transfer':
      return 0 - feeOf(t); // not -fee: a free transfer must be 0, not -0
  }
}

/** Change to one wallet's balance (0 if the entry doesn't touch that wallet). */
export function effectOnWallet(t: Transaction, walletId: string): number {
  if (t.type === 'transfer') {
    let effect = 0;
    if (t.walletId === walletId) effect -= t.amountMinor + feeOf(t);
    if (t.toWalletId === walletId) effect += t.amountMinor;
    return effect;
  }
  return t.walletId === walletId ? netEffectMinor(t) : 0;
}

/** True if the entry moves money in or out of the wallet. */
export function touchesWallet(t: Transaction, walletId: string): boolean {
  return t.walletId === walletId || (t.type === 'transfer' && t.toWalletId === walletId);
}
