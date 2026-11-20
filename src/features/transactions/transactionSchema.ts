import { z } from 'zod';
import { isValidDateString } from '../../lib/dates.ts';
import { parseAmountToMinor, parseOptionalAmountToMinor } from '../../lib/money.ts';

/** Parses the optional transfer fee as typed: empty or zero means no fee. */
export const parseFee = parseOptionalAmountToMinor;

/**
 * Add/edit form rules. Amounts stay strings here (what the user typed) and are
 * converted to centavos on submit, so fields never reformat while typing.
 * Income/expense need a category; a transfer needs a second, different wallet
 * and may have a fee.
 */
export const transactionFormSchema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z
      .string()
      .refine((v) => parseAmountToMinor(v) !== null, 'Enter an amount above 0, up to 2 decimals.'),
    categoryId: z.string(),
    walletId: z.string().min(1, 'Pick a wallet.'),
    toWalletId: z.string(),
    fee: z.string(),
    date: z.string().refine(isValidDateString, 'Pick a valid date.'),
    note: z.string().max(200, 'Keep the note under 200 characters.'),
  })
  .superRefine((values, ctx) => {
    if (values.type !== 'transfer') {
      if (!values.categoryId) {
        ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Pick a category.' });
      }
      return;
    }
    if (!values.toWalletId) {
      ctx.addIssue({ code: 'custom', path: ['toWalletId'], message: 'Pick where the money goes.' });
    } else if (values.toWalletId === values.walletId) {
      ctx.addIssue({
        code: 'custom',
        path: ['toWalletId'],
        message: 'Pick two different wallets.',
      });
    }
    if (parseFee(values.fee) === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['fee'],
        message: 'Enter a fee up to 2 decimals, or leave it empty.',
      });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
