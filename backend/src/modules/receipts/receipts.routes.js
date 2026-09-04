import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import { previewReceipt, printReceipt } from './receipts.controller.js';

const router = express.Router();

// GET /api/receipts/preview - Structured receipt JSON
router.get('/preview', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), previewReceipt);

// GET /api/receipts/print - 58mm plain-text receipt
router.get('/print', authenticate, authorize(PERMISSIONS.REPORTS.VIEW), printReceipt);

export default router;