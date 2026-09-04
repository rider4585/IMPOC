import {
    createStockSchema,
    updateStockSchema,
    stockUuidParamSchema,
    scanIntoStockSchema,
} from './stock.validation.js';
import {
    verifyTripAccess,
    createStock as createStockService,
    getStocksByTrip as getStocksByTripService,
    getStockByUuid as getStockByUuidService,
    updateStock as updateStockService,
    scanIntoStock as scanIntoStockService,
} from './stock.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value, label) {
    if (!UUID_REGEX.test(value)) {
        const error = new Error(`Invalid ${label} UUID format`);
        error.statusCode = 400;
        throw error;
    }
}

/**
 * Create a stock (was 'lot') for a vendor/channel within a trip
 */
export const createStock = async (req, res, next) => {
    try {
        const data = createStockSchema.parse(req.body);

        // Verify trip access for the current user
        await verifyTripAccess(data.tripUuid, req.user);

        const stock = await createStockService(data);

        return res.status(201).json({
            success: true,
            data: stock,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all stocks for a trip
 */
export const getStocksByTrip = async (req, res, next) => {
    try {
        assertUuid(req.params.tripUuid, 'trip');

        const { tripUuid } = req.params;

        // Verify trip access for the current user
        await verifyTripAccess(tripUuid, req.user);

        const stocks = await getStocksByTripService(tripUuid);

        return res.status(200).json({
            success: true,
            data: stocks,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single stock by UUID
 */
export const getStockByUuid = async (req, res, next) => {
    try {
        assertUuid(req.params.tripUuid, 'trip');
        assertUuid(req.params.uuid, 'stock');

        const { tripUuid, uuid } = req.params;

        stockUuidParamSchema.parse({ uuid });

        // Verify trip access for the current user
        await verifyTripAccess(tripUuid, req.user);

        const stock = await getStockByUuidService(tripUuid, uuid);

        return res.status(200).json({
            success: true,
            data: stock,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a stock
 */
export const updateStock = async (req, res, next) => {
    try {
        assertUuid(req.params.tripUuid, 'trip');
        assertUuid(req.params.uuid, 'stock');

        const { tripUuid, uuid } = req.params;
        const updates = updateStockSchema.parse(req.body);

        stockUuidParamSchema.parse({ uuid });

        // Verify trip access for the current user
        await verifyTripAccess(tripUuid, req.user);

        const stock = await updateStockService(tripUuid, uuid, updates);

        return res.status(200).json({
            success: true,
            data: stock,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Scan a barcode into a stock
 * POST /api/trips/:tripUuid/stocks/:uuid/scan
 */
export const scanIntoStock = async (req, res, next) => {
    try {
        assertUuid(req.params.uuid, 'stock');

        const stockUuid = req.params.uuid;
        const data = scanIntoStockSchema.parse(req.body);

        const unit = await scanIntoStockService({
            stockUuid,
            barcode: data.barcode,
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