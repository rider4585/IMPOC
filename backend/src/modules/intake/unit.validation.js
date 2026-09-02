import { z } from 'zod';

/**
 * Schema for POST /api/stock-intake-lines/:uuid/scan
 * Validates barcode and UUID presence with proper format constraints
 */
export const scanIntoLotSchema = z.object({
    barcode: z
        .string()
        .min(1, 'Barcode must be at least 1 character')
        .max(12, 'Barcode must be at most 12 characters'),

    stockIntakeLineUuid: z
        .string()
        .uuid('Invalid stock intake line UUID format'),

    colourUuid: z
        .string()
        .uuid('Invalid colour UUID format'),

    sizeUuid: z
        .string()
        .uuid('Invalid size UUID format'),
});
