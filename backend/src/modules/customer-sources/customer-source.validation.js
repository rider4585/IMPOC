import { z } from 'zod';

export const createCustomerSourceSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine((name) => name.trim().length > 0, "Name cannot be empty or whitespace-only"),
});

export const customerSourceUuidParamSchema = z.object({
    uuid: z.string().uuid(),
});

export const updateCustomerSourceSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine((name) => name.trim().length > 0, "Name cannot be empty or whitespace-only")
        .optional(),

    isActive: z
        .boolean()
        .optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });