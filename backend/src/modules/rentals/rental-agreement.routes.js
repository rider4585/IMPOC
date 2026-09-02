import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { RENTAL_PERMISSIONS } from '../../constants/rental-permissions.js';

import {
    createRental,
    listRentals,
    getRentalByUuid,
    processRentalReturn,
    cancelRental,
} from './rental-agreement.controller.js';

const router = express.Router();

// GET /api/rentals - List rental agreements
router.get('/', authenticate, authorize(RENTAL_PERMISSIONS.VIEW), listRentals);

// POST /api/rentals - Checkout / hand-out a rental
router.post('/', authenticate, authorize(RENTAL_PERMISSIONS.CREATE), createRental);

// GET /api/rentals/:uuid - Get an agreement by uuid
router.get('/:uuid', authenticate, authorize(RENTAL_PERMISSIONS.VIEW), getRentalByUuid);

// POST /api/rentals/:uuid/return - Process a return
router.post('/:uuid/return', authenticate, authorize(RENTAL_PERMISSIONS.RETURN), processRentalReturn);

// POST /api/rentals/:uuid/cancel - Cancel an active agreement
router.post('/:uuid/cancel', authenticate, authorize(RENTAL_PERMISSIONS.CANCEL), cancelRental);

export default router;
