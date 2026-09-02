import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getStockIntakes,
    createStockIntake,
    getStockIntakeByUuid,
    getCloneLastLot,
} from './stock-intake.controller.js';

const router = express.Router();

router.get('/', authenticate, getStockIntakes);

router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createStockIntake);

router.get('/:tripUuid/clone-last-lot', authenticate, getCloneLastLot);

router.get('/:uuid', authenticate, getStockIntakeByUuid);

export default router;
