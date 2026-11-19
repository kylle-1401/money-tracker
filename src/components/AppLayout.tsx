import { Link, Outlet, useLocation } from 'react-router-dom';
import TabBar from './TabBar.tsx';
import { PlusIcon } from './icons.tsx';
import styles from './AppLayout.module.css';

// The add button only makes sense where money is shown.
const pagesWithAddButton = new Set(['/', '/transactions']);

/**
 * App shell: the current page on top, the bottom tab bar fixed below it, and a
 * floating + button in the thumb zone on Home and List.
 * On desktop the whole shell is a centered phone-width column (see --app-max-width).
 */
export default function AppLayout() {
  const { pathname } = useLocation();
  const showAddButton = pagesWithAddButton.has(pathname);

  return (
    <div className={styles.shell}>
      <main className={showAddButton ? `${styles.main} ${styles.withFab}` : styles.main}>
        <Outlet />
      </main>
      {showAddButton && (
        <Link to="/transactions/new" className={styles.fab} aria-label="Add transaction">
          <PlusIcon />
        </Link>
      )}
      <TabBar />
    </div>
  );
}
