import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getPermissions,
    createPermission,
    getPermissionByUuid,
    updatePermission,
    deletePermission,
} from './permission.controller.js';

const router = express.Router();

router.get('/', authenticate, authorize(PERMISSIONS.ROLES.VIEW), getPermissions);

router.post('/', authenticate, authorize(PERMISSIONS.ROLES.MANAGE), createPermission);

router.get('/:uuid', authenticate, authorize(PERMISSIONS.ROLES.VIEW), getPermissionByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.ROLES.MANAGE), updatePermission);

router.delete('/:uuid', authenticate, authorize(PERMISSIONS.ROLES.MANAGE), deletePermission);

export default router;
