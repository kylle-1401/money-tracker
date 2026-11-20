import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.tsx';
import { db } from '../../db/db.ts';
import { addTransaction } from '../transactions/transactionRepository.ts';
import { createBackup, getLastBackupAt, recordBackup } from './backupRepository.ts';
import { serializeBackup } from './backupFormat.ts';
import { saveFile } from './saveFile.ts';
import { first } from '../../test/helpers.ts';

// The share sheet / download can't run in tests; capture what would be saved instead.
vi.mock('./saveFile.ts', () => ({ saveFile: vi.fn() }));
const saveFileMock = vi.mocked(saveFile);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const DAY = 24 * 60 * 60 * 1000;

function lunch(createdAt = Date.now()) {
  return addTransaction(
    {
      type: 'expense',
      amountMinor: 24550,
      categoryId: 'expense-food',
      walletId: 'wallet-cash',
      date: '2026-11-19',
      note: 'Jollibee',
    },
    createdAt,
  );
}

function jsonFile(text: string, name = 'backup.json') {
  return new File([text], name, { type: 'application/json' });
}

beforeEach(() => {
  saveFileMock.mockReset();
  saveFileMock.mockResolvedValue('shared');
});

describe('Save backup', () => {
  it('SaveBackup_Shared_SavesJsonAndRecordsDate', async () => {
    await lunch();
    const user = userEvent.setup();
    renderAt('/settings');

    expect(
      await screen.findByText('No backup yet. Your data only lives on this phone.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save backup' }));

    expect(await screen.findByText(/Backup saved/)).toBeInTheDocument();
    const [filename, content, type] = first(saveFileMock.mock.calls);
    expect(filename).toMatch(/^money-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(type).toBe('application/json');
    expect(JSON.parse(content).transactions).toHaveLength(1);
    expect(await getLastBackupAt()).not.toBeNull();
    expect(await screen.findByText(/^Last backup: /)).toBeInTheDocument();
  });

  it('SaveBackup_Cancelled_DoesNotRecordBackup', async () => {
    saveFileMock.mockResolvedValue('cancelled');
    const user = userEvent.setup();
    renderAt('/settings');

    await user.click(await screen.findByRole('button', { name: 'Save backup' }));

    expect(saveFileMock).toHaveBeenCalled();
    expect(screen.queryByText(/Backup saved/)).not.toBeInTheDocument();
    expect(await getLastBackupAt()).toBeNull();
  });

  it('ExportCsv_SavesSpreadsheetFile', async () => {
    await lunch();
    const user = userEvent.setup();
    renderAt('/settings');

    await user.click(await screen.findByRole('button', { name: 'Export for spreadsheets (CSV)' }));

    expect(await screen.findByText('Spreadsheet file exported.')).toBeInTheDocument();
    const [filename, content, type] = first(saveFileMock.mock.calls);
    expect(filename).toMatch(/\.csv$/);
    expect(type).toBe('text/csv');
    expect(content).toContain('2026-11-19,Expense,Cash,,Food,-245.50,,PHP,Jollibee');
    expect(await getLastBackupAt()).toBeNull(); // CSV can't restore, so it isn't a backup
  });

  it('SaveBackup_Fails_ShowsError', async () => {
    saveFileMock.mockRejectedValue(new Error('Disk full'));
    const user = userEvent.setup();
    renderAt('/settings');

    await user.click(await screen.findByRole('button', { name: 'Save backup' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Disk full');
  });
});

describe('Restore', () => {
  async function backupText() {
    await lunch();
    const text = serializeBackup(await createBackup(new Date('2026-11-19T10:00:00')));
    await db.transactions.clear();
    return text;
  }

  it('Restore_Merge_ShowsPreviewThenAddsTransactions', async () => {
    const text = await backupText();
    const user = userEvent.setup();
    renderAt('/settings');

    await user.upload(await screen.findByLabelText('Choose backup file'), jsonFile(text));

    const preview = await screen.findByRole('region', { name: 'Backup to restore' });
    expect(within(preview).getByText('Backup from Nov 19, 2026')).toBeInTheDocument();
    expect(
      within(preview).getByText(/1 transactions · 1 wallet · 12 categories · PHP/),
    ).toBeInTheDocument();

    await user.click(within(preview).getByRole('button', { name: 'Add to my data' }));

    expect(await screen.findByText('Added 1 transaction.')).toBeInTheDocument();
    expect(await db.transactions.count()).toBe(1);
  });

  it('Restore_Replace_AsksFirstThenReplaces', async () => {
    const text = await backupText();
    await addTransaction({
      type: 'expense',
      amountMinor: 1,
      categoryId: 'expense-food',
      walletId: 'wallet-cash',
      date: '2026-11-01',
      note: 'local only',
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAt('/settings');

    await user.upload(await screen.findByLabelText('Choose backup file'), jsonFile(text));
    await user.click(await screen.findByRole('button', { name: 'Replace all my data' }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining(
        'Your 1 transaction here will be deleted and replaced with 1 from the backup.',
      ),
    );
    expect(await screen.findByText('Restored 1 transaction.')).toBeInTheDocument();
    const notes = (await db.transactions.toArray()).map((t) => t.note);
    expect(notes).toEqual(['Jollibee']);
    confirm.mockRestore();
  });

  it('Restore_ReplaceDeclined_ChangesNothing', async () => {
    const text = await backupText();
    await addTransaction({
      type: 'expense',
      amountMinor: 1,
      categoryId: 'expense-food',
      walletId: 'wallet-cash',
      date: '2026-11-01',
      note: 'local only',
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderAt('/settings');

    await user.upload(await screen.findByLabelText('Choose backup file'), jsonFile(text));
    await user.click(await screen.findByRole('button', { name: 'Replace all my data' }));

    expect((await db.transactions.toArray()).map((t) => t.note)).toEqual(['local only']);
    expect(screen.getByRole('region', { name: 'Backup to restore' })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('Restore_InvalidFile_ShowsErrorAndNoPreview', async () => {
    const user = userEvent.setup();
    renderAt('/settings');

    await user.upload(
      await screen.findByLabelText('Choose backup file'),
      jsonFile('{"app":"money-tracker","version":1,"transactions":"x"}'),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('damaged or was edited');
    expect(screen.queryByRole('region', { name: 'Backup to restore' })).not.toBeInTheDocument();
  });

  it('Restore_FileCannotBeRead_ShowsError', async () => {
    const unreadable = jsonFile('{}');
    unreadable.text = () => Promise.reject(new Error('NotReadableError'));
    const user = userEvent.setup();
    renderAt('/settings');

    await user.upload(await screen.findByLabelText('Choose backup file'), unreadable);

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t read that file');
  });

  it('Restore_MergeConflict_ShowsErrorAndKeepsData', async () => {
    const backup = await createBackup();
    const food = backup.categories.find((c) => c.id === 'expense-food');
    if (!food) throw new Error('seed missing');
    food.type = 'income';
    const user = userEvent.setup();
    renderAt('/settings');

    await user.upload(
      await screen.findByLabelText('Choose backup file'),
      jsonFile(serializeBackup(backup)),
    );
    await user.click(await screen.findByRole('button', { name: 'Add to my data' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('conflicts with your categories');
    expect((await db.categories.get('expense-food'))?.type).toBe('expense');
  });

  it('Restore_Cancel_HidesPreviewAndChangesNothing', async () => {
    const text = await backupText();
    const user = userEvent.setup();
    renderAt('/settings');

    await user.upload(await screen.findByLabelText('Choose backup file'), jsonFile(text));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('region', { name: 'Backup to restore' })).not.toBeInTheDocument();
    expect(await db.transactions.count()).toBe(0);
  });
});

describe('Backup reminder on Home', () => {
  it('Reminder_OldDataNeverBackedUp_ShowsAndLinksToBackup', async () => {
    await lunch(Date.now() - 40 * DAY);
    const user = userEvent.setup();
    renderAt('/');

    const banner = await screen.findByRole('complementary', { name: 'Backup reminder' });
    expect(banner).toHaveTextContent('Your data only lives on this phone.');

    await user.click(within(banner).getByRole('link', { name: 'Back up' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save backup' })).toBeInTheDocument();
  });

  it('Reminder_RecentBackup_Hidden', async () => {
    await lunch(Date.now() - 40 * DAY);
    await recordBackup(Date.now() - 2 * DAY);
    renderAt('/');

    await screen.findByRole('region', { name: 'Total balance' });
    expect(
      screen.queryByRole('complementary', { name: 'Backup reminder' }),
    ).not.toBeInTheDocument();
  });

  it('Reminder_NewUser_Hidden', async () => {
    await lunch();
    renderAt('/');

    await screen.findByRole('region', { name: 'Total balance' });
    expect(
      screen.queryByRole('complementary', { name: 'Backup reminder' }),
    ).not.toBeInTheDocument();
  });
});
