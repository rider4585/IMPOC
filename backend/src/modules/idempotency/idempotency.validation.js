import { z } from 'zod';

export const requestUuidSchema = z.object({
    requestUuid: z
        .string()
        .uuid('Request UUID must be a valid UUID'),
});
