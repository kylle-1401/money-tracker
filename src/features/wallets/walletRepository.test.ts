import { describe, expect, it } from 'vitest';
import { db } from '../../db/db.ts';
import { CASH_WALLET_ID } from '../../db/seed.ts';
import type { Transaction, Wallet } from '../../db/types.ts';
import { addTransaction } from '../transactions/transactionRepository.ts';
import { totalBalanceMinor, walletBalances } from '../dashboard/summary.ts';
import {
  addWallet,
  deleteWallet,
  getDefaultWalletId,
  listWallets,
  moveWallet,
  rememberLastWallet,
  setWalletArchived,
  updateWallet,
  type WalletInput,
} from './walletRepository.ts';

const gcash: WalletInput = {
  name: 'GCash',
  emoji: '📱',
  color: 'blue',
  startingBalanceMinor: 500_000,
};

function expense(walletId: string, amountMinor: number) {
  return addTransaction({
    type: 'expense',
    amountMinor,
    categoryId: 'expense-food',
    walletId,
    date: '2026-11-20',
    note: '',
  });
}

describe('walletRepository', () => {
  it('addWallet_Valid_AddsAtTheEndWithTrimmedName', async () => {
    const id = await addWallet({ ...gcash, name: '  G   Cash ' });
    const wallets = await listWallets();
    expect(wallets.map((w) => w.name)).toEqual(['Cash', 'G Cash']);
    expect(wallets[1]).toMatchObject({ id, sortOrder: 1, archived: false });
  });

  it('addWallet_DuplicateNameAnyCase_Throws', async () => {
    await expect(addWallet({ ...gcash, name: 'cash' })).rejects.toThrow(
      'You already have a wallet called "cash".',
    );
  });

  it('addWallet_InvalidInput_Throws', async () => {
    await expect(addWallet({ ...gcash, name: ' ' })).rejects.toThrow('Name is required.');
    await expect(addWallet({ ...gcash, emoji: '' })).rejects.toThrow('Pick an icon.');
    await expect(addWallet({ ...gcash, color: 'red' as Wallet['color'] })).rejects.toThrow(
      'Pick a card color.',
    );
    await expect(addWallet({ ...gcash, startingBalanceMinor: 1.5 })).rejects.toThrow(
      'starting balance',
    );
  });

  it('addWallet_BidiOrControlChars_StrippedSoNamesStayUnique', async () => {
    // U+202E (right-to-left override) would make "GCash" look like another wallet,
    // and the app's own backup would then fail to restore (names clash after cleaning).
    await addWallet(gcash);
    await expect(addWallet({ ...gcash, name: 'GCash‮' })).rejects.toThrow(
      'You already have a wallet called "GCash".',
    );
    const id = await addWallet({ ...gcash, name: 'Ma\u0007ya‏' });
    expect((await db.wallets.get(id))?.name).toBe('Maya');
  });

  it('addWallet_LongEmojiField_Throws', async () => {
    await expect(addWallet({ ...gcash, emoji: '💵'.repeat(9) })).rejects.toThrow(
      'Use a single emoji.',
    );
  });

  it('addWallet_NegativeStartingBalance_AllowedForMoneyOwed', async () => {
    const id = await addWallet({ ...gcash, name: 'Credit card', startingBalanceMinor: -300_000 });
    expect((await db.wallets.get(id))?.startingBalanceMinor).toBe(-300_000);
  });

  it('updateWallet_RenameToOwnNameDifferentCase_Allowed', async () => {
    const id = await addWallet(gcash);
    await updateWallet(id, { ...gcash, name: 'GCASH', color: 'purple' });
    expect(await db.wallets.get(id)).toMatchObject({ name: 'GCASH', color: 'purple' });
  });

  it('setWalletArchived_LastActiveWallet_Throws', async () => {
    await expect(setWalletArchived(CASH_WALLET_ID, true)).rejects.toThrow(
      'You need at least one active wallet.',
    );
  });

  it('setWalletArchived_WithAnotherActive_ArchivesAndRestores', async () => {
    await addWallet(gcash);
    await setWalletArchived(CASH_WALLET_ID, true);
    expect((await listWallets()).map((w) => [w.name, w.archived])).toEqual([
      ['GCash', false],
      ['Cash', true],
    ]);
    await setWalletArchived(CASH_WALLET_ID, false);
    expect((await db.wallets.get(CASH_WALLET_ID))?.archived).toBe(false);
  });

  it('deleteWallet_Used_ThrowsAndKeepsIt', async () => {
    const id = await addWallet(gcash);
    await expense(id, 100);
    await expect(deleteWallet(id)).rejects.toThrow('Archive it instead.');
    expect(await db.wallets.get(id)).toBeDefined();
  });

  it('deleteWallet_Unused_Deletes', async () => {
    const id = await addWallet(gcash);
    await deleteWallet(id);
    expect(await db.wallets.get(id)).toBeUndefined();
  });

  it('deleteWallet_OnlyWallet_Throws', async () => {
    await expect(deleteWallet(CASH_WALLET_ID)).rejects.toThrow('at least one active wallet');
  });

  it('moveWallet_Up_SwapsOrder_AndEdgesAreNoOps', async () => {
    const g = await addWallet(gcash);
    const b = await addWallet({ ...gcash, name: 'BDO' });
    await moveWallet(b, -1);
    expect((await listWallets()).map((w) => w.name)).toEqual(['Cash', 'BDO', 'GCash']);
    await moveWallet(CASH_WALLET_ID, -1); // already first
    await moveWallet(g, 1); // already last
    expect((await listWallets()).map((w) => w.name)).toEqual(['Cash', 'BDO', 'GCash']);
  });

  it('getDefaultWalletId_RemembersLastActive_FallsBackWhenArchived', async () => {
    expect(await getDefaultWalletId()).toBe(CASH_WALLET_ID);
    const id = await addWallet(gcash);
    await rememberLastWallet(id);
    expect(await getDefaultWalletId()).toBe(id);
    await setWalletArchived(id, true);
    expect(await getDefaultWalletId()).toBe(CASH_WALLET_ID);
  });

  it('addTransaction_UnknownWallet_Throws', async () => {
    await expect(expense('nope', 100)).rejects.toThrow('Pick a wallet.');
    await expect(expense('', 100)).rejects.toThrow('Pick a wallet.');
  });
});

