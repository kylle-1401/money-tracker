import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.tsx';
import { db } from '../../db/db.ts';
import { CASH_WALLET_ID } from '../../db/seed.ts';
import { currentMonthKey } from '../../lib/dates.ts';
import { addWallet } from '../wallets/walletRepository.ts';
import { addTransaction } from './transactionRepository.ts';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const today = `${currentMonthKey()}-01`;

function addGcash() {
  return addWallet({ name: 'GCash', emoji: '📱', color: 'blue', startingBalanceMinor: 0 });
}

function addTransfer(toWalletId: string, feeMinor?: number) {
  return addTransaction({
    type: 'transfer',
    amountMinor: 100_000,
    categoryId: '',
    walletId: CASH_WALLET_ID,
    toWalletId,
    feeMinor,
    date: today,
    note: '',
  });
}

describe('Transfer in the entry form', () => {
  it('AddTransfer_WithFee_SavesAndShowsFromToRow', async () => {
    const gcash = await addGcash();
    const user = userEvent.setup();
    renderAt('/transactions/new');

    await user.click(await screen.findByRole('radio', { name: '⇄ Transfer' }));
    expect(screen.queryByRole('group', { name: 'Category' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Amount'), '1000');
    const from = screen.getByRole('group', { name: 'From' });
    expect(within(from).getByRole('radio', { name: 'Cash' })).toBeChecked();
    const to = screen.getByRole('group', { name: 'To' });
    // The "from" wallet isn't offered as a destination.
    expect(within(to).queryByRole('radio', { name: 'Cash' })).not.toBeInTheDocument();
    await user.click(within(to).getByRole('radio', { name: 'GCash' }));
    await user.type(screen.getByLabelText(/Fee/), '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const day = await screen.findByRole('region', { name: /./ });
    expect(within(day).getByText('💵 Cash → 📱 GCash')).toBeInTheDocument();
    expect(within(day).getByText('Fee ₱15.00')).toBeInTheDocument();
    expect(within(day).getByText('₱1,000.00')).toBeInTheDocument(); // unsigned
    expect(within(day).getByText('−₱15.00')).toBeInTheDocument(); // day total: only the fee

    expect(await db.transactions.toArray()).toEqual([
      expect.objectContaining({
        type: 'transfer',
        amountMinor: 100_000,
        walletId: CASH_WALLET_ID,
        toWalletId: gcash,
        feeMinor: 1_500,
        categoryId: '',
      }),
    ]);
  });

  it('AddTransfer_FeeStartsAtZeroEvenAfterAPaidTransfer', async () => {
    // Owner request: the fee defaults to 0 and is never carried over from a previous
    // transfer. Empty field (placeholder 0.00) = no fee.
    const gcash = await addGcash();
    await addTransfer(gcash, 1_500);
    const user = userEvent.setup();
    renderAt('/transactions/new');

    await user.click(await screen.findByRole('radio', { name: '⇄ Transfer' }));
    const fee = screen.getByLabelText(/Fee/);
    expect(fee).toHaveValue('');
    expect(fee).toHaveAttribute('placeholder', '0.00');

    await user.type(screen.getByLabelText('Amount'), '200');
    await user.click(
      within(screen.getByRole('group', { name: 'To' })).getByRole('radio', { name: 'GCash' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('heading', { level: 1, name: 'Transactions' });
    const saved = (await db.transactions.toArray()).find((t) => t.amountMinor === 20_000);
    expect(saved).toBeDefined();
    expect(saved).not.toHaveProperty('feeMinor');
  });

  it('AddTransfer_NoDestination_ShowsErrorAndSavesNothing', async () => {
    await addGcash();
    const user = userEvent.setup();
    renderAt('/transactions/new');

    await user.click(await screen.findByRole('radio', { name: '⇄ Transfer' }));
    await user.type(screen.getByLabelText('Amount'), '100');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Pick where the money goes.')).toBeInTheDocument();
    expect(await db.transactions.count()).toBe(0);
  });

  it('AddTransfer_BadFee_ShowsError', async () => {
    await addGcash();
    const user = userEvent.setup();
    renderAt('/transactions/new');

    await user.click(await screen.findByRole('radio', { name: '⇄ Transfer' }));
    await user.type(screen.getByLabelText('Amount'), '100');
    await user.click(
      within(screen.getByRole('group', { name: 'To' })).getByRole('radio', { name: 'GCash' }),
    );
    await user.type(screen.getByLabelText(/Fee/), '1.234');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Enter a fee up to 2 decimals/)).toBeInTheDocument();
    expect(await db.transactions.count()).toBe(0);
  });

  it('AddTransfer_FromChangedToTheChosenDestination_ClearsDestination', async () => {
    await addGcash();
    const user = userEvent.setup();
    renderAt('/transactions/new');

    await user.click(await screen.findByRole('radio', { name: '⇄ Transfer' }));
    await user.click(
      within(screen.getByRole('group', { name: 'To' })).getByRole('radio', { name: 'GCash' }),
    );
    await user.click(
      within(screen.getByRole('group', { name: 'From' })).getByRole('radio', { name: 'GCash' }),
    );

    const to = screen.getByRole('group', { name: 'To' });
    expect(within(to).getByRole('radio', { name: 'Cash' })).not.toBeChecked();
    expect(within(to).queryByRole('radio', { name: 'GCash' })).not.toBeInTheDocument();
  });

  it('Transfer_OnlyOneWallet_ExplainsAndLinksToAddWallet', async () => {
    const user = userEvent.setup();
    renderAt('/transactions/new');

    await user.click(await screen.findByRole('radio', { name: '⇄ Transfer' }));

    expect(screen.getByText(/You need a second wallet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a wallet' })).toHaveAttribute(
      'href',
      '/settings/wallets/new',
    );
  });

  it('EditTransfer_ChangeToExpense_SavesAsExpense', async () => {
    const gcash = await addGcash();
    const id = await addTransfer(gcash, 1_500);
    const user = userEvent.setup();
    renderAt(`/transactions/${id}`);

    expect(await screen.findByRole('radio', { name: '⇄ Transfer' })).toBeChecked();
    expect(screen.getByLabelText(/Fee/)).toHaveValue('15.00');
    await user.click(screen.getByRole('radio', { name: '− Expense' }));
    await user.click(await screen.findByRole('radio', { name: /Food/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('heading', { level: 1, name: 'Transactions' });
    const saved = await db.transactions.get(id);
    expect(saved).toMatchObject({ type: 'expense', categoryId: 'expense-food' });
    expect(saved).not.toHaveProperty('toWalletId');
  });
});

describe('Transfers on Home and in the List', () => {
  it('Home_Transfer_MovesBalancesAndOnlyFeeIsSpending', async () => {
    const gcash = await addGcash();
    await addTransfer(gcash, 1_500);
    renderAt('/');

    const cards = await screen.findByRole('region', { name: 'Wallets' });
    expect(within(cards).getByRole('link', { name: /^Cash.*−₱1,015\.00/ })).toBeInTheDocument();
    expect(within(cards).getByRole('link', { name: /GCash.*₱1,000\.00/ })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Total balance' })).getByText('−₱15.00'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Money in' })).getByText('+₱0.00'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Money out' })).getByText('−₱15.00'),
    ).toBeInTheDocument();
    const where = screen.getByRole('region', { name: 'Where your money went' });
    expect(within(where).getByText(/Transfer fees/)).toBeInTheDocument();
  });

  it('List_FilterByWallet_ShowsItsEntriesAndItsDayTotal', async () => {
    const gcash = await addGcash();
    await addTransfer(gcash, 1_500);
    await addTransaction({
      type: 'expense',
      amountMinor: 2_000,
      categoryId: 'expense-food',
      walletId: CASH_WALLET_ID,
      date: today,
      note: 'Lunch',
    });
    const user = userEvent.setup();
    renderAt('/transactions');

    const filters = await screen.findByRole('group', { name: 'Filter by wallet' });
    expect(within(filters).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(filters).getByRole('button', { name: /GCash/ }));

    // Only the transfer touches GCash, and for GCash it's +₱1,000.
    expect(screen.queryByText(/Lunch/)).not.toBeInTheDocument();
    expect(screen.getByText('💵 Cash → 📱 GCash')).toBeInTheDocument();
    expect(screen.getByText('+₱1,000.00')).toBeInTheDocument();
  });

  it('List_UnknownWalletInUrl_ShowsEverything', async () => {
    const gcash = await addGcash();
    await addTransfer(gcash);
    renderAt('/transactions?wallet=deleted-wallet');

    expect(await screen.findByText('💵 Cash → 📱 GCash')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Filter by wallet' })).getByRole('button', {
        name: 'All',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
