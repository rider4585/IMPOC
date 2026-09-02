import {
    generateBarcodes,
    generateBarcodeTestSheet,
} from './barcode.service.js';

import {
    generateBarcodeSchema,
    generateBarcodeTestSheetSchema,
} from './barcode.validation.js';

import { lookup } from '../idempotency/idempotency.service.js';
import { GESTURE_TYPES } from '../../constants/gesture-type.js';

export const generateBarcodePdf = async (req, res, next) => {
    try {
        // Validate request including requestUuid
        const validatedData = generateBarcodeSchema.parse({
            pages: req.query.pages,
            requestUuid: req.query.requestUuid,
        });

        // Check if this request was already processed (replay scenario)
        const replay = await lookup(
            GESTURE_TYPES.BARCODE_GENERATE,
            validatedData.requestUuid
        );

        if (replay.found) {
            // Guard: result_uuid must be present
            if (!replay.result_uuid) {
                const error = new Error('Cached result UUID is missing');
                error.statusCode = 500;
                throw error;
            }
            // Return cached result
            return res.status(200).json({
                success: true,
                message: 'Barcode PDF generated (cached result)',
                data: {
                    resultUuid: replay.result_uuid,
                },
            });
        }

        // First attempt: generate barcodes with idempotency tracking
        let result;
        try {
            result = await generateBarcodes(
                validatedData.pages,
                validatedData.requestUuid,
                req.auth.userUuid
            );
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                const replay = await lookup(
                    GESTURE_TYPES.BARCODE_GENERATE,
                    validatedData.requestUuid
                );
                if (replay.found) {
                    // Guard: result_uuid must be present
                    if (!replay.result_uuid) {
                        const guardError = new Error('Cached result UUID is missing');
                        guardError.statusCode = 500;
                        throw guardError;
                    }
                    return res.status(200).json({
                        success: true,
                        message: 'Barcode PDF generated (cached result)',
                        data: {
                            resultUuid: replay.result_uuid,
                        },
                    });
                }
            }
            throw error;
        }

        const { pdfBuffer, resultUuid } = result;

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

        // Check if this request was already processed (replay scenario)
        const replay = await lookup(
            GESTURE_TYPES.BARCODE_GENERATE_TEST,
            validatedData.requestUuid
        );

        if (replay.found) {
            // Guard: result_uuid must be present
            if (!replay.result_uuid) {
                const error = new Error('Cached result UUID is missing');
                error.statusCode = 500;
                throw error;
            }
            // Return cached result
            return res.status(200).json({
                success: true,
                message: 'Barcode test sheet PDF generated (cached result)',
                data: {
                    resultUuid: replay.result_uuid,
                },
            });
        }

        // First attempt: generate test sheet with idempotency tracking
        let result;
        try {
            result = await generateBarcodeTestSheet(
                validatedData.requestUuid,
                req.auth.userUuid
            );
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                const replay = await lookup(
                    GESTURE_TYPES.BARCODE_GENERATE_TEST,
                    validatedData.requestUuid
                );
                if (replay.found) {
                    // Guard: result_uuid must be present
                    if (!replay.result_uuid) {
                        const guardError = new Error('Cached result UUID is missing');
                        guardError.statusCode = 500;
                        throw guardError;
                    }
                    return res.status(200).json({
                        success: true,
                        message: 'Barcode test sheet PDF generated (cached result)',
                        data: {
                            resultUuid: replay.result_uuid,
                        },
                    });
                }
            }
            throw error;
        }

        const { pdfBuffer } = result;

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
