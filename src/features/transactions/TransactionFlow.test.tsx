import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.tsx';
import { db } from '../../db/db.ts';
import { toLocalDateString } from '../../lib/dates.ts';
import { addTransaction } from './transactionRepository.ts';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const today = toLocalDateString(new Date());

describe('Add transaction', () => {
  it('AddFlow_ValidExpense_SavesAndShowsInList', async () => {
    const user = userEvent.setup();
    renderAt('/transactions');

    await user.click(screen.getByRole('link', { name: 'Add transaction' }));
    expect(screen.getByRole('heading', { name: 'New transaction' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Amount'), '245.50');
    await user.click(await screen.findByRole('radio', { name: /Food/ }));
    await user.type(screen.getByLabelText(/Note/), 'Jollibee');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Back on the list, under "Today"
    const todayGroup = await screen.findByRole('region', { name: 'Today' });
    expect(within(todayGroup).getByText('Food')).toBeInTheDocument();
    expect(within(todayGroup).getByText('Jollibee')).toBeInTheDocument();
    expect(within(todayGroup).getAllByText('−₱245.50').length).toBeGreaterThan(0);

    const saved = await db.transactions.toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      type: 'expense',
      amountMinor: 24550,
      categoryId: 'expense-food',
    });
  });

  it('AddFlow_Income_ShowsIncomeCategoriesAndPlusSign', async () => {
    const user = userEvent.setup();
    renderAt('/transactions');

    await user.click(screen.getByRole('link', { name: 'Add transaction' }));
    await user.click(screen.getByRole('radio', { name: '+ Income' }));
    expect(await screen.findByRole('radio', { name: /Salary/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Food/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Amount'), '25000');
    await user.click(screen.getByRole('radio', { name: /Salary/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Shown on the row and as the day's net total.
    const todayGroup = await screen.findByRole('region', { name: 'Today' });
    expect(within(todayGroup).getByText('Salary')).toBeInTheDocument();
    expect(within(todayGroup).getAllByText('+₱25,000.00')).toHaveLength(2);
  });

  it('AddFlow_EmptyForm_ShowsErrorsAndSavesNothing', async () => {
    const user = userEvent.setup();
    renderAt('/transactions/new');
    await screen.findByRole('radio', { name: /Food/ });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Enter an amount above 0, up to 2 decimals.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Pick a category.')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true');
    expect(await db.transactions.count()).toBe(0);
  });

  it('AddFlow_ThreeDecimals_RejectsAmount', async () => {
    const user = userEvent.setup();
    renderAt('/transactions/new');

    await user.type(screen.getByLabelText('Amount'), '1.234');
    await user.click(await screen.findByRole('radio', { name: /Food/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Enter an amount above 0, up to 2 decimals.'),
    ).toBeInTheDocument();
    expect(await db.transactions.count()).toBe(0);
  });

  it('AddFlow_SwitchType_ClearsCategoryPick', async () => {
    const user = userEvent.setup();
    renderAt('/transactions/new');

    await user.type(screen.getByLabelText('Amount'), '100');
    await user.click(await screen.findByRole('radio', { name: /Food/ }));
    await user.click(screen.getByRole('radio', { name: '+ Income' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Pick a category.')).toBeInTheDocument();
  });

  it('AddFlow_DefaultsToExpenseAndToday', async () => {
    renderAt('/transactions/new');

    expect(screen.getByRole('radio', { name: '− Expense' })).toBeChecked();
    expect(screen.getByLabelText('Date')).toHaveValue(today);
  });

  it('AddFlow_Cancel_SavesNothingAndGoesBack', async () => {
    const user = userEvent.setup();
    renderAt('/transactions');

    await user.click(screen.getByRole('link', { name: 'Add transaction' }));
    await user.type(screen.getByLabelText('Amount'), '99');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Transactions' }),
    ).toBeInTheDocument();
    expect(await db.transactions.count()).toBe(0);
  });
});

describe('Edit and delete transaction', () => {
  it('EditFlow_ChangeAmount_UpdatesList', async () => {
    const id = await addTransaction({
      type: 'expense',
      amountMinor: 5000,
      categoryId: 'expense-transport',
      date: today,
      note: 'Jeep',
    });
    const user = userEvent.setup();
    renderAt('/transactions');

    await user.click(await screen.findByRole('link', { name: /Transport/ }));
    const amount = await screen.findByLabelText('Amount');
    expect(amount).toHaveValue('50.00');

    await user.clear(amount);
    await user.type(amount, '65');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findAllByText('−₱65.00')).not.toHaveLength(0);
    expect((await db.transactions.get(id))?.amountMinor).toBe(6500);
  });

  it('DeleteFlow_Confirmed_RemovesTransaction', async () => {
    const id = await addTransaction({
      type: 'expense',
      amountMinor: 5000,
      categoryId: 'expense-transport',
      date: today,
      note: '',
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAt('/transactions');

    await user.click(await screen.findByRole('link', { name: /Transport/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete transaction' }));

    expect(confirm).toHaveBeenCalled();
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    expect(await db.transactions.get(id)).toBeUndefined();
    confirm.mockRestore();
  });

  it('DeleteFlow_Declined_KeepsTransaction', async () => {
    const id = await addTransaction({
      type: 'expense',
      amountMinor: 5000,
      categoryId: 'expense-transport',
      date: today,
      note: '',
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderAt(`/transactions/${id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete transaction' }));

    expect(screen.getByRole('heading', { name: 'Edit transaction' })).toBeInTheDocument();
    expect(await db.transactions.get(id)).toBeDefined();
    confirm.mockRestore();
  });

  it('EditFlow_UnknownId_ShowsNotFound', async () => {
    renderAt('/transactions/does-not-exist');

    expect(await screen.findByText('Transaction not found')).toBeInTheDocument();
  });
});

describe('Transactions list', () => {
  it('List_NewUser_ShowsEmptyState', async () => {
    renderAt('/transactions');

    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
  });

  it('List_SeveralDays_GroupsNewestFirst', async () => {
    await addTransaction({
      type: 'expense',
      amountMinor: 100,
      categoryId: 'expense-food',
      date: '2025-01-02',
      note: '',
    });
    await addTransaction({
      type: 'expense',
      amountMinor: 100,
      categoryId: 'expense-food',
      date: today,
      note: '',
    });
    renderAt('/transactions');

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Today', 'Thu, Jan 2, 2025']);
  });
});
