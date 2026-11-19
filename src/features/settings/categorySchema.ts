import { z } from 'zod';

/** Add/edit category form rules (mirrored in categoryRepository for safety). */
export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(30, 'Keep the name under 30 characters.'),
  emoji: z.string().trim().min(1, 'Pick an icon.').max(16, 'Use a single emoji.'),
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
