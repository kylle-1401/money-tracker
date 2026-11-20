/** Categories are for income or expenses only (transfers have no category). */
export type CategoryType = 'income' | 'expense';

/**
 * Every transaction is one of these. The sign comes from the type, never the amount.
 * A transfer (slice 8) moves money between two wallets: it is not income or spending,
 * only its optional fee is spending.
 */
export type TxType = CategoryType | 'transfer';

/** A label such as "Food" or "Salary". Belongs to exactly one type. */
export interface Category {
  id: string;
  name: string;
  type: CategoryType;
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

/** One income, expense or transfer entry. */
export interface Transaction {
  id: string;
  type: TxType;
  /** Integer minor units (centavos), always > 0. For a transfer: the amount moved. */
  amountMinor: number;
  /** The category; '' for transfers. */
  categoryId: string;
  /**
   * The wallet the money came into or went out of (schema v2).
   * For a transfer: the wallet it left (the "from" wallet).
   */
  walletId: string;
  /** Transfers only: the wallet that received it. Never equal to walletId. */
  toWalletId?: string;
  /** Transfers only: fee charged on top, taken from the "from" wallet. ≥ 0. */
  feeMinor?: number;
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
