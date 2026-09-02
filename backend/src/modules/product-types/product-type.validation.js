import { z } from 'zod';

export const createProductTypeSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(100),

    parentUuid: z
        .string()
        .uuid()
        .optional()
        .nullable(),
});

export const productTypeUuidParamSchema = z.object({
    uuid: z.string().uuid(),
});

export const updateProductTypeSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .optional(),

    parentUuid: z
        .string()
        .uuid()
        .optional()
        .nullable(),

    isActive: z
        .boolean()
        .optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
