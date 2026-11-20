import { Link } from 'react-router-dom';
import AmountText from '../../components/AmountText.tsx';
import type { Category, Transaction, Wallet } from '../../db/types.ts';
import { formatMinor } from '../../lib/money.ts';
import { useCurrency } from '../settings/currencyContext.ts';
import styles from './TransactionRow.module.css';

interface TransactionRowProps {
  transaction: Transaction;
  category: Category | undefined;
  /** Every wallet by id (archived too). Transfers always need it for their names. */
  wallets: ReadonlyMap<string, Wallet>;
  /** Show the wallet under an income/expense row (only useful with 2+ wallets). */
  showWallet: boolean;
}

const walletLabel = (w: Wallet | undefined) => (w ? `${w.emoji} ${w.name}` : '❔ Unknown wallet');

/**
 * One tappable transaction line. Opens the editor.
 * - income/expense: category emoji and name, "wallet · note", signed amount
 * - transfer: "From → To", "Fee ₱15.00 · note", unsigned amount moved
 */
export default function TransactionRow({
  transaction: tx,
  category,
  wallets,
  showWallet,
}: TransactionRowProps) {
  const currency = useCurrency();
  const isTransfer = tx.type === 'transfer';

  const title = isTransfer
    ? `${walletLabel(wallets.get(tx.walletId))} → ${walletLabel(wallets.get(tx.toWalletId ?? ''))}`
    : (category?.name ?? 'Unknown category');
  const details = [
    isTransfer && tx.feeMinor ? `Fee ${formatMinor(tx.feeMinor, currency)}` : null,
    !isTransfer && showWallet ? walletLabel(wallets.get(tx.walletId)) : null,
    tx.note,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link to={`/transactions/${tx.id}`} className={styles.row}>
      <span className={styles.emoji} aria-hidden="true">
        {isTransfer ? '🔁' : (category?.emoji ?? '❔')}
      </span>
      <span className={styles.text}>
        <span className={styles.category}>{title}</span>
        {details && <span className={styles.note}>{details}</span>}
      </span>
      <AmountText amountMinor={tx.amountMinor} type={tx.type} />
    </Link>
  );
}
