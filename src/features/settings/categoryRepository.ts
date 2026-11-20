import { db } from '../../db/db.ts';
import type { Category, TxType } from '../../db/types.ts';
import { normalizeName, stripUnsafeChars } from '../../lib/text.ts';

/** What the user can set on a category. Type is fixed once created (see addCategory). */
export interface CategoryInput {
  name: string;
  emoji: string;
}

/** Neutral color for user-made categories; reserved for future charts (bars use one hue). */
const DEFAULT_COLOR = '#64748b';

const MAX_NAME = 30;

/** Same cleaning as backup import (lib/text.ts), so the app's own backups always restore. */
function normalize(input: CategoryInput): CategoryInput {
  return { name: normalizeName(input.name), emoji: stripUnsafeChars(input.emoji).trim() };
}

/** Re-checks the form's rules before writing (the form is UX; this guards the data). */
async function assertValid(input: CategoryInput, type: TxType, excludeId?: string) {
  if (!input.name) throw new Error('Name is required.');
  if (input.name.length > MAX_NAME) throw new Error(`Keep the name under ${MAX_NAME} characters.`);
  if (!input.emoji) throw new Error('Pick an icon.');

  // Names are unique per type (archived ones included) so pickers and reports never
  // show two "Food" rows that mean different things.
  const sameType = await db.categories.where('type').equals(type).toArray();
  const clash = sameType.some(
    (c) => c.id !== excludeId && c.name.toLowerCase() === input.name.toLowerCase(),
  );
  if (clash) throw new Error(`You already have a category called "${input.name}".`);
}

/**
 * Creates a category at the end of its type's list. Type can't change later, because
 * existing transactions rely on a category's type matching their own.
 */
export async function addCategory(type: TxType, raw: CategoryInput): Promise<string> {
  const input = normalize(raw);
  await assertValid(input, type);
  const sameType = await db.categories.where('type').equals(type).toArray();
  const sortOrder = Math.max(-1, ...sameType.map((c) => c.sortOrder)) + 1;
  const id = crypto.randomUUID();
  await db.categories.add({
    id,
    type,
    ...input,
    color: DEFAULT_COLOR,
    archived: false,
    sortOrder,
  });
  return id;
}

/** Renames a category and/or changes its icon. Past transactions show the new name. */
export async function updateCategory(id: string, raw: CategoryInput): Promise<void> {
  const existing = await db.categories.get(id);
  if (!existing) throw new Error('This category no longer exists.');
  const input = normalize(raw);
  await assertValid(input, existing.type, id);
  await db.categories.update(id, input);
}

/** Hides a category from the picker (or brings it back). History keeps using it. */
export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  const changed = await db.categories.update(id, { archived });
  if (changed === 0) throw new Error('This category no longer exists.');
}

/** How many transactions use the category. */
export function countTransactionsInCategory(id: string): Promise<number> {
  return db.transactions.where('categoryId').equals(id).count();
}

/**
 * Deletes a category. Business rule: only allowed when no transaction uses it;
 * otherwise archive it so past reports stay correct.
 */
export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, db.transactions, async () => {
    const used = await countTransactionsInCategory(id);
    if (used > 0) {
      throw new Error('This category has transactions. Archive it instead.');
    }
    await db.categories.delete(id);
  });
}

/** All categories of one type in display order, active first, then archived. */
export async function listCategories(type: TxType): Promise<Category[]> {
  const rows = await db.categories.where('type').equals(type).toArray();
  return rows.sort((a, b) => Number(a.archived) - Number(b.archived) || a.sortOrder - b.sortOrder);
}
