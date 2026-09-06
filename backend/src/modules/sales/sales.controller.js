import { createSaleBodySchema, saleUuidParamSchema, reversalBodySchema, updateSaleBodySchema } from './sales.validation.js';
import {
    createSale as createSaleService,
    listSales as listSalesService,
    getSaleByUuid as getSaleByUuidService,
    cancelSale as cancelSaleService,
    refundSale as refundSaleService,
    patchSale as patchSaleService,
} from './sales.service.js';

/**
 * POST /api/sales - Checkout a RETAIL sale
 */
export const createSale = async (req, res, next) => {
    try {
        const body = createSaleBodySchema.parse(req.body);

        const sale = await createSaleService({
            customerName: body.customerName,
            customerUuid: body.customerUuid,
            soldAt: body.soldAt,
            paymentMethod: body.paymentMethod,
            customerSource: body.customerSource,
            notes: body.notes,
            items: body.items,
            actorUserId: req.user?.id,
        });

        return res.status(201).json({
            success: true,
            data: sale,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/sales - List sales
 */
export const listSales = async (req, res, next) => {
    try {
        const sales = await listSalesService();
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

        const sale = await getSaleByUuidService(uuid);

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

        const sale = await cancelSaleService({
            uuid,
            reason: body.reason,
            actorUserId: req.user?.id,
        });

        return res.status(200).json({
            success: true,
            data: sale,
        });
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

        const sale = await refundSaleService({
            uuid,
            reason: body.reason,
            actorUserId: req.user?.id,
        });

        return res.status(200).json({
            success: true,
            data: sale,
        });
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
