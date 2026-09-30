import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getTransactionTags,
    createTransactionTag,
    getTransactionTagByUuid,
    updateTransactionTag,
} from './transaction-tag.controller.js';

const router = express.Router();

router.get('/', authenticate, getTransactionTags);

router.post('/', authenticate, authorize(PERMISSIONS.PICKLISTS.CREATE), createTransactionTag);

router.get('/:uuid', authenticate, getTransactionTagByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.PICKLISTS.UPDATE), updateTransactionTag);

export default router;