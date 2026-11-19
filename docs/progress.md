# Progress

## Done
- 2026-11-19: Repo created locally (`git init`, branch `main`, nothing committed yet). `docs/PROJECT.md` filled in for this app.
- 2026-11-19: Plan approved: `docs/plans/2026-11-19-money-tracker.md`. Target device is iPhone 14 (390×844). Desktop layout added as slice 7.
- 2026-11-19: **Slice 0 (scaffold)** on branch `feature/0-scaffold`, not committed yet:
  - Vite 8 + React 19 + TypeScript 6 (strict), React Router 7 (HashRouter), Vitest 5 + Testing Library, ESLint 9 + Prettier
  - App shell: 3 bottom tabs (Home, List, Settings) with empty states, design tokens, light/dark mode, iPhone safe areas, `100dvh`, iOS home-screen meta tags
  - 6 shell tests pass; lint, typecheck, format, build and `npm audit` are clean
  - Checked in the browser pane at 390×844 (light and dark), 360×740 (no horizontal scroll) and desktop (centered 480px column); a refresh on `#/settings` stays on Settings; no console errors
  - Committed `0e4ef15`.
- 2026-11-19: **Slice 1 (transactions)** on branch `feature/1-transactions`, not committed yet:
  - Dexie database (`src/db/`), schema v1, seeds 8 expense and 4 income categories on first open
  - `lib/money.ts` (centavo parsing and formatting, no float math) and `lib/dates.ts` (local dates, "Today"/"Yesterday" labels)
  - Full-screen add/edit form (`#/transactions/new`, `#/transactions/:id`): Expense/Income toggle, big amount field with the number pad, category tile grid, date, note, Zod validation; delete with a confirm dialog
  - List grouped by day, newest first, with a day net total; tap a row to edit
  - Floating + button on Home and List; ErrorBoundary so the app is never a blank screen
  - Added `.gitattributes` (LF line endings) because this machine has `core.autocrlf=true`
  - 79 tests pass; lint, typecheck, format, build and audit are clean
  - Browser pane at 390×844: add → shows under Today; reload keeps it; edit loads 245.50; an invalid amount (1.234) shows an error; delete → empty state; dark mode OK; no console errors

  - Committed `d8117a8`.
- 2026-11-19: **Slice 2 (dashboard)** on branch `feature/2-dashboard`, not committed yet:
  - All-time balance (hero figure), month switcher (month kept in the URL `?month=YYYY-MM`; next is disabled at the current month), Money in/out tiles, "Saved/Overspent ₱X in <month>"
  - "Where your money went" as **ranked horizontal bars** (one hue, name + amount + %), largest first, instead of the planned donut. **Recharts was dropped**: no new package, and the bundle grew about 2 KB instead of about 100 KB
  - Recent 5 with "See all"; `TransactionRow` is shared by the List and Home pages
  - Pure `summary.ts` (balance, month totals, spending by category) and month helpers in `dates.ts`, all unit-tested
  - Fixed: the + button covered the last row at the bottom of the page (extra bottom padding on pages with the button)
  - 106 tests pass; lint, typecheck, format, build and audit are clean
  - Browser pane at 390×844 with 12 demo entries: the numbers match a hand calculation, previous month works, light and dark OK, no horizontal scroll, no console errors

  - Committed `b0eb167`.
- 2026-11-19: **Slice 3 (settings)** on branch `feature/3-settings`, not committed yet:
  - Currency picker (10 currencies that use 2 decimals; JPY/KRW are left out because amounts are stored in hundredths). It's display only, with no conversion. Saved in the `settings` table and shared app-wide through `CurrencyProvider`
  - Category lists per type (active first, archived labelled), plus add/edit page: name, emoji quick picks or any typed emoji, archive/restore, delete only when unused (otherwise "Used by N transactions… archive instead")
  - Rules enforced in `categoryRepository` too: name required, at most 30 characters, unique per type (case-insensitive); type fixed after creation; delete is blocked inside a DB transaction if used
  - Refactor: shared `FullScreenPage` + `useGoBack` + `forms.module.css`; removed `TransactionFormPage.module.css`
  - `vite.config.ts`: `chunkSizeWarningLimit: 700` (bundle 507 KB raw / 159 KB gzipped; one cached offline bundle, so splitting has little value)
  - The category `color` field is now unused by the UI (bars use one hue). It's kept for future charts and not editable
  - 132 tests pass; lint, typecheck, format, build and audit are clean
  - Browser pane at 390×844: Settings list, added "Pets 🐶" (dark mode), switched to USD → Home shows $ with the same numbers, switched back to PHP; no console errors

  - Committed `72cfd31`.
