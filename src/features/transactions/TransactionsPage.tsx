import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.tsx';
import EmptyState from '../../components/EmptyState.tsx';
import TransactionRow from './TransactionRow.tsx';
import { dayLabel } from '../../lib/dates.ts';
import { formatMinor } from '../../lib/money.ts';
import { useCurrency } from '../settings/currencyContext.ts';
import { useCategoryMap, useTransactions } from './hooks.ts';
import { groupByDay } from './groupByDay.ts';
import { touchesWallet } from './effects.ts';
import { toWalletMap, useWallets } from '../wallets/hooks.ts';
import tone from '../wallets/walletTone.module.css';
import styles from './TransactionsPage.module.css';

/**
 * List tab: every transaction, newest first, grouped by day. Tap one to edit it.
 * With 2+ wallets, chips filter to one wallet (kept in the URL: ?wallet=<id>); the
 * day totals then show that wallet's change, so transfers in count as +.
 */
export default function TransactionsPage() {
  const transactions = useTransactions();
  const categories = useCategoryMap();
  const currency = useCurrency();
  const wallets = useWallets();
  const [searchParams, setSearchParams] = useSearchParams();

  const walletMap = toWalletMap(wallets ?? []);
  const requested = searchParams.get('wallet');
  // Ignore a missing or unknown wallet in the URL (e.g. after it was deleted).
  const filterId = requested && walletMap.has(requested) ? requested : undefined;
  const filterWallet = filterId ? walletMap.get(filterId) : undefined;

  function setFilter(id: string | undefined) {
    setSearchParams(id ? { wallet: id } : {}, { replace: true });
  }

  let body;
  if (transactions === undefined || categories === undefined || wallets === undefined) {
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
    const shown = filterId ? transactions.filter((t) => touchesWallet(t, filterId)) : transactions;
    // Wallet names on rows only help with 2+ wallets and no wallet filter.
    const showWallet = wallets.length > 1 && !filterId;

    body =
      shown.length === 0 ? (
        <EmptyState title="Nothing here yet">
          No entries in {filterWallet?.name ?? 'this wallet'} yet.
        </EmptyState>
      ) : (
        groupByDay(shown, filterId).map((group) => {
          const headingId = `day-${group.date}`;
          return (
            <section key={group.date} className={styles.day} aria-labelledby={headingId}>
              <div className={styles.dayHeader}>
                <h2 id={headingId} className={styles.dayTitle}>
                  {dayLabel(group.date)}
                </h2>
                <span className={styles.dayNet}>
                  {group.netMinor >= 0 ? '+' : '−'}
                  {formatMinor(Math.abs(group.netMinor), currency)}
                </span>
              </div>
              <ul className={styles.list}>
                {group.items.map((tx) => (
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
          );
        })
      );
  }

  return (
    <>
      <PageHeader title="Transactions" />
      {wallets && wallets.length > 1 && (
        <div className={styles.filters} role="group" aria-label="Filter by wallet">
          <button
            type="button"
            className={styles.chip}
            aria-pressed={!filterId}
            onClick={() => setFilter(undefined)}
          >
            All
          </button>
          {wallets.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`${styles.chip} ${tone.tone}`}
              data-color={w.color}
              aria-pressed={filterId === w.id}
              onClick={() => setFilter(w.id)}
            >
              <span aria-hidden="true">{w.emoji}</span> {w.name}
            </button>
          ))}
        </div>
      )}
      {body}
    </>
  );
}
