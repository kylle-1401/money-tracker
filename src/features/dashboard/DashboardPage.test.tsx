import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.tsx';
import { addMonths, currentMonthKey, monthLabel } from '../../lib/dates.ts';
import { addTransaction, type TransactionInput } from '../transactions/transactionRepository.ts';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

// Dates relative to the real current month, so the tests pass whenever they run.
const thisMonth = currentMonthKey();
const lastMonth = addMonths(thisMonth, -1);

function add(overrides: Partial<TransactionInput>) {
  return addTransaction({
    type: 'expense',
    amountMinor: 100,
    categoryId: 'expense-food',
    date: `${thisMonth}-01`,
    note: '',
    ...overrides,
  });
}

async function seed() {
  await add({
    type: 'income',
    amountMinor: 2_500_000,
    categoryId: 'income-salary',
    date: `${lastMonth}-15`,
  });
  await add({ amountMinor: 50_000, categoryId: 'expense-transport', date: `${lastMonth}-20` });
  await add({ type: 'income', amountMinor: 1_000_000, categoryId: 'income-salary' });
  await add({ amountMinor: 300_000, categoryId: 'expense-bills-utilities' });
  await add({ amountMinor: 100_000, categoryId: 'expense-food', note: 'Groceries' });
}

describe('Dashboard', () => {
  it('Dashboard_NewUser_ShowsEmptyState', async () => {
    renderAt('/');

    expect(await screen.findByText('No money tracked yet')).toBeInTheDocument();
  });

  it('Dashboard_WithData_ShowsAllTimeBalance', async () => {
    await seed();
    renderAt('/');

    // 25,000 - 500 + 10,000 - 3,000 - 1,000 = 30,500
    const balance = await screen.findByRole('region', { name: 'Balance' });
    expect(within(balance).getByText('₱30,500.00')).toBeInTheDocument();
  });

  it('Dashboard_ThisMonth_ShowsInOutAndNet', async () => {
    await seed();
    renderAt('/');

    expect(await screen.findByText(monthLabel(thisMonth))).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Money in' })).getByText('+₱10,000.00'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Money out' })).getByText('−₱4,000.00'),
    ).toBeInTheDocument();
    expect(screen.getByText('₱6,000.00')).toBeInTheDocument(); // Saved ₱6,000.00
  });

  it('Dashboard_ThisMonth_RanksSpendingWithPercent', async () => {
    await seed();
    renderAt('/');

    const where = await screen.findByRole('region', { name: 'Where your money went' });
    const rows = within(where).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Bills & Utilities₱3,000.0075%');
    expect(rows[1]).toHaveTextContent('Food₱1,000.0025%');
  });

  it('Dashboard_PreviousMonth_ShowsThatMonthsNumbers', async () => {
    await seed();
    const user = userEvent.setup();
    renderAt('/');

    await user.click(await screen.findByRole('button', { name: 'Previous month' }));

    expect(screen.getByText(monthLabel(lastMonth))).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Money in' })).getByText('+₱25,000.00'),
    ).toBeInTheDocument();
    const where = screen.getByRole('region', { name: 'Where your money went' });
    expect(within(where).getAllByRole('listitem')).toHaveLength(1);
    expect(within(where).getByText(/Transport/)).toBeInTheDocument();
    // Balance stays all-time
    expect(
      within(screen.getByRole('region', { name: 'Balance' })).getByText('₱30,500.00'),
    ).toBeInTheDocument();
  });

  it('Dashboard_CurrentMonth_NextIsDisabled', async () => {
    await seed();
    renderAt('/');

    expect(await screen.findByRole('button', { name: 'Next month' })).toBeDisabled();
  });

  it('Dashboard_MonthWithoutSpending_SaysSo', async () => {
    await seed();
    renderAt(`/?month=${addMonths(thisMonth, -6)}`);

    expect(
      await screen.findByText(`No spending in ${monthLabel(addMonths(thisMonth, -6))}.`),
    ).toBeInTheDocument();
  });

  it('Dashboard_FutureMonthInUrl_FallsBackToThisMonth', async () => {
    await seed();
    renderAt(`/?month=${addMonths(thisMonth, 3)}`);

    expect(await screen.findByText(monthLabel(thisMonth))).toBeInTheDocument();
  });

  it('Dashboard_Overspent_SaysOverspent', async () => {
    await add({ amountMinor: 5_000 });
    renderAt('/');

    expect(await screen.findByText(/Overspent/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Balance' })).getByText('−₱50.00'),
    ).toBeInTheDocument();
  });

  it('Dashboard_Recent_ShowsLatestFiveAndLinksToList', async () => {
    for (let day = 1; day <= 7; day += 1) {
      await add({ date: `${thisMonth}-0${day}`, note: `Day ${day}` });
    }
    const user = userEvent.setup();
    renderAt('/');

    const recent = await screen.findByRole('region', { name: 'Recent' });
    const items = within(recent).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent('Day 7');

    await user.click(within(recent).getByRole('link', { name: 'See all' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Transactions' })).toBeInTheDocument();
  });
});
