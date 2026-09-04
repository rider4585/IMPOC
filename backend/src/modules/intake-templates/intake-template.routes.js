import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getIntakeRecords,
    getIntakeRecordByUuid,
    createIntakeRecord,
    updateIntakeRecord,
    createIntakeTemplate,
    updateIntakeTemplate,
    deleteIntakeTemplate,
} from './intake-template.controller.js';

const router = express.Router();

router.get('/', authenticate, getIntakeRecords);
router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createIntakeRecord);
router.get('/:intakeUuid', authenticate, getIntakeRecordByUuid);
router.patch('/:intakeUuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updateIntakeRecord);

router.post('/:intakeUuid/templates', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createIntakeTemplate);
router.patch('/:intakeUuid/templates/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updateIntakeTemplate);
router.delete('/:intakeUuid/templates/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.DELETE), deleteIntakeTemplate);

export default router;
