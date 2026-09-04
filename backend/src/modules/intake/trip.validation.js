import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

const paiseSchema = z
    .number()
    .int('Amount must be an integer')
    .min(0, 'Amount cannot be negative')
    .max(9223372036854775807, 'Amount exceeds maximum BIGINT value');

export const tripVendorBillSchema = z.object({
    vendorUuid: uuidSchema,
    billReference: z
        .string()
        .max(100, 'Bill reference cannot exceed 100 characters')
        .nullable()
        .optional()
        .default(null),
    totalPaidPaise: paiseSchema,
    notes: z
        .string()
        .max(2000, 'Notes cannot exceed 2000 characters')
        .nullable()
        .optional()
        .default(null),
});

/**
 * POST /api/trips
 */
export const createTripSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Name is required')
        .max(200, 'Name cannot exceed 200 characters'),

    purchasedOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
        .refine((dateStr) => {
            const date = new Date(dateStr);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const minDate = new Date('1990-01-01');
            return date >= minDate && date <= today;
        }, 'Date must be between 1990-01-01 and today'),

    notes: z
        .string()
        .max(2000, 'Notes cannot exceed 2000 characters')
        .nullable()
        .optional()
        .default(null),

    vendors: z
        .array(tripVendorBillSchema)
        .max(20, 'Cannot add more than 20 vendors to a trip')
        .optional()
        .default([]),
});

/**
 * POST/PATCH /api/trips/:uuid/vendors
 */
export const addTripVendorSchema = z.object({
    vendorUuid: uuidSchema,
    billReference: z
        .string()
        .max(100, 'Bill reference cannot exceed 100 characters')
        .nullable()
        .optional()
        .default(null),
    totalPaidPaise: paiseSchema,
    notes: z
        .string()
        .max(2000, 'Notes cannot exceed 2000 characters')
        .nullable()
        .optional()
        .default(null),
});

/**
 * PATCH /api/trips/:uuid (status only for now)
 */
export const updateTripSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    notes: z.string().max(2000).nullable().optional(),
    status: z.enum(['active', 'closed']).optional(),
});

export const tripUuidParamSchema = z.object({
    uuid: z.string().uuid('Invalid UUID format'),
});