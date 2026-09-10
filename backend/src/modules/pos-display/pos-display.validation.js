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
    })
    .refine(
        (data) => (data.status === 'awaiting' ? data.method != null && data.amountPaise != null : true),
        { message: 'method and amountPaise are required when status is awaiting' }
    );
