import { z } from 'zod';

import { ORIENTATION_OPTIONS, PAGE_SIZE_OPTIONS, CUSTOM_PAGE_SIZE, CUSTOM_PAGE_MM, GRID_MAX } from './barcode-layout.geometry.js';

const mm = (max, label) => z.coerce.number().min(0, `${label} cannot be negative`).max(max, `${label} is too large`);

const customMm = (label) => z.coerce.number()
    .min(CUSTOM_PAGE_MM.min, `${label} must be at least ${CUSTOM_PAGE_MM.min} mm`)
    .max(CUSTOM_PAGE_MM.max, `${label} cannot exceed ${CUSTOM_PAGE_MM.max} mm`);

const layoutShape = {
    pageSize: z.enum(PAGE_SIZE_OPTIONS),
    orientation: z.enum(ORIENTATION_OPTIONS),
    // R-56: stored in mm whatever unit the UI showed; only meaningful for CUSTOM
    pageCustomWidthMm: customMm('Custom page width').optional().default(101.6),
    pageCustomHeightMm: customMm('Custom page height').optional().default(152.4),
    // Rows/columns are bounded by the fit check, not a hard number (user: >10 rows on tall/custom sheets)
    columns: z.coerce.number().int().min(1).max(GRID_MAX),
    rows: z.coerce.number().int().min(1).max(GRID_MAX),
    marginTopMm: mm(100, 'Top margin'),
    marginRightMm: mm(100, 'Right margin'),
    marginBottomMm: mm(100, 'Bottom margin'),
    marginLeftMm: mm(100, 'Left margin'),
    gapHorizontalMm: mm(100, 'Horizontal gap'),
    gapVerticalMm: mm(100, 'Vertical gap'),
    barcodeWidthMm: z.coerce.number().min(10, 'Barcode width must be at least 10 mm').max(200, 'Barcode width is too large'),
    barcodeHeightMm: z.coerce.number().min(3, 'Barcode height must be at least 3 mm').max(100, 'Barcode height is too large'),
    textFontSizePt: z.coerce.number().min(3, 'Text size must be at least 3 pt').max(24, 'Text size is too large'),
    textMarginTopMm: mm(20, 'Text gap'),
    showText: z.coerce.boolean(),
    labelPaddingTopMm: mm(50, 'Top padding'),
    labelPaddingBottomMm: mm(50, 'Bottom padding'),
    labelPaddingXMm: mm(50, 'Side padding'),
    borderWidthPt: mm(5, 'Border width'),
    borderRadiusMm: mm(20, 'Corner radius'),
    showDivider: z.coerce.boolean(),
    infoBoxMinHeightMm: mm(100, 'Price box minimum height'),
};

const requireCustomDims = (data) => data.pageSize !== CUSTOM_PAGE_SIZE || (data.pageCustomWidthMm != null && data.pageCustomHeightMm != null);

/** Full replacement of the single layout row (PUT). */
export const updateBarcodeLayoutSchema = z.object(layoutShape).strict()
    .refine(requireCustomDims, { message: 'Custom page size needs a width and a height' });

/** POST /templates body: a name + a full layout snapshot (R-56). */
export const createTemplateSchema = z.object({
    name: z.string().trim().min(1, 'Template name is required').max(100, 'Template name is too long'),
    layout: z.object(layoutShape).strict().refine(requireCustomDims, { message: 'Custom page size needs a width and a height' }),
}).strict();

export const templateUuidParamSchema = z.object({ uuid: z.string().uuid('Invalid UUID format') });
