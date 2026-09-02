import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getRoles,
    createRole,
    getRoleByUuid,
    updateRole,
    deleteRole,
} from './role.controller.js';

import {
    getPermissions,
    assignPermission,
    removePermission,
} from './role-permission.controller.js';

const router = express.Router();

router.get('/', authenticate, authorize(PERMISSIONS.ROLES.VIEW), getRoles);

router.post('/', authenticate, authorize(PERMISSIONS.ROLES.MANAGE), createRole);

router.get('/:uuid', authenticate, authorize(PERMISSIONS.ROLES.VIEW), getRoleByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.ROLES.MANAGE), updateRole);

router.delete('/:uuid', authenticate, authorize(PERMISSIONS.ROLES.MANAGE), deleteRole);

router.get(
    '/:roleUuid/permissions',
    authenticate,
    authorize(PERMISSIONS.ROLES.VIEW),
    getPermissions
);

router.post(
    '/:roleUuid/permissions',
    authenticate,
    authorize(PERMISSIONS.ROLES.MANAGE),
    assignPermission
);

router.delete(
    '/:roleUuid/permissions/:permissionUuid',
    authenticate,
    authorize(PERMISSIONS.ROLES.MANAGE),
    removePermission
);

export default router;