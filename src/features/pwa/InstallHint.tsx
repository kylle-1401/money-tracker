import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  currentInstallContext,
  dismissInstallHint,
  isInstallHintDismissed,
  shouldShowInstallHint,
  type InstallContext,
} from './installHint.ts';
import styles from './InstallHint.module.css';

interface InstallHintProps {
  /** Injectable for tests; defaults to the real browser. */
  context?: InstallContext;
}

/**
 * Home card for iPhone users in Safari: how to add the app to the home screen.
 * Installing matters on iOS: the app then opens full-screen and its data is less
 * likely to be cleared by Safari.
 */
export default function InstallHint({ context }: InstallHintProps) {
  const [ctx] = useState(() => context ?? currentInstallContext());
  const dismissed = useLiveQuery(isInstallHintDismissed, []);
  if (dismissed === undefined || !shouldShowInstallHint(ctx, dismissed)) return null;

  return (
    <aside className={styles.card} aria-label="Install the app">
      <div className={styles.text}>
        <p className={styles.title}>Add Money Tracker to your Home Screen</p>
        <p className={styles.steps}>
          Tap{' '}
          <span className={styles.share} role="img" aria-label="the Share button">
            <ShareIcon />
          </span>{' '}
          then <strong>Add to Home Screen</strong>. It opens full-screen and works offline.
        </p>
      </div>
      <button
        type="button"
        className={styles.close}
        aria-label="Dismiss install tip"
        onClick={() => void dismissInstallHint()}
      >
        ×
      </button>
    </aside>
  );
}

/** The iOS Share glyph (square with an up arrow), so the step matches what users see. */
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11v9h12v-9" />
    </svg>
  );
}