- 2026-11-19: **Slice 4 (backup)** on branch `feature/4-backup`, not committed yet:
  - Settings → Backup: **Save backup** (JSON, the full restorable dataset), **Export for spreadsheets (CSV)** (one-way), **Restore from backup…** with a preview (date, counts, currency) and **Add to my data** (merge) or **Replace all my data** (confirm first)
  - Files are handed out through the iPhone share sheet (Web Share API with files → Save to Files, AirDrop, etc.), with a download-link fallback
  - The imported file is treated as untrusted: 20 MB cap, zod schema (types, lengths, ranges, counts, unique ids, every transaction points to a same-type category in the file), and newer-version files are refused. Import runs in one DB transaction (all or nothing)
  - Merge: same id → the backup wins; a same-name category with a different id is folded into the existing one (no duplicate "Pets"); the currency is unchanged. Replace also restores the currency
  - CSV: RFC 4180 quoting, formula-injection guard (`'` prefix on text starting with `= + - @`), expenses negative, UTF-8 BOM + CRLF for Excel
  - Home reminder banner when the last backup (or, if never backed up, the oldest entry) is over 30 days old; links to `#/settings?focus=backup`. A CSV export doesn't count as a backup
  - Fixed during testing: merging an identical backup said "Added 13 transactions"; it now reports new vs updated honestly
  - Security review (security-reviewer agent): passed with notes. Fixed:
    - Medium: merge could flip an existing category's type → now rejected as a conflict (all or nothing)
    - Ids restricted to `[A-Za-z0-9_-]{1,100}` (they go into URLs)
    - Duplicate category names per type are rejected; names normalized like the app does
    - File-read errors and parsing now show an error and a busy state
    - The replace confirmation states both counts; a replace with no categories re-seeds the defaults
    - Caps lowered to 5 MB / 50,000 transactions
    - Control and bidi characters are stripped from names, emoji and notes (ZWJ kept)
  - **Open follow-ups from the review:**
    - Content-Security-Policy meta tag: do it in slice 5 alongside the service worker
    - The Transactions list renders every row: add paging or windowing before the data gets large
    - Backups and CSVs are unencrypted plain text: tell users in the app copy or README
  - 200 tests pass; lint, typecheck, format, build and audit are clean
  - Browser pane at 390×844: reminder shows for 40-day-old data → Back up → save (share sheet stubbed to capture the file: 13 transactions, 13 categories) → "Last backup" updated → restore the same file → preview → merge → "Nothing new to add", count unchanged; junk file → clear error; dark mode OK; no console errors

  - Committed `64326b9`.
- 2026-11-19: **Slice 5 (PWA)** on branch `feature/5-pwa`, not committed yet:
  - `vite-plugin-pwa` 2.0 (+ `workbox-build`, `workbox-window`): web manifest, Workbox service worker precaching the whole app (16 files), `registerType: 'prompt'`
  - Icons drawn by `scripts/generate-icons.mjs` (no image libraries; Node zlib): `apple-touch-icon.png` 180, `pwa-192/512`, maskable 512, `favicon.svg`
  - `UpdatePrompt`: "Ready to work offline" and "A new version is ready → Reload / Later" (never auto-reloads mid-entry)
  - `InstallHint` on Home for iPhone/iPad in the browser (not once installed): "Tap Share, then Add to Home Screen"; dismissal saved in `settings`
  - **Content-Security-Policy** meta (build only): `default-src 'self'`, `connect-src 'self'` etc. Verified: the app renders, and an outside `fetch` is blocked
  - 211 tests pass; lint, typecheck, format and build are clean
  - **`npm audit`: 4 moderate** advisories, all in `workbox-build` → `glob`/`minimatch` (build-time only, runs on our own files, never shipped to the browser). npm's fix is a breaking downgrade. Decision pending with the owner
  - **Not verified: offline mode.** The in-app browser pane can't register any service worker (even a one-line probe fails with "unknown error when fetching the script"). Verify in real Chrome or on the iPhone after deploy

## In progress
- Waiting for review of slice 5.

## Next
- Slice 6: deploy to GitHub Pages (GitHub Actions workflow). The owner creates the GitHub repo; push only on request.

## Decisions / notes
- ESLint is pinned to 9, because `eslint-plugin-jsx-a11y` doesn't support ESLint 10 yet. ESLint 9 shows as deprecated in npm. Revisit when jsx-a11y supports 10.
- Vite `base: './'` (relative), so the build works under any GitHub Pages repo name.
- git comes from GitHub Desktop's bundled copy (`%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`). It isn't on PATH on this machine.

## Open questions
- Final app name (working name: Money Tracker).
- GitHub repo: the owner creates it on their account when we reach slice 6.
