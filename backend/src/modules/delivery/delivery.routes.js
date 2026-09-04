import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { DELIVERY_PERMISSIONS } from '../../constants/delivery-permissions.js';

import {
    createDeliveryLog,
    listDeliveryLogs,
    getDeliveryLogByUuid,
} from './delivery.controller.js';

const router = express.Router();

// GET /api/delivery/logs - List delivery logs (optionally by entity)
router.get('/logs', authenticate, authorize(DELIVERY_PERMISSIONS.VIEW), listDeliveryLogs);

// POST /api/delivery/logs - Create a delivery log
router.post('/logs', authenticate, authorize(DELIVERY_PERMISSIONS.CREATE), createDeliveryLog);

// GET /api/delivery/logs/:uuid - Get a delivery log by uuid
router.get('/logs/:uuid', authenticate, authorize(DELIVERY_PERMISSIONS.VIEW), getDeliveryLogByUuid);

export default router;