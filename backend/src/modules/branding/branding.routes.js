import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';

import { getBrandingHandler, putBrandingHandler } from './branding.controller.js';

const router = express.Router();

// PUBLIC: the sign-in page and the customer display (/display) show the brand before any login.
// Exposes only the shop name and logo — nothing else.
router.get('/', getBrandingHandler);

router.put('/', authenticate, authorize(PERMISSIONS.BRANDING.MANAGE), putBrandingHandler);

export default router;
