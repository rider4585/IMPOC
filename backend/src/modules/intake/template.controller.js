import {
    createTemplateSchema,
    updateTemplateSchema,
    templateUuidParamSchema,
    listTemplatesQuerySchema,
} from './template.validation.js';
import {
    getTemplates as getTemplatesService,
    getTemplateByUuid as getTemplateByUuidService,
    createTemplate as createTemplateService,
    updateTemplate as updateTemplateService,
    deleteTemplate as deleteTemplateService,
} from './template.service.js';

/**
 * HTML escape function to prevent XSS attacks
 */
function escapeHtml(text) {
    if (!text || typeof text !== 'string') return text;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, char => map[char]);
}

function mapDTO(template) {
    return {
        ...template,
        name: template.name ? escapeHtml(template.name) : null,
        vendorName: template.vendorName ? escapeHtml(template.vendorName) : null,
    };
}

export const getTemplates = async (req, res, next) => {
    try {
        const query = listTemplatesQuerySchema.parse(req.query || {});
        const templates = await getTemplatesService({ vendorUuid: query.vendorUuid });
        return res.status(200).json({ success: true, data: templates.map(mapDTO) });
    } catch (error) {
        next(error);
    }
};

export const getTemplateByUuid = async (req, res, next) => {
    try {
        const { uuid } = templateUuidParamSchema.parse(req.params);
        const template = await getTemplateByUuidService(uuid);
        return res.status(200).json({ success: true, data: mapDTO(template) });
    } catch (error) {
        next(error);
    }
};

export const createTemplate = async (req, res, next) => {
    try {
        const body = createTemplateSchema.parse(req.body);
        const template = await createTemplateService(body);
        return res.status(201).json({ success: true, data: mapDTO(template) });
    } catch (error) {
        next(error);
    }
};

export const updateTemplate = async (req, res, next) => {
    try {
        const { uuid } = templateUuidParamSchema.parse(req.params);
        const body = updateTemplateSchema.parse(req.body);
        const template = await updateTemplateService(uuid, body);
        return res.status(200).json({ success: true, data: mapDTO(template) });
    } catch (error) {
        next(error);
    }
};

export const deleteTemplate = async (req, res, next) => {
    try {
        const { uuid } = templateUuidParamSchema.parse(req.params);
        const result = await deleteTemplateService(uuid);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};