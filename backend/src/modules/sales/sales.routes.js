import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    createSale,
    listSales,
    getSaleByUuid,
    cancelSale,
    refundSale,
} from './sales.controller.js';

const router = express.Router();

// GET /api/sales - List sales
router.get('/', authenticate, authorize(PERMISSIONS.SALES.VIEW), listSales);

// POST /api/sales - Checkout a RETAIL sale
router.post('/', authenticate, authorize(PERMISSIONS.SALES.CREATE), createSale);

// GET /api/sales/:uuid - Get a sale by uuid
router.get('/:uuid', authenticate, authorize(PERMISSIONS.SALES.VIEW), getSaleByUuid);

// POST /api/sales/:uuid/cancel - Cancel a completed sale
router.post('/:uuid/cancel', authenticate, authorize(PERMISSIONS.SALES.CANCEL), cancelSale);

// POST /api/sales/:uuid/refund - Refund a completed sale
router.post('/:uuid/refund', authenticate, authorize(PERMISSIONS.SALES.REFUND), refundSale);

export default router;
