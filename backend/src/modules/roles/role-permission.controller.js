import {
    getRolePermissions,
    assignPermissionToRole,
    removePermissionFromRole,
} from './role-permission.service.js';

import {
    roleUuidParamSchema,
    rolePermissionParamSchema,
    assignPermissionSchema,
} from './role-permission.validation.js';

export const getPermissions = async (req, res, next) => {
    try {
        const { roleUuid } = roleUuidParamSchema.parse(
            req.params
        );

        const permissions = await getRolePermissions(roleUuid);

        return res.status(200).json({
            success: true,
            data: permissions.map((permission) => ({
                uuid: permission.uuid,
                name: permission.name,
                description: permission.description,
            })),
        });
    } catch (error) {
        next(error);
    }
};

export const assignPermission = async (req, res, next) => {
    try {
        const { roleUuid } = roleUuidParamSchema.parse(
            req.params
        );

        const { permissionUuid } =
            assignPermissionSchema.parse(req.body);

        const permission = await assignPermissionToRole(
            roleUuid,
            permissionUuid
        );

        return res.status(201).json({
            success: true,
            data: {
                uuid: permission.uuid,
                name: permission.name,
                description: permission.description,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const removePermission = async (req, res, next) => {
    try {
        const { roleUuid, permissionUuid } =
            rolePermissionParamSchema.parse(req.params);

        await removePermissionFromRole(
            roleUuid,
            permissionUuid
        );

        return res.status(200).json({
            success: true,
            message: 'Permission removed successfully',
        });
    } catch (error) {
        next(error);
    }
};