import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import { publishState, streamState } from './pos-display.controller.js';

const router = express.Router();

// PUBLIC — no auth. The customer-facing display device subscribes here.
router.get('/:code/stream', streamState);

// AUTHENTICATED — only a cashier with SALES.CREATE can publish a state,
// so nobody can inject a fake QR/amount onto someone else's display.
router.post('/:code', authenticate, authorize(PERMISSIONS.SALES.CREATE), publishState);

export default router;
