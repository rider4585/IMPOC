import { z } from 'zod';

import { ORIENTATION_OPTIONS, PAGE_SIZE_OPTIONS } from './barcode-layout.geometry.js';

const mm = (max, label) => z.coerce.number().min(0, `${label} cannot be negative`).max(max, `${label} is too large`);

/** Full replacement of the single layout row (PUT). */
export const updateBarcodeLayoutSchema = z.object({
    pageSize: z.enum(PAGE_SIZE_OPTIONS),
    orientation: z.enum(ORIENTATION_OPTIONS),
    columns: z.coerce.number().int().min(1).max(10),
    rows: z.coerce.number().int().min(1).max(10),
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
}).strict();
