import { formatMinor } from '../../lib/money.ts';
import { useCurrency } from '../settings/currencyContext.ts';
import type { CategorySpend } from './summary.ts';
import styles from './SpendingBars.module.css';

interface SpendingBarsProps {
  rows: CategorySpend[];
}

/**
 * "Where your money went": one ranked horizontal bar per category, largest first.
 *
 * Ranked bars instead of a donut: with up to 8 categories, bars on one baseline are
 * far easier to compare than slices. One hue (identity comes from the printed name,
 * not color). Each bar's length is the category's share of the month's spending,
 * so it matches the printed percent. The figures are text, so the bars are aria-hidden.
 */
export default function SpendingBars({ rows }: SpendingBarsProps) {
  const currency = useCurrency();
  return (
    <ul className={styles.list}>
      {rows.map((row) => (
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
        </li>
      ))}
    </ul>
  );
}
