import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  minorToInput,
  parseOptionalAmountToMinor as parseOptionalAmount,
} from '../../lib/money.ts';
import { useCurrency } from '../settings/currencyContext.ts';
import { currencySymbol } from '../settings/currencies.ts';
import { getMonthlyBudget, setMonthlyBudget } from './budgetRepository.ts';
import styles from './BudgetSection.module.css';

/**
 * Settings → Budget: one overall monthly budget (empty = none). It repeats every month
 * until changed; category budgets are set on each expense category.
 */
type Status = { kind: 'info' | 'error'; text: string } | null;

export default function BudgetSection() {
  const budget = useLiveQuery(getMonthlyBudget, []);
  // Lives here, not in the form: saving changes the budget, which remounts the form
  // (to show the saved value), and the "Budget saved." message must survive that.
  const [status, setStatus] = useState<Status>(null);

  return (
    <section id="budget" className={styles.section} aria-labelledby="budget-heading">
      <h2 id="budget-heading" className={styles.sectionTitle}>
        Monthly budget
      </h2>
      {budget === undefined ? (
        <p className={styles.hint} role="status">
          Loading…
        </p>
      ) : (
        // Remount when the saved value changes (e.g. after a restore) so the field resets.
        <BudgetForm key={budget ?? 'none'} saved={budget} status={status} onStatus={setStatus} />
      )}
      <p className={styles.hint}>
        Counts expenses and transfer fees. You’ll get a warning in the app at 80% and when you go
        over. Set budgets for single categories in their settings below.
      </p>
    </section>
  );
}

interface BudgetFormProps {
  saved: number | null;
  status: Status;
  onStatus: (status: Status) => void;
}

function BudgetForm({ saved, status, onStatus: setStatus }: BudgetFormProps) {
  const symbol = currencySymbol(useCurrency());
  const [value, setValue] = useState(saved === null ? '' : minorToInput(saved));

  async function save(event: FormEvent) {
    event.preventDefault();
    const minor = parseOptionalAmount(value);
    if (minor === null) {
      setStatus({ kind: 'error', text: 'Enter an amount, up to 2 decimals.' });
      return;
    }
    try {
      await setMonthlyBudget(minor === 0 ? null : minor);
      setStatus({ kind: 'info', text: minor === 0 ? 'Budget removed.' : 'Budget saved.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not save. Please try again.',
      });
    }
  }

  return (
    <form className={styles.group} onSubmit={(e) => void save(e)} noValidate>
      <label htmlFor="monthly-budget" className={styles.rowLabel}>
        Per month
      </label>
      <div className={styles.amountWrap}>
        <span aria-hidden="true" className={styles.symbol}>
          {symbol}
        </span>
        <input
          id="monthly-budget"
          className={styles.amount}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="No budget"
          value={value}
          aria-invalid={status?.kind === 'error' ? true : undefined}
          aria-describedby={status ? 'budget-status' : undefined}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <button type="submit" className={styles.save}>
        Save
      </button>
      {status && (
        <p
          id="budget-status"
          className={status.kind === 'error' ? styles.error : styles.success}
          role={status.kind === 'error' ? 'alert' : 'status'}
        >
          {status.text}
        </p>
      )}
    </form>
  );
}
