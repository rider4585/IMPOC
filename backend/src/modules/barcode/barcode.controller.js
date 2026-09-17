import {
    generateBarcodes,
    generateBarcodeTestSheet,
    generateBarcodePreview,
} from './barcode.service.js';

import {
    generateBarcodeSchema,
    generateBarcodeTestSheetSchema,
} from './barcode.validation.js';

export const generateBarcodePdf = async (req, res, next) => {
    try {
        // Validate request including requestUuid
        const validatedData = generateBarcodeSchema.parse({
            pages: req.query.pages,
            requestUuid: req.query.requestUuid,
        });

        // Always stream a fresh PDF — a repeated requestUuid must never
        // replay a cached result (R-64).
        const { pdfBuffer } = await generateBarcodes(
            validatedData.pages,
            validatedData.requestUuid,
            req.auth.userUuid
        );

        // Guard: pdfBuffer must be present
        if (!pdfBuffer) {
            const error = new Error('Failed to generate PDF buffer');
            error.statusCode = 500;
            throw error;
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="barcodes.pdf"',
        );
        res.setHeader('Content-Length', pdfBuffer.length);

        return res.send(pdfBuffer);
    } catch (error) {
        return next(error);
    }
};

export const generateBarcodeTestSheetPdf = async (
    req,
    res,
    next,
) => {
    try {
        // Validate request including requestUuid
        const validatedData = generateBarcodeTestSheetSchema.parse({
            requestUuid: req.query.requestUuid,
        });

        // Always stream a fresh PDF — a repeated requestUuid must never
        // replay a cached result (R-64).
        const { pdfBuffer } = await generateBarcodeTestSheet(
            validatedData.requestUuid,
            req.auth.userUuid
        );

        // Guard: pdfBuffer must be present
        if (!pdfBuffer) {
            const error = new Error('Failed to generate PDF buffer');
            error.statusCode = 500;
            throw error;
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="barcode-size-test-a4.pdf"',
        );
        res.setHeader('Content-Length', pdfBuffer.length);

        return res.send(pdfBuffer);
    } catch (error) {
        return next(error);
    }
};

/**
 * GET /api/barcodes/preview — one sample page with the saved layout (R-50).
 * Inline (not attachment) so the Label layout page can show it in a tab.
 */
export const previewBarcodeSheetPdf = async (req, res, next) => {
    try {
        const { pdfBuffer } = await generateBarcodePreview();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="label-layout-preview.pdf"');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Cache-Control', 'no-store');

        return res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};
