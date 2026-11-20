import { describe, expect, it } from 'vitest';
import { db } from '../../db/db.ts';
import { CASH_WALLET_ID, defaultCategories } from '../../db/seed.ts';
import type { Category, Transaction, Wallet } from '../../db/types.ts';
import {
  balanceMinor,
  monthTotals,
  spendingByCategory,
  totalBalanceMinor,
  walletBalances,
} from '../dashboard/summary.ts';
import { addWallet, countTransactionsInWallet, deleteWallet } from '../wallets/walletRepository.ts';
import { effectOnWallet, netEffectMinor } from './effects.ts';
import { groupByDay } from './groupByDay.ts';
import {
  addTransaction,
  updateTransaction,
  type TransactionInput,
} from './transactionRepository.ts';

const wallet = (id: string, startingBalanceMinor = 0): Wallet => ({
  id,
  name: id,
  emoji: '💵',
  color: 'green',
  startingBalanceMinor,
  archived: false,
  sortOrder: 0,
});

let seq = 0;
function tx(fields: Partial<Transaction> & Pick<Transaction, 'type' | 'amountMinor'>): Transaction {
  seq += 1;
  return {
    id: String(seq),
    categoryId: fields.type === 'transfer' ? '' : 'expense-food',
    walletId: 'cash',
    date: '2026-11-20',
    note: '',
    createdAt: seq,
    updatedAt: seq,
    ...fields,
  };
}

const transfer = (amountMinor: number, feeMinor?: number) =>
  tx({ type: 'transfer', amountMinor, walletId: 'gcash', toWalletId: 'bdo', feeMinor });

