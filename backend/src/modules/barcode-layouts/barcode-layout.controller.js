import { updateBarcodeLayoutSchema, createTemplateSchema, templateUuidParamSchema } from './barcode-layout.validation.js';
import { getLayout, updateLayout, listTemplates, createTemplate, deleteTemplate } from './barcode-layout.service.js';

export const getBarcodeLayout = async (req, res, next) => {
    try {
        const layout = await getLayout();
        return res.status(200).json({ success: true, data: layout });
    } catch (error) {
        next(error);
    }
};

export const putBarcodeLayout = async (req, res, next) => {
    try {
        const data = updateBarcodeLayoutSchema.parse(req.body);
        const layout = await updateLayout(data, req.auth?.userUuid);
        return res.status(200).json({ success: true, data: layout });
    } catch (error) {
        next(error);
    }
};

/* Templates (R-56) */

export const getBarcodeLayoutTemplates = async (req, res, next) => {
    try {
        return res.status(200).json({ success: true, data: await listTemplates() });
    } catch (error) {
        next(error);
    }
};

export const postBarcodeLayoutTemplate = async (req, res, next) => {
    try {
        const data = createTemplateSchema.parse(req.body);
        const template = await createTemplate(data, req.auth?.userUuid);
        return res.status(201).json({ success: true, data: template });
    } catch (error) {
        next(error);
    }
};

export const deleteBarcodeLayoutTemplate = async (req, res, next) => {
    try {
        const { uuid } = templateUuidParamSchema.parse(req.params);
        return res.status(200).json({ success: true, data: await deleteTemplate(uuid) });
    } catch (error) {
        next(error);
    }
};
