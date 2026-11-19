import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './UpdatePrompt.module.css';

/**
 * Registers the service worker (offline support) and shows a small toast when:
 * - the app is cached and works offline for the first time, or
 * - a new version was downloaded: it waits for the user to tap Reload, so an update
 *   never interrupts someone mid-entry.
 */
export default function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  function close() {
    setOfflineReady(false);
    setNeedRefresh(false);
  }

  return (
    <div className={styles.toast} role="status">
      <p className={styles.text}>
        {needRefresh ? 'A new version is ready.' : 'Ready to work offline.'}
      </p>
      {needRefresh && (
        <button
          type="button"
          className={styles.primary}
          onClick={() => void updateServiceWorker(true)}
        >
          Reload
        </button>
      )}
      <button type="button" className={styles.close} onClick={close}>
        {needRefresh ? 'Later' : 'OK'}
      </button>
    </div>
  );
}
