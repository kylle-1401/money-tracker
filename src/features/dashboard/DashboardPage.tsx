import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.tsx';
import EmptyState from '../../components/EmptyState.tsx';
import AmountText from '../../components/AmountText.tsx';
import { addMonths, currentMonthKey, monthLabel, type MonthKey } from '../../lib/dates.ts';
import { formatMinor } from '../../lib/money.ts';
import type { Category, Transaction, Wallet } from '../../db/types.ts';
import { useCategoryMap, useTransactions } from '../transactions/hooks.ts';
import { useCurrency } from '../settings/currencyContext.ts';
import TransactionRow from '../transactions/TransactionRow.tsx';
import SpendingBars from './SpendingBars.tsx';
import BackupReminder from '../backup/BackupReminder.tsx';
import InstallHint from '../pwa/InstallHint.tsx';
import { monthTotals, spendingByCategory, totalBalanceMinor, walletBalances } from './summary.ts';
import { toWalletMap, useWallets } from '../wallets/hooks.ts';
import WalletCards from '../wallets/WalletCards.tsx';
import { useLiveQuery } from 'dexie-react-hooks';
import BudgetMeter from '../budget/BudgetMeter.tsx';
import { getMonthlyBudget } from '../budget/budgetRepository.ts';
import styles from './DashboardPage.module.css';

const MONTH_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/;
const RECENT_COUNT = 5;

/**
 * Home tab: total balance, wallet cards, money in/out for the selected month, where
 * the month's money went, and the latest entries. The month lives in the URL
 * (?month=2026-11) so Back returns to the month you were looking at.
 */
export default function DashboardPage() {
  const transactions = useTransactions();
  const categories = useCategoryMap();
  const wallets = useWallets();
  const currency = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();

  const thisMonth = currentMonthKey();
  const requested = searchParams.get('month');
  // Ignore malformed or future months in the URL.
  const month: MonthKey =
    requested && MONTH_PARAM.test(requested) && requested <= thisMonth ? requested : thisMonth;

  function goToMonth(next: MonthKey) {
    setSearchParams(next === thisMonth ? {} : { month: next }, { replace: true });
  }

  let body;
  if (transactions === undefined || categories === undefined || wallets === undefined) {
    body = (
      <p className={styles.muted} role="status">
        Loading…
      </p>
    );
  } else {
    const balances = walletBalances(wallets, transactions);
    const total = totalBalanceMinor(wallets, transactions);
    const activeWallets = wallets.filter((w) => !w.archived);
    const walletMap = toWalletMap(wallets);
    // Wallet names on income/expense rows only help once there's more than one wallet.
    const showWallet = wallets.length > 1;

    const overview = (
      <>
        <section className={styles.balanceCard} aria-labelledby="balance-label">
          <h2 id="balance-label" className={styles.cardLabel}>
            Total balance
          </h2>
          <p className={styles.balance}>
            {total < 0 && '−'}
            {formatMinor(Math.abs(total), currency)}
          </p>
          <p className={styles.muted}>
            {activeWallets.length > 1 ? `Across ${wallets.length} wallets` : 'All time'}
          </p>
        </section>
        <WalletCards wallets={activeWallets} balances={balances} />
      </>
    );

    if (transactions.length === 0) {
      body = (
        <>
          {overview}
          <EmptyState title="No money tracked yet">
            Tap the + button to add your first income or expense. Your balance and where your money
            goes will show up here.
          </EmptyState>
        </>
      );
    } else {
      body = (
        <>
          <BackupReminder transactions={transactions} />
          {overview}
          <MonthSection
            transactions={transactions}
            categories={categories}
            walletMap={walletMap}
            showWallet={showWallet}
            month={month}
            thisMonth={thisMonth}
            onMonthChange={goToMonth}
          />
        </>
      );
    }
  }

  return (
    <>
      <PageHeader title="Home" />
      <div className={styles.stack}>
        <InstallHint />
        {body}
      </div>
    </>
  );
}

