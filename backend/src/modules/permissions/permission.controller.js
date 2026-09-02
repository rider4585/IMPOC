import { createPermissionSchema, permissionUuidParamSchema, updatePermissionSchema } from './permission.validation.js';
import {
    getPermissions as getPermissionsList,
    createPermission as createPermissionAccount,
    getPermissionByUuid as getPermissionByUuidAccount,
    updatePermission as updatePermissionAccount,
    deletePermission as deletePermissionAccount,
} from './permission.service.js';

export const getPermissions = async (req, res, next) => {
    try {
        const permissions = await getPermissionsList();

        return res.status(200).json({
            success: true,
            data: permissions.map((permission) => ({
                uuid: permission.uuid,
                name: permission.name,
                description: permission.description,
                createdAt: permission.createdAt,
                updatedAt: permission.updatedAt,
            })),
        });
    } catch (error) {
        next(error);
    }
};

export const createPermission = async (req, res, next) => {
    try {
        const data = createPermissionSchema.parse(req.body);

        const permission = await createPermissionAccount(data);

        return res.status(201).json({
            success: true,
            data: {
                uuid: permission.uuid,
                name: permission.name,
                description: permission.description,
                createdAt: permission.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getPermissionByUuid = async (req, res, next) => {
    try {
        const { uuid } = permissionUuidParamSchema.parse(req.params);

        const permission = await getPermissionByUuidAccount(uuid);

        return res.status(200).json({
            success: true,
            data: {
                uuid: permission.uuid,
                name: permission.name,
                description: permission.description,
                createdAt: permission.createdAt,
                updatedAt: permission.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const updatePermission = async (req, res, next) => {
    try {
        const { uuid } = permissionUuidParamSchema.parse(req.params);

        const data = updatePermissionSchema.parse(req.body);

        const permission = await updatePermissionAccount(uuid, data);

        return res.status(200).json({
            success: true,
            data: {
                uuid: permission.uuid,
                name: permission.name,
                description: permission.description,
                createdAt: permission.createdAt,
                updatedAt: permission.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const deletePermission = async (req, res, next) => {
    try {
        const { uuid } = permissionUuidParamSchema.parse(req.params);

        const permission = await deletePermissionAccount(uuid);

        return res.status(200).json({
            success: true,
            data: {
                uuid: permission.uuid,
                name: permission.name,
            },
        });
    } catch (error) {
        next(error);
    }
};
