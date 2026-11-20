import { z } from 'zod';
import { parseOptionalAmountToMinor } from '../../lib/money.ts';

/** Add/edit category form rules (mirrored in categoryRepository for safety). */
export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(30, 'Keep the name under 30 characters.'),
  emoji: z.string().trim().min(1, 'Pick an icon.').max(16, 'Use a single emoji.'),
  /** Monthly budget as typed; empty = none. Expense categories only (slice 9). */
  budget: z
    .string()
    .refine(
      (v) => parseOptionalAmountToMinor(v) !== null,
      'Enter an amount up to 2 decimals, or leave it empty.',
    ),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

/** Quick picks shown above the custom emoji field. */
export const SUGGESTED_EMOJIS = [
  '🍜',
  '🍔',
  '☕',
  '🛒',
  '🚌',
  '🚗',
  '⛽',
  '🏠',
  '💡',
  '💧',
  '📱',
  '🛍️',
  '👕',
  '💊',
  '🏥',
  '🎬',
  '🎮',
  '✈️',
  '🎓',
  '👶',
  '🐶',
  '🎁',
  '💼',
  '💰',
];
