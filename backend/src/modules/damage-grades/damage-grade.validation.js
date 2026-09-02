import { z } from 'zod';
import DAMAGE_GRADE_OUTCOMES from '../../constants/damage-grade-outcome.js';

export const createDamageGradeSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine((name) => name.trim().length > 0, "Name cannot be empty or whitespace-only"),

    defaultChargePaise: z
        .number()
        .int()
        .nonnegative("Default charge cannot be negative"),

    outcome: z
        .string()
        .refine(
            (value) => Object.values(DAMAGE_GRADE_OUTCOMES).includes(value),
            "Invalid outcome value"
        ),
});

export const damageGradeUuidParamSchema = z.object({
    uuid: z.string().uuid(),
});

export const updateDamageGradeSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine((name) => name.trim().length > 0, "Name cannot be empty or whitespace-only")
        .optional(),

    defaultChargePaise: z
        .number()
        .int()
        .nonnegative("Default charge cannot be negative")
        .optional(),

    outcome: z
        .string()
        .refine(
            (value) => Object.values(DAMAGE_GRADE_OUTCOMES).includes(value),
            "Invalid outcome value"
        )
        .optional(),

    isActive: z
        .boolean()
        .optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
