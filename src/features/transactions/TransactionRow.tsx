import { Link } from 'react-router-dom';
import AmountText from '../../components/AmountText.tsx';
import type { Category, Transaction, Wallet } from '../../db/types.ts';
import styles from './TransactionRow.module.css';

interface TransactionRowProps {
  transaction: Transaction;
  category: Category | undefined;
  /** Shown under the category; pass only when the user has more than one wallet. */
  wallet?: Wallet | undefined;
}

/**
 * One tappable transaction line (emoji, category, wallet · note, signed amount).
 * Opens the editor.
 */
export default function TransactionRow({ transaction: tx, category, wallet }: TransactionRowProps) {
  const details = [wallet && `${wallet.emoji} ${wallet.name}`, tx.note].filter(Boolean).join(' · ');
  return (
    <Link to={`/transactions/${tx.id}`} className={styles.row}>
      <span className={styles.emoji} aria-hidden="true">
        {category?.emoji ?? '❔'}
      </span>
      <span className={styles.text}>
        <span className={styles.category}>{category?.name ?? 'Unknown category'}</span>
        {details && <span className={styles.note}>{details}</span>}
      </span>
      <AmountText amountMinor={tx.amountMinor} type={tx.type} />
    </Link>
  );
}
