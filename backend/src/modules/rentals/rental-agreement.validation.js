import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * A single rentable unit spec: exactly one of barcode or unitUuid must be set.
 * An empty/partial item would otherwise let the resolver drop the key and rent
 * an arbitrary in_stock unit (SEC-H-6).
 */
const itemSchema = z
    .object({
        unitUuid: uuidSchema.optional(),
        barcode: z.string().trim().min(1).max(12).optional(),
    })
    .refine(
        ({ unitUuid, barcode }) => Boolean(unitUuid) !== Boolean(barcode),
        'Each item must specify exactly one of barcode or unitUuid'
    );

/**
 * Validation schema for POST /api/rentals (checkout / hand-out)
 */
export const createRentalBodySchema = z.object({
    customerName: z.string().trim().max(255).optional().default(undefined),
    customerUuid: uuidSchema.nullable().optional().default(undefined),
    startDate: z.string().date('Invalid date').optional().default(undefined),
    rentalDays: z.number().int().positive('Rental days must be a positive integer').optional().default(undefined),
    paymentMethod: z.string().trim().max(50).optional().default(undefined),
    customerSource: z.string().trim().max(50).optional().default(undefined),
    notes: z.string().trim().max(2000).optional().default(undefined),
    items: z.array(itemSchema).min(1, 'At least one item is required'),
});

/**
 * Validation schema for PATCH /api/rentals/:uuid
 * Links/unlinks a customer and refreshes snapshot contact fields.
 */
export const updateRentalBodySchema = z.object({
    customerUuid: uuidSchema.nullable().optional(),
    customerName: z.string().trim().max(255).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Validation schema for GET /api/rentals/:uuid
 */
export const rentalUuidParamSchema = z.object({
    uuid: uuidSchema,
});

/**
 * Validation schema for POST /api/rentals/:uuid/return
 * Returns one or more units. gradeUuid refers to a damage grade (optional).
 */
export const returnBodySchema = z.object({
    actualReturnDate: z.string().date('Invalid date').optional().default(undefined),
    items: z.array(
        z.object({
            unitUuid: uuidSchema.optional(),
            barcode: z.string().trim().min(1).max(12).optional(),
            gradeUuid: uuidSchema.optional(),
            damageChargePaise: z.number().int().nonnegative('Damage charge must be >= 0').optional(),
            notes: z.string().trim().max(2000).optional(),
        })
    ).min(1, 'At least one item is required'),
});

/**
 * Validation schema for POST /api/rentals/:uuid/cancel
 */
export const cancelBodySchema = z.object({
    reason: z.string().trim().max(2000).optional().default(undefined),
});
