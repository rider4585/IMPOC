import {
    createIntakeRecordSchema,
    updateIntakeRecordSchema,
    createIntakeTemplateSchema,
    updateIntakeTemplateSchema,
    intakeRecordUuidParamSchema,
    intakeTemplateUuidParamSchema,
} from './intake-template.validation.js';
import {
    getIntakeRecords as getIntakeRecordsService,
    getIntakeRecordByUuid as getIntakeRecordByUuidService,
    createIntakeRecord as createIntakeRecordService,
    updateIntakeRecord as updateIntakeRecordService,
    createIntakeTemplate as createIntakeTemplateService,
    updateIntakeTemplate as updateIntakeTemplateService,
    deleteIntakeTemplate as deleteIntakeTemplateService,
} from './intake-template.service.js';

export const getIntakeRecords = async (req, res, next) => {
    try {
        const records = await getIntakeRecordsService();
        return res.status(200).json({ success: true, data: records });
    } catch (error) {
        next(error);
    }
};

export const getIntakeRecordByUuid = async (req, res, next) => {
    try {
        const { intakeUuid } = intakeRecordUuidParamSchema.parse(req.params);
        const record = await getIntakeRecordByUuidService(intakeUuid);
        return res.status(200).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};

export const createIntakeRecord = async (req, res, next) => {
    try {
        const body = createIntakeRecordSchema.parse(req.body);
        const record = await createIntakeRecordService(body);
        return res.status(201).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};

export const updateIntakeRecord = async (req, res, next) => {
    try {
        const { intakeUuid } = intakeRecordUuidParamSchema.parse(req.params);
        const body = updateIntakeRecordSchema.parse(req.body);
        const record = await updateIntakeRecordService(intakeUuid, body);
        return res.status(200).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};

export const createIntakeTemplate = async (req, res, next) => {
    try {
        const { intakeUuid } = intakeRecordUuidParamSchema.parse(req.params);
        const body = createIntakeTemplateSchema.parse(req.body);
        const template = await createIntakeTemplateService(intakeUuid, body);
        return res.status(201).json({ success: true, data: template });
    } catch (error) {
        next(error);
    }
};

export const updateIntakeTemplate = async (req, res, next) => {
    try {
        const params = intakeTemplateUuidParamSchema.parse(req.params);
        const body = updateIntakeTemplateSchema.parse(req.body);
        const template = await updateIntakeTemplateService(params.intakeUuid, params.uuid, body);
        return res.status(200).json({ success: true, data: template });
    } catch (error) {
        next(error);
    }
};

export const deleteIntakeTemplate = async (req, res, next) => {
    try {
        const params = intakeTemplateUuidParamSchema.parse(req.params);
        const result = await deleteIntakeTemplateService(params.intakeUuid, params.uuid);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};
