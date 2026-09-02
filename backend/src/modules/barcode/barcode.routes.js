import { Router } from 'express';

import {
    generateBarcodePdf,
    generateBarcodeTestSheetPdf,
} from './barcode.controller.js';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = Router();

router.get(
    '/generate',
    authenticate,
    authorize(PERMISSIONS.INVENTORY.BARCODE_GENERATE),
    generateBarcodePdf
);

router.get(
    '/test-sheet',
    authenticate,
    authorize(PERMISSIONS.INVENTORY.BARCODE_GENERATE),
    generateBarcodeTestSheetPdf,
);

export default router;
