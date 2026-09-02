import { z } from 'zod';

export const createRoleSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(50),

    description: z
        .string()
        .trim()
        .max(255)
        .optional()
        .nullable(),
});

export const roleUuidParamSchema = z.object({
    uuid: z.string().uuid(),
});

export const updateRoleSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(50)
        .optional(),

    description: z
        .string()
        .trim()
        .max(255)
        .optional()
        .nullable(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
