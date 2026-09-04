import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Validation schema for POST /api/customers
 */
export const createCustomerBodySchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(255),
    phone: z.string().trim().max(30).optional().default(undefined),
    email: z.string().trim().email('Invalid email').max(255).optional().default(undefined),
    dob: z.string().date('Invalid date (expected YYYY-MM-DD)').optional().default(undefined),
    address: z.string().trim().max(5000).optional().default(undefined),
    notes: z.string().trim().max(5000).optional().default(undefined),
    consentWhatsapp: z.boolean().optional().default(false),
    consentEmail: z.boolean().optional().default(false),
    consentSms: z.boolean().optional().default(false),
    consentWhatsappGroup: z.boolean().optional().default(false),
});

/**
 * Validation schema for GET /api/customers (search query)
 */
export const listCustomersQuerySchema = z.object({
    search: z.string().trim().max(255).optional(),
});

/**
 * Validation schema for GET /api/customers/:uuid
 */
export const customerUuidParamSchema = z.object({
    uuid: uuidSchema,
});

/**
 * Validation schema for PATCH /api/customers/:uuid
 * All fields optional; name must be non-empty when provided.
 */
export const updateCustomerBodySchema = z.object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(255).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    email: z.string().trim().email('Invalid email').max(255).nullable().optional(),
    dob: z.string().date('Invalid date (expected YYYY-MM-DD)').nullable().optional(),
    address: z.string().trim().max(5000).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    consentWhatsapp: z.boolean().optional(),
    consentEmail: z.boolean().optional(),
    consentSms: z.boolean().optional(),
    consentWhatsappGroup: z.boolean().optional(),
});

/**
 * Validation schema for PATCH /api/customers/:uuid/consent
 */
export const consentBodySchema = z.object({
    channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS', 'WHATSAPP_GROUP'], {
        message: 'Channel must be WHATSAPP, EMAIL, SMS or WHATSAPP_GROUP',
    }),
    consented: z.boolean({ message: 'consented must be a boolean' }),
});