import { Link } from 'react-router-dom';
import AmountText from '../../components/AmountText.tsx';
import type { Category, Transaction } from '../../db/types.ts';
import styles from './TransactionRow.module.css';

interface TransactionRowProps {
  transaction: Transaction;
  category: Category | undefined;
}

/** One tappable transaction line (emoji, category, note, signed amount). Opens the editor. */
export default function TransactionRow({ transaction: tx, category }: TransactionRowProps) {
  return (
    <Link to={`/transactions/${tx.id}`} className={styles.row}>
      <span className={styles.emoji} aria-hidden="true">
        {category?.emoji ?? '❔'}
      </span>
      <span className={styles.text}>
        <span className={styles.category}>{category?.name ?? 'Unknown category'}</span>
        {tx.note && <span className={styles.note}>{tx.note}</span>}
      </span>
      <AmountText amountMinor={tx.amountMinor} type={tx.type} />
    </Link>
  );
}
