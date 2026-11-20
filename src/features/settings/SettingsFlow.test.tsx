import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.tsx';
import { db } from '../../db/db.ts';
import { toLocalDateString } from '../../lib/dates.ts';
import { addTransaction } from '../transactions/transactionRepository.ts';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const today = toLocalDateString(new Date());

describe('Currency', () => {
  it('Currency_Change_UpdatesAmountsEverywhereWithoutConverting', async () => {
    await addTransaction({
      type: 'expense',
      amountMinor: 24550,
      categoryId: 'expense-food',
      walletId: 'wallet-cash',
      date: today,
      note: '',
    });
    const user = userEvent.setup();
    renderAt('/settings');

    const select = await screen.findByLabelText('Show amounts in');
    expect(select).toHaveValue('PHP');
    await user.selectOptions(select, 'USD');
    expect(await screen.findByDisplayValue('USD – US dollar')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'List' }));
    // Same number, new symbol: display only, no conversion
    expect((await screen.findAllByText('−$245.50')).length).toBeGreaterThan(0);
    expect(screen.queryByText('−₱245.50')).not.toBeInTheDocument();

    expect(await db.settings.get('currency')).toEqual({ key: 'currency', value: 'USD' });
  });
});

describe('Categories', () => {
  it('Settings_ListsSeededCategoriesByType', async () => {
    renderAt('/settings');

    const expense = await screen.findByRole('region', { name: 'Expense categories' });
    const income = screen.getByRole('region', { name: 'Income categories' });
    expect(await within(expense).findByRole('link', { name: /Food/ })).toBeInTheDocument();
    expect(await within(income).findByRole('link', { name: /Salary/ })).toBeInTheDocument();
    expect(within(income).queryByRole('link', { name: /Food/ })).not.toBeInTheDocument();
  });

  it('AddCategory_PickEmoji_ShowsInSettingsAndTransactionForm', async () => {
    const user = userEvent.setup();
    renderAt('/settings');

    const expense = await screen.findByRole('region', { name: 'Expense categories' });
    await user.click(await within(expense).findByRole('link', { name: '+ Add expense category' }));
    expect(screen.getByRole('heading', { name: 'New expense category' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Use 🐶' }));
    expect(screen.getByRole('button', { name: 'Use 🐶' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    const updated = await screen.findByRole('region', { name: 'Expense categories' });
    expect(await within(updated).findByRole('link', { name: /Pets/ })).toBeInTheDocument();

    // And it can be picked when adding an expense
    await user.click(screen.getByRole('link', { name: 'Home' }));
    await user.click(screen.getByRole('link', { name: 'Add transaction' }));
    expect(await screen.findByRole('radio', { name: /Pets/ })).toBeInTheDocument();
  });

  it('AddCategory_Empty_ShowsErrors', async () => {
    const user = userEvent.setup();
    renderAt('/settings/categories/new?type=income');

    expect(screen.getByRole('heading', { name: 'New income category' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('Enter a name.')).toBeInTheDocument();
    expect(screen.getByText('Pick an icon.')).toBeInTheDocument();
  });

  it('AddCategory_DuplicateName_ShowsErrorAndSavesNothing', async () => {
    const user = userEvent.setup();
    renderAt('/settings/categories/new?type=expense');
    const before = await db.categories.count();

    await user.type(screen.getByLabelText('Name'), 'food');
    await user.click(screen.getByRole('button', { name: 'Use 🍔' }));
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(
      await screen.findByText('You already have a category called "food".'),
    ).toBeInTheDocument();
    expect(await db.categories.count()).toBe(before);
  });

  it('EditCategory_Rename_UpdatesPastTransactions', async () => {
    await addTransaction({
      type: 'expense',
      amountMinor: 100,
      categoryId: 'expense-food',
      walletId: 'wallet-cash',
      date: today,
      note: '',
    });
    const user = userEvent.setup();
    renderAt('/settings/categories/expense-food');

    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Food');
    await user.clear(name);
    await user.type(name, 'Food & Drinks');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('link', { name: /Food & Drinks/ })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'List' }));
    expect(await screen.findByText('Food & Drinks')).toBeInTheDocument();
  });

  it('EditCategory_Used_CannotDeleteButCanArchive', async () => {
    await addTransaction({
      type: 'expense',
      amountMinor: 100,
      categoryId: 'expense-food',
      walletId: 'wallet-cash',
      date: today,
      note: '',
    });
    const user = userEvent.setup();
    renderAt('/settings/categories/expense-food');

    expect(
      await screen.findByText(/Used by 1 transaction, so it can’t be deleted/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete category' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Archive category' }));

    const expense = await screen.findByRole('region', { name: 'Expense categories' });
    expect(
      await within(expense).findByRole('link', { name: /Food.*Archived/ }),
    ).toBeInTheDocument();
    expect((await db.categories.get('expense-food'))?.archived).toBe(true);
  });

  it('ArchivedCategory_HiddenFromPickerButKeptOnOldEntries', async () => {
    await addTransaction({
      type: 'expense',
      amountMinor: 100,
      categoryId: 'expense-food',
      walletId: 'wallet-cash',
      date: today,
      note: '',
    });
    await db.categories.update('expense-food', { archived: true });
    const user = userEvent.setup();
    renderAt('/transactions');

    expect(await screen.findByText('Food')).toBeInTheDocument(); // old entry still named
    await user.click(screen.getByRole('link', { name: 'Add transaction' }));
    await screen.findByRole('radio', { name: /Transport/ });
    expect(screen.queryByRole('radio', { name: /Food/ })).not.toBeInTheDocument();
  });

  it('ArchivedCategory_Restore_ShowsInPickerAgain', async () => {
    await db.categories.update('expense-food', { archived: true });
    const user = userEvent.setup();
    renderAt('/settings/categories/expense-food');

    await user.click(await screen.findByRole('button', { name: 'Restore category' }));

    await screen.findByRole('region', { name: 'Expense categories' });
    expect((await db.categories.get('expense-food'))?.archived).toBe(false);
  });

  it('EditCategory_Unused_DeleteAfterConfirm', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAt('/settings/categories/expense-health');

    await user.click(await screen.findByRole('button', { name: 'Delete category' }));

    expect(confirm).toHaveBeenCalledWith('Delete "Health"? This cannot be undone.');
    await screen.findByRole('region', { name: 'Expense categories' });
    expect(await db.categories.get('expense-health')).toBeUndefined();
    confirm.mockRestore();
  });

  it('EditCategory_UnknownId_ShowsNotFound', async () => {
    renderAt('/settings/categories/nope');

    expect(await screen.findByText('Category not found')).toBeInTheDocument();
  });
});
