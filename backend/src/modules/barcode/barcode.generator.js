import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';

import {
    PDF_CONFIG,
} from './barcode.constants.js';

import * as appSettings from '../app-settings/app-settings.service.js';
import { ConfigurationError, DatabaseError } from '../app-settings/app-settings.service.js';

/**
 * Generate a Code 128 barcode image.
 *
 * Uses barcode scale and sourceHeight from hardcoded defaults.
 * Text rendering (including font size) is handled separately in the PDF layer.
 */
const generateBarcodeImage = async (value) => {
    return bwipjs.toBuffer({
        bcid: 'code128',
        text: value,
        scale: 3,      // Barcode scale (structural, not user-configurable)
        height: 20,    // Source height in barcode units (structural)
        includetext: false,
    });
};


/**
 * Calculate the size of every label on the page.
 *
 * @param {PDFDocument} doc - The PDF document
 * @param {Object} geometry - Geometry configuration from app_settings
 * @returns {Object} { labelWidth, labelHeight }
 */
const calculateLabelSize = (doc, geometry) => {
    const {
        columns,
        rows,
        margin,
        gap,
    } = geometry;

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    const labelWidth =
        (
            pageWidth -
            margin.left -
            margin.right -
            gap.horizontal * (columns - 1)
        ) / columns;

    const labelHeight =
        (
            pageHeight -
            margin.top -
            margin.bottom -
            gap.vertical * (rows - 1)
        ) / rows;

    return {
        labelWidth,
        labelHeight,
    };
};


/**
 * Draw one barcode label.
 *
 * @param {PDFDocument} doc - The PDF document
 * @param {string} value - The barcode value
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} labelWidth - Width of the label
 * @param {number} labelHeight - Height of the label
 * @param {Object} geometry - Geometry configuration from app_settings
 */
const drawLabel = async (
    doc,
    value,
    x,
    y,
    labelWidth,
    labelHeight,
    geometry,
) => {
    const {
        label,
        barcode,
        text,
        infoBox,
    } = geometry;


    /*
     * --------------------------------------------------
     * Calculate sections
     * --------------------------------------------------
     *
     * The info box has a fixed small height.
     *
     * Everything above it becomes the barcode section.
     */

    const infoBoxHeight = infoBox.height;

    const codeAreaHeight =
        labelHeight - infoBoxHeight;


    /*
     * --------------------------------------------------
     * Outer label border
     * --------------------------------------------------
     */

    doc
        .lineWidth(label.borderWidth)
        .roundedRect(
            x,
            y,
            labelWidth,
            labelHeight,
            label.borderRadius,
        )
        .stroke();


    /*
     * --------------------------------------------------
     * Divider line
     * --------------------------------------------------
     */

    const dividerY =
        y + codeAreaHeight;

    doc
        .lineWidth(label.dividerHeight)
        .moveTo(x, dividerY)
        .lineTo(x + labelWidth, dividerY)
        .stroke();


    /*
     * --------------------------------------------------
     * Generate barcode
     * --------------------------------------------------
     */

    const barcodeImage =
        await generateBarcodeImage(value);


    /*
     * --------------------------------------------------
     * Barcode dimensions
     * --------------------------------------------------
     */

    const availableWidth =
        labelWidth -
        label.paddingX * 2;

    const availableHeight =
        codeAreaHeight -
        label.paddingTop -
        label.paddingBottom;


    /*
     * --------------------------------------------------
     * Barcode dimensions from app_settings
     * --------------------------------------------------
     * Use configured dimensions (35mm × 8mm = 99.21 × 22.68 points)
     * loaded from app_settings. These define the physical size
     * of the rendered barcode on paper.
     */

    const barcodeWidth = barcode.widthPt;
    const barcodeHeight = barcode.heightPt;


    /*
     * --------------------------------------------------
     * Center barcode horizontally
     * --------------------------------------------------
     */

    const barcodeX =
        x +
        (labelWidth - barcodeWidth) / 2;


    /*
     * Position barcode toward the upper portion
     * of the label.
     */

    const barcodeY =
        y +
        label.paddingTop;


    doc.image(
        barcodeImage,
        barcodeX,
        barcodeY,
        {
            width: barcodeWidth,
            height: barcodeHeight,
        },
    );


    /*
     * --------------------------------------------------
     * Human-readable barcode number
     * --------------------------------------------------
     */

    const textY =
        barcodeY +
        barcodeHeight +
        text.textMarginTop;


    doc
        .fontSize(text.fontSize)
        .text(
            value,
            x + label.paddingX,
            textY,
            {
                width:
                    labelWidth -
                    label.paddingX * 2,

                align: 'center',

                lineBreak: false,
            },
        );


    /*
     * --------------------------------------------------
     * Information box
     * --------------------------------------------------
     *
     * This section intentionally remains empty.
     *
     * The user can manually write:
     *
     * ₹ 1299
     * Size: M
     * etc.
     *
     * We only draw the border/divider.
     * --------------------------------------------------
     */
};


