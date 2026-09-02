import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    createStockIntakeLine,
    getStockIntakeLines,
    getStockIntakeLineByUuid,
    updateStockIntakeLine,
    scanIntoLot,
} from './stock-intake-line.controller.js';

const router = express.Router({ mergeParams: true });

// GET all lines for a trip
router.get('/', authenticate, getStockIntakeLines);

// POST to create a new line
router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createStockIntakeLine);

// GET a specific line by UUID
router.get('/:uuid', authenticate, getStockIntakeLineByUuid);

// POST to scan a unit into a lot
router.post('/:uuid/scan', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), scanIntoLot);

// PATCH to update a line
router.patch('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updateStockIntakeLine);

export default router;
