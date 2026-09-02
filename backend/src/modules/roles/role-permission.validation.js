import { z } from 'zod';

export const roleUuidParamSchema = z.object({
    roleUuid: z.string().uuid(),
});

export const rolePermissionParamSchema = z.object({
    roleUuid: z.string().uuid(),
    permissionUuid: z.string().uuid(),
});

export const assignPermissionSchema = z.object({
    permissionUuid: z.string().uuid(),
});