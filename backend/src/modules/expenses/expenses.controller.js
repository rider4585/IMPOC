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

/**
 * POST /api/expenses - Create an expense
 */
export const createExpense = async (req, res, next) => {
    try {
        const body = createExpenseBodySchema.parse(req.body);

        const expense = await createExpenseService({
            amountPaise: body.amountPaise,
            category: body.category,
            purpose: body.purpose,
            expenseDate: body.expenseDate,
            notes: body.notes,
            actorUserId: req.user?.id,
        });

        return res.status(201).json({
            success: true,
            data: expense,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/expenses - List expenses
 */
export const listExpenses = async (req, res, next) => {
    try {
        const expenses = await listExpensesService();
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

        const expense = await getExpenseByUuidService(uuid);

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

        const expense = await cancelExpenseService({
            uuid,
            reason: body.reason,
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
