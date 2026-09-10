import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getExpenseTypes,
    createExpenseType,
    getExpenseTypeByUuid,
    updateExpenseType,
} from './expense-type.controller.js';

const router = express.Router();

router.get('/', authenticate, getExpenseTypes);

router.post('/', authenticate, authorize(PERMISSIONS.PICKLISTS.CREATE), createExpenseType);

router.get('/:uuid', authenticate, getExpenseTypeByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.PICKLISTS.UPDATE), updateExpenseType);

export default router;
