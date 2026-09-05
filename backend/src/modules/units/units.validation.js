import { z } from 'zod';

// UUID format validation (standard UUID v4)
const uuidSchema = z.string().uuid('Invalid UUID format');

// Barcode validation (1-12 alphanumeric characters)
const barcodeSchema = z.string().min(1).max(12).regex(/^[A-Z0-9]+$/, 'Barcode must be uppercase alphanumeric');

// Pagination
const pageSchema = z.number().int().min(1).default(1);
const pageSizeSchema = z.number().int().min(1).max(100).default(50);

// Unit status enum
const unitStatusEnum = z.enum(['in_stock', 'sold', 'damaged', 'lost', 'in_maintenance', 'retired', 'rented']);

// Unit channel enum
const channelEnum = z.enum(['RETAIL', 'RENTAL']);

/**
 * Validation schema for GET /api/units/:uuid
 */
export const getUnitParamsSchema = z.object({
    uuid: uuidSchema,
});

/**
 * Validation schema for GET /api/units/:uuid/status-events
 */
export const getStatusEventsParamsSchema = z.object({
    uuid: uuidSchema,
});

export const getStatusEventsQuerySchema = z.object({
    page: pageSchema,
    pageSize: pageSizeSchema,
});

/**
 * Validation schema for GET /api/units (bare list-all endpoint)
 */
export const listAllUnitsQuerySchema = z.object({
    search: z.string().trim().max(200).optional(),
    status: z.string().trim().max(20).optional(),
    stockUuid: uuidSchema.optional(),
});

/**
 * Validation schema for GET /api/units/by-barcode/:barcode
 */
export const getUnitByBarcodeParamsSchema = z.object({
    barcode: barcodeSchema,
});

// Unit transition causes (from unit-status-cause.js)
const transitionCauseEnum = z.enum([
    'INTAKE',
    'CHECKOUT',
    'EXCHANGE',
    'STAFF_MARKED_DAMAGED',
    'STAFF_MARKED_LOST',
    'MAINTENANCE_COMPLETE',
    'BEYOND_REPAIR',
    'RECOVERY',
    'HAND_OVER',
    'RETURN',
    'WRITE_OFF',
]);

/**
 * Validation schema for POST /api/units/:uuid/transition
 */
export const transitionUnitParamsSchema = z.object({
    uuid: uuidSchema,
});

export const transitionUnitBodySchema = z.object({
    toStatus: unitStatusEnum,
    cause: transitionCauseEnum,
    reason: z.string().trim().max(2000).optional().default(undefined),
});

/**
 * Response schema for a unit detail
 */
export const unitResponseSchema = z.object({
    uuid: uuidSchema,
    barcode: barcodeSchema,
    status: unitStatusEnum,
    channel: channelEnum,
    colourUuid: uuidSchema.nullable(),
    sizeUuid: uuidSchema.nullable(),
    buyingPricePaise: z.string(),
    sellingPricePaise: z.string(),
    floorPricePaise: z.string(),
    rentPerDayPaise: z.string().nullable(),
    depositPaise: z.string().nullable(),
    overduePerDayPaise: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

/**
 * Response schema for status event
 */
export const statusEventSchema = z.object({
    uuid: uuidSchema,
    fromStatus: z.string().nullable(),
    toStatus: z.string(),
    cause: z.string(),
    reason: z.string().nullable(),
    occurredAt: z.date(),
    createdAt: z.date(),
});

/**
 * Response schema for paginated status events (AD-26 envelope)
 */
export const statusEventsResponseSchema = z.object({
    items: z.array(statusEventSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
});
