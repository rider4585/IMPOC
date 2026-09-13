import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getReviewLinks,
    createReviewLink,
    getReviewLinkByUuid,
    updateReviewLink,
} from './review-link.controller.js';

const router = express.Router();

router.get('/', authenticate, getReviewLinks);

router.post('/', authenticate, authorize(PERMISSIONS.PICKLISTS.CREATE), createReviewLink);

router.get('/:uuid', authenticate, getReviewLinkByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.PICKLISTS.UPDATE), updateReviewLink);

export default router;
