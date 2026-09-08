import { createUserSchema, userUuidParamSchema, updateUserSchema, updateUserStatusSchema } from './user.validation.js';
import {
    getUsers as getUsersList,
    createUser as createUserAccount,
    getUserByUuid as getUserByUuidAccount,
    updateUser as updateUserAccount,
    updateUserStatus as updateUserStatusAccount,
    deleteUser as deleteUserAccount,
} from './user.service.js';

export const getUsers = async (req, res, next) => {
    try {
        const users = await getUsersList();

        return res.status(200).json({
            success: true,
            data: users.map((user) => ({
                uuid: user.uuid,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                status: user.status,
                lastLoginAt: user.lastLoginAt,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })),
        });
    } catch (error) {
        next(error);
    }
};

export const createUser = async (req, res, next) => {
    try {
        const data = createUserSchema.parse(req.body);

        const user = await createUserAccount(data, req.auth.userUuid);

        return res.status(201).json({
            success: true,
            data: {
                uuid: user.uuid,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                status: user.status,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getUserByUuid = async (req, res, next) => {
    try {
        const { uuid } = userUuidParamSchema.parse(req.params);

        const user = await getUserByUuidAccount(uuid);

        return res.status(200).json({
            success: true,
            data: {
                uuid: user.uuid,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                status: user.status,
                lastLoginAt: user.lastLoginAt,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const updateUser = async (req, res, next) => {
    try {
        const { uuid } = userUuidParamSchema.parse(req.params);

        const data = updateUserSchema.parse(req.body);

        const user = await updateUserAccount(uuid, data, req.auth.userUuid);

        return res.status(200).json({
            success: true,
            data: {
                uuid: user.uuid,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                status: user.status,
                lastLoginAt: user.lastLoginAt,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const updateUserStatus = async (req, res, next) => {
    try {
        const { uuid } = userUuidParamSchema.parse(req.params);

        const { status } = updateUserStatusSchema.parse(req.body);

        const user = await updateUserStatusAccount(uuid, status, req.auth.userUuid);

        return res.status(200).json({
            success: true,
            data: {
                uuid: user.uuid,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                status: user.status,
                lastLoginAt: user.lastLoginAt,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const { uuid } = userUuidParamSchema.parse(req.params);

        const user = await deleteUserAccount(uuid, req.auth.userUuid);

        return res.status(200).json({
            success: true,
            data: {
                uuid: user.uuid,
                username: user.username,
                status: user.status,
            },
        });
    } catch (error) {
        next(error);
    }
};