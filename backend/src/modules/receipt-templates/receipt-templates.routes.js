import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';

import {
    handleListTemplates,
    handleGetTemplate,
    handleCreateTemplate,
    handleUpdateTemplate,
    handleActivateTemplate,
    handleGetActiveTemplate,
    handlePreviewTemplate,
    handleCaptureSnapshot,
    handleGetSnapshot,
    handleListSnapshots,
    handleExportSnapshots,
} from './receipt-templates.controller.js';

// ---- Template Router (mounted at /api/receipt-templates) ----

const router = express.Router();

// GET / — list templates (optional ?entityType filter)
router.get('/', authenticate, authorize(PERMISSIONS.RECEIPT_TEMPLATES.VIEW), handleListTemplates);

// GET /active — get the active template for a given entityType (BEFORE /:uuid)
router.get('/active', authenticate, authorize(PERMISSIONS.RECEIPT_TEMPLATES.VIEW), handleGetActiveTemplate);

// POST /preview — render a template with sample data (BEFORE /:uuid)
router.post('/preview', authenticate, authorize(PERMISSIONS.RECEIPT_TEMPLATES.VIEW), handlePreviewTemplate);

// GET /:uuid — get single template
router.get('/:uuid', authenticate, authorize(PERMISSIONS.RECEIPT_TEMPLATES.VIEW), handleGetTemplate);

// POST / — create a new template (version 1)
router.post('/', authenticate, authorize(PERMISSIONS.RECEIPT_TEMPLATES.MANAGE), handleCreateTemplate);

// PUT /:uuid — create a new version from an existing template
router.put('/:uuid', authenticate, authorize(PERMISSIONS.RECEIPT_TEMPLATES.MANAGE), handleUpdateTemplate);

// POST /:uuid/activate — make this template active for its entityType
router.post('/:uuid/activate', authenticate, authorize(PERMISSIONS.RECEIPT_TEMPLATES.MANAGE), handleActivateTemplate);

// ---- Snapshot Router (mounted at /api/receipt-snapshots) ----

const snapshotRouter = express.Router();

// GET / — list snapshots (optional ?entityType, ?limit, ?offset)
snapshotRouter.get('/', authenticate, authorize(PERMISSIONS.RECEIPT_SNAPSHOTS.VIEW), handleListSnapshots);

// GET /export — bulk export all snapshots (BEFORE /:entityType/:entityUuid)
snapshotRouter.get('/export', authenticate, authorize(PERMISSIONS.RECEIPT_SNAPSHOTS.EXPORT), handleExportSnapshots);

// POST /:entityType/:entityUuid — capture a new snapshot
snapshotRouter.post('/:entityType/:entityUuid', authenticate, authorize(PERMISSIONS.RECEIPT_SNAPSHOTS.MANAGE), handleCaptureSnapshot);

// GET /:entityType/:entityUuid — get snapshot for a specific entity
snapshotRouter.get('/:entityType/:entityUuid', authenticate, authorize(PERMISSIONS.RECEIPT_SNAPSHOTS.VIEW), handleGetSnapshot);

export const receiptTemplateRoutes = router;
export const receiptSnapshotRoutes = snapshotRouter;
