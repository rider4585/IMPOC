import {
    createStockIntakeLineSchema,
    updateStockIntakeLineSchema,
    stockIntakeLineUuidParamSchema,
} from './stock-intake-line.validation.js';
import {
    createStockIntakeLine as createStockIntakeLineService,
    getStockIntakeLines as getStockIntakeLinesService,
    getStockIntakeLineByUuid as getStockIntakeLineByUuidService,
    updateStockIntakeLine as updateStockIntakeLineService,
    scanIntoLot as scanIntoLotService,
    verifyTripAccess,
} from './stock-intake-line.service.js';
import { scanIntoLotSchema } from './unit.validation.js';

/**
 * Create a stock intake line (lot)
 */
export const createStockIntakeLine = async (req, res, next) => {
    try {
        const data = createStockIntakeLineSchema.parse(req.body);

        // Verify trip access for the current user
        await verifyTripAccess(data.tripUuid, req.user);

        const line = await createStockIntakeLineService(data);

        return res.status(201).json({
            success: true,
            data: line,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all stock intake lines for a trip
 */
export const getStockIntakeLines = async (req, res, next) => {
    try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.params.tripUuid)) {
            const error = new Error('Invalid UUID format');
            error.statusCode = 400;
            throw error;
        }

        const { tripUuid } = req.params;

        // Verify trip access for the current user
        await verifyTripAccess(tripUuid, req.user);

        const lines = await getStockIntakeLinesService(tripUuid);

        return res.status(200).json({
            success: true,
            data: lines,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single stock intake line by UUID
 */
export const getStockIntakeLineByUuid = async (req, res, next) => {
    try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.params.tripUuid)) {
            const error = new Error('Invalid trip UUID format');
            error.statusCode = 400;
            throw error;
        }

        if (!uuidRegex.test(req.params.uuid)) {
            const error = new Error('Invalid lot UUID format');
            error.statusCode = 400;
            throw error;
        }

        const { tripUuid, uuid } = req.params;

        stockIntakeLineUuidParamSchema.parse({ uuid });

        // Verify trip access for the current user
        await verifyTripAccess(tripUuid, req.user);

        const line = await getStockIntakeLineByUuidService(tripUuid, uuid);

        return res.status(200).json({
            success: true,
            data: line,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a stock intake line
 */
export const updateStockIntakeLine = async (req, res, next) => {
    try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.params.tripUuid)) {
            const error = new Error('Invalid trip UUID format');
            error.statusCode = 400;
            throw error;
        }

        if (!uuidRegex.test(req.params.uuid)) {
            const error = new Error('Invalid lot UUID format');
            error.statusCode = 400;
            throw error;
        }

        const { tripUuid, uuid } = req.params;
        const updates = updateStockIntakeLineSchema.parse(req.body);

        stockIntakeLineUuidParamSchema.parse({ uuid });

        // Verify trip access for the current user
        await verifyTripAccess(tripUuid, req.user);

        const line = await updateStockIntakeLineService(tripUuid, uuid, updates);

        return res.status(200).json({
            success: true,
            data: line,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Scan a barcode into a lot (stock intake line)
 * POST /api/stock-intake-lines/:uuid/scan
 */
export const scanIntoLot = async (req, res, next) => {
    try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.params.uuid)) {
            const error = new Error('Invalid lot UUID format');
            error.statusCode = 400;
            throw error;
        }

        const stockIntakeLineUuid = req.params.uuid;
        const data = scanIntoLotSchema.parse(req.body);

        const unit = await scanIntoLotService({
            barcode: data.barcode,
            stockIntakeLineUuid,
            colourUuid: data.colourUuid,
            sizeUuid: data.sizeUuid,
            actorUserId: req.user.id,
        });

        return res.status(201).json({
            success: true,
            data: unit,
        });
    } catch (error) {
        next(error);
    }
};
