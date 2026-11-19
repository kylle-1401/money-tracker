import { z } from 'zod';
import { isValidDateString } from '../../lib/dates.ts';
import { parseAmountToMinor } from '../../lib/money.ts';

/**
 * Add/edit form rules. The amount stays a string here (what the user typed) and is
 * converted to centavos on submit, so the field never reformats while typing.
 */
export const transactionFormSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z
    .string()
    .refine((v) => parseAmountToMinor(v) !== null, 'Enter an amount above 0, up to 2 decimals.'),
  categoryId: z.string().min(1, 'Pick a category.'),
  date: z.string().refine(isValidDateString, 'Pick a valid date.'),
  note: z.string().max(200, 'Keep the note under 200 characters.'),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
