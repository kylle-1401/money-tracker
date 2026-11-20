import { Link } from 'react-router-dom';
import type { Wallet } from '../../db/types.ts';
import { formatMinor } from '../../lib/money.ts';
import { useCurrency } from '../settings/currencyContext.ts';
import tone from './walletTone.module.css';
import styles from './WalletCards.module.css';

interface WalletCardsProps {
  /** Active wallets in display order. */
  wallets: readonly Wallet[];
  balances: ReadonlyMap<string, number>;
}

/**
 * Home: one card per active wallet with its balance, in a row you swipe sideways,
 * ending with an "Add wallet" card. Tapping a card opens that wallet's settings.
 */
export default function WalletCards({ wallets, balances }: WalletCardsProps) {
  const currency = useCurrency();

  return (
    <section aria-labelledby="wallets-label">
      <h2 id="wallets-label" className="visually-hidden">
        Wallets
      </h2>
      <ul className={styles.row}>
        {wallets.map((w) => {
          const balance = balances.get(w.id) ?? 0;
          return (
            <li key={w.id} className={styles.item}>
              <Link
                to={`/settings/wallets/${w.id}`}
                className={`${styles.card} ${tone.tone}`}
                data-color={w.color}
              >
                <span className={styles.top}>
                  <span className={styles.emoji} aria-hidden="true">
                    {w.emoji}
                  </span>
                  <span className={styles.name}>{w.name}</span>
                </span>
                <span className={`${styles.balance} ${balance < 0 ? styles.negative : ''}`}>
                  {balance < 0 && '−'}
                  {formatMinor(Math.abs(balance), currency)}
                </span>
              </Link>
            </li>
          );
        })}
        <li className={styles.item}>
          <Link to="/settings/wallets/new" className={`${styles.card} ${styles.add}`}>
            <span aria-hidden="true" className={styles.plus}>
              +
            </span>
            <span>Add wallet</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
