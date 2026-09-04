import { receiptQuerySchema } from './receipts.validation.js';
import { buildReceipt, buildReceiptText } from './receipts.service.js';

/**
 * GET /api/receipts/preview?entityType=SALE|RENTAL&entityUuid=<uuid>
 */
export const previewReceipt = async (req, res, next) => {
    try {
        const query = receiptQuerySchema.parse(req.query);
        const receipt = await buildReceipt({ entityType: query.entityType, entityUuid: query.entityUuid });

        if (!receipt) {
            return res.status(404).json({
                success: false,
                message: `${query.entityType} with UUID ${query.entityUuid} not found`,
            });
        }

        return res.status(200).json({ success: true, data: { receipt } });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/receipts/print?entityType=SALE|RENTAL&entityUuid=<uuid>
 */
export const printReceipt = async (req, res, next) => {
    try {
        const query = receiptQuerySchema.parse(req.query);
        const text = await buildReceiptText({ entityType: query.entityType, entityUuid: query.entityUuid });

        if (text === null) {
            return res.status(404).json({
                success: false,
                message: `${query.entityType} with UUID ${query.entityUuid} not found`,
            });
        }

        return res.status(200).json({ success: true, data: { text } });
    } catch (error) {
        next(error);
    }
};