import { z } from 'zod';

export const createStockIntakeSchema = z.object({
    vendorUuid: z
        .string()
        .uuid('Invalid vendor UUID format'),

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

    billReference: z
        .string()
        .max(100, 'Bill reference cannot exceed 100 characters')
        .nullable()
        .optional()
        .default(null),

    totalPaidPaise: z
        .number()
        .int('Total paid must be an integer')
        .min(0, 'Total paid cannot be negative')
        .max(9223372036854775807, 'Total paid exceeds maximum BIGINT value'),
});

export const stockIntakeUuidParamSchema = z.object({
    uuid: z.string().uuid('Invalid UUID format'),
});
