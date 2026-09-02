import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getDamageGrades,
    createDamageGrade,
    getDamageGradeByUuid,
    updateDamageGrade,
} from './damage-grade.controller.js';

const router = express.Router();

router.get('/', authenticate, getDamageGrades);

router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createDamageGrade);

router.get('/:uuid', authenticate, getDamageGradeByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updateDamageGrade);

export default router;
