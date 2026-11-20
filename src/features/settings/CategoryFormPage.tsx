import { useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '../../db/db.ts';
import type { CategoryType } from '../../db/types.ts';
import { useGoBack } from '../../lib/useGoBack.ts';
import EmptyState from '../../components/EmptyState.tsx';
import FullScreenPage from '../../components/FullScreenPage.tsx';
import {
  addCategory,
  countTransactionsInCategory,
  deleteCategory,
  setCategoryArchived,
  setCategoryBudget,
  updateCategory,
} from './categoryRepository.ts';
import { categoryFormSchema, SUGGESTED_EMOJIS, type CategoryFormValues } from './categorySchema.ts';
import { minorToInput, parseOptionalAmountToMinor } from '../../lib/money.ts';
import { useCurrency } from './currencyContext.ts';
import { currencySymbol } from './currencies.ts';
import forms from '../../components/forms.module.css';
import styles from './CategoryFormPage.module.css';

/**
 * Add (/settings/categories/new?type=expense) or edit (/settings/categories/:id)
 * a category. Existing categories can be renamed, archived/restored, or deleted
 * when no transaction uses them.
 */
export default function CategoryFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = id !== undefined;
  const goBack = useGoBack('/settings');

  const existing = useLiveQuery(
    async () => (id ? ((await db.categories.get(id)) ?? null) : null),
    [id],
  );
  const usage = useLiveQuery(async () => (id ? countTransactionsInCategory(id) : 0), [id]);

  const newType: CategoryType = searchParams.get('type') === 'income' ? 'income' : 'expense';

  if (isEdit && (existing === undefined || usage === undefined)) {
    return (
      <FullScreenPage title="Edit category" onCancel={goBack}>
        <p className={forms.muted} role="status">
          Loading…
        </p>
      </FullScreenPage>
    );
  }

  if (isEdit && !existing) {
    return (
      <FullScreenPage title="Edit category" onCancel={goBack}>
        <EmptyState title="Category not found">It may have been deleted.</EmptyState>
      </FullScreenPage>
    );
  }

  const type = existing?.type ?? newType;
  const typeLabel = type === 'income' ? 'income' : 'expense';

  async function save(values: CategoryFormValues) {
    const input = { name: values.name, emoji: values.emoji };
    const budget = parseOptionalAmountToMinor(values.budget) ?? 0;
    // One transaction: the name and the budget are saved together or not at all.
    await db.transaction('rw', db.categories, async () => {
      const id = existing ? existing.id : await addCategory(type, input);
      if (existing) await updateCategory(existing.id, input);
      if (type === 'expense') await setCategoryBudget(id, budget > 0 ? budget : null);
    });
    goBack();
  }

  async function toggleArchived() {
    if (!existing) return;
    await setCategoryArchived(existing.id, !existing.archived);
    goBack();
  }

  async function remove() {
    if (!existing) return;
    if (!window.confirm(`Delete "${existing.name}"? This cannot be undone.`)) return;
    await deleteCategory(existing.id);
    goBack();
  }

  return (
    <FullScreenPage
      title={isEdit ? 'Edit category' : `New ${typeLabel} category`}
      onCancel={goBack}
    >
      <CategoryForm
        key={existing?.id ?? 'new'}
        defaultValues={{
          name: existing?.name ?? '',
          emoji: existing?.emoji ?? '',
          budget: existing?.budgetMinor ? minorToInput(existing.budgetMinor) : '',
        }}
        submitLabel={isEdit ? 'Save changes' : 'Add category'}
        showBudget={type === 'expense'}
        onSubmit={save}
      />

      {existing && (
        <>
          <button type="button" className={forms.secondary} onClick={() => void toggleArchived()}>
            {existing.archived ? 'Restore category' : 'Archive category'}
          </button>
          <p className={forms.hint}>
            {existing.archived
              ? 'Archived categories are hidden when adding transactions, but past entries keep them.'
              : 'Archiving hides it when adding transactions. Past entries keep it.'}
          </p>

          {usage === 0 ? (
            <button type="button" className={forms.danger} onClick={() => void remove()}>
              Delete category
            </button>
          ) : (
            <p className={forms.hint}>
              Used by {usage} {usage === 1 ? 'transaction' : 'transactions'}, so it can’t be
              deleted. Archive it instead.
            </p>
          )}
        </>
      )}
    </FullScreenPage>
  );
}

interface CategoryFormProps {
  defaultValues: CategoryFormValues;
  submitLabel: string;
  /** Expense categories can have a monthly budget. */
  showBudget: boolean;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
}

/**
 * Name plus icon (tap a suggested emoji or type your own), and for expense
 * categories an optional monthly budget.
 */
function CategoryForm({ defaultValues, submitLabel, showBudget, onSubmit }: CategoryFormProps) {
  const symbol = currencySymbol(useCurrency());
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues,
  });
  const emoji = useWatch({ control, name: 'emoji' });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      // e.g. a duplicate name: show it under the name field
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not save. Please try again.',
      });
    }
  });

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.preview} aria-hidden="true">
        <span className={styles.previewEmoji}>{emoji || '❔'}</span>
      </div>

      <div className={styles.field}>
        <label htmlFor="category-name" className={styles.label}>
          Name
        </label>
        <input
          id="category-name"
          className={styles.input}
          type="text"
          autoComplete="off"
          maxLength={30}
          placeholder="e.g. Pets"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'category-name-error' : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p id="category-name-error" className={styles.error} role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      <fieldset className={styles.field}>
        <legend className={styles.label}>Icon</legend>
        <div className={styles.emojiGrid}>
          {SUGGESTED_EMOJIS.map((option) => (
            <button
              key={option}
              type="button"
              className={styles.emojiOption}
              aria-pressed={emoji === option}
              aria-label={`Use ${option}`}
              onClick={() => setValue('emoji', option, { shouldValidate: true })}
            >
              {option}
            </button>
          ))}
        </div>
        <label htmlFor="category-emoji" className={styles.subLabel}>
          Or type any emoji
        </label>
        <input
          id="category-emoji"
          className={`${styles.input} ${styles.emojiInput}`}
          type="text"
          autoComplete="off"
          aria-invalid={errors.emoji ? true : undefined}
          aria-describedby={errors.emoji ? 'category-emoji-error' : undefined}
          {...register('emoji')}
        />
        {errors.emoji && (
          <p id="category-emoji-error" className={styles.error} role="alert">
            {errors.emoji.message}
          </p>
        )}
      </fieldset>

      {showBudget && (
        <div className={styles.field}>
          <label htmlFor="category-budget" className={styles.label}>
            Monthly budget <span className={styles.optional}>(optional)</span>
          </label>
          <div className={styles.budgetWrap}>
            <span aria-hidden="true" className={styles.budgetSymbol}>
              {symbol}
            </span>
            <input
              id="category-budget"
              className={styles.budgetInput}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="No budget"
              aria-invalid={errors.budget ? true : undefined}
              aria-describedby={errors.budget ? 'category-budget-error' : 'category-budget-hint'}
              {...register('budget')}
            />
          </div>
          {errors.budget ? (
            <p id="category-budget-error" className={styles.error} role="alert">
              {errors.budget.message}
            </p>
          ) : (
            <p id="category-budget-hint" className={styles.subLabel}>
              You’ll get a warning at 80% and when you go over.
            </p>
          )}
        </div>
      )}

      <button type="submit" className={styles.primary} disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
