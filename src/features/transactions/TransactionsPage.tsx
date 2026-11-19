import PageHeader from '../../components/PageHeader.tsx';
import EmptyState from '../../components/EmptyState.tsx';

/** List tab. Adding, editing and listing transactions arrive in slice 1. */
export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transactions" />
      <EmptyState title="No transactions yet">
        Every peso in and out will be listed here, newest first.
      </EmptyState>
    </>
  );
}