describe('wallet balances', () => {
  const wallet = (id: string, startingBalanceMinor: number, archived = false): Wallet => ({
    id,
    name: id,
    emoji: '💵',
    color: 'green',
    startingBalanceMinor,
    archived,
    sortOrder: 0,
  });
  const tx = (walletId: string, type: Transaction['type'], amountMinor: number): Transaction => ({
    id: crypto.randomUUID(),
    type,
    amountMinor,
    walletId,
    categoryId: type === 'income' ? 'income-salary' : 'expense-food',
    date: '2026-11-20',
    note: '',
    createdAt: 0,
    updatedAt: 0,
  });

  it('walletBalances_StartingPlusIncomeMinusExpenses_PerWallet', () => {
    const wallets = [wallet('cash', 100_000), wallet('gcash', 0), wallet('card', -300_000)];
    const txs = [
      tx('cash', 'expense', 24_550),
      tx('gcash', 'income', 2_500_000),
      tx('gcash', 'expense', 50_000),
      tx('card', 'expense', 10_000),
    ];
    expect(Object.fromEntries(walletBalances(wallets, txs))).toEqual({
      cash: 75_450,
      gcash: 2_450_000,
      card: -310_000,
    });
  });

  it('totalBalanceMinor_IncludesArchivedWallets', () => {
    const wallets = [wallet('cash', 1_000), wallet('old', 5_000, true)];
    expect(totalBalanceMinor(wallets, [tx('old', 'expense', 500)])).toBe(5_500);
  });

  it('totalBalanceMinor_NoWalletsOrEntries_IsZero', () => {
    expect(totalBalanceMinor([], [])).toBe(0);
  });
});
