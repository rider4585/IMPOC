import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getDashboard,
    getSalesReport,
    getRentalsReport,
    getExpensesReport,
    getInventoryReport,
} from './reports.controller.js';

const router = express.Router();

// All report endpoints are read-side and require reports.view
router.get('/dashboard', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getDashboard);
router.get('/sales', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getSalesReport);
router.get('/rentals', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getRentalsReport);
router.get('/expenses', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getExpensesReport);
router.get('/inventory', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getInventoryReport);

export default router;
