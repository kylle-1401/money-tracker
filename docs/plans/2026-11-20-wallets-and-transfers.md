# Plan: Wallets, transfers and budget alerts

**Status:** Approved 2026-11-20. Slice 7 built (see `docs/progress.md`).
**Date:** 2026-11-20

## Goal
Show where money is kept (Cash, GCash, BDO, a credit card…) as cards with their own balance, and let the user move money between wallets with an optional fee. A transfer is not income or spending, so the monthly totals and "Where your money went" stay honest.

## Decisions (confirmed by the owner)
- A wallet is **only a name and an icon**: no bank login, account number, card number or any credential. The app still never connects to a bank.
- **Transfers can have an optional fee.** The fee leaves the source wallet and counts as spending.
- **Existing entries go into a wallet called "Cash"** when the update first opens.

## Assumptions (please double-check)
1. **Negative balances are allowed** (for credit cards or overdrafts) and shown in red. The starting balance can also be negative ("I owe ₱3,000 on this card").
2. **Icons are emoji plus a card color**, not bank logos. Logos are trademarks, and loading them from bank websites would break the "no network calls" privacy rule. Quick picks: 💵 👛 🏦 💳 📱 🐷 💰 🪙, or any typed emoji.
3. **Archived wallets** disappear from the cards and pickers, but their balance still counts in the total (the money still exists). A wallet can only be deleted if nothing uses it; otherwise archive it, same as categories.
4. **The fee shows in "Where your money went" as "Transfer fees"**, a fixed group, not a category the user picks.
5. **The wallet picker remembers the last wallet used** (saved on the device).
6. The top Home figure becomes **"Total balance"** = the sum of all wallets. Existing users see the same number (Cash starts at ₱0).

## Data model change (needs approval: storage schema change)
Dexie **version 2**. Version 1 is never edited.

```ts
interface Wallet {
  id: string;            // URL-safe, e.g. "wallet-cash"
  name: string;          // required, ≤ 30 chars, unique (case-insensitive)
  emoji: string;
  color: string;         // one of a fixed set of card colors
  startingBalanceMinor: number; // centavos, may be negative
  archived: boolean;
  sortOrder: number;
}

type TxType = 'income' | 'expense' | 'transfer';

interface Transaction {
  // ...existing fields...
  walletId: string;      // income/expense: the wallet; transfer: the FROM wallet
  toWalletId?: string;   // transfer only, must differ from walletId
  feeMinor?: number;     // transfer only, ≥ 0
  categoryId: string;    // '' for transfers (no category)
}
```

- Stores: `wallets: 'id, sortOrder'`, transactions gain `walletId` and `toWalletId` indexes.
- **Upgrade (existing users):** create "Cash 💵" and set `walletId` on every transaction, in Dexie's upgrade transaction (all or nothing).
- **New installs:** the populate step also creates "Cash".
- **Balance rule:** wallet balance = starting balance + income − expenses − transfers out − fees + transfers in.
- Rules are enforced in the repositories, not just the form: amount > 0, fee ≥ 0, both wallets exist, from ≠ to, transfers have no category.

## Slices
The old "Slice 7: desktop layout" moves after these.

### Slice 7: Wallets
- Storage v2 with the upgrade above, plus a test that builds a real v1 database, opens it with v2 and checks that every entry is in Cash
- Settings → **Wallets**: list, add/edit (name, emoji, color, starting balance), reorder, archive/restore, delete if unused
- Transaction form: a **wallet picker** (remembers the last one)
- Home: **swipeable wallet cards** above the month summary; "Total balance" on top
- List rows show the wallet emoji
- **Backup format v2** (includes wallets). Version-1 files still restore, into Cash. Merge folds wallets by name like categories. The CSV gains a **Wallet** column
- Security review at the end (storage and backup import changed)

### Slice 8: Transfers
- Third tab in the form: **Expense / Income / Transfer**. Transfer shows From, To, amount, optional fee, date, note (no category)
- List and Recent show "💵 Cash → 🏦 BDO ₱1,000" (fee shown under it)
- Dashboard: Money in/out ignore transfers; fees count in Money out and as "Transfer fees" in the bars
- Wallet filter chips on the List page
- Backup and CSV carry transfers (CSV columns **To wallet** and **Fee**)
- Security review at the end

### Slice 9: Monthly budget alerts
You set a monthly amount; the app warns as you approach it and when you go over.
- **What counts as spending:** expenses plus transfer fees in the calendar month (transfers themselves don't count).
- **Set once, repeats every month** until changed or removed. No rollover of unspent money.
- **Overall budget** (Settings → Budget), plus an **optional budget per expense category** (e.g. Food ₱6,000) in the category edit page.
- **Where the alert shows** (all inside the app):
  - Home: a budget bar under the month summary, "₱9,200 of ₱12,000 · ₱2,800 left". It turns amber at **80%** and red when over: "Over budget by ₱1,150"
  - **Right after saving an expense** that crosses 80% or 100% (overall or that category): a banner such as "⚠️ You've used 85% of your Food budget" / "You're ₱350 over your November budget". It shows once per crossing, not on every entry
  - Category budgets show as a thin marker on that category's bar in "Where your money went"
- **No phone notifications.** An iPhone home-screen app can only get notifications through a push server, and this app has no server by design. Alerts appear when you open or use the app.
- Storage: the overall budget goes in `settings`; category budgets as an optional `budgetMinor` on the category (part of the v2 schema). Included in backups and restored with them.
- Past months show the budget as it was set then? **No (assumption):** one current budget is applied to every month you view. Simpler; revisit if history matters.

## Mockup (Home, iPhone 14)
```
┌──────────────────────────┐
│ Total balance            │
│ ₱25,420.00               │
│ ┌──────────┐┌──────────┐┌─│  swipe →
│ │💵 Cash    ││📱 GCash   ││🏦│
│ │₱2,300.00 ││₱5,120.00 ││₱1│
│ └──────────┘└──────────┘└─│
│ November 2026     ◀  ▶   │
│ In ₱30,000   Out ₱12,480 │
│ Where your money went    │
│ ...                      │
└──────────────────────────┘
```

## Risks
- **The upgrade runs once on each phone and can't be undone.** It's tested against a real v1 database, but owners should **Save backup** before tapping Reload on this update. The update bar could say so.
- Transfers change the meaning of every total, so the summary tests get rewritten carefully (transfers excluded, fees included).
- Backup v2 is a new file format, so import validation grows; the security reviewer checks it.

## Test plan
- Unit: balance rule (all five parts, negative balances), month totals with transfers and fees, v1 → v2 upgrade, backup v1 and v2 import, CSV columns
- Repository: from = to rejected, unknown wallet rejected, fee < 0 rejected, delete of a used wallet blocked
- Flows: add a wallet, add an expense to it, transfer with a fee, check the card balances and the dashboard
- Browser pane at 390×844, light and dark; then on the iPhone after deploy
