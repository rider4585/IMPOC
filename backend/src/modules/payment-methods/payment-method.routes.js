import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getPaymentMethods,
    createPaymentMethod,
    getPaymentMethodByUuid,
    updatePaymentMethod,
} from './payment-method.controller.js';

const router = express.Router();

router.get('/', authenticate, getPaymentMethods);

router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createPaymentMethod);

router.get('/:uuid', authenticate, getPaymentMethodByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updatePaymentMethod);

export default router;