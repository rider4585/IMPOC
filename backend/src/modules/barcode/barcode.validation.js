import { z } from 'zod';

import { requestUuidSchema } from '../idempotency/idempotency.validation.js';

export const generateBarcodeSchema = z
    .object({
        pages: z
            .string()
            .or(z.number())
            .transform((val) => Number(val))
            .refine((val) => Number.isInteger(val) && val >= 1, {
                message: 'Pages must be a positive integer',
            }),
    })
    .merge(requestUuidSchema);

export const generateBarcodeTestSheetSchema = requestUuidSchema;
