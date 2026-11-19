import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Transaction } from '../../db/types.ts';
import { getLastBackupAt } from './backupRepository.ts';
import { needsBackupReminder } from './reminder.ts';
import styles from './BackupReminder.module.css';

interface BackupReminderProps {
  transactions: readonly Transaction[];
  /** Injectable for tests. */
  now?: number;
}

/**
 * Home banner shown when the last backup (or the oldest entry, if never backed up)
 * is over 30 days old. Data only lives on the phone, so this is the nudge that
 * prevents losing it.
 */
export default function BackupReminder({ transactions, now: nowProp }: BackupReminderProps) {
  // Read the clock once per mount (lazy initializer), so renders stay pure.
  const [now] = useState(() => nowProp ?? Date.now());
  const lastBackupAt = useLiveQuery(getLastBackupAt, []);
  if (lastBackupAt === undefined) return null; // still loading

  const oldest = transactions.reduce<number | null>(
    (min, t) => (min === null || t.createdAt < min ? t.createdAt : min),
    null,
  );
  if (!needsBackupReminder(now, lastBackupAt, oldest)) return null;

  return (
    <aside className={styles.banner} aria-label="Backup reminder">
      <span className={styles.icon} aria-hidden="true">
        💾
      </span>
      <p className={styles.text}>
        <strong>Time for a backup.</strong>{' '}
        {lastBackupAt === null
          ? 'Your data only lives on this phone.'
          : 'Your last backup is over 30 days old.'}
      </p>
      <Link to="/settings?focus=backup" className={styles.action}>
        Back up
      </Link>
    </aside>
  );
}
