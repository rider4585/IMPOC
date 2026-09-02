import express from 'express';

import {
    login,
    refresh,
    logout,
    logoutAll,
    getCurrentUser,
} from './auth.controller.js';

import {
    getUserSessions,
    getSessionByUuid,
    revokeSession,
} from './auth-session.controller.js';

import { authenticate } from '../../middleware/auth.middleware.js';
import { requireSpaHeader } from '../../middleware/require-spa-header.middleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh', requireSpaHeader, refresh);
router.post('/logout', authenticate, requireSpaHeader, logout);
router.post('/logout-all', authenticate, requireSpaHeader, logoutAll);
router.get('/me', authenticate, getCurrentUser);

router.get('/sessions', authenticate, getUserSessions);
router.get('/sessions/:uuid', authenticate, getSessionByUuid);
router.delete('/sessions/:uuid', authenticate, revokeSession);

export default router;