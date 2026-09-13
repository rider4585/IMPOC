/**
 * Pure label-sheet geometry (R-50). Mirrored 1:1 in
 * frontend/src/platform/labelLayout.js — keep both in sync.
 *
 * Input: a layout row in millimetres (font/border in points).
 * Output: everything the PDF generator and the live preview need, in points.
 */

export const MM_TO_PT = 72 / 25.4;

export const mmToPt = (mm) => Number(mm) * MM_TO_PT;

/** Standard page sizes in points (PDFKit names), portrait. */
export const PAGE_SIZES_PT = Object.freeze({
    A3: { width: 841.89, height: 1190.55 },
    A4: { width: 595.28, height: 841.89 },
    A5: { width: 419.53, height: 595.28 },
    LETTER: { width: 612, height: 792 },
});

/** 'CUSTOM' uses pageCustomWidthMm / pageCustomHeightMm (R-56). */
export const CUSTOM_PAGE_SIZE = 'CUSTOM';
export const PAGE_SIZE_OPTIONS = Object.freeze([...Object.keys(PAGE_SIZES_PT), CUSTOM_PAGE_SIZE]);

/**
 * Grid ceiling. Not a design limit — the real guard is the fit check
 * (labels must hold the barcode + price box); this only keeps a typo like
 * 1000 rows from asking the sequence for a million labels per page.
 */
export const GRID_MAX = 100;

/** Custom page dimension bounds, mm (a 50 mm label roll up to a 2 m banner). */
export const CUSTOM_PAGE_MM = Object.freeze({ min: 50, max: 2000 });

/** Units the UI may offer for custom sizes; storage is always mm. */
export const LENGTH_UNITS = Object.freeze({
    mm: { label: 'mm', toMm: 1 },
    cm: { label: 'cm', toMm: 10 },
    in: { label: 'inch', toMm: 25.4 },
});

/** mm -> display unit (2 decimals, trailing zeros trimmed); display unit -> mm rounded to 0.01. */
export const mmToUnit = (mm, unit) => (Number(mm) / LENGTH_UNITS[unit].toMm).toFixed(2).replace(/\.?0+$/, '');
export const unitToMm = (value, unit) => Math.round(Number(value) * LENGTH_UNITS[unit].toMm * 100) / 100;

/** Resolve the portrait page box in points for a layout (standard or custom). */
export function resolvePageSizePt(layout) {
    if (layout.pageSize === CUSTOM_PAGE_SIZE) {
        return { width: mmToPt(layout.pageCustomWidthMm), height: mmToPt(layout.pageCustomHeightMm) };
    }
    return PAGE_SIZES_PT[layout.pageSize] || PAGE_SIZES_PT.A4;
}
export const ORIENTATION_OPTIONS = Object.freeze(['portrait', 'landscape']);

/** Today's sheet, verbatim (matches the old app_settings seed). */
export const DEFAULT_LAYOUT = Object.freeze({
    pageSize: 'A4',
    orientation: 'portrait',
    // Only used when pageSize === 'CUSTOM' (defaults: 4 x 6 inch label sheet)
    pageCustomWidthMm: 101.6,
    pageCustomHeightMm: 152.4,
    columns: 3,
    rows: 5,
    marginTopMm: 8,
    marginRightMm: 8,
    marginBottomMm: 8,
    marginLeftMm: 8,
    gapHorizontalMm: 5,
    gapVerticalMm: 6,
    barcodeWidthMm: 35,
    barcodeHeightMm: 8,
    textFontSizePt: 5,
    textMarginTopMm: 1.4,
    showText: true,
    labelPaddingTopMm: 2.8,
    labelPaddingBottomMm: 2.1,
    labelPaddingXMm: 3.5,
    borderWidthPt: 1,
    borderRadiusMm: 0,
    showDivider: true,
    infoBoxMinHeightMm: 5,
});

