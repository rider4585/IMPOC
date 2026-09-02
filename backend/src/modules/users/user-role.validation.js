import {z} from 'zod';

export const userUuidParamSchema = z.object({
    userUuid: z.string().uuid('Invalid user UUID'),
});

export const userRoleParamsSchema = z.object({
    userUuid: z.string().uuid('Invalid user UUID'),
    roleUuid: z.string().uuid('Invalid role UUID'),
});

export const assignRoleSchema = z.object({
    roleUuid: z.string().uuid('Invalid role UUID'),
});