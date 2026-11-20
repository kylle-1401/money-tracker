import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '../../db/db.ts';
import { WALLET_COLORS } from '../../db/types.ts';
import { minorToInput } from '../../lib/money.ts';
import { useGoBack } from '../../lib/useGoBack.ts';
import EmptyState from '../../components/EmptyState.tsx';
import FullScreenPage from '../../components/FullScreenPage.tsx';
import { useCurrency } from '../settings/currencyContext.ts';
import { currencySymbol } from '../settings/currencies.ts';
import {
  addWallet,
  countTransactionsInWallet,
  deleteWallet,
  listWallets,
  moveWallet,
  setWalletArchived,
  updateWallet,
  type WalletInput,
} from './walletRepository.ts';
import {
  parseStartingBalance,
  SUGGESTED_WALLET_EMOJIS,
  WALLET_COLOR_LABELS,
  walletFormSchema,
  type WalletFormValues,
} from './walletSchema.ts';
import forms from '../../components/forms.module.css';
// Same field, emoji-grid and button styles as the category editor.
import shared from '../settings/CategoryFormPage.module.css';
import tone from './walletTone.module.css';
import styles from './WalletFormPage.module.css';

/**
 * Add (/settings/wallets/new) or edit (/settings/wallets/:id) a wallet. Existing
 * wallets can be reordered, archived/restored, or deleted when nothing uses them.
 */
export default function WalletFormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const goBack = useGoBack('/settings');

  const existing = useLiveQuery(
    async () => (id ? ((await db.wallets.get(id)) ?? null) : null),
    [id],
  );
  const usage = useLiveQuery(async () => (id ? countTransactionsInWallet(id) : 0), [id]);
  const activeIds = useLiveQuery(
    async () => (await listWallets()).filter((w) => !w.archived).map((w) => w.id),
    [],
  );

  const title = isEdit ? 'Edit wallet' : 'New wallet';

  if (isEdit && (existing === undefined || usage === undefined || activeIds === undefined)) {
    return (
      <FullScreenPage title={title} onCancel={goBack}>
        <p className={forms.muted} role="status">
          Loading…
        </p>
      </FullScreenPage>
    );
  }

  if (isEdit && !existing) {
    return (
      <FullScreenPage title={title} onCancel={goBack}>
        <EmptyState title="Wallet not found">It may have been deleted.</EmptyState>
      </FullScreenPage>
    );
  }

  async function save(input: WalletInput) {
    if (existing) {
      await updateWallet(existing.id, input);
    } else {
      await addWallet(input);
    }
    goBack();
  }

  const position = existing && activeIds ? activeIds.indexOf(existing.id) : -1;
  const isOnlyActive = !!existing && !existing.archived && activeIds?.length === 1;

  async function toggleArchived() {
    if (!existing) return;
    await setWalletArchived(existing.id, !existing.archived);
    goBack();
  }

  async function remove() {
    if (!existing) return;
    if (!window.confirm(`Delete "${existing.name}"? This cannot be undone.`)) return;
    await deleteWallet(existing.id);
    goBack();
  }

  return (
    <FullScreenPage title={title} onCancel={goBack}>
      <WalletForm
        key={existing?.id ?? 'new'}
        defaultValues={{
          name: existing?.name ?? '',
          emoji: existing?.emoji ?? '',
          color: existing?.color ?? 'blue',
          startingBalance: existing ? minorToInput(Math.abs(existing.startingBalanceMinor)) : '',
          owed: (existing?.startingBalanceMinor ?? 0) < 0,
        }}
        submitLabel={isEdit ? 'Save changes' : 'Add wallet'}
        onSubmit={save}
      />

      {existing && (
        <>
          {position !== -1 && activeIds && activeIds.length > 1 && (
            <div className={styles.moveRow}>
              <button
                type="button"
                className={forms.secondary}
                disabled={position === 0}
                onClick={() => void moveWallet(existing.id, -1)}
              >
                ↑ Move earlier
              </button>
              <button
                type="button"
                className={forms.secondary}
                disabled={position === activeIds.length - 1}
                onClick={() => void moveWallet(existing.id, 1)}
              >
                ↓ Move later
              </button>
            </div>
          )}

          {isOnlyActive ? (
            <p className={forms.hint}>This is your only active wallet, so it can’t be archived.</p>
          ) : (
            <>
              <button
                type="button"
                className={forms.secondary}
                onClick={() => void toggleArchived()}
              >
                {existing.archived ? 'Restore wallet' : 'Archive wallet'}
              </button>
              <p className={forms.hint}>
                Archived wallets are hidden from Home and when adding entries. Their money still
                counts in your total balance.
              </p>
            </>
          )}

          {usage === 0 && !isOnlyActive ? (
            <button type="button" className={forms.danger} onClick={() => void remove()}>
              Delete wallet
            </button>
          ) : usage !== 0 ? (
            <p className={forms.hint}>
              Used by {usage} {usage === 1 ? 'transaction' : 'transactions'}, so it can’t be
              deleted. Archive it instead.
            </p>
          ) : null}
        </>
      )}
    </FullScreenPage>
  );
}

