import { z } from 'zod';

// UPI id (VPA) shape: <username>@<bank-handle>, e.g. shree@okhdfcbank
const VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,255}@[a-zA-Z0-9.\-_]{2,64}$/;

export const createUpiAccountSchema = z.object({
    label: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine((label) => label.trim().length > 0, 'Label cannot be empty or whitespace-only'),

    vpa: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .regex(VPA_REGEX, 'Enter a valid UPI id, e.g. name@bank'),
});

export const upiAccountUuidParamSchema = z.object({
    uuid: z.string().uuid(),
});

export const updateUpiAccountSchema = z.object({
    label: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine((label) => label.trim().length > 0, 'Label cannot be empty or whitespace-only')
        .optional(),

    vpa: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .regex(VPA_REGEX, 'Enter a valid UPI id, e.g. name@bank')
        .optional(),

    isActive: z
        .boolean()
        .optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
