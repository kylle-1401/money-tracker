# Plan: Money Tracker PWA

**Status:** Approved 2026-11-19 (target device: iPhone 14)
**Date:** 2026-11-19

## Target device
**Primary: iPhone 14 in Safari and as a home-screen app.** The viewport is 390×844 CSS px, with a notch at the top and the home indicator at the bottom. All layout is designed and checked at 390×844 first.
- `viewport-fit=cover` plus `env(safe-area-inset-*)` padding, so content clears the notch and home bar
- `apple-mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style` and an Apple touch icon (180×180), so it opens full-screen from the home screen
- `100dvh` instead of `100vh`, so the Safari toolbar doesn't cut off the bottom tab bar
- Small Android phones (360px wide) must not break, but iPhone 14 is the reference
- **Desktop view:** the same app centered in a phone-width column from slice 0. A proper wide layout (side navigation, dashboard and list side by side) is a separate later slice.

## Goal
A free, private, offline money tracker that anyone can install from one link. The user enters income and expenses by hand, and a dashboard shows the balance and where the money goes. All data stays on the device: no accounts, ads, analytics or servers. It is hosted free on GitHub Pages.

## Why this approach
| Need | Solution |
|---|---|
| Free hosting | GitHub Pages serves static files. The app has no backend. |
| Works on iPhone without a Mac or App Store | PWA: Safari, then Share, then Add to Home Screen. It opens full-screen with its own icon. |
| Works without internet | A service worker (`vite-plugin-pwa`) caches the whole app after the first visit. |
| Local database | IndexedDB through Dexie. It's on-device, survives restarts, and needs no SQL server. |
| Privacy | No network calls after load. Fonts, icons and libraries are bundled. No tracking. |

## Packages (need approval)
**Runtime:** `react`, `react-dom`, `react-router-dom`, `dexie`, `dexie-react-hooks`, `recharts`, `react-hook-form`, `zod`, `@hookform/resolvers`
**Dev:** `vite`, `@vitejs/plugin-react`, `typescript`, `vite-plugin-pwa`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `fake-indexeddb` (lets tests use IndexedDB), `eslint` (+ the typescript-eslint, react-hooks and jsx-a11y plugins), `prettier`

No UI kit. The styling is plain CSS with CSS variables (CSS Modules per component).

## Mobile design

Phone-first. On desktop the same layout is centered at a maximum width of about 480px, like a phone screen.

```
┌──────────────────────────┐
│ November 2026     ◀  ▶   │  month switcher
│                          │
│  Balance                 │
│  ₱ 12,480.00             │  big number
│  ┌─────────┬──────────┐  │
│  │ In      │ Out      │  │  this month
│  │ ₱25,000 │ ₱12,520  │  │
│  └─────────┴──────────┘  │
│                          │
│   ( donut: by category ) │  where the money went
│   Food 38% · Bills 25%…  │  legend shows amounts and %
│                          │
│  Recent                  │
│  🍜 Jollibee   -₱245     │
│  💼 Salary  +₱25,000     │
│                    ( + ) │  floating add button
├──────────────────────────┤
│  🏠 Home  📋 List  ⚙ Settings│  bottom tab bar
└──────────────────────────┘
```

