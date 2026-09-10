import {
    createRentalBodySchema,
    rentalUuidParamSchema,
    returnBodySchema,
    cancelBodySchema,
    updateRentalBodySchema,
} from './rental-agreement.validation.js';
import {
    createRental as createRentalService,
    listRentals as listRentalsService,
    getRentalByUuid as getRentalByUuidService,
    processRentalReturn as processRentalReturnService,
    cancelRental as cancelRentalService,
    patchRental as patchRentalService,
} from './rental-agreement.service.js';
import { lookup } from '../idempotency/idempotency.service.js';
import { GESTURE_TYPES } from '../../constants/gesture-type.js';
import { userHasBroadReadScope } from '../auth/permission.service.js';
import { parsePagination } from '../../utils/pagination.js';

/**
 * Return a fresh fetch of the entity a request key points at, so a replayed
 * money-writing request serves the already-applied result instead of running
 * the write again (SEC-M-3).
 */
const sendAgreementReplay = async (replay, res) => {
    if (!replay.result_uuid) {
        const error = new Error('Cached result UUID is missing');
        error.statusCode = 500;
        throw error;
    }

    const cached = await getRentalByUuidService(replay.result_uuid);

    if (!cached) {
        const error = new Error('Cached agreement record is missing');
        error.statusCode = 500;
        throw error;
    }

    return res.status(200).json({
        success: true,
        message: 'Rental agreement already processed (request replayed)',
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
        return sendAgreementReplay(replay, res);
    }

    throw error;
};

/**
 * POST /api/rentals - Checkout a rental (hand-out)
 */
export const createRental = async (req, res, next) => {
    try {
        const body = createRentalBodySchema.parse(req.body);

        const replay = await lookup(GESTURE_TYPES.RENTAL_BOOK, body.requestUuid);
        if (replay.found) {
            return sendAgreementReplay(replay, res);
        }

        try {
            const agreement = await createRentalService({
                customerName: body.customerName,
                customerUuid: body.customerUuid,
                startDate: body.startDate,
                rentalDays: body.rentalDays,
                paymentMethod: body.paymentMethod,
                customerSource: body.customerSource,
                notes: body.notes,
                items: body.items,
                requestUuid: body.requestUuid,
                actorUserId: req.user?.id,
            });

            return res.status(201).json({
                success: true,
                data: agreement,
            });
        } catch (error) {
            return handleDuplicateKey(GESTURE_TYPES.RENTAL_BOOK, body.requestUuid, res, error);
        }
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/rentals - List agreements
 */
export const listRentals = async (req, res, next) => {
    try {
        const viewAll = await userHasBroadReadScope(req.auth.userUuid);
        const pagination = parsePagination(req.query);

        const agreements = await listRentalsService({
            actorUserId: req.user?.id,
            viewAll,
            limit: pagination.limit,
            offset: pagination.offset,
        });

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

        const viewAll = await userHasBroadReadScope(req.auth.userUuid);

        const agreement = await getRentalByUuidService(uuid, {
            actorUserId: req.user?.id,
            viewAll,
        });

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

        const replay = await lookup(GESTURE_TYPES.RENTAL_SETTLE, body.requestUuid);
        if (replay.found) {
            return sendAgreementReplay(replay, res);
        }

        try {
            const agreement = await processRentalReturnService({
                uuid,
                actualReturnDate: body.actualReturnDate,
                items: body.items,
                requestUuid: body.requestUuid,
                actorUserId: req.user?.id,
            });

            return res.status(200).json({
                success: true,
                data: agreement,
            });
        } catch (error) {
            return handleDuplicateKey(GESTURE_TYPES.RENTAL_SETTLE, body.requestUuid, res, error);
        }
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

        const replay = await lookup(GESTURE_TYPES.RENTAL_CANCEL, body.requestUuid);
        if (replay.found) {
            return sendAgreementReplay(replay, res);
        }

        try {
            const agreement = await cancelRentalService({
                uuid,
                reason: body.reason,
                requestUuid: body.requestUuid,
                actorUserId: req.user?.id,
            });

            return res.status(200).json({
                success: true,
                data: agreement,
            });
        } catch (error) {
            return handleDuplicateKey(GESTURE_TYPES.RENTAL_CANCEL, body.requestUuid, res, error);
        }
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/rentals/:uuid - Update linkable fields (customer link, snapshots)
 */
export const patchRental = async (req, res, next) => {
    try {
        const { uuid } = rentalUuidParamSchema.parse(req.params);
        const body = updateRentalBodySchema.parse(req.body);

        const agreement = await patchRentalService({
            uuid,
            payload: {
                customerUuid: body.customerUuid,
                customerName: body.customerName,
                notes: body.notes,
            },
        });

        return res.status(200).json({
            success: true,
            data: agreement,
        });
    } catch (error) {
        next(error);
    }
};