interface MonthSectionProps {
  transactions: Transaction[];
  categories: ReadonlyMap<string, Category>;
  walletMap: ReadonlyMap<string, Wallet>;
  showWallet: boolean;
  month: MonthKey;
  thisMonth: MonthKey;
  onMonthChange: (month: MonthKey) => void;
}

/** Month switcher, money in/out, where the money went, and the latest entries. */
function MonthSection({
  transactions,
  categories,
  walletMap,
  showWallet,
  month,
  thisMonth,
  onMonthChange: goToMonth,
}: MonthSectionProps) {
  const currency = useCurrency();
  const monthlyBudget = useLiveQuery(getMonthlyBudget, []);
  const totals = monthTotals(transactions, month);
  const net = totals.incomeMinor - totals.expenseMinor;
  const spending = spendingByCategory(transactions, month, categories);
  const categoryBudgets = new Map<string, number>();
  for (const c of categories.values()) {
    if (c.type === 'expense' && c.budgetMinor) categoryBudgets.set(c.id, c.budgetMinor);
  }
  const recent = transactions.slice(0, RECENT_COUNT);
  const label = monthLabel(month);

  return (
    <>
      <nav className={styles.monthNav} aria-label="Month">
        <button
          type="button"
          className={styles.monthButton}
          aria-label="Previous month"
          onClick={() => goToMonth(addMonths(month, -1))}
        >
          ‹
        </button>
        <p className={styles.monthLabel} aria-live="polite">
          {label}
        </p>
        <button
          type="button"
          className={styles.monthButton}
          aria-label="Next month"
          disabled={month >= thisMonth}
          onClick={() => goToMonth(addMonths(month, 1))}
        >
          ›
        </button>
      </nav>

      <div className={styles.tiles}>
        <section className={styles.tile} aria-labelledby="in-label">
          <h2 id="in-label" className={styles.cardLabel}>
            Money in
          </h2>
          <AmountText amountMinor={totals.incomeMinor} type="income" />
        </section>
        <section className={styles.tile} aria-labelledby="out-label">
          <h2 id="out-label" className={styles.cardLabel}>
            Money out
          </h2>
          <AmountText amountMinor={totals.expenseMinor} type="expense" />
        </section>
      </div>
      <p className={styles.net}>
        {net >= 0 ? 'Saved ' : 'Overspent '}
        <strong>{formatMinor(Math.abs(net), currency)}</strong> in {label}
      </p>

      {/* Budget: the current budget is applied to whichever month is shown (assumption
          confirmed with the owner: no per-month budget history). Spending = Money out. */}
      {monthlyBudget ? (
        <BudgetMeter spentMinor={totals.expenseMinor} budgetMinor={monthlyBudget} />
      ) : (
        monthlyBudget === null &&
        month === thisMonth && (
          <Link to="/settings?focus=budget" className={styles.setBudget}>
            Set a monthly budget
          </Link>
        )
      )}

      <section className={styles.card} aria-labelledby="where-label">
        <h2 id="where-label" className={styles.sectionTitle}>
          Where your money went
        </h2>
        {spending.length === 0 ? (
          <p className={styles.muted}>No spending in {label}.</p>
        ) : (
          <SpendingBars rows={spending} budgets={categoryBudgets} />
        )}
      </section>

      <section aria-labelledby="recent-label">
        <div className={styles.sectionHeader}>
          <h2 id="recent-label" className={styles.sectionTitle}>
            Recent
          </h2>
          <Link to="/transactions" className={styles.seeAll}>
            See all
          </Link>
        </div>
        <ul className={styles.recentList}>
          {recent.map((tx) => (
            <li key={tx.id}>
              <TransactionRow
                transaction={tx}
                category={categories.get(tx.categoryId)}
                wallets={walletMap}
                showWallet={showWallet}
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
