import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Validation schema for POST /api/delivery/logs
 */
export const createDeliveryLogBodySchema = z.object({
    entityType: z.enum(['SALE', 'RENTAL', 'QUOTE', 'GENERAL'], {
        message: 'entityType must be SALE, RENTAL, QUOTE or GENERAL',
    }),
    entityUuid: uuidSchema,
    channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS', 'WHATSAPP_GROUP'], {
        message: 'channel must be WHATSAPP, EMAIL, SMS or WHATSAPP_GROUP',
    }),
    status: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'OPTED_OUT']).optional().default('PENDING'),
    receiptPayload: z.unknown().optional(),
    providerMessageId: z.string().trim().max(255).nullable().optional(),
    provider: z.string().trim().max(50).nullable().optional(),
    sentAt: z.string().datetime({ offset: true }).nullable().optional(),
    deliveredAt: z.string().datetime({ offset: true }).nullable().optional(),
    failedAt: z.string().datetime({ offset: true }).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
});

/**
 * Validation schema for GET /api/delivery/logs (list by entity)
 */
export const listDeliveryLogsQuerySchema = z.object({
    entityType: z.enum(['SALE', 'RENTAL', 'QUOTE', 'GENERAL']).optional(),
    entityUuid: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

/**
 * Validation schema for GET /api/delivery/logs/:uuid
 */
export const deliveryLogUuidParamSchema = z.object({
    uuid: uuidSchema,
});