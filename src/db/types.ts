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

/** One income or expense entry. */
export interface Transaction {
  id: string;
  type: TxType;
  /** Integer minor units (centavos), always > 0. */
  amountMinor: number;
  categoryId: string;
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
