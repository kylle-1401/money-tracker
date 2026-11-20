import { describe, expect, it } from 'vitest';
import { CASH_WALLET_ID, defaultCategories, defaultWallet } from '../../db/seed.ts';
import { first } from '../../test/helpers.ts';
import { BACKUP_VERSION, parseBackup, serializeBackup, type Backup } from './backupFormat.ts';

function firstTx(b: Record<string, unknown>) {
  return first(b.transactions as Array<Record<string, unknown>>);
}

function validBackup(): Backup {
  return {
    app: 'money-tracker',
    version: BACKUP_VERSION,
    exportedAt: '2026-11-19T08:00:00.000Z',
    currency: 'PHP',
    categories: defaultCategories.map((c) => ({ ...c })),
    wallets: [{ ...defaultWallet }],
    transactions: [
      {
        id: 't1',
        type: 'expense',
        amountMinor: 24550,
        categoryId: 'expense-food',
        walletId: CASH_WALLET_ID,
        date: '2026-11-19',
        note: 'Jollibee',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  };
}

function parseEdited(edit: (b: Record<string, unknown>) => void) {
  const backup = JSON.parse(serializeBackup(validBackup())) as Record<string, unknown>;
  edit(backup);
  return parseBackup(JSON.stringify(backup));
}

describe('parseBackup transfers', () => {
  /** validBackup plus a BDO wallet and a transfer Cash → BDO. */
  function parseWithTransfer(edit: (t: Record<string, unknown>) => void = () => undefined) {
    return parseEdited((b) => {
      (b.wallets as unknown[]).push({ ...defaultWallet, id: 'w-bdo', name: 'BDO' });
      const transfer: Record<string, unknown> = {
        id: 't2',
        type: 'transfer',
        amountMinor: 100_000,
        categoryId: '',
        walletId: CASH_WALLET_ID,
        toWalletId: 'w-bdo',
        feeMinor: 1_500,
        date: '2026-11-20',
        note: '',
        createdAt: 2,
        updatedAt: 2,
      };
      edit(transfer);
      (b.transactions as unknown[]).push(transfer);
    });
  }

  it('parseBackup_ValidTransfer_Accepted', () => {
    const result = parseWithTransfer();
    expect(result.ok && result.backup.transactions[1]).toMatchObject({
      type: 'transfer',
      toWalletId: 'w-bdo',
      feeMinor: 1_500,
    });
  });

  it('parseBackup_ZeroFee_StoredAsNoFee', () => {
    const result = parseWithTransfer((t) => (t.feeMinor = 0));
    expect(result.ok && result.backup.transactions[1]).not.toHaveProperty('feeMinor');
  });

  it.each([
    ['to itself', (t: Record<string, unknown>) => (t.toWalletId = CASH_WALLET_ID)],
    ['to a missing wallet', (t: Record<string, unknown>) => (t.toWalletId = 'nope')],
    ['without destination', (t: Record<string, unknown>) => delete t.toWalletId],
    ['with a category', (t: Record<string, unknown>) => (t.categoryId = 'expense-food')],
    ['negative fee', (t: Record<string, unknown>) => (t.feeMinor = -1)],
    ['fractional fee', (t: Record<string, unknown>) => (t.feeMinor = 1.5)],
    ['unsafe destination id', (t: Record<string, unknown>) => (t.toWalletId = '../x')],
  ])('parseBackup_Transfer_%s_Rejects', (_label, edit) => {
    expect(parseWithTransfer(edit).ok).toBe(false);
  });

  it('parseBackup_ExpenseWithFeeOrSecondWallet_Rejects', () => {
    expect(parseEdited((b) => (firstTx(b).feeMinor = 100)).ok).toBe(false);
    expect(parseEdited((b) => (firstTx(b).toWalletId = CASH_WALLET_ID)).ok).toBe(false);
  });

  it('parseBackup_ExpenseWithEmptyCategory_Rejects', () => {
    expect(parseEdited((b) => (firstTx(b).categoryId = '')).ok).toBe(false);
  });
});

describe('parseBackup budgets (v4)', () => {
  it('parseBackup_Budgets_RoundTrip', () => {
    const result = parseEdited((b) => {
      b.monthlyBudgetMinor = 1_200_000;
      first(b.categories as Array<Record<string, unknown>>).budgetMinor = 600_000; // Food
    });
    expect(result.ok && result.backup.monthlyBudgetMinor).toBe(1_200_000);
    expect(result.ok && first(result.backup.categories).budgetMinor).toBe(600_000);
  });

  it.each([
    ['zero monthly budget', (b: Record<string, unknown>) => (b.monthlyBudgetMinor = 0)],
    ['fractional monthly budget', (b: Record<string, unknown>) => (b.monthlyBudgetMinor = 1.5)],
    [
      'negative category budget',
      (b: Record<string, unknown>) =>
        (first(b.categories as Array<Record<string, unknown>>).budgetMinor = -1),
    ],
    [
      'income category with a budget',
      (b: Record<string, unknown>) => {
        const salary = (b.categories as Array<Record<string, unknown>>).find(
          (c) => c.id === 'income-salary',
        );
        if (salary) salary.budgetMinor = 100;
      },
    ],
  ])('parseBackup_%s_Rejects', (_label, edit) => {
    expect(parseEdited(edit).ok).toBe(false);
  });
});

describe('parseBackup', () => {
  it('parseBackup_ValidFile_RoundTrips', () => {
    const result = parseBackup(serializeBackup(validBackup()));

    expect(result).toEqual({ ok: true, backup: validBackup() });
  });

  it('parseBackup_NotJson_ExplainsIt', () => {
    expect(parseBackup('hello')).toEqual({
      ok: false,
      error: expect.stringContaining('valid JSON'),
    });
  });

  it('parseBackup_OtherAppJson_Rejects', () => {
    expect(parseBackup('{"foo": 1}')).toEqual({
      ok: false,
      error: 'This file isn’t a Money Tracker backup.',
    });
  });

  it('parseBackup_NewerVersion_AsksToUpdate', () => {
    const result = parseEdited((b) => (b.version = BACKUP_VERSION + 1));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('newer version') });
  });

  it.each([
    ['zero amount', (b: Record<string, unknown>) => (firstTx(b).amountMinor = 0)],
    ['float amount', (b: Record<string, unknown>) => (firstTx(b).amountMinor = 12.5)],
    ['bad date', (b: Record<string, unknown>) => (firstTx(b).date = '2026-02-30')],
    ['long note', (b: Record<string, unknown>) => (firstTx(b).note = 'x'.repeat(201))],
    ['missing category', (b: Record<string, unknown>) => (firstTx(b).categoryId = 'nope')],
    ['type mismatch', (b: Record<string, unknown>) => (firstTx(b).categoryId = 'income-salary')],
    [
      'duplicate category id',
      (b: Record<string, unknown>) =>
        (b.categories as unknown[]).push((b.categories as unknown[])[0]),
    ],
    [
      'duplicate transaction id',
      (b: Record<string, unknown>) =>
        (b.transactions as unknown[]).push((b.transactions as unknown[])[0]),
    ],
    ['transactions not a list', (b: Record<string, unknown>) => (b.transactions = 'lots')],
    ['missing wallet', (b: Record<string, unknown>) => (firstTx(b).walletId = 'nope')],
    ['no wallets', (b: Record<string, unknown>) => (b.wallets = [])],
    [
      'duplicate wallet name',
      (b: Record<string, unknown>) =>
        (b.wallets as unknown[]).push({ ...defaultWallet, id: 'cash-2', name: ' CASH' }),
    ],
    [
      'every wallet archived',
      (b: Record<string, unknown>) => (b.wallets = [{ ...defaultWallet, archived: true }]),
    ],
    [
      'starting balance too large',
      (b: Record<string, unknown>) =>
        (b.wallets = [{ ...defaultWallet, startingBalanceMinor: 1e15 }]),
    ],
  ])('parseBackup_Damaged_%s_RejectsSafely', (_label, edit) => {
    const result = parseEdited(edit);
    expect(result).toEqual({ ok: false, error: expect.stringContaining('damaged or was edited') });
  });

  it.each(['a/b', 'x?y', '#z', '%E0', '', 'x'.repeat(101)])(
    'parseBackup_UnsafeId_%j_Rejects',
    (id) => {
      const result = parseEdited((b) => (firstTx(b).id = id));
      expect(result.ok).toBe(false);
    },
  );

  it('parseBackup_DuplicateCategoryNameSameType_Rejects', () => {
    const result = parseEdited((b) => {
      const categories = b.categories as Array<Record<string, unknown>>;
      categories.push({ ...first(categories), id: 'another-food', name: '  FOOD ' });
    });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('damaged or was edited') });
  });

  it('parseBackup_ControlAndBidiChars_AreStripped', () => {
    const result = parseEdited((b) => {
      firstTx(b).note = 'Jolli‮bee\u0007';
      first(b.categories as Array<Record<string, unknown>>).name = 'My ⁦  Food';
    });
    expect(result.ok && first(result.backup.transactions).note).toBe('Jollibee');
    expect(result.ok && first(result.backup.categories).name).toBe('My Food');
  });

  it('parseBackup_EmojiWithZwj_IsKept', () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
    const result = parseEdited(
      (b) => (first(b.categories as Array<Record<string, unknown>>).emoji = family),
    );
    expect(result.ok && first(result.backup.categories).emoji).toBe(family);
  });

  it('parseBackup_UnknownCurrency_FallsBackToDefault', () => {
    const result = parseEdited((b) => (b.currency = 'XYZ'));
    expect(result.ok && result.backup.currency).toBe('PHP');
  });

  it('parseBackup_Version1File_PutsEveryEntryInCash', () => {
    // Exactly what slices 4–6 wrote: no wallets, no walletId.
    const v1 = JSON.parse(serializeBackup(validBackup())) as Record<string, unknown>;
    v1.version = 1;
    delete v1.wallets;
    delete firstTx(v1).walletId;

    const result = parseBackup(JSON.stringify(v1));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.wallets).toEqual([defaultWallet]);
    expect(first(result.backup.transactions).walletId).toBe(CASH_WALLET_ID);
  });

  it('parseBackup_UnknownWalletColor_FallsBackToGray', () => {
    const result = parseEdited(
      (b) => (first(b.wallets as Array<Record<string, unknown>>).color = 'red'),
    );
    expect(result.ok && first(result.backup.wallets).color).toBe('gray');
  });

  it('parseBackup_NegativeStartingBalance_Kept', () => {
    const result = parseEdited(
      (b) => (first(b.wallets as Array<Record<string, unknown>>).startingBalanceMinor = -300_000),
    );
    expect(result.ok && first(result.backup.wallets).startingBalanceMinor).toBe(-300_000);
  });

  it('parseBackup_ScriptInNote_IsKeptAsPlainText', () => {
    // React escapes text, so this is harmless data; the parser must not choke on it.
    const result = parseEdited((b) => (firstTx(b).note = '<img src=x onerror=alert(1)>'));
    expect(result.ok && result.backup.transactions[0]?.note).toBe('<img src=x onerror=alert(1)>');
  });
});
