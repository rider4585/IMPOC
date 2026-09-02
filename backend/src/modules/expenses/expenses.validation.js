import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Validation schema for POST /api/expenses (create)
 */
export const createExpenseBodySchema = z.object({
    amountPaise: z.number().int().nonnegative('Amount must be >= 0'),
    category: z.string().trim().min(1, 'Category is required').max(100),
    purpose: z.string().trim().max(2000).optional().default(undefined),
    expenseDate: z.string().date('Invalid date').optional().default(undefined),
    notes: z.string().trim().max(2000).optional().default(undefined),
});

/**
 * Validation schema for PATCH /api/expenses/:uuid (update, pre-completion)
 */
export const updateExpenseBodySchema = z.object({
    amountPaise: z.number().int().nonnegative('Amount must be >= 0').optional(),
    category: z.string().trim().min(1, 'Category is required').max(100).optional(),
    purpose: z.string().trim().max(2000).optional(),
    expenseDate: z.string().date('Invalid date').optional(),
    notes: z.string().trim().max(2000).optional(),
});

/**
 * Validation schema for GET /api/expenses/:uuid and /cancel
 */
export const expenseUuidParamSchema = z.object({
    uuid: uuidSchema,
});

/**
 * Validation schema for POST /api/expenses/:uuid/cancel
 */
export const cancelExpenseBodySchema = z.object({
    reason: z.string().trim().max(2000).optional().default(undefined),
});
