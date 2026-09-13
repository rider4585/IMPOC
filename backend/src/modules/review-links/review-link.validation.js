import { z } from 'zod';

// R-54: a public https link the customer display turns into a QR code
// (e.g. Google's https://search.google.com/local/writereview?placeid=...).
const urlSchema = z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .url('Enter a full link starting with https://')
    .refine((value) => value.startsWith('https://'), 'Review links must start with https://');

export const createReviewLinkSchema = z.object({
    label: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine((label) => label.trim().length > 0, 'Label cannot be empty or whitespace-only'),

    url: urlSchema,
});

export const reviewLinkUuidParamSchema = z.object({
    uuid: z.string().uuid(),
});

export const updateReviewLinkSchema = z.object({
    label: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine((label) => label.trim().length > 0, 'Label cannot be empty or whitespace-only')
        .optional(),

    url: urlSchema.optional(),

    isActive: z
        .boolean()
        .optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
