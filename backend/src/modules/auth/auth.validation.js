import { z } from 'zod';

export const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
    // refreshToken is now read from httpOnly cookies, not from request body
}).strict();