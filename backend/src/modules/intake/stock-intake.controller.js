import { createStockIntakeSchema, stockIntakeUuidParamSchema } from './stock-intake.validation.js';
import {
    getStockIntakes as getStockIntakesList,
    createStockIntake as createStockIntakeAccount,
    getStockIntakeByUuid as getStockIntakeByUuidAccount,
    getLastLotForTrip as getLastLotForTripService,
} from './stock-intake.service.js';

/**
 * HTML escape function to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
    if (!text || typeof text !== 'string') return text;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Map stock intake to DTO response
 * @param {Object} intake - StockIntake from service (already includes variancePaise)
 * @returns {Object} DTO with uuid, vendorUuid, purchasedOn, billReference (HTML-escaped), totalPaidPaise, variancePaise, createdAt, updatedAt
 */
function mapStockIntakeDTO(intake) {
    return {
        uuid: intake.uuid,
        vendorUuid: intake.vendorUuid,
        purchasedOn: intake.purchasedOn,
        billReference: intake.billReference ? escapeHtml(intake.billReference) : null,
        totalPaidPaise: intake.totalPaidPaise,
        variancePaise: intake.variancePaise,
        createdAt: intake.createdAt,
        updatedAt: intake.updatedAt,
    };
}

export const getStockIntakes = async (req, res, next) => {
    try {
        const intakes = await getStockIntakesList();

        return res.status(200).json({
            success: true,
            data: intakes.map(mapStockIntakeDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createStockIntake = async (req, res, next) => {
    try {
        const data = createStockIntakeSchema.parse(req.body);

        const intake = await createStockIntakeAccount(data);

        return res.status(201).json({
            success: true,
            data: mapStockIntakeDTO(intake),
        });
    } catch (error) {
        next(error);
    }
};

export const getStockIntakeByUuid = async (req, res, next) => {
    try {
        const { uuid } = stockIntakeUuidParamSchema.parse(req.params);

        const intake = await getStockIntakeByUuidAccount(uuid);

        return res.status(200).json({
            success: true,
            data: mapStockIntakeDTO(intake),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get the most recent lot for a trip to pre-fill clone form
 * Response includes createdAt for reference only (audit trail).
 * Frontend must NOT use historical createdAt as the new lot's timestamp;
 * instead, set purchasedOn to today or user-selected date when creating the new lot.
 */
export const getCloneLastLot = async (req, res, next) => {
    try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.params.tripUuid)) {
            const error = new Error('Invalid UUID format');
            error.statusCode = 400;
            throw error;
        }

        const { tripUuid } = req.params;

        const cloneLotData = await getLastLotForTripService(tripUuid);

        return res.status(200).json({
            success: true,
            data: cloneLotData,
        });
    } catch (error) {
        next(error);
    }
};
