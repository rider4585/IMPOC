import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getTemplates,
    getTemplateByUuid,
    createTemplate,
    updateTemplate,
    deleteTemplate,
} from './template.controller.js';

const router = express.Router();

router.get('/', authenticate, getTemplates);

router.post('/', authenticate, authorize(PERMISSIONS.INVENTORY.CREATE), createTemplate);

router.get('/:uuid', authenticate, getTemplateByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.UPDATE), updateTemplate);

router.delete('/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.DELETE), deleteTemplate);

export default router;