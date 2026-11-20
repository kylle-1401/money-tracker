import { formatMinor } from '../../lib/money.ts';
import { useCurrency } from '../settings/currencyContext.ts';
import { budgetLevel, percentUsed } from './budget.ts';
import styles from './BudgetMeter.module.css';

interface BudgetMeterProps {
  spentMinor: number;
  budgetMinor: number;
}

/**
 * Home: how much of the monthly budget is used. The words carry the state (left /
 * 85% used / over by); the bar color (accent → amber at 80% → red when over) is
 * extra, so it never relies on color alone. The bar is aria-hidden: the text says it.
 */
export default function BudgetMeter({ spentMinor, budgetMinor }: BudgetMeterProps) {
  const currency = useCurrency();
  const level = budgetLevel(spentMinor, budgetMinor);
  const percent = percentUsed(spentMinor, budgetMinor);
  const left = budgetMinor - spentMinor;

  let status: string;
  if (level === 'over') status = `Over budget by ${formatMinor(-left, currency)}`;
  else if (level === 'warning')
    status = `⚠️ ${percent}% used · ${formatMinor(left, currency)} left`;
  else status = `${formatMinor(left, currency)} left`;

  return (
    <section className={styles.card} aria-labelledby="budget-label">
      <div className={styles.labels}>
        <h2 id="budget-label" className={styles.title}>
          Budget
        </h2>
        <span className={styles.figures}>
          {formatMinor(spentMinor, currency)} of {formatMinor(budgetMinor, currency)}
        </span>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div
          className={`${styles.fill} ${styles[level]}`}
          style={{ width: `${Math.min(Math.max(percent, 1), 100)}%` }}
        />
      </div>
      <p className={`${styles.status} ${level === 'over' ? styles.overText : ''}`}>{status}</p>
    </section>
  );
}
