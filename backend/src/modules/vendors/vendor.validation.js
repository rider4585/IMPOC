import { z } from 'zod';

export const createVendorSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Name cannot be empty')
        .max(100, 'Name cannot exceed 100 characters')
        .refine((name) => name.trim().length > 0, 'Name cannot be empty or whitespace-only'),

    phone: z
        .string()
        .trim()
        .max(20, 'Phone cannot exceed 20 characters')
        .refine((phone) => phone.trim().length > 0, 'Phone cannot be empty or whitespace-only')
        .optional(),

    address: z
        .string()
        .max(500, 'Address cannot exceed 500 characters')
        .optional(),

    notes: z
        .string()
        .max(1000, 'Notes cannot exceed 1000 characters')
        .optional(),
});

export const vendorUuidParamSchema = z.object({
    uuid: z.string().uuid('Invalid UUID format'),
});

export const updateVendorSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Name cannot be empty')
        .max(100, 'Name cannot exceed 100 characters')
        .refine((name) => name.trim().length > 0, 'Name cannot be empty or whitespace-only')
        .optional(),

    phone: z
        .string()
        .trim()
        .max(20, 'Phone cannot exceed 20 characters')
        .refine((phone) => phone.trim().length > 0, 'Phone cannot be empty or whitespace-only')
        .optional(),

    address: z
        .string()
        .max(500, 'Address cannot exceed 500 characters')
        .optional(),

    notes: z
        .string()
        .max(1000, 'Notes cannot exceed 1000 characters')
        .optional(),

    isActive: z
        .boolean()
        .optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
