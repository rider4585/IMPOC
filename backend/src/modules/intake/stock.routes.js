import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    createStock,
    getStocksByTrip,
    getStockByUuid,
    updateStock,
    scanIntoStock,
} from './stock.controller.js';

const router = express.Router({ mergeParams: true });

// GET all stocks for a trip
router.get('/', authenticate, getStocksByTrip);

// POST to create a new stock
router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createStock);

// GET a specific stock by UUID
router.get('/:uuid', authenticate, getStockByUuid);

// POST to scan a unit into a stock
router.post('/:uuid/scan', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), scanIntoStock);

// PATCH to update a stock
router.patch('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updateStock);

export default router;