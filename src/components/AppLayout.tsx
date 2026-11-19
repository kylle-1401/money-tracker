import { Outlet } from 'react-router-dom';
import TabBar from './TabBar.tsx';
import styles from './AppLayout.module.css';

/**
 * App shell: the current page on top, the bottom tab bar fixed below it.
 * On desktop the whole shell is a centered phone-width column (see --app-max-width).
 */
export default function AppLayout() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
