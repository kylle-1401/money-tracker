import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { parseAmountToMinor } from '../../lib/money.ts';
import type { TransactionInput } from './transactionRepository.ts';
import { transactionFormSchema, type TransactionFormValues } from './transactionSchema.ts';
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

/**
 * Add/edit form, laid out for one-handed use on a phone: type toggle on top, a big
 * amount field that opens the number pad, a grid of category tiles, then date and note.
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
  const categories = usePickableCategories(type);
  const allWallets = useWallets();
  // Active wallets, plus the entry's own wallet if it was archived later (editing an
  // old entry must still show where it was).
  const wallets = allWallets?.filter((w) => !w.archived || w.id === defaultValues.walletId);
  const symbol = currencySymbol(useCurrency());

  const submit = handleSubmit(async (values) => {
    // Schema already guarantees the amount parses; the check keeps TypeScript honest.
    const amountMinor = parseAmountToMinor(values.amount);
    if (amountMinor === null) return;
    try {
      await onSubmit({
        type: values.type,
        amountMinor,
        categoryId: values.categoryId,
        walletId: values.walletId,
        date: values.date,
        note: values.note,
      });
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
        {(['expense', 'income'] as const).map((value) => (
          <label key={value} className={styles.segment}>
            <input
              type="radio"
              value={value}
              {...register('type', {
                // Categories belong to one type, so a switch clears the pick.
                onChange: () => setValue('categoryId', ''),
              })}
            />
            <span>{value === 'expense' ? '− Expense' : '+ Income'}</span>
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

      <fieldset
        className={styles.field}
        aria-describedby={errors.walletId ? 'wallet-error' : undefined}
      >
        <legend className={styles.label}>{type === 'income' ? 'Received in' : 'Paid from'}</legend>
        {wallets === undefined ? (
          <p className={styles.muted} role="status">
            Loading wallets…
          </p>
        ) : (
          <div className={styles.walletRow}>
            {wallets.map((w) => (
              <label
                key={w.id}
                className={`${styles.walletChip} ${tone.tone} ${selectedWalletId === w.id ? styles.selected : ''}`}
                data-color={w.color}
              >
                <input type="radio" value={w.id} {...register('walletId')} />
                <span aria-hidden="true">{w.emoji}</span>
                <span className={styles.walletName}>{w.name}</span>
              </label>
            ))}
          </div>
        )}
        {errors.walletId && (
          <p id="wallet-error" className={styles.error} role="alert">
            {errors.walletId.message}
          </p>
        )}
      </fieldset>

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
          placeholder="e.g. Jollibee with friends"
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
