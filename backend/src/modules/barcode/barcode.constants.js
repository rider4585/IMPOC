/**
 * Digit-count layout constants (structurally fixed per AD-17).
 * These are not geometry values and remain as constants.
 */
export const BARCODE_DIGIT_LAYOUTS = {
    // 12-digit layout (default)
    TWELVE_DIGIT: {
        columns: 4,
        rows: 6,
    },
    // 10-digit layout (alternate)
    TEN_DIGIT: {
        columns: 3,
        rows: 5,
    },
};

/**
 * PDF page size and layout (structural invariants, not user-configurable).
 */
export const PDF_CONFIG = {
    size: 'A4',
    layout: 'portrait',
};

export const BARCODE_CONFIG = {
    type: 'CODE128',
    maxPages: 100,
};

/**
 * A4-only barcode dimension test configuration.
 * 30 combinations = 6 widths × 5 heights.
 * 15 tests per page = 3 columns × 5 rows.
 */
export const BARCODE_TEST_CONFIG = {
    page: {
        size: 'A4',
        layout: 'portrait',
    },

    grid: {
        columns: 3,
        rows: 5,
    },

    marginMm: {
        top: 8,
        right: 8,
        bottom: 8,
        left: 8,
    },

    gapMm: {
        horizontal: 5,
        vertical: 6,
    },

    widthsMm: [30, 35, 40, 45, 50, 55],

    heightsMm: [6, 8, 10, 12, 14],

    barcode: {
        scale: 3,
        sourceHeight: 20,
    },

    label: {
        borderWidth: 0.7,
        borderRadius: 2,
        paddingMm: 3,
        titleFontSize: 7,
        valueFontSize: 6,
        titleGapMm: 2,
        valueGapMm: 2,
    },

    testValue: '123456789012',
};

/**
 * Barcode VALUE format (R-48).
 *
 *   SHREE + TS6 + CNT4  ->  15 chars, uppercase A-Z0-9 only.
 *
 * - TS6  : seconds since EPOCH_MS in base-36, zero-padded to 6 (lasts ~69 years).
 * - CNT4 : nextval(barcode_seq) mod 36^4 in base-36, zero-padded to 4.
 *
 * Two values can only collide with the same second AND the same counter.
 * Within a second the sequence keeps climbing; after a sequence reset
 * (db wipe, re-migrate) the timestamp is strictly later than every label
 * already printed, so old and new labels never overlap.
 */
export const BARCODE_FORMAT = {
    prefix: 'SHREE',
    epochMs: Date.UTC(2026, 0, 1),
    timestampLength: 6,
    counterLength: 4,
    radix: 36,
    // 5 + 6 + 4; column/validator cap is BARCODE_MAX_LENGTH for headroom
    length: 15,
};

/** Storage + validation ceiling for a barcode string (units / sale_lines / rental_lines). */
export const BARCODE_MAX_LENGTH = 32;
