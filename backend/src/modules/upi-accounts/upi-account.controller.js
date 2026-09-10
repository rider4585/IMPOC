import { createUpiAccountSchema, upiAccountUuidParamSchema, updateUpiAccountSchema } from './upi-account.validation.js';
import {
    getUpiAccounts as getUpiAccountsList,
    createUpiAccount as createUpiAccountService,
    getUpiAccountByUuid as getUpiAccountByUuidService,
    updateUpiAccount as updateUpiAccountService,
} from './upi-account.service.js';

function mapUpiAccountDTO(upiAccount) {
    return {
        uuid: upiAccount.uuid,
        label: upiAccount.label,
        vpa: upiAccount.vpa,
        isActive: upiAccount.isActive,
        createdAt: upiAccount.createdAt,
        updatedAt: upiAccount.updatedAt,
    };
}

export const getUpiAccounts = async (req, res, next) => {
    try {
        const upiAccounts = await getUpiAccountsList();

        return res.status(200).json({
            success: true,
            data: upiAccounts.map(mapUpiAccountDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createUpiAccount = async (req, res, next) => {
    try {
        const data = createUpiAccountSchema.parse(req.body);

        const upiAccount = await createUpiAccountService(data);

        return res.status(201).json({
            success: true,
            data: mapUpiAccountDTO(upiAccount),
        });
    } catch (error) {
        next(error);
    }
};

export const getUpiAccountByUuid = async (req, res, next) => {
    try {
        const { uuid } = upiAccountUuidParamSchema.parse(req.params);

        const upiAccount = await getUpiAccountByUuidService(uuid);

        return res.status(200).json({
            success: true,
            data: mapUpiAccountDTO(upiAccount),
        });
    } catch (error) {
        next(error);
    }
};

export const updateUpiAccount = async (req, res, next) => {
    try {
        const { uuid } = upiAccountUuidParamSchema.parse(req.params);
        const data = updateUpiAccountSchema.parse(req.body);

        const upiAccount = await updateUpiAccountService(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapUpiAccountDTO(upiAccount),
        });
    } catch (error) {
        next(error);
    }
};
