import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.tsx';
import EmptyState from '../../components/EmptyState.tsx';
import AmountText from '../../components/AmountText.tsx';
import { addMonths, currentMonthKey, monthLabel, type MonthKey } from '../../lib/dates.ts';
import { formatMinor } from '../../lib/money.ts';
import { useCategoryMap, useTransactions } from '../transactions/hooks.ts';
import TransactionRow from '../transactions/TransactionRow.tsx';
import SpendingBars from './SpendingBars.tsx';
import { balanceMinor, monthTotals, spendingByCategory } from './summary.ts';
import styles from './DashboardPage.module.css';

const MONTH_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/;
const RECENT_COUNT = 5;

/**
 * Home tab: all-time balance, money in/out for the selected month, where the month's
 * money went, and the latest entries. The month lives in the URL (?month=2026-11)
 * so Back returns to the month you were looking at.
 */
export default function DashboardPage() {
  const transactions = useTransactions();
  const categories = useCategoryMap();
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
  if (transactions === undefined || categories === undefined) {
    body = (
      <p className={styles.muted} role="status">
        Loading…
      </p>
    );
  } else if (transactions.length === 0) {
    body = (
      <EmptyState title="No money tracked yet">
        Tap the + button to add your first income or expense. Your balance and where your money goes
        will show up here.
      </EmptyState>
    );
  } else {
    const balance = balanceMinor(transactions);
    const totals = monthTotals(transactions, month);
    const net = totals.incomeMinor - totals.expenseMinor;
    const spending = spendingByCategory(transactions, month, categories);
    const recent = transactions.slice(0, RECENT_COUNT);
    const label = monthLabel(month);

    body = (
      <>
        <section className={styles.balanceCard} aria-labelledby="balance-label">
          <h2 id="balance-label" className={styles.cardLabel}>
            Balance
          </h2>
          <p className={styles.balance}>
            {balance < 0 && '−'}
            {formatMinor(Math.abs(balance))}
          </p>
          <p className={styles.muted}>All time</p>
        </section>

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
          <strong>{formatMinor(Math.abs(net))}</strong> in {label}
        </p>

        <section className={styles.card} aria-labelledby="where-label">
          <h2 id="where-label" className={styles.sectionTitle}>
            Where your money went
          </h2>
          {spending.length === 0 ? (
            <p className={styles.muted}>No spending in {label}.</p>
          ) : (
            <SpendingBars rows={spending} />
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
                <TransactionRow transaction={tx} category={categories.get(tx.categoryId)} />
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Home" />
      <div className={styles.stack}>{body}</div>
    </>
  );
}
