import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Validation schema for POST /api/sales (checkout)
 * items: one or more units to be sold (by barcode or unitUuid)
 */
export const createSaleBodySchema = z.object({
    customerName: z.string().trim().max(255).optional().default(undefined),
    soldAt: z.string().date('Invalid date').optional().default(undefined),
    notes: z.string().trim().max(2000).optional().default(undefined),
    items: z.array(
        z.object({
            unitUuid: uuidSchema.optional(),
            barcode: z.string().trim().min(1).max(12).optional(),
        })
    ).min(1, 'At least one item is required'),
});

/**
 * Validation schema for GET /api/sales/:uuid
 */
export const saleUuidParamSchema = z.object({
    uuid: uuidSchema,
});

/**
 * Validation schema for POST /api/sales/:uuid/cancel and /refund
 */
export const reversalBodySchema = z.object({
    reason: z.string().trim().max(2000).optional().default(undefined),
});
