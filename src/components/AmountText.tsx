import type { TxType } from '../db/types.ts';
import { formatMinor } from '../lib/money.ts';
import { useCurrency } from '../features/settings/currencyContext.ts';
import styles from './AmountText.module.css';

interface AmountTextProps {
  amountMinor: number;
  type: TxType;
}

const SIGNS: Record<TxType, string> = { income: '+', expense: '−', transfer: '' };

/**
 * A signed, colored amount in the user's currency: "+₱25,000.00" for income,
 * "−₱245.00" for expenses, and an unsigned "₱1,000.00" for transfers (money moved
 * between your own wallets, neither in nor out). The sign carries the meaning; color
 * is extra (WCAG: don't rely on color alone).
 */
export default function AmountText({ amountMinor, type }: AmountTextProps) {
  const currency = useCurrency();
  return (
    <span className={`${styles.amount} ${styles[type]}`}>
      {SIGNS[type]}
      {formatMinor(amountMinor, currency)}
    </span>
  );
}
