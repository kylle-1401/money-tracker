import { db } from '../../db/db.ts';
import { WALLET_COLORS, type Wallet, type WalletColor } from '../../db/types.ts';
import { MAX_AMOUNT_MINOR } from '../../lib/money.ts';
import { normalizeName, stripUnsafeChars } from '../../lib/text.ts';

/** What the user can set on a wallet. */
export interface WalletInput {
  name: string;
  emoji: string;
  color: WalletColor;
  startingBalanceMinor: number;
}

const MAX_NAME = 30;
const LAST_WALLET_KEY = 'lastWalletId';

const MAX_EMOJI = 16;

/** Same cleaning as backup import (lib/text.ts), so the app's own backups always restore. */
function normalize(input: WalletInput): WalletInput {
  return {
    ...input,
    name: normalizeName(input.name),
    emoji: stripUnsafeChars(input.emoji).trim(),
  };
}

/** Re-checks the form's rules before writing (the form is UX; this guards the data). */
async function assertValid(input: WalletInput, excludeId?: string) {
  if (!input.name) throw new Error('Name is required.');
  if (input.name.length > MAX_NAME) throw new Error(`Keep the name under ${MAX_NAME} characters.`);
  if (!input.emoji) throw new Error('Pick an icon.');
  if (input.emoji.length > MAX_EMOJI) throw new Error('Use a single emoji.');
  if (!WALLET_COLORS.includes(input.color)) throw new Error('Pick a card color.');
  if (
    !Number.isSafeInteger(input.startingBalanceMinor) ||
    Math.abs(input.startingBalanceMinor) > MAX_AMOUNT_MINOR
  ) {
    throw new Error('Enter a starting balance up to 2 decimals.');
  }
  // Unique names (archived included) so pickers and cards never show two "GCash".
  const all = await db.wallets.toArray();
  const clash = all.some(
    (w) => w.id !== excludeId && w.name.toLowerCase() === input.name.toLowerCase(),
  );
  if (clash) throw new Error(`You already have a wallet called "${input.name}".`);
}

/** Wallets in display order: active first, then archived. */
export async function listWallets(): Promise<Wallet[]> {
  const rows = await db.wallets.toArray();
  return rows.sort((a, b) => Number(a.archived) - Number(b.archived) || a.sortOrder - b.sortOrder);
}

/** Creates a wallet at the end of the list and returns its id. */
export async function addWallet(raw: WalletInput): Promise<string> {
  const input = normalize(raw);
  await assertValid(input);
  const all = await db.wallets.toArray();
  const sortOrder = Math.max(-1, ...all.map((w) => w.sortOrder)) + 1;
  const id = crypto.randomUUID();
  await db.wallets.add({ id, ...input, archived: false, sortOrder });
  return id;
}

/** Edits a wallet. Past entries keep pointing at it, so they show the new name. */
export async function updateWallet(id: string, raw: WalletInput): Promise<void> {
  const input = normalize(raw);
  await assertValid(input, id);
  const changed = await db.wallets.update(id, input);
  if (changed === 0) throw new Error('This wallet no longer exists.');
}

/**
 * Hides a wallet from the cards and pickers (or brings it back). Its balance still
 * counts in the total. Business rule: at least one wallet must stay active, or there
 * would be nowhere to put a new entry.
 */
export async function setWalletArchived(id: string, archived: boolean): Promise<void> {
  await db.transaction('rw', db.wallets, async () => {
    const wallet = await db.wallets.get(id);
    if (!wallet) throw new Error('This wallet no longer exists.');
    if (archived) {
      const active = (await db.wallets.toArray()).filter((w) => !w.archived && w.id !== id);
      if (active.length === 0) throw new Error('You need at least one active wallet.');
    }
    await db.wallets.update(id, { archived });
  });
}

/** How many transactions use the wallet (including transfers into it). */
export async function countTransactionsInWallet(id: string): Promise<number> {
  const [from, to] = await Promise.all([
    db.transactions.where('walletId').equals(id).count(),
    db.transactions.where('toWalletId').equals(id).count(),
  ]);
  return from + to;
}

/**
 * Deletes a wallet. Business rule: only when no transaction uses it (otherwise archive
 * it, so balances and history stay correct), and never the last wallet.
 */
export async function deleteWallet(id: string): Promise<void> {
  await db.transaction('rw', db.wallets, db.transactions, async () => {
    if ((await countTransactionsInWallet(id)) > 0) {
      throw new Error('This wallet has transactions. Archive it instead.');
    }
    const others = (await db.wallets.toArray()).filter((w) => w.id !== id);
    if (!others.some((w) => !w.archived)) {
      throw new Error('You need at least one active wallet.');
    }
    await db.wallets.delete(id);
  });
}

/**
 * Moves a wallet one place earlier (-1) or later (+1) among the active wallets.
 * Renumbers sortOrder 0..n so the order stays clean after many moves.
 */
export async function moveWallet(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.wallets, async () => {
    const ordered = (await listWallets()).filter((w) => !w.archived);
    const from = ordered.findIndex((w) => w.id === id);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= ordered.length) return;
    [ordered[from], ordered[to]] = [ordered[to] as Wallet, ordered[from] as Wallet];
    await Promise.all(ordered.map((w, i) => db.wallets.update(w.id, { sortOrder: i })));
  });
}

/** Remembers the wallet used for the last new entry, so the form preselects it. */
export async function rememberLastWallet(id: string): Promise<void> {
  await db.settings.put({ key: LAST_WALLET_KEY, value: id });
}

/**
 * The wallet a new entry should start with: the last one used if it's still active,
 * otherwise the first active wallet.
 */
export async function getDefaultWalletId(): Promise<string> {
  const [last, wallets] = await Promise.all([db.settings.get(LAST_WALLET_KEY), listWallets()]);
  const active = wallets.filter((w) => !w.archived);
  const remembered = active.find((w) => w.id === last?.value);
  return remembered?.id ?? active[0]?.id ?? '';
}
