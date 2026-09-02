import {z} from 'zod';

import { USER_STATUS } from '../../constants/user-status.js';

export const createUserSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(50),

    email: z
        .string()
        .trim()
        .email()
        .optional()
        .or(z.literal('')),

    password: z
        .string()
        .min(8),

    firstName: z
        .string()
        .trim()
        .min(1)
        .max(100),

    lastName: z
        .string()
        .trim()
        .max(100)
        .optional(),

    phone: z
        .string()
        .trim()
        .max(20)
        .optional(),

    roleUuid: z
        .string()
        .uuid(),
});

export const userUuidParamSchema = z.object({
    uuid: z.string().uuid(),
});

export const updateUserSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(50)
        .optional(),

    email: z
        .string()
        .trim()
        .email()
        .max(255)
        .optional()
        .nullable(),

    firstName: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .optional(),

    lastName: z
        .string()
        .trim()
        .max(100)
        .optional()
        .nullable(),

    phone: z
        .string()
        .trim()
        .max(20)
        .optional()
        .nullable(),
}).refine((data) => Object.keys(data).length > 0, {message: 'At least one field is required'});

export const updateUserStatusSchema = z.object({
    status: z.enum([
        USER_STATUS.ACTIVE,
        USER_STATUS.INACTIVE,
        USER_STATUS.SUSPENDED,
    ]),
});