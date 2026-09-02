import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getSizes,
    createSize,
    getSizeByUuid,
    updateSize,
} from './size.controller.js';

const router = express.Router();

router.get('/', authenticate, getSizes);

router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createSize);

router.get('/:uuid', authenticate, getSizeByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updateSize);

export default router;
