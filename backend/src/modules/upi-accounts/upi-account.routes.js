import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getUpiAccounts,
    createUpiAccount,
    getUpiAccountByUuid,
    updateUpiAccount,
} from './upi-account.controller.js';

const router = express.Router();

router.get('/', authenticate, getUpiAccounts);

router.post('/', authenticate, authorize(PERMISSIONS.PICKLISTS.CREATE), createUpiAccount);

router.get('/:uuid', authenticate, getUpiAccountByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.PICKLISTS.UPDATE), updateUpiAccount);

export default router;
