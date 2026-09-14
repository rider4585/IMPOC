import { z } from 'zod';

import { LOGO_MAX_BYTES } from './branding.service.js';

const DATA_URL_RE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;

/** Bytes encoded by a base64 data-URL payload. */
export function dataUrlBytes(dataUrl) {
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return Math.floor((b64.length * 3) / 4) - padding;
}

export const updateBrandingSchema = z.object({
    shopName: z.string().trim().min(1, 'Shop name is required').max(80, 'Shop name cannot exceed 80 characters'),
    // undefined = keep the current logo, null = remove it, string = replace it
    logoDataUrl: z
        .string()
        .regex(DATA_URL_RE, 'Logo must be a PNG, JPEG, WebP or SVG image')
        .refine((v) => dataUrlBytes(v) <= LOGO_MAX_BYTES, `Logo must be ${LOGO_MAX_BYTES / 1024} KB or smaller`)
        .nullable()
        .optional(),
}).strict();
