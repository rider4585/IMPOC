import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (expected YYYY-MM-DD)').optional();

/**
 * Shared query schema for period-scoped report endpoints.
 * from/to are optional ISO dates; empty when absent means no boundary.
 */
export const periodQuerySchema = z.object({
    from: isoDate,
    to: isoDate,
});

/**
 * Query schema for the expenses report: period + optional category filter.
 */
export const expensesQuerySchema = z.object({
    from: isoDate,
    to: isoDate,
    category: z.string().trim().max(100).optional(),
});

/**
 * Query schema for the stock-levels report: optional low-stock threshold.
 */
export const stockLevelsQuerySchema = z.object({
    lowStockThreshold: z.coerce.number().int().min(0).optional(),
});
