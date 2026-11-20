/** Every transaction is one of these. The sign comes from the type, never the amount. */
export type TxType = 'income' | 'expense';

/** A label such as "Food" or "Salary". Belongs to exactly one type. */
export interface Category {
  id: string;
  name: string;
  type: TxType;
  emoji: string;
  /** Chart color (slice 2). */
  color: string;
  /** Business rule: categories that have transactions are archived, not deleted. */
  archived: boolean;
  sortOrder: number;
}

/** Card accent colors a wallet can use (a fixed set, mapped to CSS in WalletCards). */
export const WALLET_COLORS = [
  'blue',
  'green',
  'teal',
  'purple',
  'pink',
  'orange',
  'yellow',
  'gray',
] as const;
export type WalletColor = (typeof WALLET_COLORS)[number];

/**
 * Where money is kept: "Cash", "GCash", "BDO". Only a name and an icon; the app never
 * stores bank logins, account or card numbers.
 */
export interface Wallet {
  id: string;
  name: string;
  emoji: string;
  color: WalletColor;
  /**
   * What was already in the wallet before tracking started, in minor units.
   * May be negative (money owed on a credit card).
   */
  startingBalanceMinor: number;
  /** Business rule: wallets that have transactions are archived, not deleted. */
  archived: boolean;
  sortOrder: number;
}

/** One income or expense entry. */
export interface Transaction {
  id: string;
  type: TxType;
  /** Integer minor units (centavos), always > 0. */
  amountMinor: number;
  categoryId: string;
  /** The wallet the money came into or went out of (schema v2). */
  walletId: string;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  note: string;
  /** Epoch ms. Used to order entries within the same day. */
  createdAt: number;
  updatedAt: number;
}

/** Key/value app settings (e.g. currency, slice 3). */
export interface Setting {
  key: string;
  value: string;
}
