import {
    createRentalBodySchema,
    rentalUuidParamSchema,
    returnBodySchema,
    cancelBodySchema,
} from './rental-agreement.validation.js';
import {
    createRental as createRentalService,
    listRentals as listRentalsService,
    getRentalByUuid as getRentalByUuidService,
    processRentalReturn as processRentalReturnService,
    cancelRental as cancelRentalService,
} from './rental-agreement.service.js';

/**
 * POST /api/rentals - Checkout a rental (hand-out)
 */
export const createRental = async (req, res, next) => {
    try {
        const body = createRentalBodySchema.parse(req.body);

        const agreement = await createRentalService({
            customerName: body.customerName,
            startDate: body.startDate,
            rentalDays: body.rentalDays,
            notes: body.notes,
            items: body.items,
            actorUserId: req.user?.id,
        });

        return res.status(201).json({
            success: true,
            data: agreement,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/rentals - List agreements
 */
export const listRentals = async (req, res, next) => {
    try {
        const agreements = await listRentalsService();
        return res.status(200).json({
            success: true,
            data: agreements,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/rentals/:uuid - Get an agreement by uuid
 */
export const getRentalByUuid = async (req, res, next) => {
    try {
        const { uuid } = rentalUuidParamSchema.parse(req.params);

        const agreement = await getRentalByUuidService(uuid);

        if (!agreement) {
            return res.status(404).json({
                success: false,
                message: `Rental agreement with UUID ${uuid} not found`,
            });
        }

        return res.status(200).json({
            success: true,
            data: agreement,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/rentals/:uuid/return - Process a return of one or more units
 */
export const processRentalReturn = async (req, res, next) => {
    try {
        const { uuid } = rentalUuidParamSchema.parse(req.params);
        const body = returnBodySchema.parse(req.body);

        const agreement = await processRentalReturnService({
            uuid,
            actualReturnDate: body.actualReturnDate,
            items: body.items,
            actorUserId: req.user?.id,
        });

        return res.status(200).json({
            success: true,
            data: agreement,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/rentals/:uuid/cancel - Cancel an active agreement
 */
export const cancelRental = async (req, res, next) => {
    try {
        const { uuid } = rentalUuidParamSchema.parse(req.params);
        const body = cancelBodySchema.parse(req.body);

        const agreement = await cancelRentalService({
            uuid,
            reason: body.reason,
            actorUserId: req.user?.id,
        });

        return res.status(200).json({
            success: true,
            data: agreement,
        });
    } catch (error) {
        next(error);
    }
};
