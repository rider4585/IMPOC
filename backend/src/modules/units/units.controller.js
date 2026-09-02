import { getUnitByUuid, getUnitByBarcode, getUnitStatusEvents, transitionUnitEndpoint } from './units.service.js';
import { transitionUnitParamsSchema, transitionUnitBodySchema } from './units.validation.js';

/**
 * GET /api/units/:uuid
 * Retrieve a unit by UUID with full details
 */
export const getUnit = async (req, res, next) => {
    try {
        const { uuid } = req.params;

        const unit = await getUnitByUuid(uuid);

        if (!unit) {
            return res.status(404).json({
                success: false,
                message: `Unit with UUID ${uuid} not found`,
            });
        }

        return res.status(200).json({
            success: true,
            data: unit,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/units/:uuid/status-events
 * Retrieve status events for a unit, paginated, newest first
 */
export const getStatusEvents = async (req, res, next) => {
    try {
        const { uuid } = req.params;
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize || '50', 10)));

        // Verify unit exists
        const unit = await getUnitByUuid(uuid);
        if (!unit) {
            return res.status(404).json({
                success: false,
                message: `Unit with UUID ${uuid} not found`,
            });
        }

        const result = await getUnitStatusEvents(uuid, page, pageSize);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/units/by-barcode/:barcode
 * Retrieve a unit by barcode with full details
 */
export const getUnitByBarcodeRoute = async (req, res, next) => {
    try {
        let { barcode } = req.params;
        barcode = barcode?.trim();

        if (!barcode) {
            return res.status(400).json({
                success: false,
                message: 'Barcode parameter is required',
            });
        }

        const unit = await getUnitByBarcode(barcode);

        if (!unit) {
            return res.status(404).json({
                success: false,
                message: `Unit with barcode ${barcode} not found`,
            });
        }

        return res.status(200).json({
            success: true,
            data: unit,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/units/:uuid/transition
 * Transition a unit's status via the state machine
 */
export const transitionUnitRoute = async (req, res, next) => {
    try {
        const { uuid } = transitionUnitParamsSchema.parse(req.params);
        const body = transitionUnitBodySchema.parse(req.body);

        const unit = await transitionUnitEndpoint({
            unitUuid: uuid,
            to: body.toStatus,
            cause: body.cause,
            reason: body.reason,
            actorUserId: req.user?.id,
        });

        return res.status(200).json({
            success: true,
            data: unit,
        });
    } catch (error) {
        next(error);
    }
};
