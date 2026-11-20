import { useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { toLocalDateString } from '../../lib/dates.ts';
import { useCurrency } from '../settings/currencyContext.ts';
import { MAX_BACKUP_BYTES, parseBackup, serializeBackup, type Backup } from './backupFormat.ts';
import {
  createBackup,
  getLastBackupAt,
  importBackup,
  recordBackup,
  type ImportMode,
} from './backupRepository.ts';
import { importMessage } from './importMessage.ts';
import { transactionsToCsv } from './csv.ts';
import { saveFile } from './saveFile.ts';
import styles from './BackupSection.module.css';

type Status = { kind: 'info' | 'error'; text: string } | null;

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/**
 * Settings → Backup. Data lives only on this device, so this is the safety net:
 * save a JSON backup (restorable), export CSV (for spreadsheets), or restore.
 */
export default function BackupSection() {
  const currency = useCurrency();
  const lastBackupAt = useLiveQuery(getLastBackupAt, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Backup | null>(null);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setStatus(null);
    try {
      await task();
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  const saveBackup = () =>
    run(async () => {
      const backup = await createBackup();
      const outcome = await saveFile(
        `money-tracker-backup-${toLocalDateString(new Date())}.json`,
        serializeBackup(backup),
        'application/json',
      );
      if (outcome === 'cancelled') return;
      await recordBackup();
      setStatus({ kind: 'info', text: 'Backup saved. Keep it somewhere safe, like iCloud Drive.' });
    });

  const exportCsv = () =>
    run(async () => {
      const [transactions, categories, wallets] = await Promise.all([
        db.transactions.toArray(),
        db.categories.toArray(),
        db.wallets.toArray(),
      ]);
      const csv = transactionsToCsv(
        transactions,
        new Map(categories.map((c) => [c.id, c])),
        new Map(wallets.map((w) => [w.id, w])),
        currency,
      );
      const outcome = await saveFile(
        `money-tracker-${toLocalDateString(new Date())}.csv`,
        csv,
        'text/csv',
      );
      if (outcome !== 'cancelled') {
        setStatus({ kind: 'info', text: 'Spreadsheet file exported.' });
      }
    });

  function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    setPreview(null);
    // run(): shows busy state and turns any read failure (e.g. an iCloud file that
    // isn't downloaded yet) into a visible error instead of a silent rejection.
    void run(async () => {
      if (file.size > MAX_BACKUP_BYTES) {
        throw new Error('That file is too large to be a Money Tracker backup.');
      }
      let text: string;
      try {
        text = await file.text();
      } catch {
        throw new Error('Couldn’t read that file. If it’s in iCloud, open it once in Files first.');
      }
      const result = parseBackup(text);
      if (!result.ok) throw new Error(result.error);
      setPreview(result.backup);
    });
  }

  const restore = (mode: ImportMode) =>
    run(async () => {
      if (!preview) return;
      if (mode === 'replace') {
        const localCount = await db.transactions.count();
        const ok = window.confirm(
          `Replace everything on this phone with this backup? Your ${localCount} ${localCount === 1 ? 'transaction' : 'transactions'} here will be deleted and replaced with ${preview.transactions.length} from the backup.`,
        );
        if (!ok) return;
      }
      const summary = await importBackup(preview, mode);
      setPreview(null);
      setStatus({ kind: 'info', text: importMessage(mode, summary) });
    });

  return (
    <section id="backup" className={styles.section} aria-labelledby="backup-heading">
      <h2 id="backup-heading" className={styles.sectionTitle}>
        Backup
      </h2>
      <div className={styles.group}>
        <button
          type="button"
          className={styles.row}
          onClick={() => void saveBackup()}
          disabled={busy}
        >
          Save backup
        </button>
        <button
          type="button"
          className={styles.row}
          onClick={() => void exportCsv()}
          disabled={busy}
        >
          Export for spreadsheets (CSV)
        </button>
        <button
          type="button"
          className={styles.row}
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          Restore from backup…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          tabIndex={-1}
          aria-label="Choose backup file"
          onChange={onFileChosen}
        />
      </div>
      <p className={styles.hint}>
        {lastBackupAt === undefined
          ? ' '
          : lastBackupAt === null
            ? 'No backup yet. Your data only lives on this phone.'
            : `Last backup: ${dateFormat.format(lastBackupAt)}.`}
      </p>

      {preview && (
        <div className={styles.preview} role="region" aria-label="Backup to restore">
          <p className={styles.previewTitle}>Backup from {formatExportedAt(preview.exportedAt)}</p>
          <p className={styles.hint}>
            {preview.transactions.length} transactions · {preview.wallets.length}{' '}
            {preview.wallets.length === 1 ? 'wallet' : 'wallets'} · {preview.categories.length}{' '}
            categories · {preview.currency}
          </p>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void restore('merge')}
            disabled={busy}
          >
            Add to my data
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={() => void restore('replace')}
            disabled={busy}
          >
            Replace all my data
          </button>
          <button
            type="button"
            className={styles.plain}
            onClick={() => setPreview(null)}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      )}

      {status && (
        <p
          className={status.kind === 'error' ? styles.error : styles.success}
          role={status.kind === 'error' ? 'alert' : 'status'}
        >
          {status.text}
        </p>
      )}
    </section>
  );
}

function formatExportedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'an unknown date' : dateFormat.format(date);
}
