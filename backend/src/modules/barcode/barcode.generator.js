import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';

import { getLayout } from '../barcode-layouts/barcode-layout.service.js';
import { computeSheetGeometry } from '../barcode-layouts/barcode-layout.geometry.js';

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
        divider,
        codeAreaHeight,
    } = geometry;

    // Outer label border
    if (label.borderWidth > 0) {
        doc
            .lineWidth(label.borderWidth)
            .roundedRect(x, y, labelWidth, labelHeight, label.borderRadius)
            .stroke();
    }

    // Divider between the barcode strip and the hand-written info box (R-49/R-50)
    if (divider.show) {
        const dividerY = y + codeAreaHeight;
        doc
            .lineWidth(Math.max(label.borderWidth, 0.5))
            .moveTo(x, dividerY)
            .lineTo(x + labelWidth, dividerY)
            .stroke();
    }

    // Barcode, centred horizontally, at the configured physical size
    const barcodeImage = await generateBarcodeImage(value);
    const barcodeX = x + (labelWidth - barcode.width) / 2;
    const barcodeY = y + label.paddingTop;

    doc.image(barcodeImage, barcodeX, barcodeY, {
        width: barcode.width,
        height: barcode.height,
    });

    // Human-readable value under the bars
    if (text.show) {
        doc
            .fontSize(text.fontSize)
            .text(value, x + label.paddingX, barcodeY + barcode.height + text.marginTop, {
                width: labelWidth - label.paddingX * 2,
                align: 'center',
                lineBreak: false,
            });
    }

    // The info box below the divider stays empty on purpose: the shop writes
    // the price / size by hand.
};


/**
 * Generate complete barcode PDF.
 *
 * Geometry comes from the single barcode_layouts row (R-50), read fresh on
 * every render (no caching) so a layout edit applies to the next sheet.
 *
 * @param {string[]} barcodeValues - Array of barcode values to render
 * @param {Transaction} transaction - Sequelize transaction for a consistent layout read
 * @param {Object} [layoutOverride] - Layout to render instead of the saved row (preview)
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateBarcodePdf = async (
    barcodeValues,
    transaction = null,
    layoutOverride = null,
) => {
    // Validate input
    if (!Array.isArray(barcodeValues) || barcodeValues.length === 0) {
        throw new Error('barcodeValues must be a non-empty array');
    }

    const layout = layoutOverride || await getLayout(transaction);
    const geometry = computeSheetGeometry(layout);

    if (geometry.problems.length > 0) {
        throw new Error(`Cannot generate barcode sheet: ${geometry.problems[0]}`);
    }

    try {
        // Patch 3: Wrap PDF document creation and streaming in try-catch
        const pageOptions = {
            size: [geometry.page.width, geometry.page.height],
            margin: 0,
        };

        const doc = new PDFDocument({
            ...pageOptions,
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

        const labelWidth = geometry.label.width;
        const labelHeight = geometry.label.height;

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
                doc.addPage(pageOptions);
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
        throw new Error(
            `PDF generation failed: ${pdfError.message}`,
        );
    }
};

/**
 * One sample page rendered with the given (or saved) layout and dummy values.
 * Draws nothing from barcode_seq and writes no request_keys row (R-50 preview).
 */
export const generateSampleSheetPdf = async (layoutOverride = null) => {
    const layout = layoutOverride || await getLayout();
    const { perPage, problems } = computeSheetGeometry(layout);
    if (problems.length > 0) {
        throw new Error(`Cannot generate barcode sheet: ${problems[0]}`);
    }
    const values = Array.from({ length: perPage }, (_, i) => `SHREE000000${String(i + 1).padStart(4, '0')}`);
    return generateBarcodePdf(values, null, layout);
};