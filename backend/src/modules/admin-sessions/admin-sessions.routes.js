import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
    getSessions,
    revokeSession,
    revokeUserSessions,
} from './admin-sessions.controller.js';

const router = express.Router();

router.get('/', authenticate, authorize(PERMISSIONS.USERS.VIEW), getSessions);
router.delete('/users/:userUuid', authenticate, authorize(PERMISSIONS.USERS.UPDATE), revokeUserSessions);
router.delete('/:sessionUuid', authenticate, authorize(PERMISSIONS.USERS.UPDATE), revokeSession);

export default router;
