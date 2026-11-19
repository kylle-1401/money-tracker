import PageHeader from '../../components/PageHeader.tsx';
import EmptyState from '../../components/EmptyState.tsx';
import TransactionRow from './TransactionRow.tsx';
import { dayLabel } from '../../lib/dates.ts';
import { formatMinor } from '../../lib/money.ts';
import { useCategoryMap, useTransactions } from './hooks.ts';
import { groupByDay } from './groupByDay.ts';
import styles from './TransactionsPage.module.css';

/** List tab: every transaction, newest first, grouped by day. Tap one to edit it. */
export default function TransactionsPage() {
  const transactions = useTransactions();
  const categories = useCategoryMap();

  let body;
  if (transactions === undefined || categories === undefined) {
    body = (
      <p className={styles.muted} role="status">
        Loading…
      </p>
    );
  } else if (transactions.length === 0) {
    body = (
      <EmptyState title="No transactions yet">
        Tap the + button to add your first income or expense.
      </EmptyState>
    );
  } else {
    body = groupByDay(transactions).map((group) => {
      const headingId = `day-${group.date}`;
      return (
        <section key={group.date} className={styles.day} aria-labelledby={headingId}>
          <div className={styles.dayHeader}>
            <h2 id={headingId} className={styles.dayTitle}>
              {dayLabel(group.date)}
            </h2>
            <span className={styles.dayNet}>
              {group.netMinor >= 0 ? '+' : '−'}
              {formatMinor(Math.abs(group.netMinor))}
            </span>
          </div>
          <ul className={styles.list}>
            {group.items.map((tx) => (
              <li key={tx.id}>
                <TransactionRow transaction={tx} category={categories.get(tx.categoryId)} />
              </li>
            ))}
          </ul>
        </section>
      );
    });
  }

  return (
    <>
      <PageHeader title="Transactions" />
      {body}
    </>
  );
}
