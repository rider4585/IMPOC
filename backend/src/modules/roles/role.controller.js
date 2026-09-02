import { createRoleSchema, roleUuidParamSchema, updateRoleSchema } from './role.validation.js';
import {
    getRoles as getRolesList,
    createRole as createRoleAccount,
    getRoleByUuid as getRoleByUuidAccount,
    updateRole as updateRoleAccount,
    deleteRole as deleteRoleAccount,
} from './role.service.js';

export const getRoles = async (req, res, next) => {
    try {
        const roles = await getRolesList();

        return res.status(200).json({
            success: true,
            data: roles.map((role) => ({
                uuid: role.uuid,
                name: role.name,
                description: role.description,
                createdAt: role.createdAt,
                updatedAt: role.updatedAt,
            })),
        });
    } catch (error) {
        next(error);
    }
};

export const createRole = async (req, res, next) => {
    try {
        const data = createRoleSchema.parse(req.body);

        const role = await createRoleAccount(data);

        return res.status(201).json({
            success: true,
            data: {
                uuid: role.uuid,
                name: role.name,
                description: role.description,
                createdAt: role.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getRoleByUuid = async (req, res, next) => {
    try {
        const { uuid } = roleUuidParamSchema.parse(req.params);

        const role = await getRoleByUuidAccount(uuid);

        return res.status(200).json({
            success: true,
            data: {
                uuid: role.uuid,
                name: role.name,
                description: role.description,
                createdAt: role.createdAt,
                updatedAt: role.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const updateRole = async (req, res, next) => {
    try {
        const { uuid } = roleUuidParamSchema.parse(req.params);

        const data = updateRoleSchema.parse(req.body);

        const role = await updateRoleAccount(uuid, data);

        return res.status(200).json({
            success: true,
            data: {
                uuid: role.uuid,
                name: role.name,
                description: role.description,
                createdAt: role.createdAt,
                updatedAt: role.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const deleteRole = async (req, res, next) => {
    try {
        const { uuid } = roleUuidParamSchema.parse(req.params);

        const role = await deleteRoleAccount(uuid);

        return res.status(200).json({
            success: true,
            data: {
                uuid: role.uuid,
                name: role.name,
            },
        });
    } catch (error) {
        next(error);
    }
};
