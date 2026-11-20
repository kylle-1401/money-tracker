import { formatMinor } from '../../lib/money.ts';
import { useCurrency } from '../settings/currencyContext.ts';
import { budgetLevel, percentUsed } from '../budget/budget.ts';
import type { CategorySpend } from './summary.ts';
import styles from './SpendingBars.module.css';

interface SpendingBarsProps {
  rows: CategorySpend[];
  /** Monthly budget per category id (slice 9); categories without one are absent. */
  budgets?: ReadonlyMap<string, number>;
}

const BUDGET_ICON = { ok: '', warning: '⚠️ ', over: '‼️ ' } as const;

/**
 * "Where your money went": one ranked horizontal bar per category, largest first.
 *
 * Ranked bars instead of a donut: with up to 8 categories, bars on one baseline are
 * far easier to compare than slices. One hue (identity comes from the printed name,
 * not color). Each bar's length is the category's share of the month's spending,
 * so it matches the printed percent. The figures are text, so the bars are aria-hidden.
 */
export default function SpendingBars({ rows, budgets }: SpendingBarsProps) {
  const currency = useCurrency();
  return (
    <ul className={styles.list}>
      {rows.map((row) => {
        const budget = budgets?.get(row.categoryId);
        const level = budget ? budgetLevel(row.amountMinor, budget) : 'ok';
        return (
          <li key={row.categoryId} className={styles.row}>
            <div className={styles.labels}>
              <span className={styles.name}>
                <span aria-hidden="true">{row.emoji}</span> {row.name}
              </span>
              <span className={styles.figures}>
                <span className={styles.amount}>{formatMinor(row.amountMinor, currency)}</span>
                <span className={styles.percent}>{row.percent}%</span>
              </span>
            </div>
            <div className={styles.track} aria-hidden="true">
              <div className={styles.bar} style={{ width: `${Math.max(row.percent, 1)}%` }} />
            </div>
            {budget !== undefined && (
              // Category budget usage, in words (with an icon when it needs attention).
              <p className={`${styles.budget} ${level === 'over' ? styles.budgetOver : ''}`}>
                {BUDGET_ICON[level]}
                {percentUsed(row.amountMinor, budget)}% of {formatMinor(budget, currency)} budget
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
