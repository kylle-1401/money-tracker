import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.tsx';
import { db } from '../../db/db.ts';
import { CASH_WALLET_ID } from '../../db/seed.ts';
import { addTransaction } from '../transactions/transactionRepository.ts';
import { addWallet, setWalletArchived } from './walletRepository.ts';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const gcash = { name: 'GCash', emoji: '📱', color: 'blue' as const, startingBalanceMinor: 500_000 };

function expense(walletId: string, amountMinor: number, note = '') {
  return addTransaction({
    type: 'expense',
    amountMinor,
    categoryId: 'expense-food',
    walletId,
    date: '2026-11-20',
    note,
  });
}

describe('Wallets in Settings', () => {
  it('AddWallet_WithStartingBalance_ShowsInSettingsAndOnHome', async () => {
    const user = userEvent.setup();
    renderAt('/settings');

    const section = await screen.findByRole('region', { name: 'Wallets' });
    expect(await within(section).findByText('Cash')).toBeInTheDocument();
    await user.click(within(section).getByRole('link', { name: '+ Add wallet' }));

    expect(screen.getByRole('heading', { name: 'New wallet' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'GCash');
    await user.click(screen.getByRole('button', { name: 'Use 📱' }));
    await user.click(screen.getByRole('radio', { name: 'Purple' }));
    await user.type(screen.getByLabelText(/Starting balance/), '5,000');
    await user.click(screen.getByRole('button', { name: 'Add wallet' }));

    const list = await screen.findByRole('region', { name: 'Wallets' });
    expect(await within(list).findByText('GCash')).toBeInTheDocument();
    expect(within(list).getByText('₱5,000.00')).toBeInTheDocument();
    const saved = (await db.wallets.toArray()).find((w) => w.name === 'GCash');
    expect(saved).toMatchObject({ emoji: '📱', color: 'purple', startingBalanceMinor: 500_000 });
  });

  it('AddWallet_MoneyOwed_SavesNegativeAndShowsMinus', async () => {
    const user = userEvent.setup();
    renderAt('/settings/wallets/new');

    await user.type(await screen.findByLabelText('Name'), 'Credit card');
    await user.click(screen.getByRole('button', { name: 'Use 💳' }));
    await user.type(screen.getByLabelText(/Starting balance/), '3000');
    await user.click(screen.getByLabelText(/money I owe/));
    await user.click(screen.getByRole('button', { name: 'Add wallet' }));

    const list = await screen.findByRole('region', { name: 'Wallets' });
    expect(await within(list).findByText('−₱3,000.00')).toBeInTheDocument();
  });

  it('AddWallet_DuplicateName_ShowsErrorAndSavesNothing', async () => {
    const user = userEvent.setup();
    renderAt('/settings/wallets/new');

    await user.type(await screen.findByLabelText('Name'), ' cash ');
    await user.click(screen.getByRole('button', { name: 'Use 👛' }));
    await user.click(screen.getByRole('button', { name: 'Add wallet' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You already have a wallet called');
    expect(await db.wallets.count()).toBe(1);
  });

  it('AddWallet_BadStartingBalance_ShowsError', async () => {
    const user = userEvent.setup();
    renderAt('/settings/wallets/new');

    await user.type(await screen.findByLabelText('Name'), 'Maya');
    await user.click(screen.getByRole('button', { name: 'Use 📱' }));
    await user.type(screen.getByLabelText(/Starting balance/), '1.234');
    await user.click(screen.getByRole('button', { name: 'Add wallet' }));

    expect(await screen.findByText('Enter an amount, up to 2 decimals.')).toBeInTheDocument();
    expect(await db.wallets.count()).toBe(1);
  });

  it('EditWallet_Used_CannotDelete_OnlyActive_CannotArchive', async () => {
    await expense(CASH_WALLET_ID, 100);
    renderAt(`/settings/wallets/${CASH_WALLET_ID}`);

    expect(await screen.findByText(/Used by 1 transaction/)).toBeInTheDocument();
    expect(screen.getByText(/only active wallet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete wallet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive wallet' })).not.toBeInTheDocument();
  });

  it('EditWallet_UnusedSecondWallet_Deletes', async () => {
    const id = await addWallet(gcash);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAt(`/settings/wallets/${id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete wallet' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(await db.wallets.get(id)).toBeUndefined();
  });

  it('EditWallet_MoveEarlier_ChangesOrder', async () => {
    const id = await addWallet(gcash);
    const user = userEvent.setup();
    renderAt(`/settings/wallets/${id}`);

    await user.click(await screen.findByRole('button', { name: '↑ Move earlier' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '↑ Move earlier' })).toBeDisabled(),
    );
    expect((await db.wallets.get(id))?.sortOrder).toBe(0);
  });
});

describe('Wallets on Home and in the entry form', () => {
  it('Home_TwoWallets_ShowsCardsBalancesAndTotal', async () => {
    const id = await addWallet(gcash);
    await expense(id, 24_550, 'Lunch');
    await expense(CASH_WALLET_ID, 10_000);
    renderAt('/');

    const cards = await screen.findByRole('region', { name: 'Wallets' });
    expect(within(cards).getByRole('link', { name: /Cash.*−₱100\.00/ })).toBeInTheDocument();
    expect(within(cards).getByRole('link', { name: /GCash.*₱4,754\.50/ })).toBeInTheDocument();
    // 5,000 − 245.50 − 100 = 4,654.50
    const total = screen.getByRole('region', { name: 'Total balance' });
    expect(within(total).getByText('₱4,654.50')).toBeInTheDocument();
    // Rows name the wallet once there's more than one.
    const recent = screen.getByRole('region', { name: 'Recent' });
    expect(within(recent).getByText('📱 GCash · Lunch')).toBeInTheDocument();
  });

  it('Home_ArchivedWallet_HiddenFromCardsButCountsInTotal', async () => {
    const id = await addWallet(gcash);
    await setWalletArchived(id, true);
    renderAt('/');

    const cards = await screen.findByRole('region', { name: 'Wallets' });
    expect(within(cards).queryByText('GCash')).not.toBeInTheDocument();
    const total = screen.getByRole('region', { name: 'Total balance' });
    expect(within(total).getByText('₱5,000.00')).toBeInTheDocument();
  });

  it('AddEntry_PickWallet_SavesItAndPreselectsItNextTime', async () => {
    const id = await addWallet(gcash);
    const user = userEvent.setup();
    renderAt('/transactions/new');

    const paidFrom = await screen.findByRole('group', { name: 'Paid from' });
    expect(await within(paidFrom).findByRole('radio', { name: 'Cash' })).toBeChecked();
    await user.click(within(paidFrom).getByRole('radio', { name: 'GCash' }));
    await user.type(screen.getByLabelText('Amount'), '50');
    await user.click(await screen.findByRole('radio', { name: /Food/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('heading', { level: 1, name: 'Transactions' });
    expect(first(await db.transactions.toArray()).walletId).toBe(id);

    await user.click(screen.getByRole('link', { name: 'Add transaction' }));
    const again = await screen.findByRole('group', { name: 'Paid from' });
    expect(await within(again).findByRole('radio', { name: 'GCash' })).toBeChecked();
  });

  it('AddEntry_Income_LabelSaysReceivedIn', async () => {
    const user = userEvent.setup();
    renderAt('/transactions/new');

    await user.click(await screen.findByRole('radio', { name: '+ Income' }));

    expect(screen.getByRole('group', { name: 'Received in' })).toBeInTheDocument();
  });

  it('EditEntry_WalletArchivedLater_StillShowsAndKeepsIt', async () => {
    const id = await addWallet(gcash);
    const txId = await expense(id, 100);
    await setWalletArchived(id, true);
    const user = userEvent.setup();
    renderAt(`/transactions/${txId}`);

    const paidFrom = await screen.findByRole('group', { name: 'Paid from' });
    expect(await within(paidFrom).findByRole('radio', { name: 'GCash' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('heading', { level: 1, name: 'Transactions' });
    expect((await db.transactions.get(txId))?.walletId).toBe(id);
  });
});

function first<T>(items: T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error('expected at least one item');
  return item;
}
