/** Remind the user to back up after this many days. */
export const BACKUP_REMINDER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when it's time to nudge for a backup: there is data, and the last backup (or,
 * if never backed up, the oldest entry) is more than 30 days old. A brand-new user
 * isn't nagged on day one.
 */
export function needsBackupReminder(
  now: number,
  lastBackupAt: number | null,
  oldestEntryCreatedAt: number | null,
): boolean {
  if (oldestEntryCreatedAt === null) return false; // nothing to lose yet
  const since = lastBackupAt ?? oldestEntryCreatedAt;
  return now - since > BACKUP_REMINDER_DAYS * DAY_MS;
}
