import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    createExpense,
    listExpenses,
    getExpenseByUuid,
    updateExpense,
    cancelExpense,
} from './expenses.controller.js';

const router = express.Router();

// GET /api/expenses - List expenses
router.get('/', authenticate, authorize(PERMISSIONS.EXPENSES.VIEW), listExpenses);

// POST /api/expenses - Create an expense
router.post('/', authenticate, authorize(PERMISSIONS.EXPENSES.CREATE), createExpense);

// GET /api/expenses/:uuid - Get an expense by uuid
router.get('/:uuid', authenticate, authorize(PERMISSIONS.EXPENSES.VIEW), getExpenseByUuid);

// PATCH /api/expenses/:uuid - Update (pre-completion)
router.patch('/:uuid', authenticate, authorize(PERMISSIONS.EXPENSES.UPDATE), updateExpense);

// POST /api/expenses/:uuid/cancel - Cancel a completed expense (reversal)
router.post('/:uuid/cancel', authenticate, authorize(PERMISSIONS.EXPENSES.UPDATE), cancelExpense);

export default router;
