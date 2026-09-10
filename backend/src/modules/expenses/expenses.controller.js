import {
    createExpenseBodySchema,
    updateExpenseBodySchema,
    expenseUuidParamSchema,
    cancelExpenseBodySchema,
} from './expenses.validation.js';
import {
    createExpense as createExpenseService,
    listExpenses as listExpensesService,
    getExpenseByUuid as getExpenseByUuidService,
    updateExpense as updateExpenseService,
    cancelExpense as cancelExpenseService,
} from './expenses.service.js';
import { lookup } from '../idempotency/idempotency.service.js';
import { GESTURE_TYPES } from '../../constants/gesture-type.js';
import { userHasBroadReadScope } from '../auth/permission.service.js';
import { parsePagination } from '../../utils/pagination.js';

/**
 * Return a fresh fetch of the entity a request key points at, so a replayed
 * money-writing request serves the already-applied result instead of running
 * the write again (SEC-M-3).
 */
const sendExpenseReplay = async (replay, res) => {
    if (!replay.result_uuid) {
        const error = new Error('Cached result UUID is missing');
        error.statusCode = 500;
        throw error;
    }

    const cached = await getExpenseByUuidService(replay.result_uuid);

    if (!cached) {
        const error = new Error('Cached expense record is missing');
        error.statusCode = 500;
        throw error;
    }

    return res.status(200).json({
        success: true,
        message: 'Expense already processed (request replayed)',
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
        return sendExpenseReplay(replay, res);
    }

    throw error;
};

/**
 * POST /api/expenses - Create an expense
 */
export const createExpense = async (req, res, next) => {
    try {
        const body = createExpenseBodySchema.parse(req.body);

        const replay = await lookup(GESTURE_TYPES.EXPENSE_CREATE, body.requestUuid);
        if (replay.found) {
            return sendExpenseReplay(replay, res);
        }

        try {
            const expense = await createExpenseService({
                amountPaise: body.amountPaise,
                category: body.category,
                purpose: body.purpose,
                expenseDate: body.expenseDate,
                notes: body.notes,
                requestUuid: body.requestUuid,
                actorUserId: req.user?.id,
            });

            return res.status(201).json({
                success: true,
                data: expense,
            });
        } catch (error) {
            return handleDuplicateKey(GESTURE_TYPES.EXPENSE_CREATE, body.requestUuid, res, error);
        }
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/expenses - List expenses
 */
export const listExpenses = async (req, res, next) => {
    try {
        const viewAll = await userHasBroadReadScope(req.auth.userUuid);
        const pagination = parsePagination(req.query);

        const expenses = await listExpensesService({
            actorUserId: req.user?.id,
            viewAll,
            limit: pagination.limit,
            offset: pagination.offset,
        });

        return res.status(200).json({
            success: true,
            data: expenses,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/expenses/:uuid - Get an expense by uuid
 */
export const getExpenseByUuid = async (req, res, next) => {
    try {
        const { uuid } = expenseUuidParamSchema.parse(req.params);

        const viewAll = await userHasBroadReadScope(req.auth.userUuid);

        const expense = await getExpenseByUuidService(uuid, {
            actorUserId: req.user?.id,
            viewAll,
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: `Expense with UUID ${uuid} not found`,
            });
        }

        return res.status(200).json({
            success: true,
            data: expense,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/expenses/:uuid - Update an expense (pre-completion only)
 */
export const updateExpense = async (req, res, next) => {
    try {
        const { uuid } = expenseUuidParamSchema.parse(req.params);
        const body = updateExpenseBodySchema.parse(req.body);

        const expense = await updateExpenseService({
            uuid,
            updates: body,
            actorUserId: req.user?.id,
        });

        return res.status(200).json({
            success: true,
            data: expense,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/expenses/:uuid/cancel - Cancel a completed expense (reversal)
 */
export const cancelExpense = async (req, res, next) => {
    try {
        const { uuid } = expenseUuidParamSchema.parse(req.params);
        const body = cancelExpenseBodySchema.parse(req.body);

        const replay = await lookup(GESTURE_TYPES.EXPENSE_REVERSE, body.requestUuid);
        if (replay.found) {
            return sendExpenseReplay(replay, res);
        }

        try {
            const expense = await cancelExpenseService({
                uuid,
                reason: body.reason,
                requestUuid: body.requestUuid,
                actorUserId: req.user?.id,
            });

            return res.status(200).json({
                success: true,
                data: expense,
            });
        } catch (error) {
            return handleDuplicateKey(GESTURE_TYPES.EXPENSE_REVERSE, body.requestUuid, res, error);
        }
    } catch (error) {
        next(error);
    }
};
