import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toLocalDateString } from '../../lib/dates.ts';
import { minorToInput } from '../../lib/money.ts';
import EmptyState from '../../components/EmptyState.tsx';
import TransactionForm from './TransactionForm.tsx';
import { useTransaction } from './hooks.ts';
import {
  addTransaction,
  deleteTransaction,
  updateTransaction,
  type TransactionInput,
} from './transactionRepository.ts';
import styles from './TransactionFormPage.module.css';

/**
 * Full-screen add (/transactions/new) or edit (/transactions/:id) page.
 * Shown outside the tab layout so the keyboard and form get the whole screen.
 */
export default function TransactionFormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const existing = useTransaction(id);
  const navigate = useNavigate();
  const location = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  /** Back to where the user came from; if they opened this URL directly, go to the list. */
  function goBack() {
    if (location.key !== 'default') {
      void navigate(-1);
    } else {
      void navigate('/transactions', { replace: true });
    }
  }

  async function handleSave(input: TransactionInput) {
    if (isEdit) {
      await updateTransaction(id, input);
    } else {
      await addTransaction(input);
    }
    goBack();
  }

  async function handleDelete() {
    if (!isEdit) return;
    // Native confirm: simple, accessible, and works offline on iOS.
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return;
    await deleteTransaction(id);
    goBack();
  }

  const title = isEdit ? 'Edit transaction' : 'New transaction';

  let body;
  if (isEdit && existing === undefined) {
    body = (
      <p className={styles.muted} role="status">
        Loading…
      </p>
    );
  } else if (isEdit && existing === null) {
    body = <EmptyState title="Transaction not found">It may have been deleted.</EmptyState>;
  } else {
    body = (
      <>
        <TransactionForm
          // Remount when switching records so defaults reset.
          key={existing?.id ?? 'new'}
          submitLabel={isEdit ? 'Save changes' : 'Save'}
          defaultValues={
            existing
              ? {
                  type: existing.type,
                  amount: minorToInput(existing.amountMinor),
                  categoryId: existing.categoryId,
                  date: existing.date,
                  note: existing.note,
                }
              : {
                  type: 'expense', // most entries are expenses
                  amount: '',
                  categoryId: '',
                  date: toLocalDateString(new Date()),
                  note: '',
                }
          }
          onSubmit={handleSave}
        />
        {isEdit && (
          <button type="button" className={styles.danger} onClick={() => void handleDelete()}>
            Delete transaction
          </button>
        )}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.cancel} onClick={goBack}>
          Cancel
        </button>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        <span className={styles.spacer} aria-hidden="true" />
      </header>
      <main className={styles.main}>{body}</main>
    </div>
  );
}
