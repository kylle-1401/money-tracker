import PageHeader from '../../components/PageHeader.tsx';
import EmptyState from '../../components/EmptyState.tsx';

/** Settings tab. Currency, categories and backup arrive in slices 3 and 4. */
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <EmptyState title="Nothing to set yet">
        Currency, categories and backup will live here.
      </EmptyState>
    </>
  );
}