/**
 * Compute the sheet geometry in points from a layout (mm).
 *
 * @returns {{
 *   page: {width:number,height:number},
 *   columns:number, rows:number,
 *   margin:{top,right,bottom,left}, gap:{horizontal,vertical},
 *   label:{width,height,paddingTop,paddingBottom,paddingX,borderWidth,borderRadius},
 *   barcode:{width,height}, text:{fontSize,marginTop,show},
 *   divider:{show}, infoBox:{minHeight,height}, codeAreaHeight:number,
 *   perPage:number, problems:string[]
 * }}
 */
export function computeSheetGeometry(layout) {
    const l = { ...DEFAULT_LAYOUT, ...layout };

    const base = resolvePageSizePt(l);
    const page = l.orientation === 'landscape'
        ? { width: base.height, height: base.width }
        : { width: base.width, height: base.height };

    const columns = Number(l.columns);
    const rows = Number(l.rows);

    const margin = {
        top: mmToPt(l.marginTopMm),
        right: mmToPt(l.marginRightMm),
        bottom: mmToPt(l.marginBottomMm),
        left: mmToPt(l.marginLeftMm),
    };
    const gap = {
        horizontal: mmToPt(l.gapHorizontalMm),
        vertical: mmToPt(l.gapVerticalMm),
    };

    const labelWidth = (page.width - margin.left - margin.right - gap.horizontal * (columns - 1)) / columns;
    const labelHeight = (page.height - margin.top - margin.bottom - gap.vertical * (rows - 1)) / rows;

    const label = {
        width: labelWidth,
        height: labelHeight,
        paddingTop: mmToPt(l.labelPaddingTopMm),
        paddingBottom: mmToPt(l.labelPaddingBottomMm),
        paddingX: mmToPt(l.labelPaddingXMm),
        borderWidth: Number(l.borderWidthPt),
        borderRadius: mmToPt(l.borderRadiusMm),
    };
    const barcode = { width: mmToPt(l.barcodeWidthMm), height: mmToPt(l.barcodeHeightMm) };
    const text = {
        fontSize: Number(l.textFontSizePt),
        marginTop: mmToPt(l.textMarginTopMm),
        show: Boolean(l.showText),
    };
    const infoBoxMin = mmToPt(l.infoBoxMinHeightMm);

    // Content-driven barcode strip (R-49); the info box takes the remainder.
    const contentHeight =
        label.paddingTop +
        barcode.height +
        (text.show ? text.marginTop + text.fontSize : 0) +
        label.paddingBottom;
    const codeAreaHeight = Math.min(contentHeight, labelHeight - infoBoxMin);

    const problems = [];
    if (l.pageSize === CUSTOM_PAGE_SIZE) {
        const w = Number(l.pageCustomWidthMm);
        const h = Number(l.pageCustomHeightMm);
        if (!(w >= CUSTOM_PAGE_MM.min && w <= CUSTOM_PAGE_MM.max && h >= CUSTOM_PAGE_MM.min && h <= CUSTOM_PAGE_MM.max)) {
            problems.push(`Custom page size must be between ${CUSTOM_PAGE_MM.min} mm and ${CUSTOM_PAGE_MM.max} mm on each side.`);
        }
    }
    if (!(labelWidth > 0) || !(labelHeight > 0)) {
        problems.push('The grid does not fit on the page: reduce margins, gaps, columns or rows.');
    }
    if (barcode.width + label.paddingX * 2 > labelWidth + 0.01) {
        problems.push('The barcode is wider than the label: reduce barcode width, side padding, or columns.');
    }
    if (contentHeight + infoBoxMin > labelHeight + 0.01) {
        problems.push('The label is too short for the barcode plus the price box: reduce rows, barcode height, or padding.');
    }

    return {
        layout: l,
        page,
        columns,
        rows,
        margin,
        gap,
        label,
        barcode,
        text,
        divider: { show: Boolean(l.showDivider) },
        infoBox: { minHeight: infoBoxMin, height: labelHeight - codeAreaHeight },
        codeAreaHeight,
        perPage: columns * rows,
        problems,
    };
}