interface WalletFormProps {
  defaultValues: WalletFormValues;
  submitLabel: string;
  onSubmit: (input: WalletInput) => Promise<void>;
}

/** Name, icon, card color and starting balance. No bank details are ever asked for. */
function WalletForm({ defaultValues, submitLabel, onSubmit }: WalletFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues,
  });
  const emoji = useWatch({ control, name: 'emoji' });
  const color = useWatch({ control, name: 'color' });
  const name = useWatch({ control, name: 'name' });
  const symbol = currencySymbol(useCurrency());

  const submit = handleSubmit(async (values) => {
    const amount = parseStartingBalance(values.startingBalance);
    if (amount === null) return; // the schema already reported it
    try {
      await onSubmit({
        name: values.name,
        emoji: values.emoji,
        color: values.color,
        startingBalanceMinor: values.owed ? -amount : amount,
      });
    } catch (error) {
      // e.g. a duplicate name: show it under the name field
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not save. Please try again.',
      });
    }
  });

  return (
    <form className={shared.form} onSubmit={submit} noValidate>
      {/* Live preview of the Home card */}
      <div className={`${styles.preview} ${tone.tone}`} data-color={color} aria-hidden="true">
        <span className={styles.previewEmoji}>{emoji || '❔'}</span>
        <span className={styles.previewName}>{name.trim() || 'Wallet name'}</span>
      </div>

      <div className={shared.field}>
        <label htmlFor="wallet-name" className={shared.label}>
          Name
        </label>
        <input
          id="wallet-name"
          className={shared.input}
          type="text"
          autoComplete="off"
          maxLength={30}
          placeholder="e.g. GCash, BDO Savings"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'wallet-name-error' : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p id="wallet-name-error" className={shared.error} role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      <fieldset className={shared.field}>
        <legend className={shared.label}>Icon</legend>
        <div className={shared.emojiGrid}>
          {SUGGESTED_WALLET_EMOJIS.map((option) => (
            <button
              key={option}
              type="button"
              className={shared.emojiOption}
              aria-pressed={emoji === option}
              aria-label={`Use ${option}`}
              onClick={() => setValue('emoji', option, { shouldValidate: true })}
            >
              {option}
            </button>
          ))}
        </div>
        <label htmlFor="wallet-emoji" className={shared.subLabel}>
          Or type any emoji
        </label>
        <input
          id="wallet-emoji"
          className={`${shared.input} ${shared.emojiInput}`}
          type="text"
          autoComplete="off"
          aria-invalid={errors.emoji ? true : undefined}
          aria-describedby={errors.emoji ? 'wallet-emoji-error' : undefined}
          {...register('emoji')}
        />
        {errors.emoji && (
          <p id="wallet-emoji-error" className={shared.error} role="alert">
            {errors.emoji.message}
          </p>
        )}
      </fieldset>

      <fieldset className={shared.field}>
        <legend className={shared.label}>Card color</legend>
        <div className={styles.swatches}>
          {WALLET_COLORS.map((option) => (
            <label key={option} className={`${styles.swatch} ${tone.tone}`} data-color={option}>
              <input type="radio" value={option} {...register('color')} />
              <span className="visually-hidden">{WALLET_COLOR_LABELS[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={shared.field}>
        <label htmlFor="wallet-balance" className={shared.label}>
          Starting balance <span className={styles.muted}>(what’s in it today)</span>
        </label>
        <div className={styles.amountWrap}>
          <span aria-hidden="true" className={styles.symbol}>
            {symbol}
          </span>
          <input
            id="wallet-balance"
            className={styles.amount}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            aria-invalid={errors.startingBalance ? true : undefined}
            aria-describedby={errors.startingBalance ? 'wallet-balance-error' : undefined}
            {...register('startingBalance')}
          />
        </div>
        {errors.startingBalance && (
          <p id="wallet-balance-error" className={shared.error} role="alert">
            {errors.startingBalance.message}
          </p>
        )}
        <label className={styles.owed}>
          <input type="checkbox" {...register('owed')} />
          <span>This is money I owe (credit card, loan)</span>
        </label>
      </div>

      <button type="submit" className={shared.primary} disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
