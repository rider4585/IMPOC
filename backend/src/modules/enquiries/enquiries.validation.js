import { z } from 'zod';

import { ENQUIRY_STATUSES, ENQUIRY_CHANNELS } from '../../../database/models/CustomerEnquiry.js';

const uuidSchema = z.string().uuid('Invalid UUID format');
const optionalUuid = uuidSchema.nullable().optional();
const dateOnly = z.string().date('Invalid date (expected YYYY-MM-DD)');

/**
 * A brand-new customer captured together with the enquiry (R-63).
 * Mirrors createCustomerBodySchema so the picker's inline form and this
 * endpoint accept the same shape.
 */
const inlineCustomerSchema = z.object({
    name: z.string().trim().min(1, 'Customer name is required').max(255),
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().email('Invalid email').max(255).optional(),
    dob: dateOnly.optional(),
    consentWhatsapp: z.boolean().optional().default(false),
    consentEmail: z.boolean().optional().default(false),
    consentSms: z.boolean().optional().default(false),
    consentWhatsappGroup: z.boolean().optional().default(false),
});

const enquiryFields = {
    productTypeUuid: optionalUuid,
    colourUuid: optionalUuid,
    sizeUuid: optionalUuid,
    description: z.string().trim().min(1, 'Describe what the customer is looking for').max(5000),
    notes: z.string().trim().max(5000).nullable().optional(),
    promisedDate: dateOnly.nullable().optional(),
};

/**
 * POST /api/enquiries — exactly one of customerUuid / customer.
 */
export const createEnquiryBodySchema = z
    .object({
        customerUuid: uuidSchema.optional(),
        customer: inlineCustomerSchema.optional(),
        ...enquiryFields,
    })
    .refine((body) => Boolean(body.customerUuid) !== Boolean(body.customer), {
        message: 'Provide either customerUuid or a new customer, not both',
        path: ['customerUuid'],
    });

/**
 * PATCH /api/enquiries/:uuid — all fields optional.
 */
export const updateEnquiryBodySchema = z.object({
    productTypeUuid: optionalUuid,
    colourUuid: optionalUuid,
    sizeUuid: optionalUuid,
    description: z.string().trim().min(1, 'Description cannot be empty').max(5000).optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    promisedDate: dateOnly.nullable().optional(),
});

/**
 * GET /api/enquiries
 */
export const listEnquiriesQuerySchema = z.object({
    status: z.enum(ENQUIRY_STATUSES).optional(),
    search: z.string().trim().max(255).optional(),
    customerUuid: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});

export const enquiryUuidParamSchema = z.object({
    uuid: uuidSchema,
});

/**
 * POST /api/enquiries/:uuid/close — two outcomes only:
 *   notify=true  -> "it's available", message goes out on `channels`
 *   notify=false -> close quietly, nothing is sent
 */
export const closeEnquiryBodySchema = z
    .object({
        notify: z.boolean({ message: 'notify must be true or false' }),
        channels: z.array(z.enum(ENQUIRY_CHANNELS)).max(3).optional(),
        note: z.string().trim().max(5000).nullable().optional(),
    })
    .refine((body) => !body.notify || (body.channels && body.channels.length > 0), {
        message: 'Pick at least one channel to tell the customer on',
        path: ['channels'],
    });
