import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getVendors,
    createVendor,
    getVendorByUuid,
    updateVendor,
    getVendorHistory,
} from './vendor.controller.js';

const router = express.Router();

router.get('/', authenticate, authorize(PERMISSIONS.INVENTORY.VIEW), getVendors);

router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createVendor);

router.get('/:uuid/history', authenticate, authorize(PERMISSIONS.INVENTORY.VIEW), getVendorHistory);

router.get('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.VIEW), getVendorByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updateVendor);

export default router;
