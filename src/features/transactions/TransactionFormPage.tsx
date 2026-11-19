import { useParams } from 'react-router-dom';
import { toLocalDateString } from '../../lib/dates.ts';
import { minorToInput } from '../../lib/money.ts';
import { useGoBack } from '../../lib/useGoBack.ts';
import EmptyState from '../../components/EmptyState.tsx';
import FullScreenPage from '../../components/FullScreenPage.tsx';
import TransactionForm from './TransactionForm.tsx';
import { useTransaction } from './hooks.ts';
import {
  addTransaction,
  deleteTransaction,
  updateTransaction,
  type TransactionInput,
} from './transactionRepository.ts';
import forms from '../../components/forms.module.css';

/**
 * Full-screen add (/transactions/new) or edit (/transactions/:id) page.
 * Shown outside the tab layout so the keyboard and form get the whole screen.
 */
export default function TransactionFormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const existing = useTransaction(id);
  const goBack = useGoBack('/transactions');

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

  let body;
  if (isEdit && existing === undefined) {
    body = (
      <p className={forms.muted} role="status">
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
          <button type="button" className={forms.danger} onClick={() => void handleDelete()}>
            Delete transaction
          </button>
        )}
      </>
    );
  }

  return (
    <FullScreenPage title={isEdit ? 'Edit transaction' : 'New transaction'} onCancel={goBack}>
      {body}
    </FullScreenPage>
  );
}