describe('transfer effects', () => {
  it('effectOnWallet_Transfer_FromLosesAmountPlusFee_ToGainsAmount', () => {
    const t = transfer(100_000, 1_500);
    expect(effectOnWallet(t, 'gcash')).toBe(-101_500);
    expect(effectOnWallet(t, 'bdo')).toBe(100_000);
    expect(effectOnWallet(t, 'cash')).toBe(0);
  });

  it('netEffectMinor_Transfer_OnlyTheFeeLeavesYourMoney', () => {
    expect(netEffectMinor(transfer(100_000, 1_500))).toBe(-1_500);
    expect(netEffectMinor(transfer(100_000))).toBe(0);
  });

  it('walletBalances_TransferMovesMoneyAndTotalDropsByFee', () => {
    const wallets = [wallet('cash', 10_000), wallet('gcash', 200_000), wallet('bdo')];
    const txs = [transfer(100_000, 1_500), tx({ type: 'expense', amountMinor: 2_000 })];
    expect(Object.fromEntries(walletBalances(wallets, txs))).toEqual({
      cash: 8_000,
      gcash: 98_500,
      bdo: 100_000,
    });
    expect(totalBalanceMinor(wallets, txs)).toBe(206_500); // 210,000 − 2,000 − 1,500
    expect(balanceMinor(txs)).toBe(-3_500);
  });

  it('monthTotals_TransferIsNotIncomeOrSpending_ButFeeIsSpending', () => {
    const txs = [
      transfer(100_000, 1_500),
      tx({ type: 'income', amountMinor: 50_000, categoryId: 'income-salary' }),
      tx({ type: 'expense', amountMinor: 3_000 }),
    ];
    expect(monthTotals(txs, '2026-11')).toEqual({ incomeMinor: 50_000, expenseMinor: 4_500 });
  });

  it('spendingByCategory_FeesShowAsOneTransferFeesRow_FreeTransfersHidden', () => {
    const categories = new Map<string, Category>(defaultCategories.map((c) => [c.id, c]));
    const rows = spendingByCategory(
      [
        transfer(100_000, 1_000),
        transfer(5_000, 500),
        transfer(9_999), // no fee: not spending
        tx({ type: 'expense', amountMinor: 4_500 }),
      ],
      '2026-11',
      categories,
    );
    expect(rows.map((r) => [r.name, r.amountMinor, r.percent])).toEqual([
      ['Food', 4_500, 75],
      ['Transfer fees', 1_500, 25],
    ]);
  });

  it('walletBalances_NoMoneyCreatedOrLost_SumEqualsStartingPlusNet', () => {
    const wallets = [wallet('cash', 10_000), wallet('gcash', 200_000), wallet('bdo', -5_000)];
    const txs = [
      transfer(100_000, 1_500),
      tx({ type: 'transfer', amountMinor: 7_000, walletId: 'bdo', toWalletId: 'cash' }),
      tx({ type: 'income', amountMinor: 50_000, walletId: 'bdo', categoryId: 'income-salary' }),
      tx({ type: 'expense', amountMinor: 2_000 }),
    ];
    const sum = [...walletBalances(wallets, txs).values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(10_000 + 200_000 - 5_000 + balanceMinor(txs));
  });

  it('walletBalances_CorruptTransferToItself_AppliesFeeOnce', () => {
    const t = tx({
      type: 'transfer',
      amountMinor: 1_000,
      walletId: 'cash',
      toWalletId: 'cash',
      feeMinor: 100,
    });
    expect(walletBalances([wallet('cash', 0)], [t]).get('cash')).toBe(-100);
  });

  it('groupByDay_ForOneWallet_UsesThatWalletsChange', () => {
    const txs = [transfer(100_000, 1_500)];
    expect(groupByDay(txs)[0]?.netMinor).toBe(-1_500);
    expect(groupByDay(txs, 'bdo')[0]?.netMinor).toBe(100_000);
    expect(groupByDay(txs, 'gcash')[0]?.netMinor).toBe(-101_500);
  });
});

describe('transfer repository rules', () => {
  async function wallets() {
    const gcash = await addWallet({
      name: 'GCash',
      emoji: '📱',
      color: 'blue',
      startingBalanceMinor: 0,
    });
    return { gcash };
  }
  const base = (to: string): TransactionInput => ({
    type: 'transfer',
    amountMinor: 100_000,
    categoryId: '',
    walletId: CASH_WALLET_ID,
    toWalletId: to,
    feeMinor: 1_500,
    date: '2026-11-20',
    note: '',
  });

  it('addTransaction_ValidTransfer_SavesWithoutCategory', async () => {
    const { gcash } = await wallets();
    const id = await addTransaction(base(gcash));
    expect(await db.transactions.get(id)).toMatchObject({
      type: 'transfer',
      categoryId: '',
      walletId: CASH_WALLET_ID,
      toWalletId: gcash,
      feeMinor: 1_500,
    });
  });

  it('addTransaction_ZeroFee_NotStored', async () => {
    const { gcash } = await wallets();
    const id = await addTransaction({ ...base(gcash), feeMinor: 0 });
    expect((await db.transactions.get(id))?.feeMinor).toBeUndefined();
  });

  it.each([
    [
      'same wallet',
      (i: TransactionInput) => ({ ...i, toWalletId: CASH_WALLET_ID }),
      'two different',
    ],
    ['unknown to', (i: TransactionInput) => ({ ...i, toWalletId: 'nope' }), 'move the money to'],
    ['missing to', (i: TransactionInput) => ({ ...i, toWalletId: undefined }), 'move the money to'],
    ['negative fee', (i: TransactionInput) => ({ ...i, feeMinor: -1 }), 'fee'],
    ['fractional fee', (i: TransactionInput) => ({ ...i, feeMinor: 1.5 }), 'fee'],
    ['with category', (i: TransactionInput) => ({ ...i, categoryId: 'expense-food' }), 'category'],
  ])('addTransaction_Transfer_%s_Throws', async (_label, edit, message) => {
    const { gcash } = await wallets();
    await expect(addTransaction(edit(base(gcash)))).rejects.toThrow(message);
    expect(await db.transactions.count()).toBe(0);
  });

  it('addTransaction_ExpenseWithSecondWallet_Throws', async () => {
    const { gcash } = await wallets();
    await expect(
      addTransaction({
        ...base(gcash),
        type: 'expense',
        categoryId: 'expense-food',
        feeMinor: undefined,
      }),
    ).rejects.toThrow('Only transfers');
  });

  it('updateTransaction_TransferToExpense_DropsTransferFieldsKeepsCreatedAt', async () => {
    const { gcash } = await wallets();
    const id = await addTransaction(base(gcash), 111);
    await updateTransaction(
      id,
      {
        type: 'expense',
        amountMinor: 500,
        categoryId: 'expense-food',
        walletId: CASH_WALLET_ID,
        date: '2026-11-20',
        note: '',
      },
      222,
    );
    const saved = await db.transactions.get(id);
    expect(saved).toMatchObject({
      type: 'expense',
      categoryId: 'expense-food',
      createdAt: 111,
      updatedAt: 222,
    });
    expect(saved).not.toHaveProperty('toWalletId');
    expect(saved).not.toHaveProperty('feeMinor');
  });

  it.each([
    ['unknown category', { categoryId: 'nope' }, 'Category is required.'],
    ['income category on an expense', { categoryId: 'income-salary' }, 'different type'],
    ['invalid date', { date: '2026-02-30' }, 'valid date'],
    ['note too long', { note: 'x'.repeat(201) }, 'under 200'],
  ])('addTransaction_Expense_%s_Throws', async (_label, edit, message) => {
    // The same checks backup import makes, so the app's own backup always restores.
    await expect(
      addTransaction({
        type: 'expense',
        amountMinor: 100,
        categoryId: 'expense-food',
        walletId: CASH_WALLET_ID,
        date: '2026-11-20',
        note: '',
        ...edit,
      }),
    ).rejects.toThrow(message);
  });

  it('deleteWallet_UsedOnlyAsTransferDestination_Blocked', async () => {
    const { gcash } = await wallets();
    await addTransaction(base(gcash));
    expect(await countTransactionsInWallet(gcash)).toBe(1);
    await expect(deleteWallet(gcash)).rejects.toThrow('Archive it instead.');
  });
});
