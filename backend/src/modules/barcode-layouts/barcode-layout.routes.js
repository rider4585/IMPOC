import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    getBarcodeLayout,
    putBarcodeLayout,
    getBarcodeLayoutTemplates,
    postBarcodeLayoutTemplate,
    deleteBarcodeLayoutTemplate,
} from './barcode-layout.controller.js';

const router = express.Router();

// Anyone who can print labels may read the layout (the Print/Layout screens need it)
router.get('/', authenticate, authorize(PERMISSIONS.INVENTORY.BARCODE_GENERATE), getBarcodeLayout);

// Editing changes every label printed from now on: Admin-only permission
router.put('/', authenticate, authorize(PERMISSIONS.INVENTORY.BARCODE_LAYOUT_MANAGE), putBarcodeLayout);

// R-56: named layout templates (mounted here so app.js is untouched)
router.get('/templates', authenticate, authorize(PERMISSIONS.INVENTORY.BARCODE_GENERATE), getBarcodeLayoutTemplates);
router.post('/templates', authenticate, authorize(PERMISSIONS.INVENTORY.BARCODE_LAYOUT_MANAGE), postBarcodeLayoutTemplate);
router.delete('/templates/:uuid', authenticate, authorize(PERMISSIONS.INVENTORY.BARCODE_LAYOUT_MANAGE), deleteBarcodeLayoutTemplate);

export default router;
