# Progress

## Done
- 2026-11-19: Repo created locally (`git init`, branch `main`, nothing committed yet). `docs/PROJECT.md` filled in for this app.
- 2026-11-19: Plan approved: `docs/plans/2026-11-19-money-tracker.md`. Target device is iPhone 14 (390×844). Desktop layout added as slice 7.
- 2026-11-19: **Slice 0 (scaffold)** on branch `feature/0-scaffold`, not committed yet:
  - Vite 8 + React 19 + TypeScript 6 (strict), React Router 7 (HashRouter), Vitest 5 + Testing Library, ESLint 9 + Prettier
  - App shell: 3 bottom tabs (Home, List, Settings) with empty states, design tokens, light/dark mode, iPhone safe areas, `100dvh`, iOS home-screen meta tags
  - 6 shell tests pass; lint, typecheck, format, build and `npm audit` are clean
  - Checked in the browser pane at 390×844 (light and dark), 360×740 (no horizontal scroll) and desktop (centered 480px column); a refresh on `#/settings` stays on Settings; no console errors

## In progress
- Waiting for review of slice 0.

## Next
- Slice 1: transactions (Dexie schema, seeded categories, add/edit/delete form, list grouped by day, `money.ts`/`dates.ts` unit tests). It needs the packages `dexie`, `dexie-react-hooks`, `react-hook-form`, `zod`, `@hookform/resolvers` and `fake-indexeddb` (dev), all approved in the plan.

## Decisions / notes
- ESLint is pinned to 9, because `eslint-plugin-jsx-a11y` doesn't support ESLint 10 yet. ESLint 9 shows as deprecated in npm. Revisit when jsx-a11y supports 10.
- Vite `base: './'` (relative), so the build works under any GitHub Pages repo name.
- git comes from GitHub Desktop's bundled copy (`%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`). It isn't on PATH on this machine.

## Open questions
- Final app name (working name: Money Tracker).
- GitHub repo: the owner creates it on their account when we reach slice 6.
