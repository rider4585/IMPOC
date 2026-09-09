import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getTrips,
    createTrip,
    getTripByUuid,
    addTripVendor,
    getCloneLastStock,
} from './trip.controller.js';

const router = express.Router();

router.get('/', authenticate, authorize(PERMISSIONS.INVENTORY.VIEW), getTrips);

router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createTrip);

router.get('/:tripUuid/clone-last-stock', authenticate, authorize(PERMISSIONS.INVENTORY.VIEW), getCloneLastStock);

router.post('/:uuid/vendors', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), addTripVendor);

router.patch('/:uuid/vendors', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), addTripVendor);

router.get('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.VIEW), getTripByUuid);

export default router;