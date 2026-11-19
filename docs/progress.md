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

## In progress
- Waiting for review of slice 3.

## Next
- Slice 4: backup (export JSON/CSV, import JSON with preview, 30-day backup reminder).

## Decisions / notes
- ESLint is pinned to 9, because `eslint-plugin-jsx-a11y` doesn't support ESLint 10 yet. ESLint 9 shows as deprecated in npm. Revisit when jsx-a11y supports 10.
- Vite `base: './'` (relative), so the build works under any GitHub Pages repo name.
- git comes from GitHub Desktop's bundled copy (`%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`). It isn't on PATH on this machine.

## Open questions
- Final app name (working name: Money Tracker).
- GitHub repo: the owner creates it on their account when we reach slice 6.
