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
    getTripPnlReport,
    getVendorSellThroughReport,
    getStockLevelsReport,
    getMarginsReport,
} from './reports.controller.js';

const router = express.Router();

// All report endpoints are read-side and require reports.view
router.get('/dashboard', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getDashboard);
router.get('/sales', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getSalesReport);
router.get('/rentals', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getRentalsReport);
router.get('/expenses', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getExpensesReport);
router.get('/inventory', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getInventoryReport);
router.get('/trip-pnl', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getTripPnlReport);
router.get('/vendor-sell-through', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getVendorSellThroughReport);
router.get('/stock-levels', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getStockLevelsReport);
router.get('/margins', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), getMarginsReport);

export default router;
