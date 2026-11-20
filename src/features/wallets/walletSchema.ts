import { z } from 'zod';
import { WALLET_COLORS } from '../../db/types.ts';
import { parseOptionalAmountToMinor } from '../../lib/money.ts';

/**
 * Parses a starting balance as typed: empty or zero means 0, otherwise the same rules
 * as an amount (up to 2 decimals). The sign comes from the "money I owe" switch,
 * because the iPhone decimal keypad has no minus key.
 * @returns minor units (≥ 0), or null if it isn't a valid amount
 */
export const parseStartingBalance = parseOptionalAmountToMinor;

/** Add/edit wallet form rules (mirrored in walletRepository for safety). */
export const walletFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(30, 'Keep the name under 30 characters.'),
  emoji: z.string().trim().min(1, 'Pick an icon.').max(16, 'Use a single emoji.'),
  color: z.enum(WALLET_COLORS),
  startingBalance: z
    .string()
    .refine((v) => parseStartingBalance(v) !== null, 'Enter an amount, up to 2 decimals.'),
  owed: z.boolean(),
});

export type WalletFormValues = z.infer<typeof walletFormSchema>;

/** Quick picks for wallet icons. Emoji only: no bank logos (trademarks, no downloads). */
export const SUGGESTED_WALLET_EMOJIS = ['💵', '👛', '🏦', '💳', '📱', '💰', '🐷', '🪙'];

/** Readable names for the color swatches (screen readers, tooltips). */
export const WALLET_COLOR_LABELS: Record<(typeof WALLET_COLORS)[number], string> = {
  blue: 'Blue',
  green: 'Green',
  teal: 'Teal',
  purple: 'Purple',
  pink: 'Pink',
  orange: 'Orange',
  yellow: 'Yellow',
  gray: 'Gray',
};
