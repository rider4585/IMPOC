import { z } from 'zod';

// Short, random, non-guessable per-terminal display code.
export const displayCodeParamSchema = z.object({
    code: z.string().regex(/^[A-Za-z0-9]{4,12}$/, 'Invalid display code'),
});

export const publishStateSchema = z
    .object({
        status: z.enum(['idle', 'awaiting', 'received']),
        method: z.enum(['UPI', 'Cash']).optional(),
        amountPaise: z.number().int().nonnegative().optional(),
        upiUri: z.string().max(2000).optional(),
        // R-54: public review link shown as a QR after payment (https only).
        reviewUrl: z
            .string()
            .trim()
            .max(2000)
            .url()
            .refine((value) => value.startsWith('https://'), 'reviewUrl must start with https://')
            .optional(),
        // R-42c: first name ONLY (single token, no whitespace) — see the
        // no-PII note in pos-display.state.js.
        customerFirstName: z
            .string()
            .trim()
            .min(1)
            .max(50)
            .regex(/^\S+$/, 'customerFirstName must be a single name token')
            .optional(),
    })
    .refine(
        (data) => (data.status === 'awaiting' ? data.method != null && data.amountPaise != null : true),
        { message: 'method and amountPaise are required when status is awaiting' }
    );
