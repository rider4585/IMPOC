import { ProductType, sequelize } from '../../../database/models/index.js';

/**
 * Walk the ancestry chain to detect cycles
 * @param {number} typeId - The id of the type to check ancestry for
 * @param {number} targetParentId - The parent id to check for (if we find it, there's a cycle)
 * @returns {Promise<boolean>} true if cycle detected, false otherwise
 */
async function detectCycle(typeId, targetParentId) {
    if (targetParentId === null) {
        return false;
    }

    let currentParentId = targetParentId;
    const visited = new Set();

    while (currentParentId !== null) {
        // Detect self-reference or cycle
        if (currentParentId === typeId) {
            return true;
        }

        // Detect infinite loop (cycle in the parent chain)
        if (visited.has(currentParentId)) {
            return true;
        }

        visited.add(currentParentId);

        const parent = await ProductType.findOne({
            where: { id: currentParentId },
            attributes: ['id', 'parentId'],
        });

        if (!parent) {
            break;
        }

        currentParentId = parent.parentId;
    }

    return false;
}

export const getProductTypes = async () => {
    const types = await ProductType.findAll({
        attributes: ['uuid', 'name', 'parentId', 'isActive', 'createdAt', 'updatedAt'],
        include: [
            {
                association: 'parent',
                attributes: ['uuid'],
                required: false,
                where: { deletedAt: null },
            },
        ],
        order: [['createdAt', 'DESC']],
    });

    return types;
};

export const createProductType = async ({ name, parentUuid }) => {
    const transaction = await sequelize.transaction();

    try {
        let parentId = null;

        // Validate and resolve parent UUID if provided
        if (parentUuid) {
            const parent = await ProductType.findOne({
                where: { uuid: parentUuid, deletedAt: null },
                attributes: ['id'],
                transaction,
            });

            if (!parent) {
                const error = new Error('Product type not found');
                error.statusCode = 404;
                throw error;
            }

            parentId = parent.id;
        }

        // Check for duplicates (at top level or within parent)
        const where = { name, deletedAt: null };
        if (parentId !== null) {
            where.parentId = parentId;
        } else {
            where.parentId = null;
        }

        const existing = await ProductType.findOne({
            where,
            transaction,
        });

        if (existing) {
            const error = new Error('Product type name already exists at this level');
            error.statusCode = 409;
            throw error;
        }

        // Create the product type
        const productType = await ProductType.create({
            name,
            parentId,
        }, { transaction });

        // Fetch with parent relationship
        if (parentId) {
            const parent = await ProductType.findOne({
                where: { id: parentId },
                attributes: ['uuid'],
                transaction,
            });
            productType.parent = parent;
        }

        await transaction.commit();
        return productType;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getProductTypeByUuid = async (uuid) => {
    const productType = await ProductType.findOne({
        where: { uuid },
        attributes: ['uuid', 'name', 'parentId', 'isActive', 'createdAt', 'updatedAt'],
        include: [
            {
                association: 'parent',
                attributes: ['uuid'],
                required: false,
                where: { deletedAt: null },
            },
        ],
    });

    if (!productType) {
        const error = new Error('Product type not found');
        error.statusCode = 404;
        throw error;
    }

    return productType;
};

export const updateProductType = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const productType = await ProductType.findOne({
            where: { uuid },
            attributes: ['id', 'uuid', 'name', 'parentId', 'isActive', 'createdAt', 'updatedAt'],
            transaction,
        });

        if (!productType) {
            const error = new Error('Product type not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};
        let newParentId = productType.parentId;

        // Handle name update
        if (data.name !== undefined) {
            updateData.name = data.name;
        }

        // Handle parent UUID update
        if (data.parentUuid !== undefined) {
            if (data.parentUuid === null) {
                newParentId = null;
            } else {
                const parent = await ProductType.findOne({
                    where: { uuid: data.parentUuid, deletedAt: null },
                    attributes: ['id'],
                    transaction,
                });

                if (!parent) {
                    const error = new Error('Product type not found');
                    error.statusCode = 404;
                    throw error;
                }

                newParentId = parent.id;
            }
            updateData.parentId = newParentId;
        }

        // Detect cycle if parent is being updated
        if (data.parentUuid !== undefined) {
            const hasCycle = await detectCycle(productType.id, newParentId);
            if (hasCycle) {
                const error = new Error('type may not be its own ancestor');
                error.statusCode = 409;
                throw error;
            }
        }

        // Check for name duplicates if name is being updated
        if (data.name !== undefined) {
            const where = { name: data.name, deletedAt: null };
            if (newParentId !== null) {
                where.parentId = newParentId;
            } else {
                where.parentId = null;
            }

            const existing = await ProductType.findOne({
                where,
                transaction,
            });

            if (existing && existing.id !== productType.id) {
                const error = new Error('Product type name already exists at this level');
                error.statusCode = 409;
                throw error;
            }
        }

        // Handle isActive update
        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        await productType.update(updateData, { transaction });

        // Refresh parent relationship if needed
        if (newParentId) {
            const parent = await ProductType.findOne({
                where: { id: newParentId, deletedAt: null },
                attributes: ['uuid'],
                transaction,
            });
            productType.parent = parent;
        } else {
            productType.parent = null;
        }

        await transaction.commit();
        return productType;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const deactivateProductType = async (uuid) => {
    const productType = await ProductType.findOne({
        where: { uuid },
        include: [
            {
                association: 'parent',
                attributes: ['uuid'],
                required: false,
                where: { deletedAt: null },
            },
        ],
    });

    if (!productType) {
        const error = new Error('Product type not found');
        error.statusCode = 404;
        throw error;
    }

    await productType.update({ isActive: false });

    return productType;
};
