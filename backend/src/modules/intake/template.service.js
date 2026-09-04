import {
    StockTemplate,
    Vendor,
    ProductType,
    sequelize,
} from '../../../database/models/index.js';

function mapTemplateDTO(t) {
    return {
        uuid: t.uuid,
        vendorUuid: t.vendor ? t.vendor.uuid : null,
        vendorName: t.vendor ? t.vendor.name : null,
        name: t.name,
        productTypeUuid: t.productType ? t.productType.uuid : null,
        buyingPricePaise: String(t.buyingPricePaise),
        defaultQuantity: t.defaultQuantity != null ? t.defaultQuantity : null,
        defaultSellingPricePaise: t.defaultSellingPricePaise != null ? String(t.defaultSellingPricePaise) : null,
        defaultFloorPricePaise: t.defaultFloorPricePaise != null ? String(t.defaultFloorPricePaise) : null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
    };
}

const TEMPLATE_INCLUDE = [
    { model: Vendor, as: 'vendor', attributes: ['uuid', 'name'] },
    { model: ProductType, as: 'productType', attributes: ['uuid'] },
];

export const getTemplates = async ({ vendorUuid } = {}) => {
    const where = { deletedAt: null };
    if (vendorUuid) {
        const vendor = await Vendor.findOne({ where: { uuid: vendorUuid, deletedAt: null } });
        if (!vendor) {
            const error = new Error('Vendor not found');
            error.statusCode = 404;
            throw error;
        }
        where.vendorId = vendor.id;
    }

    const templates = await StockTemplate.findAll({
        where,
        include: TEMPLATE_INCLUDE,
        order: [['createdAt', 'DESC']],
    });

    return templates.map(mapTemplateDTO);
};

export const getTemplateByUuid = async (templateUuid) => {
    const template = await StockTemplate.findOne({
        where: { uuid: templateUuid, deletedAt: null },
        include: TEMPLATE_INCLUDE,
    });

    if (!template) {
        const error = new Error('Template not found');
        error.statusCode = 404;
        throw error;
    }

    return mapTemplateDTO(template);
};

export const createTemplate = async ({
    vendorUuid,
    productTypeUuid,
    name,
    buyingPricePaise,
    defaultQuantity,
    defaultSellingPricePaise,
    defaultFloorPricePaise,
}) => {
    const transaction = await sequelize.transaction();
    try {
        const vendor = await Vendor.findOne({ where: { uuid: vendorUuid, deletedAt: null }, transaction });
        if (!vendor) {
            const error = new Error('Vendor not found');
            error.statusCode = 404;
            throw error;
        }
        if (!vendor.isActive) {
            const error = new Error('Vendor is inactive');
            error.statusCode = 400;
            throw error;
        }

        const productType = await ProductType.findOne({ where: { uuid: productTypeUuid, deletedAt: null }, transaction });
        if (!productType) {
            const error = new Error('Product type not found');
            error.statusCode = 404;
            throw error;
        }
        if (!productType.isActive) {
            const error = new Error('Product type is inactive');
            error.statusCode = 400;
            throw error;
        }

        if (
            defaultFloorPricePaise != null &&
            defaultSellingPricePaise != null &&
            defaultFloorPricePaise > defaultSellingPricePaise
        ) {
            const error = new Error('Floor price cannot exceed selling price');
            error.statusCode = 400;
            throw error;
        }

        const template = await StockTemplate.create(
            {
                vendorId: vendor.id,
                name: name || null,
                productTypeId: productType.id,
                buyingPricePaise,
                defaultQuantity: defaultQuantity ?? null,
                defaultSellingPricePaise: defaultSellingPricePaise ?? null,
                defaultFloorPricePaise: defaultFloorPricePaise ?? null,
            },
            { transaction }
        );

        await transaction.commit();

        const created = await StockTemplate.findOne({
            where: { id: template.id },
            include: TEMPLATE_INCLUDE,
        });
        return mapTemplateDTO(created);
    } catch (error) {
        await transaction.rollback();
        handleTemplateUniqueViolation(error, name);
        throw error;
    }
};

