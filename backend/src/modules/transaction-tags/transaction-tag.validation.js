import { z } from 'zod';

// R-73: exhibition/expo labels applied to retail sales. Two booleans drive the
// POS checkout step: showOnPos (offer it) and isDefault (preselect it).

export const createTransactionTagSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine((name) => name.trim().length > 0, 'Name cannot be empty or whitespace-only'),

    isActive: z.boolean().optional(),

    showOnPos: z.boolean().optional(),

    isDefault: z.boolean().optional(),
});

export const transactionTagUuidParamSchema = z.object({
    uuid: z.string().uuid(),
});

export const updateTransactionTagSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .refine((name) => name.trim().length > 0, 'Name cannot be empty or whitespace-only')
            .optional(),

        isActive: z.boolean().optional(),

        showOnPos: z.boolean().optional(),

        isDefault: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });