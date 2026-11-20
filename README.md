# Money Tracker

A private, offline money tracker for your phone. Type in money coming in and going
out, and see your balance and where your money goes.

- **Wallets:** keep track of each place your money is kept (cash, e-wallets, banks, credit
  cards). Just a name and an icon: no bank logins or account numbers.
- **Transfers:** move money between your wallets, with an optional fee.
- **Budgets:** set a monthly budget (and per category, if you like). The app warns you at
  80% and when you go over.

- **Private:** your data stays on your device. There are no accounts, ads, analytics or servers.
- **Offline:** after the first visit, it works with no connection.
- **Free:** hosted as static files on GitHub Pages.

## Install on iPhone

1. Open the app link in **Safari**.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Tap **Add to Home Screen**, then **Add**.
4. Open **Money** from your Home Screen. It runs full-screen and works offline.

On Android, open the link in Chrome and choose **Install app** or **Add to Home screen** from the ⋮ menu.

## Your data and backups

Your data lives only in this browser on this device. Nothing is uploaded anywhere.

- **Back up regularly:** Settings → Backup → **Save backup**, then choose **Save to
  Files** (for example iCloud Drive). The app reminds you if your last backup is over 30 days old.
- **Moving to a new phone:** install the app there, then Settings → Backup →
  **Restore from backup…** → **Replace all my data**.
- If you delete the Home Screen app or clear Safari's website data, the data on that
  device is gone. Only a backup can bring it back.
- Backup (`.json`) and spreadsheet (`.csv`) files are **plain text, not encrypted**.
  Keep them somewhere private.

## Development

Requires Node 22.

```bash
npm ci
npm run dev          # local dev server
npm run lint && npm run typecheck && npm run format:check && npm test && npm run build
npm run preview      # serve the production build
node scripts/generate-icons.mjs   # regenerate app icons into public/
```

Stack: React + TypeScript + Vite, Dexie (IndexedDB), React Hook Form + Zod,
vite-plugin-pwa (Workbox). See `docs/PROJECT.md` and `docs/plans/` for details.

### Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`: lint, typecheck, format,
tests, build, then deploy to GitHub Pages. Pull requests run the same checks without
deploying.

One-time setup: in the GitHub repo, open **Settings → Pages → Build and deployment →
Source** and choose **GitHub Actions**.

The app uses a relative base path and hash routing (`#/settings`), so it works at
`https://<user>.github.io/<any-repo-name>/` with no config changes.
