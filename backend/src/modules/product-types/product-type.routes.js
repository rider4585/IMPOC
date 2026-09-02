import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getProductTypes,
    createProductType,
    getProductTypeByUuid,
    updateProductType,
    deactivateProductType,
} from './product-type.controller.js';

const router = express.Router();

router.get('/', authenticate, getProductTypes);

router.post('/', authenticate, authorize(PERMISSIONS.PICKLISTS.CREATE), createProductType);

router.get('/:uuid', authenticate, getProductTypeByUuid);

router.patch('/:uuid', authenticate, authorize(PERMISSIONS.PICKLISTS.UPDATE), updateProductType);

router.patch('/:uuid/deactivate', authenticate, authorize(PERMISSIONS.PICKLISTS.UPDATE), deactivateProductType);

export default router;
