import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

const paiseOptional = z
    .union([z.string(), z.number()])
    .optional()
    .refine((v) => v === undefined || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: 'Amount must be a non-negative number',
    })
    .transform((v) => (v === undefined ? undefined : Number(v)));

/**
 * POST /api/intake-records
 */
export const createIntakeRecordSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    purchasedOn: z.string().date('Invalid date'),
    vendorUuid: uuidSchema.optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
});

/**
 * PATCH /api/intake-records/:uuid
 */
export const updateIntakeRecordSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    purchasedOn: z.string().date('Invalid date').optional(),
    vendorUuid: uuidSchema.optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(['active', 'closed']).optional(),
});

/**
 * POST /api/intake-records/:intakeUuid/templates
 */
export const createIntakeTemplateSchema = z.object({
    name: z.string().trim().max(200).optional().nullable(),
    productTypeUuid: uuidSchema,
    buyingPricePaise: z
        .union([z.string(), z.number()])
        .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
            message: 'Buying price must be a non-negative number',
        })
        .transform((v) => Number(v)),
    defaultQuantity: z.number().int().min(1).optional().nullable(),
    defaultSellingPricePaise: paiseOptional,
    defaultFloorPricePaise: paiseOptional,
});

/**
 * PATCH /api/intake-records/:intakeUuid/templates/:uuid
 */
export const updateIntakeTemplateSchema = z.object({
    name: z.string().trim().max(200).optional().nullable(),
    productTypeUuid: uuidSchema.optional(),
    buyingPricePaise: z
        .union([z.string(), z.number()])
        .optional()
        .refine((v) => v === undefined || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
            message: 'Buying price must be a non-negative number',
        })
        .transform((v) => (v === undefined ? undefined : Number(v))),
    defaultQuantity: z.number().int().min(1).optional().nullable(),
    defaultSellingPricePaise: paiseOptional,
    defaultFloorPricePaise: paiseOptional,
});

export const intakeRecordUuidParamSchema = z.object({
    intakeUuid: uuidSchema,
});

export const intakeTemplateUuidParamSchema = z.object({
    intakeUuid: uuidSchema,
    uuid: uuidSchema,
});
