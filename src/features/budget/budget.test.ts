import { describe, expect, it } from 'vitest';
import { db } from '../../db/db.ts';
import { defaultCategories } from '../../db/seed.ts';
import type { Category, Transaction } from '../../db/types.ts';
import { addCategory, setCategoryBudget } from '../settings/categoryRepository.ts';
import {
  budgetCrossings,
  budgetLevel,
  categorySpending,
  monthSpending,
  percentUsed,
} from './budget.ts';
import { getMonthlyBudget, MONTHLY_BUDGET_KEY, setMonthlyBudget } from './budgetRepository.ts';

let seq = 0;
function tx(fields: Partial<Transaction> & Pick<Transaction, 'type' | 'amountMinor'>): Transaction {
  seq += 1;
  return {
    id: String(seq),
    categoryId: fields.type === 'transfer' ? '' : 'expense-food',
    walletId: 'cash',
    date: '2026-11-10',
    note: '',
    createdAt: seq,
    updatedAt: seq,
    ...fields,
  };
}

const food: Category = { ...(defaultCategories[0] as Category), budgetMinor: 600_000 };

describe('budget rules', () => {
  it.each([
    [0, 'ok'],
    [7_999, 'ok'],
    [8_000, 'warning'], // exactly 80%
    [10_000, 'warning'], // exactly 100% is not over yet
    [10_001, 'over'],
  ] as const)('budgetLevel_%i_of_10000_%s', (spent, level) => {
    expect(budgetLevel(spent, 10_000)).toBe(level);
  });

  it('percentUsed_RoundsDownAndCanPass100', () => {
    expect(percentUsed(8_599, 10_000)).toBe(85);
    expect(percentUsed(12_000, 10_000)).toBe(120);
  });

  it('percentUsed_AbsurdTotal_CappedAndStaysExact', () => {
    // 50,000 maximum entries: far past 2^53 if multiplied by 100 directly.
    expect(percentUsed(50_000 * 99_999_999_999, 100)).toBe(10_000);
  });

  it('monthSpending_ExpensesPlusTransferFees_OtherMonthsAndIncomeIgnored', () => {
    const txs = [
      tx({ type: 'expense', amountMinor: 1_000 }),
      tx({ type: 'transfer', amountMinor: 50_000, toWalletId: 'bdo', feeMinor: 150 }),
      tx({ type: 'income', amountMinor: 99_000, categoryId: 'income-salary' }),
      tx({ type: 'expense', amountMinor: 5_000, date: '2026-10-31' }),
    ];
    expect(monthSpending(txs, '2026-11')).toBe(1_150);
  });

  it('categorySpending_OnlyThatCategoryThatMonth', () => {
    const txs = [
      tx({ type: 'expense', amountMinor: 1_000 }),
      tx({ type: 'expense', amountMinor: 2_000, categoryId: 'expense-transport' }),
      tx({ type: 'expense', amountMinor: 3_000, date: '2026-12-01' }),
    ];
    expect(categorySpending(txs, '2026-11', 'expense-food')).toBe(1_000);
  });
});

describe('budgetCrossings', () => {
  const before = [tx({ type: 'expense', amountMinor: 900_000 })]; // 75% of 12,000
  const crossings = (after: Transaction[], monthly: number | null = 1_200_000) =>
    budgetCrossings(before, after, '2026-11', monthly, [food], 'PHP');

  it('budgetCrossings_PassingEightyPercent_WarnsWithPercent', () => {
    const after = [
      ...before,
      tx({ type: 'expense', amountMinor: 120_000, categoryId: 'expense-transport' }),
    ];
    expect(crossings(after)).toEqual([
      { key: 'overall', level: 'warning', message: 'You’ve used 85% of your November budget.' },
    ]);
  });

  it('budgetCrossings_GoingOver_SaysByHowMuch_AndCategoryToo', () => {
    // Food alone: 9,000 + 3,350 = 12,350 > 6,000 (category) and > 12,000 (overall).
    const after = [...before, tx({ type: 'expense', amountMinor: 335_000 })];
    expect(crossings(after)).toEqual([
      { key: 'overall', level: 'over', message: 'You’re ₱350.00 over your November budget.' },
      // Food was already over its 6,000 before (9,000), so no repeat alert for it.
    ]);
  });

  it('budgetCrossings_StayingInSameLevel_SaysNothing', () => {
    const warned = [
      tx({ type: 'expense', amountMinor: 1_000_000, categoryId: 'expense-transport' }),
    ];
    const after = [
      ...warned,
      tx({ type: 'expense', amountMinor: 10_000, categoryId: 'expense-transport' }),
    ];
    expect(budgetCrossings(warned, after, '2026-11', 1_200_000, [], 'PHP')).toEqual([]);
  });

  it('budgetCrossings_CategoryBudget_WarnsByName', () => {
    const start = [tx({ type: 'expense', amountMinor: 100_000 })]; // Food 1,000 of 6,000
    const after = [...start, tx({ type: 'expense', amountMinor: 400_000 })]; // 5,000 = 83%
    expect(budgetCrossings(start, after, '2026-11', null, [food], 'PHP')).toEqual([
      { key: food.id, level: 'warning', message: 'You’ve used 83% of your Food budget.' },
    ]);
  });

  it('budgetCrossings_NoBudgets_Nothing', () => {
    const noBudgetFood: Category = { ...food, budgetMinor: undefined };
    const after = [...before, tx({ type: 'expense', amountMinor: 50_000_000 })];
    expect(budgetCrossings(before, after, '2026-11', null, [noBudgetFood], 'PHP')).toEqual([]);
  });

  it('budgetCrossings_DeletingSpending_NeverAlerts', () => {
    expect(crossings([])).toEqual([]);
  });
});

describe('budget storage', () => {
  it('monthlyBudget_SetGetRemove', async () => {
    expect(await getMonthlyBudget()).toBeNull();
    await setMonthlyBudget(1_200_000);
    expect(await getMonthlyBudget()).toBe(1_200_000);
    await setMonthlyBudget(null);
    expect(await getMonthlyBudget()).toBeNull();
  });

  it('monthlyBudget_Invalid_ThrowsAndJunkReadsAsNone', async () => {
    await expect(setMonthlyBudget(0)).rejects.toThrow('budget');
    await expect(setMonthlyBudget(1.5)).rejects.toThrow('budget');
    await db.settings.put({ key: MONTHLY_BUDGET_KEY, value: 'lots' });
    expect(await getMonthlyBudget()).toBeNull();
  });

  it('setCategoryBudget_ExpenseCategory_SetsAndRemoves', async () => {
    await setCategoryBudget('expense-food', 600_000);
    expect((await db.categories.get('expense-food'))?.budgetMinor).toBe(600_000);
    await setCategoryBudget('expense-food', null);
    expect(await db.categories.get('expense-food')).not.toHaveProperty('budgetMinor');
  });

  it('setCategoryBudget_IncomeCategory_Throws', async () => {
    await expect(setCategoryBudget('income-salary', 100)).rejects.toThrow('Only expense');
  });

  it('setCategoryBudget_UnknownOrInvalid_Throws', async () => {
    await expect(setCategoryBudget('nope', 100)).rejects.toThrow('no longer exists');
    const id = await addCategory('expense', { name: 'Pets', emoji: '🐶' });
    await expect(setCategoryBudget(id, -5)).rejects.toThrow('budget');
  });
});
