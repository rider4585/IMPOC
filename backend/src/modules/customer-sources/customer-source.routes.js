import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getCustomerSources,
    createCustomerSource,
    getCustomerSourceByUuid,
    updateCustomerSource,
} from './customer-source.controller.js';

const router = express.Router();

router.get('/', authenticate, getCustomerSources);

router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createCustomerSource);

router.get('/:uuid', authenticate, getCustomerSourceByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updateCustomerSource);

export default router;