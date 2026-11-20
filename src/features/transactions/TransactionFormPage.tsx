import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDefaultWalletId, rememberLastWallet } from '../wallets/walletRepository.ts';
import { monthKeyOf, toLocalDateString } from '../../lib/dates.ts';
import { useEffect } from 'react';
import { saveAndCheckBudgets } from '../budget/checkBudgets.ts';
import { dismissBudgetAlerts } from '../budget/budgetAlerts.ts';
import { useCurrency } from '../settings/currencyContext.ts';
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
  // New entries start in the last wallet used (read once; editing ignores it).
  const defaultWalletId = useLiveQuery(getDefaultWalletId, []);
  const currency = useCurrency();
  // An alert from an earlier save is old news once you start the next entry.
  useEffect(() => dismissBudgetAlerts(), []);

  async function handleSave(input: TransactionInput) {
    // Budget alerts (slice 9): compare the entry's month before and after the save.
    await saveAndCheckBudgets(monthKeyOf(input.date), currency, async () => {
      if (isEdit) {
        await updateTransaction(id, input);
      } else {
        await addTransaction(input);
        try {
          await rememberLastWallet(input.walletId);
        } catch (error) {
          // The entry is saved; failing to remember the wallet must not show
          // "Could not save" (a retry would add a duplicate).
          console.error('Could not remember the last wallet', error);
        }
      }
    });
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
  if ((isEdit && existing === undefined) || (!isEdit && defaultWalletId === undefined)) {
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
                  walletId: existing.walletId,
                  toWalletId: existing.toWalletId ?? '',
                  fee: existing.feeMinor ? minorToInput(existing.feeMinor) : '',
                  date: existing.date,
                  note: existing.note,
                }
              : {
                  type: 'expense', // most entries are expenses
                  amount: '',
                  categoryId: '',
                  walletId: defaultWalletId ?? '',
                  toWalletId: '',
                  fee: '',
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
