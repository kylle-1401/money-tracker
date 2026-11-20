import { Link } from 'react-router-dom';
import { useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TxType, Wallet } from '../../db/types.ts';
import { parseAmountToMinor } from '../../lib/money.ts';
import type { TransactionInput } from './transactionRepository.ts';
import {
  parseFee,
  transactionFormSchema,
  type TransactionFormValues,
} from './transactionSchema.ts';
import { usePickableCategories } from './hooks.ts';
import { useWallets } from '../wallets/hooks.ts';
import tone from '../wallets/walletTone.module.css';
import { useCurrency } from '../settings/currencyContext.ts';
import { currencySymbol } from '../settings/currencies.ts';
import styles from './TransactionForm.module.css';

interface TransactionFormProps {
  defaultValues: TransactionFormValues;
  submitLabel: string;
  onSubmit: (input: TransactionInput) => Promise<void>;
}

const TYPE_LABELS: Record<TxType, string> = {
  expense: '− Expense',
  income: '+ Income',
  transfer: '⇄ Transfer',
};

/**
 * Add/edit form, laid out for one-handed use on a phone: type toggle on top, a big
 * amount field that opens the number pad, the wallet(s), a grid of category tiles
 * (not for transfers), then date and note.
 */
export default function TransactionForm({
  defaultValues,
  submitLabel,
  onSubmit,
}: TransactionFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues,
  });

  // useWatch (not watch) so the React Compiler can still optimize this component.
  const type = useWatch({ control, name: 'type' });
  const selectedCategoryId = useWatch({ control, name: 'categoryId' });
  const selectedWalletId = useWatch({ control, name: 'walletId' });
  const selectedToWalletId = useWatch({ control, name: 'toWalletId' });
  const isTransfer = type === 'transfer';
  const categories = usePickableCategories(isTransfer ? 'expense' : type);
  const allWallets = useWallets();
  // Active wallets, plus this entry's own wallets if they were archived later (editing
  // an old entry must still show where it was).
  const keep = new Set([defaultValues.walletId, defaultValues.toWalletId]);
  const wallets = allWallets?.filter((w) => !w.archived || keep.has(w.id));
  // You can't move money to the wallet it comes from.
  const toWallets = wallets?.filter((w) => w.id !== selectedWalletId);
  const symbol = currencySymbol(useCurrency());

  const submit = handleSubmit(async (values) => {
    // The schema already guarantees these parse; the checks keep TypeScript honest.
    const amountMinor = parseAmountToMinor(values.amount);
    const feeMinor = parseFee(values.fee);
    if (amountMinor === null || feeMinor === null) return;
    const common = { amountMinor, walletId: values.walletId, date: values.date, note: values.note };
    try {
      await onSubmit(
        values.type === 'transfer'
          ? { ...common, type: 'transfer', categoryId: '', toWalletId: values.toWalletId, feeMinor }
          : { ...common, type: values.type, categoryId: values.categoryId },
      );
    } catch (error) {
      // Show the failure instead of losing what the user typed.
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save. Please try again.',
      });
    }
  });

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <fieldset className={styles.segmented}>
        <legend className="visually-hidden">Type</legend>
        {(['expense', 'income', 'transfer'] as const).map((value) => (
          <label key={value} className={styles.segment}>
            <input
              type="radio"
              value={value}
              {...register('type', {
                // Categories belong to one type, so a switch clears the pick.
                onChange: () => setValue('categoryId', ''),
              })}
            />
            <span>{TYPE_LABELS[value]}</span>
          </label>
        ))}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="amount" className={styles.label}>
          Amount
        </label>
        <div className={styles.amountWrap}>
          <span className={styles.currency} aria-hidden="true">
            {symbol}
          </span>
          <input
            id="amount"
            className={styles.amount}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={errors.amount ? 'amount-error' : undefined}
            {...register('amount')}
          />
        </div>
        {errors.amount && (
          <p id="amount-error" className={styles.error} role="alert">
            {errors.amount.message}
          </p>
        )}
      </div>

      <WalletChips
        legend={isTransfer ? 'From' : type === 'income' ? 'Received in' : 'Paid from'}
        idPrefix="wallet"
        wallets={wallets}
        selectedId={selectedWalletId}
        error={errors.walletId?.message}
        inputProps={register('walletId', {
          // Moving money "to" the wallet it now comes from makes no sense: clear it.
          onChange: () => {
            if (getValues('toWalletId') === getValues('walletId')) setValue('toWalletId', '');
          },
        })}
      />

      {isTransfer && (
        <>
          {toWallets !== undefined && toWallets.length === 0 ? (
            <div className={styles.field}>
              <p className={styles.label}>To</p>
              <p className={styles.muted}>
                You need a second wallet to move money.{' '}
                <Link to="/settings/wallets/new" className={styles.link}>
                  Add a wallet
                </Link>
              </p>
            </div>
          ) : (
            <WalletChips
              legend="To"
              idPrefix="to-wallet"
              wallets={toWallets}
              selectedId={selectedToWalletId}
              error={errors.toWalletId?.message}
              inputProps={register('toWalletId')}
            />
          )}

          <div className={styles.field}>
            <label htmlFor="fee" className={styles.label}>
              Fee <span className={styles.muted}>(optional, counts as spending)</span>
            </label>
            <div className={styles.feeWrap}>
              <span aria-hidden="true" className={styles.feeSymbol}>
                {symbol}
              </span>
              <input
                id="fee"
                className={styles.feeInput}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                aria-invalid={errors.fee ? true : undefined}
                aria-describedby={errors.fee ? 'fee-error' : undefined}
                {...register('fee')}
              />
            </div>
            {errors.fee && (
              <p id="fee-error" className={styles.error} role="alert">
                {errors.fee.message}
              </p>
            )}
          </div>
        </>
      )}

      {!isTransfer && (
        <fieldset
          className={styles.field}
          aria-describedby={errors.categoryId ? 'category-error' : undefined}
        >
          <legend className={styles.label}>Category</legend>
          {categories === undefined ? (
            <p className={styles.muted} role="status">
              Loading categories…
            </p>
          ) : (
            <div className={styles.categoryGrid}>
              {categories.map((c) => (
                <label
                  key={c.id}
                  className={`${styles.categoryTile} ${selectedCategoryId === c.id ? styles.selected : ''}`}
                >
                  <input type="radio" value={c.id} {...register('categoryId')} />
                  <span className={styles.emoji} aria-hidden="true">
                    {c.emoji}
                  </span>
                  <span className={styles.categoryName}>{c.name}</span>
                </label>
              ))}
            </div>
          )}
          {errors.categoryId && (
            <p id="category-error" className={styles.error} role="alert">
              {errors.categoryId.message}
            </p>
          )}
        </fieldset>
      )}

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="date" className={styles.label}>
            Date
          </label>
          <input
            id="date"
            className={styles.input}
            type="date"
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={errors.date ? 'date-error' : undefined}
            {...register('date')}
          />
          {errors.date && (
            <p id="date-error" className={styles.error} role="alert">
              {errors.date.message}
            </p>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="note" className={styles.label}>
          Note <span className={styles.muted}>(optional)</span>
        </label>
        <input
          id="note"
          className={styles.input}
          type="text"
          autoComplete="off"
          placeholder={isTransfer ? 'e.g. Savings for rent' : 'e.g. Jollibee with friends'}
          maxLength={200}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? 'note-error' : undefined}
          {...register('note')}
        />
        {errors.note && (
          <p id="note-error" className={styles.error} role="alert">
            {errors.note.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p className={styles.error} role="alert">
          {errors.root.message}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

interface WalletChipsProps {
  legend: string;
  idPrefix: string;
  wallets: Wallet[] | undefined;
  selectedId: string;
  error: string | undefined;
  inputProps: UseFormRegisterReturn;
}

/** One swipeable row of wallet radio chips (used for "Paid from", "From" and "To"). */
function WalletChips({
  legend,
  idPrefix,
  wallets,
  selectedId,
  error,
  inputProps,
}: WalletChipsProps) {
  const errorId = `${idPrefix}-error`;
  return (
    <fieldset className={styles.field} aria-describedby={error ? errorId : undefined}>
      <legend className={styles.label}>{legend}</legend>
      {wallets === undefined ? (
        <p className={styles.muted} role="status">
          Loading wallets…
        </p>
      ) : (
        <div className={styles.walletRow}>
          {wallets.map((w) => (
            <label
              key={w.id}
              className={`${styles.walletChip} ${tone.tone} ${selectedId === w.id ? styles.selected : ''}`}
              data-color={w.color}
            >
              <input type="radio" value={w.id} {...inputProps} />
              <span aria-hidden="true">{w.emoji}</span>
              <span className={styles.walletName}>{w.name}</span>
            </label>
          ))}
        </div>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
