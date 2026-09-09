import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

/*
 * Shape schema for receiptPayload, mirroring the structured receipt built by
 * receipts.service.js buildReceipt() (SEC-M-6: no more arbitrary JSON blobs,
 * no unbounded fields, hard byte cap).
 */
const paiseStringSchema = z
    .string()
    .regex(/^\d+$/, 'Money values must be non-negative integer strings (paise)')
    .max(40);

const storeBlockSchema = z.object({
    name: z.string().max(255),
    address: z.string().max(255).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
});

const transactionBlockSchema = z.object({
    type: z.enum(['SALE', 'RENTAL']),
    number: z.string().max(50),
    date: z.string().max(50),
    paymentMethod: z.string().max(50).nullable().optional(),
    totalPaise: paiseStringSchema,
    paidPaise: paiseStringSchema,
    changePaise: paiseStringSchema,
    status: z.string().max(20),
});

const customerBlockSchema = z.object({
    name: z.string().max(255).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    email: z.string().max(255).nullable().optional(),
});

const receiptLineSchema = z.object({
    productName: z.string().max(255),
    productType: z.string().max(255).nullable().optional(),
    colour: z.string().max(255).nullable().optional(),
    size: z.string().max(255).nullable().optional(),
    quantity: z.number().int().nonnegative().max(1000000000),
    unitPricePaise: paiseStringSchema,
    lineTotalPaise: paiseStringSchema,
});

const totalsBlockSchema = z.object({
    subtotalPaise: paiseStringSchema,
    discountPaise: paiseStringSchema,
    totalPaise: paiseStringSchema,
    amountPaidPaise: paiseStringSchema,
    balancePaise: paiseStringSchema,
    itemsCount: z.number().int().nonnegative().max(1000000000),
});

/** Serialized receiptPayload size cap in bytes (SEC-M-6: bounds exfil band). */
export const MAX_RECEIPT_PAYLOAD_BYTES = 100 * 1024;

/**
 * The known, bounded receipt payload shape. Optional customer block mirrors
 * buildReceipt() which returns null when no customer is linked.
 */
export const receiptPayloadSchema = z
    .object({
        store: storeBlockSchema,
        transaction: transactionBlockSchema,
        customer: customerBlockSchema.nullable().optional(),
        lines: z.array(receiptLineSchema).max(200),
        totals: totalsBlockSchema,
    })
    .superRefine((payload, ctx) => {
        const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
        if (bytes > MAX_RECEIPT_PAYLOAD_BYTES) {
            ctx.addIssue({
                code: 'custom',
                path: [],
                message: `receiptPayload exceeds the ${MAX_RECEIPT_PAYLOAD_BYTES}-byte size cap`,
            });
        }
    });

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
    receiptPayload: receiptPayloadSchema.nullable().optional(),
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