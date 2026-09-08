import {
    getUserRoles as getUserRolesAccount,
    assignRoleToUser as assignRoleToUserAccount,
    removeRoleFromUser as removeRoleFromUserAccount,
} from './user-role.service.js';

import {
    userUuidParamSchema,
    userRoleParamsSchema,
    assignRoleSchema,
} from './user-role.validation.js';

export const getUserRoles = async (req, res, next) => {
    try {
        const { userUuid } = userUuidParamSchema.parse(
            req.params
        );

        const roles = await getUserRolesAccount(userUuid);

        return res.status(200).json({
            success: true,
            data: roles.map((role) => ({
                uuid: role.uuid,
                name: role.name,
                description: role.description,
            })),
        });
    } catch (error) {
        next(error);
    }
};

export const assignRoleToUser = async (req, res, next) => {
    try {
        const { userUuid } = userUuidParamSchema.parse(
            req.params
        );

        const { roleUuid } = assignRoleSchema.parse(
            req.body
        );

        const role = await assignRoleToUserAccount(
            userUuid,
            roleUuid,
            req.auth.userUuid
        );

        return res.status(201).json({
            success: true,
            data: {
                uuid: role.uuid,
                name: role.name,
                description: role.description,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const removeRoleFromUser = async (req, res, next) => {
    try {
        const { userUuid, roleUuid } =
            userRoleParamsSchema.parse(req.params);

        await removeRoleFromUserAccount(
            userUuid,
            roleUuid,
            req.auth.userUuid
        );

        return res.status(200).json({
            success: true,
            message: 'Role removed from user successfully',
        });
    } catch (error) {
        next(error);
    }
};