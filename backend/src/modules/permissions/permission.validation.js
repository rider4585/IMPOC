import { z } from 'zod';

export const createPermissionSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(100),

    description: z
        .string()
        .trim()
        .max(255)
        .optional()
        .nullable(),
});

export const permissionUuidParamSchema = z.object({
    uuid: z.string().uuid(),
});

export const updatePermissionSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .optional(),

    description: z
        .string()
        .trim()
        .max(255)
        .optional()
        .nullable(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
