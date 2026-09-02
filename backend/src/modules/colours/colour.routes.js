import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getColours,
    createColour,
    getColourByUuid,
    updateColour,
} from './colour.controller.js';

const router = express.Router();

router.get('/', authenticate, getColours);

router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createColour);

router.get('/:uuid', authenticate, getColourByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updateColour);

export default router;
