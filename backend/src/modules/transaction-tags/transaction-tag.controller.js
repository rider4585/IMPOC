import {
    createTransactionTagSchema,
    transactionTagUuidParamSchema,
    updateTransactionTagSchema,
} from './transaction-tag.validation.js';
import {
    getTransactionTags as getTransactionTagsService,
    getTransactionTagByUuid as getTransactionTagByUuidService,
    createTransactionTag as createTransactionTagService,
    updateTransactionTag as updateTransactionTagService,
} from './transaction-tag.service.js';

function mapTransactionTagDTO(tag) {
    return {
        uuid: tag.uuid,
        name: tag.name,
        isActive: tag.isActive,
        showOnPos: tag.showOnPos,
        isDefault: tag.isDefault,
    };
}

export const getTransactionTags = async (req, res, next) => {
    try {
        const tags = await getTransactionTagsService();

        return res.status(200).json({
            success: true,
            data: tags.map(mapTransactionTagDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createTransactionTag = async (req, res, next) => {
    try {
        const data = createTransactionTagSchema.parse(req.body);

        const tag = await createTransactionTagService(data);

        return res.status(201).json({
            success: true,
            data: mapTransactionTagDTO(tag),
        });
    } catch (error) {
        next(error);
    }
};

export const getTransactionTagByUuid = async (req, res, next) => {
    try {
        const { uuid } = transactionTagUuidParamSchema.parse(req.params);

        const tag = await getTransactionTagByUuidService(uuid);

        return res.status(200).json({
            success: true,
            data: mapTransactionTagDTO(tag),
        });
    } catch (error) {
        next(error);
    }
};

export const updateTransactionTag = async (req, res, next) => {
    try {
        const { uuid } = transactionTagUuidParamSchema.parse(req.params);
        const data = updateTransactionTagSchema.parse(req.body);

        const tag = await updateTransactionTagService(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapTransactionTagDTO(tag),
        });
    } catch (error) {
        next(error);
    }
};