import { createPaymentMethodSchema, paymentMethodUuidParamSchema, updatePaymentMethodSchema } from './payment-method.validation.js';
import {
    getPaymentMethods as getPaymentMethodsList,
    createPaymentMethod as createPaymentMethodService,
    getPaymentMethodByUuid as getPaymentMethodByUuidService,
    updatePaymentMethod as updatePaymentMethodService,
} from './payment-method.service.js';

/**
 * Map payment method to DTO response
 * @returns {Object} DTO with uuid, name, isActive, createdAt, updatedAt
 */
function mapPaymentMethodDTO(paymentMethod) {
    return {
        uuid: paymentMethod.uuid,
        name: paymentMethod.name,
        isActive: paymentMethod.isActive,
        createdAt: paymentMethod.createdAt,
        updatedAt: paymentMethod.updatedAt,
    };
}

export const getPaymentMethods = async (req, res, next) => {
    try {
        const paymentMethods = await getPaymentMethodsList();

        return res.status(200).json({
            success: true,
            data: paymentMethods.map(mapPaymentMethodDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createPaymentMethod = async (req, res, next) => {
    try {
        const data = createPaymentMethodSchema.parse(req.body);

        const paymentMethod = await createPaymentMethodService(data);

        return res.status(201).json({
            success: true,
            data: mapPaymentMethodDTO(paymentMethod),
        });
    } catch (error) {
        next(error);
    }
};

export const getPaymentMethodByUuid = async (req, res, next) => {
    try {
        const { uuid } = paymentMethodUuidParamSchema.parse(req.params);

        const paymentMethod = await getPaymentMethodByUuidService(uuid);

        return res.status(200).json({
            success: true,
            data: mapPaymentMethodDTO(paymentMethod),
        });
    } catch (error) {
        next(error);
    }
};

export const updatePaymentMethod = async (req, res, next) => {
    try {
        const { uuid } = paymentMethodUuidParamSchema.parse(req.params);
        const data = updatePaymentMethodSchema.parse(req.body);

        const paymentMethod = await updatePaymentMethodService(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapPaymentMethodDTO(paymentMethod),
        });
    } catch (error) {
        next(error);
    }
};