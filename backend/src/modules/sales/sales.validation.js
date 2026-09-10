import { z } from 'zod';

import { requestUuidSchema } from '../idempotency/idempotency.validation.js';

const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * A single sellable unit spec: exactly one of barcode or unitUuid must be set.
 * An empty/partial item would otherwise let the resolver drop the key and sell
 * an arbitrary in_stock unit (SEC-H-6).
 *
 * sellingPricePaise (R-30) is an optional checkout-time price edit for POS. It
 * is integer paise and may never undercut the unit's floor price (enforced by
 * the service); when omitted the unit snapshot is charged.
 */
const sellableUnitItemSchema = z
    .object({
        unitUuid: uuidSchema.optional(),
        barcode: z.string().trim().min(1).max(12).optional(),
        sellingPricePaise: z.number().int('Selling price must be an integer number of paise').min(0, 'Selling price cannot be negative').optional(),
    })
    .refine(
        ({ unitUuid, barcode }) => Boolean(unitUuid) !== Boolean(barcode),
        'Each item must specify exactly one of barcode or unitUuid'
    );

/**
 * Validation schema for POST /api/sales (checkout)
 * requestUuid: idempotency key (SEC-M-3) - a replayed request is not double-applied.
 * items: one or more units to be sold (by barcode or unitUuid)
 */
export const createSaleBodySchema = z.object({
    requestUuid: requestUuidSchema.shape.requestUuid,
    customerName: z.string().trim().max(255).optional().default(undefined),
    customerUuid: uuidSchema.nullable().optional().default(undefined),
    soldAt: z.string().date('Invalid date').optional().default(undefined),
    paymentMethod: z.string().trim().max(50).optional().default(undefined),
    customerSource: z.string().trim().max(50).optional().default(undefined),
    notes: z.string().trim().max(2000).optional().default(undefined),
    items: z.array(sellableUnitItemSchema).min(1, 'At least one item is required'),
});

/**
 * Validation schema for PATCH /api/sales/:uuid
 * Links/unlinks a customer and refreshes snapshot contact fields.
 */
export const updateSaleBodySchema = z.object({
    customerUuid: uuidSchema.nullable().optional(),
    customerName: z.string().trim().max(255).nullable().optional(),
    soldAt: z.string().date('Invalid date').nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
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
    requestUuid: requestUuidSchema.shape.requestUuid,
    reason: z.string().trim().max(2000).optional().default(undefined),
});