**Add/edit screen** (opens full-screen from the + button):
- Income/Expense toggle at the top (Expense selected by default, since it's the most common)
- A large amount field with `inputmode="decimal"` so the phone shows a number pad
- Category picker as a grid of big emoji buttons
- Date (defaults to today) and an optional note
- A large Save button within thumb reach at the bottom

**Mobile details:**
- Tap targets are at least 44×44px. Inputs use 16px+ text so iOS doesn't zoom in.
- `env(safe-area-inset-*)` padding so the notch and home bar don't cover the content.
- Light and dark mode follow the phone setting (`prefers-color-scheme`).
- Income and expense are marked with **+/− and an icon, not color alone** (accessibility).
- Peso formatting through `Intl.NumberFormat('en-PH', { style: 'currency', currency })`.

## Data model (IndexedDB through Dexie, `db.ts`, schema version 1)

```ts
type TxType = 'income' | 'expense';

interface Category {
  id: string;          // crypto.randomUUID()
  name: string;        // "Food"
  type: TxType;
  emoji: string;       // "🍜"
  color: string;       // chart color
  archived: boolean;   // hidden from the picker but kept for history
  sortOrder: number;
}

interface Transaction {
  id: string;
  type: TxType;
  amountMinor: number; // integer centavos, > 0
  categoryId: string;
  date: string;        // 'YYYY-MM-DD', local calendar date
  note: string;
  createdAt: number;   // epoch ms
  updatedAt: number;
}

interface Setting { key: string; value: string } // e.g. currency = 'PHP'
```
Indexes: `transactions: id, date, categoryId, type`, `categories: id, type`, `settings: key`.

**Business rules (please confirm):**
1. Amounts are stored as integer centavos and must be > 0. Up to 2 decimals are allowed when typing.
2. A category that has transactions is **archived, not deleted**, so past reports stay correct. Empty categories can be deleted.
3. "This month" uses the transaction's `date`, not when it was entered.
4. Balance = all-time income minus all-time expenses. The In/Out tiles show only the selected month.
5. Default categories on first launch:
   - Expense: Food, Transport, Bills & Utilities, Load/Internet, Shopping, Health, Entertainment, Other
   - Income: Salary, Business/Sideline, Gifts, Other
6. Currency is a display setting only (default PHP). Changing it doesn't convert amounts.

## Folder layout
```
src/
  main.tsx, App.tsx          # router + layout shell
  db/db.ts                   # Dexie schema, seed categories
  lib/money.ts               # parse/format centavos (pure, unit-tested)
  lib/dates.ts               # month ranges (pure, unit-tested)
  features/transactions/     # form, list, hooks
  features/dashboard/        # summary tiles, donut, recent list
  features/settings/         # currency, categories, backup
  components/                # shared UI (TabBar, AmountText, Sheet...)
  styles/                    # tokens.css (colors, spacing, dark mode)
```

## Slices
Each slice gets its own branch (`feature/<n>-<name>`), passes lint, typecheck, tests and build, and gets clicked through in the browser pane at iPhone 14 size (390×844). I stop after each one for review.

| # | Slice | Done when |
|---|---|---|
| 0 | **Scaffold** | Vite + TS strict + ESLint/Prettier + Vitest set up. App shell with bottom tabs (3 empty pages), design tokens, dark mode. All checks green. |
| 1 | **Transactions** | Dexie schema with seeded categories. Add/edit/delete form (validated with Zod). List grouped by day, with empty state. `money.ts` and `dates.ts` fully unit-tested. Data survives a reload. |
| 2 | **Dashboard** | Month switcher, balance, In/Out tiles, category donut with legend (amounts and %), recent 5, and an empty state for a new user. |
| 3 | **Settings** | Currency picker. Add, rename and archive categories (emoji and color). |
| 4 | **Backup** | Export JSON (full backup) and CSV (for spreadsheets). Import JSON with validation and a preview ("Import 214 transactions?"), with a choice to replace or merge. A reminder appears if there has been no backup in 30 days. |
| 5 | **PWA** | Manifest, icons (including the Apple touch icon), offline service worker, an "Add to Home Screen" hint on iOS Safari, and an "update available" prompt. Tested offline with `npm run preview`. |
| 6 | **Deploy** | GitHub Actions workflow: on push to `main`, run checks, build and deploy to Pages. **You** create the GitHub repo and turn on Pages, and I push only when you say so. |

| 7 | **Desktop layout** | At widths of 1024px and up: side navigation, with the dashboard and transaction list shown side by side. The phone layout is unchanged. |

Later ideas (not planned): wallets (Cash/GCash/Bank), budgets per category, repeating transactions, search.

## Test plan
- **Unit:** `money.ts` (parse "1,234.5" → 123450, rejects 0, negatives, 3+ decimals and junk; formatting), `dates.ts` (month boundaries, leap years), dashboard totals and category grouping.
- **Component:** add form validation and save, list and empty state, dashboard with seeded data. Storage uses `fake-indexeddb`.
- **Manual (by me, in the browser pane at 390×844):** add, edit and delete, dashboard numbers match the entries, dark mode, reload keeps data, offline after the PWA slice.
- **Manual (by you, on the iPhone):** Add to Home Screen, airplane-mode test, and whether it feels right to use. I can't test on a real iPhone.

## Risks
- **Data loss on iOS** if Safari data is cleared or the app is removed. Covered by the backup slice and the 30-day reminder.
- **IndexedDB schema changes** later must use Dexie version upgrades that keep data. Each change gets a test.
- **Public repo** on GitHub: the code is visible, but no user data is ever in it.
- **GitHub Pages base path:** the Vite `base` must equal `/<repo-name>/`. If the repo is renamed, update it.
