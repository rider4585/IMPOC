import { z } from 'zod';
import { tagUuidsListSchema } from '../sales/sales.validation.js';

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
 * Query schema for the sales-by-tag report (R-73): the shared period plus the
 * OPTIONAL transaction_tags filter.
 *
 * The filter is the same `tagUuids` param and the same OR semantics as
 * GET /api/sales (one shared schema, two endpoints). Absent or empty = every
 * tag row for the period, i.e. byte-identical to the unfiltered response.
 * When present, sales carrying none of the tags - including untagged sales -
 * are excluded, so no `Untagged` row is produced.
 */
export const salesByTagQuerySchema = periodQuerySchema.extend({
    tagUuids: tagUuidsListSchema,
});

/**
 * Query schema for the stock-levels report: optional low-stock threshold.
 */
export const stockLevelsQuerySchema = z.object({
    lowStockThreshold: z.coerce.number().int().min(0).optional(),
});
