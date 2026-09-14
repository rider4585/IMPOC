import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    createEnquiry,
    listEnquiries,
    getEnquiryByUuid,
    updateEnquiry,
    closeEnquiry,
    reopenEnquiry,
} from './enquiries.controller.js';

const router = express.Router();

// GET /api/enquiries - List enquiries (tabs by status, search)
router.get('/', authenticate, authorize(PERMISSIONS.ENQUIRIES.VIEW), listEnquiries);

// POST /api/enquiries - Log an enquiry
router.post('/', authenticate, authorize(PERMISSIONS.ENQUIRIES.CREATE), createEnquiry);

// GET /api/enquiries/:uuid
router.get('/:uuid', authenticate, authorize(PERMISSIONS.ENQUIRIES.VIEW), getEnquiryByUuid);

// PATCH /api/enquiries/:uuid - Edit what was asked for
router.patch('/:uuid', authenticate, authorize(PERMISSIONS.ENQUIRIES.UPDATE), updateEnquiry);

// POST /api/enquiries/:uuid/close - Close with a reason
router.post('/:uuid/close', authenticate, authorize(PERMISSIONS.ENQUIRIES.UPDATE), closeEnquiry);

// POST /api/enquiries/:uuid/reopen
router.post('/:uuid/reopen', authenticate, authorize(PERMISSIONS.ENQUIRIES.UPDATE), reopenEnquiry);

export default router;