/**
 * Generate complete barcode PDF.
 *
 * Loads all geometry from app_settings at render time (no caching).
 * Throws an error if any required geometry setting is missing.
 *
 * @param {string[]} barcodeValues - Array of barcode values to render
 * @param {Transaction} transaction - Sequelize transaction for consistent geometry reads
 * @returns {Promise<Buffer>} PDF buffer
 * @throws {Error} If any required geometry key is missing from app_settings
 */
export const generateBarcodePdf = async (
    barcodeValues,
    transaction = null,
) => {
    // Validate input
    if (!Array.isArray(barcodeValues) || barcodeValues.length === 0) {
        throw new Error('barcodeValues must be a non-empty array');
    }

    /*
     * --------------------------------------------------
     * Load geometry from app_settings
     * --------------------------------------------------
     * Every value is read fresh from the database on every render.
     * No in-process caching.
     */

    let geometry;
    try {
        // Validate grid dimensions before loading
        const columns = await appSettings.get('barcode_grid_columns', transaction);
        const rows = await appSettings.get('barcode_grid_rows', transaction);

        if (!Number.isInteger(columns) || columns < 1 || columns > 10) {
            throw new Error(`Invalid barcode_grid_columns: ${columns}. Must be integer between 1 and 10.`);
        }
        if (!Number.isInteger(rows) || rows < 1 || rows > 10) {
            throw new Error(`Invalid barcode_grid_rows: ${rows}. Must be integer between 1 and 10.`);
        }

        geometry = {
            columns,
            rows,
            margin: {
                top: parseFloat(await appSettings.get('barcode_margin_top_pt', transaction)),
                right: parseFloat(await appSettings.get('barcode_margin_right_pt', transaction)),
                bottom: parseFloat(await appSettings.get('barcode_margin_bottom_pt', transaction)),
                left: parseFloat(await appSettings.get('barcode_margin_left_pt', transaction)),
            },
            gap: {
                horizontal: parseFloat(await appSettings.get('barcode_gap_horizontal_pt', transaction)),
                vertical: parseFloat(await appSettings.get('barcode_gap_vertical_pt', transaction)),
            },
            label: {
                borderWidth: 1,              // Structural constant
                borderRadius: 3,             // Structural constant
                paddingX: 10,                // Structural constant
                paddingTop: 8,               // Structural constant
                paddingBottom: 6,            // Structural constant
                dividerHeight: 1,            // Structural constant
            },
            barcode: {
                widthPt: parseFloat(await appSettings.get('barcode_width_pt', transaction)),
                heightPt: parseFloat(await appSettings.get('barcode_height_pt', transaction)),
            },
            text: {
                fontSize: parseFloat(await appSettings.get('barcode_text_font_size_pt', transaction)),
                clearSpacePt: parseFloat(await appSettings.get('barcode_clear_space_pt', transaction)),
                textMarginTop: 4,            // Structural constant
            },
            infoBox: {
                height: 14,                  // Structural constant
            },
        };
    } catch (error) {
        // Handle configuration errors (missing geometry setting)
        if (error instanceof ConfigurationError) {
            throw new Error(
                `Cannot generate barcode sheet: ${error.message}. ` +
                'Ensure all barcode geometry keys are seeded in app_settings.',
            );
        }
        // Handle database errors (connection, timeout, etc.)
        if (error instanceof DatabaseError) {
            throw error;
        }
        // Patch 2: Default error handler for unexpected errors
        throw new Error(
            `Unexpected error while loading barcode geometry: ${error.message}`,
        );
    }

    try {
        // Patch 3: Wrap PDF document creation and streaming in try-catch
        const doc = new PDFDocument({
            size: PDF_CONFIG.size,
            layout: PDF_CONFIG.layout,
            margin: 0,
            autoFirstPage: true,

            info: {
                Title: 'Barcode Labels',
                Author: 'Shop Management System',
            },
        });


        /*
         * --------------------------------------------------
         * Collect PDF chunks
         * --------------------------------------------------
         */

        const chunks = [];

        doc.on('data', (chunk) => {
            chunks.push(chunk);
        });


        /*
         * --------------------------------------------------
         * PDF completion promise
         * --------------------------------------------------
         */

        const pdfPromise = new Promise(
            (resolve, reject) => {
                doc.on('end', () => {
                    resolve(
                        Buffer.concat(chunks),
                    );
                });

                doc.on('error', reject);
            },
        );


        /*
         * --------------------------------------------------
         * Calculate grid
         * --------------------------------------------------
         */

        const {
            columns,
            rows,
            margin,
            gap,
        } = geometry;

        const {
            labelWidth,
            labelHeight,
        } = calculateLabelSize(doc, geometry);

        // Validate calculated label dimensions
        if (labelWidth <= 0 || labelHeight <= 0) {
            throw new Error(
                `Invalid label dimensions: width=${labelWidth}, height=${labelHeight}. ` +
                'Check page margins and gaps against page size.',
            );
        }

        const barcodesPerPage =
            columns * rows;


        /*
         * --------------------------------------------------
         * Draw every barcode
         * --------------------------------------------------
         */

        for (
            let index = 0;
            index < barcodeValues.length;
            index += 1
        ) {
            /*
             * Create a new A2 page after
             * completing the current grid.
             */

            if (
                index > 0 &&
                index % barcodesPerPage === 0
            ) {
                doc.addPage({
                    size: PDF_CONFIG.size,
                    layout: PDF_CONFIG.layout,
                    margin: 0,
                });
            }


            /*
             * Position inside current page.
             */

            const pageIndex =
                index % barcodesPerPage;


            const row =
                Math.floor(
                    pageIndex / columns,
                );


            const column =
                pageIndex % columns;


            const x =
                margin.left +
                column *
                (
                    labelWidth +
                    gap.horizontal
                );


            const y =
                margin.top +
                row *
                (
                    labelHeight +
                    gap.vertical
                );


            /*
             * Draw label.
             */

            await drawLabel(
                doc,
                barcodeValues[index],
                x,
                y,
                labelWidth,
                labelHeight,
                geometry,
            );
        }


        /*
         * --------------------------------------------------
         * Finish PDF
         * --------------------------------------------------
         */

        doc.end();

        return pdfPromise;
    } catch (pdfError) {
        // Patch 3: Distinguish between configuration/database/PDF generation errors
        if (pdfError instanceof ConfigurationError) {
            throw pdfError;
        }
        if (pdfError instanceof DatabaseError) {
            throw pdfError;
        }
        // Wrap other PDF generation errors
        throw new Error(
            `PDF generation failed: ${pdfError.message}`,
        );
    }
};