import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

export const createTemplateBody = z.object({
    name: z.string().trim().min(1, 'Template name is required').max(100, 'Name cannot exceed 100 characters'),
    entityType: z.enum(['SALE', 'RENTAL', 'UNIVERSAL'], { message: 'entityType must be SALE, RENTAL, or UNIVERSAL' }),
    htmlContent: z.string().min(1, 'HTML content is required'),
    editorState: z.union([z.record(z.unknown()), z.null()]).optional(),
});

export const updateTemplateBody = z.object({
    name: z.string().trim().min(1, 'Template name is required').max(100, 'Name cannot exceed 100 characters').optional(),
    htmlContent: z.string().min(1, 'HTML content is required').optional(),
    editorState: z.union([z.record(z.unknown()), z.null()]).optional(),
});

export const templateUuidParam = z.object({
    uuid: uuidSchema,
});

export const listTemplatesQuery = z.object({
    entityType: z.enum(['SALE', 'RENTAL', 'UNIVERSAL'], { message: 'entityType must be SALE, RENTAL, or UNIVERSAL' }).optional(),
});

export const previewTemplateBody = z.object({
    htmlContent: z.string().min(1, 'HTML content is required'),
    entityType: z.enum(['SALE', 'RENTAL'], { message: 'entityType must be SALE or RENTAL' }),
});

export const snapshotEntityParam = z.object({
    entityType: z.enum(['SALE', 'RENTAL'], { message: 'entityType must be SALE or RENTAL' }),
    entityUuid: uuidSchema,
});

export const listSnapshotsQuery = z.object({
    entityType: z.enum(['SALE', 'RENTAL'], { message: 'entityType must be SALE or RENTAL' }).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});