export const updateTemplate = async (templateUuid, updates) => {
    const transaction = await sequelize.transaction();
    try {
        const template = await StockTemplate.findOne({
            where: { uuid: templateUuid, deletedAt: null },
            transaction,
        });
        if (!template) {
            const error = new Error('Template not found');
            error.statusCode = 404;
            throw error;
        }

        const patch = {};
        if (updates.name !== undefined) patch.name = updates.name ?? null;
        if (updates.buyingPricePaise !== undefined) patch.buyingPricePaise = updates.buyingPricePaise;
        if (updates.defaultQuantity !== undefined) patch.defaultQuantity = updates.defaultQuantity ?? null;
        if (updates.defaultSellingPricePaise !== undefined) patch.defaultSellingPricePaise = updates.defaultSellingPricePaise ?? null;
        if (updates.defaultFloorPricePaise !== undefined) patch.defaultFloorPricePaise = updates.defaultFloorPricePaise ?? null;

        if (updates.productTypeUuid !== undefined) {
            const productType = await ProductType.findOne({ where: { uuid: updates.productTypeUuid, deletedAt: null }, transaction });
            if (!productType) {
                const error = new Error('Product type not found');
                error.statusCode = 404;
                throw error;
            }
            patch.productTypeId = productType.id;
        }

        if (updates.vendorUuid !== undefined) {
            const vendor = await Vendor.findOne({ where: { uuid: updates.vendorUuid, deletedAt: null }, transaction });
            if (!vendor) {
                const error = new Error('Vendor not found');
                error.statusCode = 404;
                throw error;
            }
            if (!vendor.isActive) {
                const error = new Error('Vendor is inactive');
                error.statusCode = 400;
                throw error;
            }
            patch.vendorId = vendor.id;
        }

        const finalSelling = patch.defaultSellingPricePaise !== undefined
            ? patch.defaultSellingPricePaise
            : (template.defaultSellingPricePaise != null ? Number(template.defaultSellingPricePaise) : null);
        const finalFloor = patch.defaultFloorPricePaise !== undefined
            ? patch.defaultFloorPricePaise
            : (template.defaultFloorPricePaise != null ? Number(template.defaultFloorPricePaise) : null);
        if (finalFloor != null && finalSelling != null && finalFloor > finalSelling) {
            const error = new Error('Floor price cannot exceed selling price');
            error.statusCode = 400;
            throw error;
        }

        await template.update(patch, { transaction });
        await transaction.commit();

        const updated = await StockTemplate.findOne({
            where: { id: template.id },
            include: TEMPLATE_INCLUDE,
        });
        return mapTemplateDTO(updated);
    } catch (error) {
        await transaction.rollback();
        handleTemplateUniqueViolation(error, updates.name);
        throw error;
    }
};

export const deleteTemplate = async (templateUuid) => {
    const transaction = await sequelize.transaction();
    try {
        const template = await StockTemplate.findOne({
            where: { uuid: templateUuid, deletedAt: null },
            transaction,
        });
        if (!template) {
            const error = new Error('Template not found');
            error.statusCode = 404;
            throw error;
        }

        await template.destroy({ transaction });
        await transaction.commit();
        return { uuid: templateUuid, deleted: true };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Convert unique-index violations on (vendor_id, product_type_id, name)
 * into a 409 with a human-readable message.
 */
function handleTemplateUniqueViolation(error, name) {
    if (error.name === 'SequelizeUniqueConstraintError' ||
        error.original?.code === '23505' ||
        error.message?.includes('idx_stock_templates_vendor_product_name') ||
        error.message?.includes('duplicate key')) {
        const constraintError = new Error(
            name
                ? `A template named "${name}" already exists for this vendor and product type`
                : 'A template with this name already exists for this vendor and product type'
        );
        constraintError.statusCode = 409;
        throw constraintError;
    }
}