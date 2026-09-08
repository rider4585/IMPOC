import {
    Expense,
    ExpenseReversal,
    sequelize,
} from '../../../database/models/index.js';

function mapExpenseDTO(expense, reversals = []) {
    return {
        uuid: expense.uuid,
        amountPaise: String(expense.amountPaise),
        category: expense.category,
        purpose: expense.purpose,
        expenseDate: expense.expenseDate,
        status: expense.status,
        notes: expense.notes,
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
        reversals: reversals.map((rev) => ({
            uuid: rev.uuid,
            reversalType: rev.reversalType,
            amountPaise: String(rev.amountPaise),
            reason: rev.reason,
            createdAt: rev.createdAt,
        })),
    };
}

/**
 * Create a new expense.
 */
export const createExpense = async ({ amountPaise, category, purpose, expenseDate, notes, actorUserId }) => {
    const expense = await Expense.create({
        amountPaise,
        category,
        purpose: purpose || null,
        expenseDate: expenseDate || new Date().toISOString().split('T')[0],
        status: 'completed',
        notes: notes || null,
        createdBy: actorUserId || null,
    });

    return mapExpenseDTO(expense);
};

/**
 * List expenses, newest first.
 */
export const listExpenses = async () => {
    const expenses = await Expense.findAll({
        where: { deletedAt: null },
        order: [['createdAt', 'DESC']],
        include: [{ association: 'reversals' }],
    });

    return expenses.map((expense) => mapExpenseDTO(expense, expense.reversals || []));
};

/**
 * Get a single expense by uuid.
 */
export const getExpenseByUuid = async (uuid) => {
    const expense = await Expense.findOne({
        where: { uuid, deletedAt: null },
        include: [{ association: 'reversals' }],
    });

    if (!expense) {
        return null;
    }

    return mapExpenseDTO(expense, expense.reversals || []);
};

/**
 * Update an expense before it is committed. Financial fields (amount) of a
 * completed expense are never mutated - only non-financial details may be
 * edited pre-completion.
 */
export const updateExpense = async ({ uuid, updates, actorUserId }) => {
    const expense = await Expense.findOne({ where: { uuid, deletedAt: null } });

    if (!expense) {
        const error = new Error('Expense not found');
        error.statusCode = 404;
        throw error;
    }

    if (expense.status === 'cancelled') {
        const error = new Error('A cancelled expense cannot be updated');
        error.statusCode = 409;
        throw error;
    }

    // Never mutate the amount of an already-completed expense
    if (expense.status === 'completed' && 'amountPaise' in updates) {
        const error = new Error('Cannot update the amount of a completed expense');
        error.statusCode = 409;
        throw error;
    }

    await expense.update(updates);

    const fullExpense = await Expense.findByPk(expense.id, {
        include: [{ association: 'reversals' }],
    });

    return mapExpenseDTO(fullExpense, fullExpense.reversals || []);
};

/**
 * Cancel a completed expense: snapshot a reversal row (CANCEL) and mark the
 * expense cancelled. The completed financial record is never mutated.
 */
export const cancelExpense = async ({ uuid, reason, actorUserId }) => {
    const transaction = await sequelize.transaction();
    try {
        const expense = await Expense.findOne({ where: { uuid, deletedAt: null }, transaction });

        if (!expense) {
            const error = new Error('Expense not found');
            error.statusCode = 404;
            throw error;
        }

        if (expense.status === 'cancelled') {
            const error = new Error(`Expense ${expense.uuid} is already cancelled`);
            error.statusCode = 409;
            throw error;
        }

        // CAS: atomically flip status completed -> cancelled before writing the
        // reversal, so two concurrent cancels cannot both double-issue.
        const [, affectedCount] = await sequelize.query(
            `UPDATE expenses
             SET status = :to, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND status = :expectedFrom AND deleted_at IS NULL`,
            {
                replacements: {
                    id: expense.id,
                    to: 'cancelled',
                    expectedFrom: 'completed',
                },
                type: sequelize.QueryTypes.UPDATE,
                transaction,
            }
        );

        if (affectedCount === 0) {
            const realExpense = await Expense.findByPk(expense.id, {
                attributes: ['uuid', 'status', 'deletedAt'],
                transaction,
            });
            if (!realExpense || realExpense.deletedAt) {
                const error = new Error(`Expense ${expense.uuid} was deleted`);
                error.statusCode = 409;
                throw error;
            }
            const realStatus = realExpense.status || 'unknown';
            const error = new Error(
                `Expense ${realExpense.uuid} is already ${realStatus}, cannot cancel`
            );
            error.statusCode = 409;
            throw error;
        }

        // Record the reversal AFTER the conditional update wins, in the same
        // transaction. History is never rewritten; reversals are append-only.
        await ExpenseReversal.create(
            {
                expenseId: expense.id,
                reversalType: 'CANCEL',
                amountPaise: expense.amountPaise,
                reason: reason || null,
            },
            { transaction }
        );

        // Status already flipped to cancelled by the CAS above.
        expense.status = 'cancelled';

        await transaction.commit();

        const fullExpense = await Expense.findByPk(expense.id, {
            include: [{ association: 'reversals' }],
        });

        return mapExpenseDTO(fullExpense, fullExpense.reversals || []);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};
