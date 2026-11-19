import type { TxType } from '../db/types.ts';
import { formatMinor } from '../lib/money.ts';
import styles from './AmountText.module.css';

interface AmountTextProps {
  amountMinor: number;
  type: TxType;
  currency?: string;
}

/**
 * A signed, colored amount: "+₱25,000.00" for income, "−₱245.00" for expenses.
 * The sign carries the meaning; color is extra (WCAG: don't rely on color alone).
 */
export default function AmountText({ amountMinor, type, currency = 'PHP' }: AmountTextProps) {
  const sign = type === 'income' ? '+' : '−';
  return (
    <span className={`${styles.amount} ${type === 'income' ? styles.income : styles.expense}`}>
      {sign}
      {formatMinor(amountMinor, currency)}
    </span>
  );
}
