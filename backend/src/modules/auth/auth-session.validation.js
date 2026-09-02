import { z } from 'zod';

export const sessionUuidParamSchema = z.object({
    uuid: z.string().uuid(),
});
