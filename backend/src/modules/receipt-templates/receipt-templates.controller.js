import {
    updateTemplateBody,
    templateUuidParam,
    listTemplatesQuery,
    previewTemplateBody,
    snapshotEntityParam,
    listSnapshotsQuery,
} from './receipt-templates.validation.js';

import {
    listTemplates,
    getTemplateByUuid,
    updateTemplate,
    activateTemplate,
    getActiveTemplate,
    previewTemplate,
    captureSnapshot,
    getSnapshot,
    listSnapshots,
    exportSnapshots,
} from './receipt-templates.service.js';

// ---- Template Handlers ----

export const handleListTemplates = async (req, res, next) => {
    try {
        const query = listTemplatesQuery.parse(req.query);
        const data = await listTemplates({ entityType: query.entityType });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const handleGetTemplate = async (req, res, next) => {
    try {
        const { uuid } = templateUuidParam.parse(req.params);
        const data = await getTemplateByUuid(uuid);
        if (!data) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const handleUpdateTemplate = async (req, res, next) => {
    try {
        const { uuid } = templateUuidParam.parse(req.params);
        const body = updateTemplateBody.parse(req.body);
        const data = await updateTemplate({ uuid, ...body });
        if (!data) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const handleActivateTemplate = async (req, res, next) => {
    try {
        const { uuid } = templateUuidParam.parse(req.params);
        const data = await activateTemplate({ uuid });
        if (!data) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const handleGetActiveTemplate = async (req, res, next) => {
    try {
        const query = listTemplatesQuery.parse(req.query);
        if (!query.entityType) {
            return res.status(400).json({ success: false, message: 'entityType query parameter is required' });
        }
        const data = await getActiveTemplate(query.entityType);
        if (!data) {
            return res.status(404).json({ success: false, message: 'No active template found' });
        }
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const handlePreviewTemplate = async (req, res, next) => {
    try {
        const body = previewTemplateBody.parse(req.body);
        const data = await previewTemplate({ htmlContent: body.htmlContent, entityType: body.entityType });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// ---- Snapshot Handlers ----

export const handleCaptureSnapshot = async (req, res, next) => {
    try {
        const { entityType, entityUuid } = snapshotEntityParam.parse(req.params);
        const data = await captureSnapshot({ entityType, entityUuid });
        return res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const handleGetSnapshot = async (req, res, next) => {
    try {
        const { entityType, entityUuid } = snapshotEntityParam.parse(req.params);
        const data = await getSnapshot({ entityType, entityUuid });
        if (!data) {
            return res.status(404).json({ success: false, message: 'Snapshot not found' });
        }
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const handleListSnapshots = async (req, res, next) => {
    try {
        const query = listSnapshotsQuery.parse(req.query);
        const data = await listSnapshots({
            entityType: query.entityType,
            limit: query.limit,
            offset: query.offset,
        });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const handleExportSnapshots = async (req, res, next) => {
    try {
        const data = await exportSnapshots();
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
