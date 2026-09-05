import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

const paiseOptional = z
    .union([z.string(), z.number()])
    .optional()
    .refine((v) => v === undefined || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: 'Amount must be a non-negative number',
    })
    .transform((v) => (v === undefined ? undefined : Number(v)));

const paiseNullable = z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .refine((v) => v === undefined || v === null || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: 'Amount must be a non-negative number',
    })
    .transform((v) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        return Number(v);
    });

export const createTemplateSchema = z.object({
    vendorUuid: uuidSchema,
    name: z.string().trim().max(200).optional().nullable(),
    productTypeUuid: uuidSchema,
    subTypeUuid: uuidSchema.nullable().optional(),
    buyingPricePaise: z
        .union([z.string(), z.number()])
        .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
            message: 'Buying price must be a non-negative number',
        })
        .transform((v) => Number(v)),
    wholeBuyingPricePaise: paiseNullable,
    defaultQuantity: z.number().int().min(1).optional().nullable(),
    defaultSellingPricePaise: paiseOptional,
    defaultFloorPricePaise: paiseOptional,
});

export const updateTemplateSchema = z.object({
    vendorUuid: uuidSchema.optional(),
    name: z.string().trim().max(200).optional().nullable(),
    productTypeUuid: uuidSchema.optional(),
    subTypeUuid: uuidSchema.nullable().optional(),
    buyingPricePaise: z
        .union([z.string(), z.number()])
        .optional()
        .refine((v) => v === undefined || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
            message: 'Buying price must be a non-negative number',
        })
        .transform((v) => (v === undefined ? undefined : Number(v))),
    wholeBuyingPricePaise: paiseNullable,
    defaultQuantity: z.number().int().min(1).optional().nullable(),
    defaultSellingPricePaise: paiseOptional,
    defaultFloorPricePaise: paiseOptional,
});

export const templateUuidParamSchema = z.object({
    uuid: uuidSchema,
});

export const listTemplatesQuerySchema = z.object({
    vendorUuid: uuidSchema.optional(),
});