import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getUnit,
    getStatusEvents,
    getUnitByBarcodeRoute,
    transitionUnitRoute,
    listAllUnitsRoute,
} from './units.controller.js';

const router = express.Router();

// GET /api/units - List all units (bare list-all endpoint)
router.get('/', authenticate, authorize(PERMISSIONS.INVENTORY.VIEW), listAllUnitsRoute);

// GET /api/units/by-barcode/:barcode - Get unit by barcode
// Must be before :uuid routes so it matches first
router.get('/by-barcode/:barcode', authenticate, authorize(PERMISSIONS.INVENTORY.VIEW), getUnitByBarcodeRoute);

// GET /api/units/:uuid/status-events - Get status events for a unit
// Must be before /:uuid so it matches first
router.get('/:uuid/status-events', authenticate, authorize(PERMISSIONS.INVENTORY.VIEW), getStatusEvents);

// POST /api/units/:uuid/transition - Transition unit status via state machine
// Must be before /:uuid so it matches first
router.post('/:uuid/transition', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), transitionUnitRoute);

// GET /api/units/:uuid - Get unit by UUID
router.get('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.VIEW), getUnit);

export default router;
