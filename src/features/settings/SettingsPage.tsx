import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BackupSection from '../backup/BackupSection.tsx';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../components/PageHeader.tsx';
import type { CategoryType } from '../../db/types.ts';
import { CURRENCIES } from './currencies.ts';
import { useCurrency } from './currencyContext.ts';
import { setCurrency } from './settingsRepository.ts';
import { listCategories } from './categoryRepository.ts';
import { formatMinor } from '../../lib/money.ts';
import { useTransactions } from '../transactions/hooks.ts';
import { useWallets } from '../wallets/hooks.ts';
import { walletBalances } from '../dashboard/summary.ts';
import styles from './SettingsPage.module.css';

/** Settings tab: wallets, display currency, backup, and the category lists. */
export default function SettingsPage() {
  const currency = useCurrency();
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const focusBackup = searchParams.get('focus') === 'backup';

  // The Home backup reminder links here with ?focus=backup.
  useEffect(() => {
    // Optional call: scrollIntoView is missing in some test DOMs (jsdom).
    if (focusBackup) document.getElementById('backup')?.scrollIntoView?.({ block: 'start' });
  }, [focusBackup]);

  async function changeCurrency(code: string) {
    setCurrencyError(null);
    try {
      await setCurrency(code);
    } catch {
      setCurrencyError('Could not save the currency. Please try again.');
    }
  }

  return (
    <>
      <PageHeader title="Settings" />

      <WalletSection />

      <section className={styles.section} aria-labelledby="currency-heading">
        <h2 id="currency-heading" className={styles.sectionTitle}>
          Currency
        </h2>
        <div className={styles.group}>
          <label htmlFor="currency" className={styles.rowLabel}>
            Show amounts in
          </label>
          <select
            id="currency"
            className={styles.select}
            value={currency}
            onChange={(e) => void changeCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} – {c.name}
              </option>
            ))}
          </select>
        </div>
        <p className={styles.hint}>
          Only changes how amounts are shown. Amounts are not converted.
        </p>
        {currencyError && (
          <p className={styles.error} role="alert">
            {currencyError}
          </p>
        )}
      </section>

      <BackupSection />

      <CategorySection type="expense" title="Expense categories" />
      <CategorySection type="income" title="Income categories" />

      <p className={styles.footer}>Your data stays on this device. Nothing is sent anywhere.</p>
    </>
  );
}

/** Wallets (active, then archived) with their balances and an "Add wallet" row. */
function WalletSection() {
  const wallets = useWallets();
  const transactions = useTransactions();
  const currency = useCurrency();
  const balances =
    wallets && transactions ? walletBalances(wallets, transactions) : new Map<string, number>();

  return (
    <section className={styles.section} aria-labelledby="wallets-heading">
      <h2 id="wallets-heading" className={styles.sectionTitle}>
        Wallets
      </h2>
      {wallets === undefined || transactions === undefined ? (
        <p className={styles.hint} role="status">
          Loading…
        </p>
      ) : (
        <ul className={styles.group}>
          {wallets.map((w) => {
            const balance = balances.get(w.id) ?? 0;
            return (
              <li key={w.id}>
                <Link
                  to={`/settings/wallets/${w.id}`}
                  className={`${styles.categoryRow} ${w.archived ? styles.archived : ''}`}
                >
                  <span className={styles.emoji} aria-hidden="true">
                    {w.emoji}
                  </span>
                  <span className={styles.name}>{w.name}</span>
                  {w.archived && <span className={styles.badge}>Archived</span>}
                  <span className={`${styles.amount} ${balance < 0 ? styles.negative : ''}`}>
                    {balance < 0 && '−'}
                    {formatMinor(Math.abs(balance), currency)}
                  </span>
                  <span className={styles.chevron} aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link to="/settings/wallets/new" className={styles.addRow}>
              + Add wallet
            </Link>
          </li>
        </ul>
      )}
      <p className={styles.hint}>Only a name and icon. No bank logins or account numbers.</p>
    </section>
  );
}

/** One type's categories (active, then archived) with an "Add category" row. */
function CategorySection({ type, title }: { type: CategoryType; title: string }) {
  const categories = useLiveQuery(() => listCategories(type), [type]);
  const headingId = `${type}-categories-heading`;

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {title}
      </h2>
      {categories === undefined ? (
        <p className={styles.hint} role="status">
          Loading…
        </p>
      ) : (
        <ul className={styles.group}>
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                to={`/settings/categories/${c.id}`}
                className={`${styles.categoryRow} ${c.archived ? styles.archived : ''}`}
              >
                <span className={styles.emoji} aria-hidden="true">
                  {c.emoji}
                </span>
                <span className={styles.name}>{c.name}</span>
                {c.archived && <span className={styles.badge}>Archived</span>}
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link to={`/settings/categories/new?type=${type}`} className={styles.addRow}>
              + Add {type} category
            </Link>
          </li>
        </ul>
      )}
    </section>
  );
}
