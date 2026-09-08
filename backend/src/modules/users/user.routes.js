import express from 'express';

import {authenticate} from '../../middleware/auth.middleware.js';
import {authorize} from '../../middleware/authorization.middleware.js';

import {PERMISSIONS} from '../../constants/permissions.js';

import {
    getUsers, createUser, getUserByUuid, updateUser, updateUserStatus, deleteUser,
} from './user.controller.js';

import {
    getUserRoles, assignRoleToUser, removeRoleFromUser,
} from './user-role.controller.js';

const router = express.Router();

router.get('/', authenticate, authorize(PERMISSIONS.USERS.VIEW), getUsers);

router.get('/:uuid', authenticate, authorize(PERMISSIONS.USERS.VIEW), getUserByUuid);

router.post('/', authenticate, authorize(PERMISSIONS.USERS.CREATE), createUser);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.USERS.UPDATE), updateUser);

router.patch('/:uuid/status', authenticate, authorize(PERMISSIONS.USERS.UPDATE), updateUserStatus);

router.delete('/:uuid', authenticate, authorize(PERMISSIONS.USERS.DELETE), deleteUser);

router.get('/:userUuid/roles', authenticate, authorize(PERMISSIONS.USERS.VIEW), getUserRoles);

router.post('/:userUuid/roles', authenticate, authorize(PERMISSIONS.USERS.ASSIGN_ROLE), assignRoleToUser);

router.delete('/:userUuid/roles/:roleUuid', authenticate, authorize(PERMISSIONS.USERS.ASSIGN_ROLE), removeRoleFromUser);

export default router;