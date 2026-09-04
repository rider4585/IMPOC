import { z } from 'zod';

/**
 * Validation schema for GET /api/receipts/preview and /api/receipts/print
 */
export const receiptQuerySchema = z.object({
    entityType: z.enum(['SALE', 'RENTAL'], {
        message: 'entityType must be SALE or RENTAL',
    }),
    entityUuid: z.string().uuid('Invalid UUID format'),
});