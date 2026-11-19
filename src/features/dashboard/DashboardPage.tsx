import PageHeader from '../../components/PageHeader.tsx';
import EmptyState from '../../components/EmptyState.tsx';

/** Home tab. Balance, monthly in/out and the category chart arrive in slice 2. */
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Home" />
      <EmptyState title="No money tracked yet">
        Your balance and where your money goes will show up here.
      </EmptyState>
    </>
  );
}
