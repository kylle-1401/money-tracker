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

  - Committed `2983765`. The owner continued without objecting to the audit note (treated as accepted for now; recheck when workbox-build updates)
- 2026-11-19: **Slice 6 (deploy)** on branch `feature/6-deploy`, not committed yet:
  - `.github/workflows/deploy.yml`: on PRs runs `npm ci`, lint, typecheck, format, tests, build; on push to `main` (or manual run) also uploads `dist/` and deploys with `actions/deploy-pages`. Least-privilege permissions; no secrets needed
  - `README.md`: iPhone install steps, backup/privacy notes (unencrypted backups), dev and deploy instructions
  - Verified locally: the full CI step chain passes from a clean `npm ci`. The lockfile includes the Linux build bindings (rolldown, rollup, lightningcss)
  - **Not verified:** the workflow on GitHub itself (needs the repo)

- 2026-11-20: Merged the slices into `main`. Before republishing, the history was rewritten so the AI assistant instruction files (kept locally, now in `.gitignore`) were never committed.

- 2026-11-20: Republished; live at the GitHub Pages URL. Pages deploy verified (the "Ready to work offline" message appeared on the real site).
- 2026-11-20: Plan approved for wallets, transfers and budget alerts: `docs/plans/2026-11-20-wallets-and-transfers.md` (slices 7–9; desktop layout moves after).
- 2026-11-20: **Slice 7 (wallets)** on branch `feature/7-wallets`, not committed yet:
  - Dexie **schema v2**: `wallets` table; every transaction gets `walletId`. The upgrade creates "Cash 💵" and moves every existing entry into it (one IndexedDB transaction). New installs get Cash from the populate step
  - Settings → **Wallets**: list with balances, add/edit (name, emoji, card color, starting balance with a "money I owe" switch for negative balances), move earlier/later, archive/restore, delete only when unused. At least one wallet always stays active
  - Entry form: **Paid from / Received in** wallet chips; remembers the last wallet used (`settings.lastWalletId`); editing an entry whose wallet was archived still shows it
  - Home: **Total balance** (starting balances + all-time income − expenses, archived wallets included) and swipeable **wallet cards** with an "Add wallet" card; rows show "💵 Cash · note" once there are 2+ wallets
  - **Backup format v2** (includes wallets). v1 files still restore: entries go into Cash. Merge folds wallets by name like categories and never leaves every wallet archived. CSV gains a **Wallet** column
  - Wallet colors are a fixed set of tokens (light and dark), applied with a `data-color` attribute, not inline styles (keeps the CSP strict)
  - Security review (security-reviewer agent): passed with notes. Fixed:
    - Medium: merging an old **v1** backup overwrote this phone's Cash wallet (name, starting balance, archived) with the made-up default → the v1 stand-in is skipped when Cash exists here (and still added if Cash was deleted)
    - Same-id wallets keep this phone's sort order on merge
    - Control/bidi characters are now stripped when the app saves wallet and category names, emoji and notes, with the same rule as import (`lib/text.ts`, now also LRM/RLM/ALM). Before, a name like "GCash" + U+202E could make the app's own backup fail to restore
    - Wallet emoji length is checked in the repository, not only the form
    - Saving an entry checks the wallet and writes in one DB transaction
    - CSV cells with `;` are quoted (formula split in `;`-separator locales)
    - Merges are capped on the merged total (100 wallets / 50,000 transactions), not just per file
    - Noted, not changed: an old tab still running v1 code can't write after the upgrade, because Dexie closes the old connection when the database version changes
  - 262 tests pass (+51); lint, typecheck, format and build are clean
  - Browser pane (production build, 390×844): created a real v1-format IndexedDB with 3 entries, then opened the new build → upgraded to v2, all 3 entries in Cash, balance ₱24,704.50 as calculated; added GCash (₱5,120 starting) through the UI, spent ₱300 from it → GCash ₱4,820, total ₱29,524.50 (matches hand calculation); rows show the wallet; Settings and Home OK in dark mode; no horizontal scroll. Only console error: the known service-worker limitation of the pane

  - Committed `a6fd053`.
- 2026-11-20: **Slice 8 (transfers)** on branch `feature/8-transfers`, not committed yet:
  - New entry type **⇄ Transfer**: From, To (never the same wallet; the To list hides the From wallet), amount, optional **fee** (starts empty = 0 every time, never carried over; owner request), date, note, no category
  - Business rules in one place (`transactions/effects.ts`): the From wallet loses amount + fee, the To wallet gains the amount; only the fee counts as spending (Money out, and a fixed "🔁 Transfer fees" row in "Where your money went")
  - Rows show "📱 GCash → 💵 Cash", "Fee ₱15.00", and the unsigned amount moved
  - List: **wallet filter chips** (`?wallet=<id>`); filtered day totals show that wallet's change (transfers in count as +)
  - Dexie **schema v3**: index on `toWalletId` only (no data change), so a wallet that only received transfers can't be deleted
  - Categories now use their own `CategoryType` (income/expense); `TxType` adds `transfer`
  - Editing a transfer into an expense replaces the whole record (no stale second wallet)
  - **Backup format v3** (transfers); a slice-7 app refuses v3 files as "made by a newer version". CSV columns: Date, Type, Wallet, To wallet, Category, Amount, Fee, Currency, Note
  - Test setup: async lookups wait up to 3s (one timeout flake was seen once on a slow run)
  - Security review (security-reviewer agent): passed, Low findings only. Fixed: balance math applies a (corrupt) self-transfer once; saving an income/expense now also checks the category exists and matches the type, the date, and the note length, the same checks backup import makes, so the app can't save something its own backup refuses to restore
  - **Open questions for the owner:** should a fee be allowed to exceed the amount moved? Should archived wallets be blocked from new entries at the data level too (the form already hides them)?
  - 310 tests pass (+43); lint, typecheck, format and build are clean
  - Browser pane (production build, 390×844): the slice-7 database (v2) upgraded to v3 with the new index; transfer GCash → Cash ₱1,000 + ₱15 fee via the form → Cash ₱25,704.50, GCash ₱3,805.00, total ₱29,509.50, Money out ₱610.50, "Transfer fees ₱15.00" row, today's total −₱365 (all match hand calculation); GCash filter shows −₱1,315 for today; dark mode OK; no horizontal scroll

## In progress
- Slice 8 waiting for review and the go-ahead to commit.

## Next
- When this deploys: owners should **Save backup before tapping Reload** on that update (the storage upgrades run once and can't be undone).
- Slice 9: budget alerts. Then desktop layout.
- iPhone test of the live app: Airplane Mode, install tip, share sheet, date picker.
- Follow-ups: paging for long transaction lists; recheck the `npm audit` advisories.

## Decisions / notes
- ESLint is pinned to 9, because `eslint-plugin-jsx-a11y` doesn't support ESLint 10 yet. ESLint 9 shows as deprecated in npm. Revisit when jsx-a11y supports 10.
- Vite `base: './'` (relative), so the build works under any GitHub Pages repo name.
- git comes from GitHub Desktop's bundled copy (`%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`). It isn't on PATH on this machine.

## Open questions
- Final app name (working name: Money Tracker).
- GitHub repo: the owner creates it on their account when we reach slice 6.
