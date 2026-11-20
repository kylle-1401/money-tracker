import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.tsx';
import { db } from '../../db/db.ts';
import { CASH_WALLET_ID } from '../../db/seed.ts';
import { currentMonthKey, monthLabel } from '../../lib/dates.ts';
import { addTransaction } from '../transactions/transactionRepository.ts';
import { setCategoryBudget } from '../settings/categoryRepository.ts';
import { getMonthlyBudget, setMonthlyBudget } from './budgetRepository.ts';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const thisMonth = currentMonthKey();
const monthName = monthLabel(thisMonth).split(' ')[0] ?? '';

function spend(amountMinor: number, categoryId = 'expense-food') {
  return addTransaction({
    type: 'expense',
    amountMinor,
    categoryId,
    walletId: CASH_WALLET_ID,
    date: `${thisMonth}-01`,
    note: '',
  });
}

/** Adds an expense through the real form (so the budget check runs). */
async function addExpenseInForm(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await user.click(await screen.findByRole('link', { name: 'Add transaction' }));
  await user.type(await screen.findByLabelText('Amount'), amount);
  await user.click(await screen.findByRole('radio', { name: /Food/ }));
  await user.click(screen.getByRole('button', { name: 'Save' }));
}

describe('Budget in Settings', () => {
  it('SetMonthlyBudget_SavesAndCanBeRemoved', async () => {
    const user = userEvent.setup();
    renderAt('/settings');

    const section = await screen.findByRole('region', { name: 'Monthly budget' });
    const field = await within(section).findByLabelText('Per month');
    await user.type(field, '12,000');
    await user.click(within(section).getByRole('button', { name: 'Save' }));

    expect(await within(section).findByText('Budget saved.')).toBeInTheDocument();
    expect(await getMonthlyBudget()).toBe(1_200_000);

    const again = await within(section).findByLabelText('Per month');
    await user.clear(again);
    await user.click(within(section).getByRole('button', { name: 'Save' }));
    expect(await within(section).findByText('Budget removed.')).toBeInTheDocument();
    expect(await getMonthlyBudget()).toBeNull();
  });

  it('SetMonthlyBudget_BadAmount_ShowsError', async () => {
    const user = userEvent.setup();
    renderAt('/settings');

    const section = await screen.findByRole('region', { name: 'Monthly budget' });
    await user.type(await within(section).findByLabelText('Per month'), '1.234');
    await user.click(within(section).getByRole('button', { name: 'Save' }));

    expect(await within(section).findByRole('alert')).toHaveTextContent('up to 2 decimals');
    expect(await getMonthlyBudget()).toBeNull();
  });

  it('CategoryBudget_OnExpenseCategory_SavesAndShowsInList', async () => {
    const user = userEvent.setup();
    renderAt('/settings/categories/expense-food');

    await user.type(await screen.findByLabelText(/Monthly budget/), '6000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expect((await db.categories.get('expense-food'))?.budgetMinor).toBe(600_000);
    expect(await screen.findByText('₱6,000.00/mo')).toBeInTheDocument();
  });

  it('CategoryBudget_IncomeCategory_HasNoBudgetField', async () => {
    renderAt('/settings/categories/income-salary');

    await screen.findByLabelText('Name');
    expect(screen.queryByLabelText(/Monthly budget/)).not.toBeInTheDocument();
  });
});

describe('Budget on Home', () => {
  it('Home_NoBudget_OffersToSetOne', async () => {
    await spend(1_000);
    renderAt('/');

    expect(await screen.findByRole('link', { name: 'Set a monthly budget' })).toHaveAttribute(
      'href',
      '/settings?focus=budget',
    );
  });

  it('Home_UnderEighty_ShowsAmountLeft', async () => {
    await setMonthlyBudget(1_200_000);
    await spend(500_000);
    renderAt('/');

    const meter = await screen.findByRole('region', { name: 'Budget' });
    expect(meter).toHaveTextContent('₱5,000.00 of ₱12,000.00');
    expect(meter).toHaveTextContent('₱7,000.00 left');
  });

  it('Home_PastEighty_WarnsWithPercent', async () => {
    await setMonthlyBudget(1_000_000);
    await spend(850_000);
    renderAt('/');

    expect(await screen.findByRole('region', { name: 'Budget' })).toHaveTextContent(
      '⚠️ 85% used · ₱1,500.00 left',
    );
  });

  it('Home_Over_SaysByHowMuch', async () => {
    await setMonthlyBudget(1_000_000);
    await spend(1_115_000);
    renderAt('/');

    expect(await screen.findByRole('region', { name: 'Budget' })).toHaveTextContent(
      'Over budget by ₱1,150.00',
    );
  });

  it('Home_CategoryBudget_ShowsUsageUnderItsBar', async () => {
    await setCategoryBudget('expense-food', 600_000);
    await spend(660_000);
    renderAt('/');

    const where = await screen.findByRole('region', { name: 'Where your money went' });
    expect(within(where).getByText('‼️ 110% of ₱6,000.00 budget')).toBeInTheDocument();
  });
});

describe('Budget alert after saving', () => {
  it('Alert_CrossingEighty_ShowsOnceAndDismisses', async () => {
    await setMonthlyBudget(1_000_000);
    await spend(700_000);
    const user = userEvent.setup();
    renderAt('/transactions');

    await addExpenseInForm(user, '1000'); // 7,000 → 8,000 = 80%

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(`You’ve used 80% of your ${monthName} budget.`);
    await user.click(within(alert).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await addExpenseInForm(user, '100'); // still in the warning range: no repeat
    await screen.findByRole('heading', { level: 1, name: 'Transactions' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Alert_GoingOver_SaysByHowMuch', async () => {
    await setMonthlyBudget(1_000_000);
    await spend(900_000);
    const user = userEvent.setup();
    renderAt('/transactions');

    await addExpenseInForm(user, '1350');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      `You’re ₱350.00 over your ${monthName} budget.`,
    );
  });

  it('Alert_StartingTheNextEntry_ClearsIt', async () => {
    await setMonthlyBudget(1_000_000);
    await spend(700_000);
    const user = userEvent.setup();
    renderAt('/transactions');

    await addExpenseInForm(user, '1000');
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(await screen.findByRole('link', { name: 'Add transaction' }));
    await screen.findByLabelText('Amount');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Alert_NoBudget_NoAlert', async () => {
    const user = userEvent.setup();
    renderAt('/transactions');

    await addExpenseInForm(user, '99999');

    await screen.findByRole('heading', { level: 1, name: 'Transactions' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
