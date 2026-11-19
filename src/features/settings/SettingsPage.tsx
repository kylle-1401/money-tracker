import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BackupSection from '../backup/BackupSection.tsx';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../components/PageHeader.tsx';
import type { TxType } from '../../db/types.ts';
import { CURRENCIES } from './currencies.ts';
import { useCurrency } from './currencyContext.ts';
import { setCurrency } from './settingsRepository.ts';
import { listCategories } from './categoryRepository.ts';
import styles from './SettingsPage.module.css';

/** Settings tab: display currency, backup, and the category lists. */
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

/** One type's categories (active, then archived) with an "Add category" row. */
function CategorySection({ type, title }: { type: TxType; title: string }) {
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
