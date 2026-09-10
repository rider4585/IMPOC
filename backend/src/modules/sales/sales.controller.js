import { createSaleBodySchema, saleUuidParamSchema, reversalBodySchema, updateSaleBodySchema } from './sales.validation.js';
import {
    createSale as createSaleService,
    listSales as listSalesService,
    getSaleByUuid as getSaleByUuidService,
    cancelSale as cancelSaleService,
    refundSale as refundSaleService,
    patchSale as patchSaleService,
} from './sales.service.js';
import { lookup } from '../idempotency/idempotency.service.js';
import { GESTURE_TYPES } from '../../constants/gesture-type.js';
import { userHasBroadReadScope } from '../auth/permission.service.js';
import { parsePagination } from '../../utils/pagination.js';

/**
 * Return a fresh fetch of the entity a request key points at, so a replayed
 * money-writing request serves the already-applied result instead of running
 * the write again (SEC-M-3).
 */
const sendSaleReplay = async (replay, res) => {
    if (!replay.result_uuid) {
        const error = new Error('Cached result UUID is missing');
        error.statusCode = 500;
        throw error;
    }

    const cached = await getSaleByUuidService(replay.result_uuid);

    if (!cached) {
        const error = new Error('Cached sale record is missing');
        error.statusCode = 500;
        throw error;
    }

    return res.status(200).json({
        success: true,
        message: 'Sale already processed (request replayed)',
        data: cached,
    });
};

const handleDuplicateKey = async (gestureType, requestUuid, res, error) => {
    if (error.name !== 'SequelizeUniqueConstraintError') {
        throw error;
    }

    // A concurrent request with the same request key won the race:
    // replay its result instead of double-processing the money write.
    const replay = await lookup(gestureType, requestUuid);
    if (replay.found) {
        return sendSaleReplay(replay, res);
    }

    throw error;
};

/**
 * POST /api/sales - Checkout a RETAIL sale
 */
export const createSale = async (req, res, next) => {
    try {
        const body = createSaleBodySchema.parse(req.body);

        const replay = await lookup(GESTURE_TYPES.SALE_CHECKOUT, body.requestUuid);
        if (replay.found) {
            return sendSaleReplay(replay, res);
        }

        try {
            const sale = await createSaleService({
                customerName: body.customerName,
                customerUuid: body.customerUuid,
                soldAt: body.soldAt,
                paymentMethod: body.paymentMethod,
                customerSource: body.customerSource,
                notes: body.notes,
                items: body.items,
                requestUuid: body.requestUuid,
                actorUserId: req.user?.id,
            });

            return res.status(201).json({
                success: true,
                data: sale,
            });
        } catch (error) {
            return handleDuplicateKey(GESTURE_TYPES.SALE_CHECKOUT, body.requestUuid, res, error);
        }
    } catch (error) {
        return next(error);
    }
};

/**
 * GET /api/sales - List sales
 */
export const listSales = async (req, res, next) => {
    try {
        const viewAll = await userHasBroadReadScope(req.auth.userUuid);
        const pagination = parsePagination(req.query);

        const sales = await listSalesService({
            actorUserId: req.user?.id,
            viewAll,
            limit: pagination.limit,
            offset: pagination.offset,
        });

        return res.status(200).json({
            success: true,
            data: sales,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/sales/:uuid - Get a sale by uuid
 */
export const getSaleByUuid = async (req, res, next) => {
    try {
        const { uuid } = saleUuidParamSchema.parse(req.params);

        const viewAll = await userHasBroadReadScope(req.auth.userUuid);

        const sale = await getSaleByUuidService(uuid, {
            actorUserId: req.user?.id,
            viewAll,
        });

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: `Sale with UUID ${uuid} not found`,
            });
        }

        return res.status(200).json({
            success: true,
            data: sale,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/sales/:uuid/cancel - Cancel a completed sale (unit exchange back)
 */
export const cancelSale = async (req, res, next) => {
    try {
        const { uuid } = saleUuidParamSchema.parse(req.params);
        const body = reversalBodySchema.parse(req.body);

        const replay = await lookup(GESTURE_TYPES.SALE_CANCEL, body.requestUuid);
        if (replay.found) {
            return sendSaleReplay(replay, res);
        }

        try {
            const sale = await cancelSaleService({
                uuid,
                reason: body.reason,
                requestUuid: body.requestUuid,
                actorUserId: req.user?.id,
            });

            return res.status(200).json({
                success: true,
                data: sale,
            });
        } catch (error) {
            return handleDuplicateKey(GESTURE_TYPES.SALE_CANCEL, body.requestUuid, res, error);
        }
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/sales/:uuid/refund - Refund a completed sale (reversal record only)
 */
export const refundSale = async (req, res, next) => {
    try {
        const { uuid } = saleUuidParamSchema.parse(req.params);
        const body = reversalBodySchema.parse(req.body);

        const replay = await lookup(GESTURE_TYPES.SALE_REFUND, body.requestUuid);
        if (replay.found) {
            return sendSaleReplay(replay, res);
        }

        try {
            const sale = await refundSaleService({
                uuid,
                reason: body.reason,
                requestUuid: body.requestUuid,
                actorUserId: req.user?.id,
            });

            return res.status(200).json({
                success: true,
                data: sale,
            });
        } catch (error) {
            return handleDuplicateKey(GESTURE_TYPES.SALE_REFUND, body.requestUuid, res, error);
        }
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/sales/:uuid - Update linkable fields (customer link, snapshots)
 */
export const patchSale = async (req, res, next) => {
    try {
        const { uuid } = saleUuidParamSchema.parse(req.params);
        const body = updateSaleBodySchema.parse(req.body);

        const sale = await patchSaleService({
            uuid,
            payload: {
                customerUuid: body.customerUuid,
                customerName: body.customerName,
                soldAt: body.soldAt,
                notes: body.notes,
            },
        });

        return res.status(200).json({
            success: true,
            data: sale,
        });
    } catch (error) {
        next(error);
    }
};
