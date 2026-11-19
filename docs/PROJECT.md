# Project Context

- **Name:** Money Tracker (working name)
- **What it does (2-3 sentences):** A personal income and expense tracker. The user types in money coming in and going out, and a dashboard shows the balance and where the money goes. It runs as an offline Progressive Web App (PWA) and keeps all data on the user's own device.
- **Project type:** New development
- **Users:** Anyone with a phone browser (iPhone Safari and Android Chrome first, desktop works too). Each user's data lives only on their own device. There are no accounts and no shared data.
- **Stack:**
  - **No backend and no SQL database.** It is a static front end only: React + TypeScript + Vite.
  - **Storage:** IndexedDB in the browser through Dexie. Use Dexie's `useLiveQuery` for reactive reads, not TanStack Query (there is no server state).
  - **Hosting:** a static site on GitHub Pages, deployed by GitHub Actions. Routing uses `HashRouter` so page refreshes don't 404 on Pages.
  - **Offline/PWA:** `vite-plugin-pwa` (Workbox service worker plus a web app manifest).
  - **Charts:** Recharts. **Forms:** React Hook Form + Zod.
- **Environments:** Local (`npm run dev`) and Prod (GitHub Pages). No staging.
- **CI / issue tracker:** GitHub Actions (build, lint, test, deploy). Issues on GitHub.
- **Project commands** (run in the repo root):
  ```bash
  npm ci
  npm run dev        # local dev server
  npm run lint && npm run typecheck && npm test && npm run build
  npm run preview    # serve the production build (test the PWA/offline here)
  ```

## Domain notes
- **Glossary:**
  - *Transaction*: one entry, either income or an expense.
  - *Category*: a label such as Food or Salary. Each category belongs to one type (income or expense).
  - *Balance*: total income minus total expenses, across all time.
- **Key business rules** (spec: `docs/plans/2026-11-19-money-tracker.md`):
  - Amounts are stored as **integer minor units** (centavos), never floats. ₱12.50 is stored as `1250`.
  - Amounts must be greater than 0. The sign comes from the type, not the number.
  - Dates are stored as local calendar dates (`YYYY-MM-DD`), not timestamps, so "which month" never shifts with time zones.
  - The default currency is PHP (₱). Currency is a display setting only, with no conversion.
- **Known gotchas:**
  - iOS Safari can clear site data for websites that aren't used for a while. Data in an installed home-screen app is safer but not guaranteed, so export/backup is a core feature, not an extra.
  - Each device and browser has its own separate data. There is no sync.
  - GitHub Pages serves the app from `/<repo-name>/`, so Vite's `base` must match the repo name.
- **Extra-careful areas:** Data loss (migrations to the IndexedDB schema must keep existing data; import must validate before writing). Privacy: no analytics, no third-party network calls, and fonts and libraries are bundled.
- **Integrations:** None.
- **Who to ask:** the repo owner.
