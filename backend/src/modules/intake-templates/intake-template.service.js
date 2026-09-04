import {
    IntakeRecord,
    IntakeTemplate,
    Vendor,
    ProductType,
    sequelize,
} from '../../../database/models/index.js';

function mapTemplateDTO(t) {
    return {
        uuid: t.uuid,
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

function mapRecordDTO(record) {
    return {
        uuid: record.uuid,
        name: record.name,
        purchasedOn: record.purchasedOn,
        vendorUuid: record.vendor ? record.vendor.uuid : null,
        notes: record.notes,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

export const getIntakeRecords = async () => {
    const records = await IntakeRecord.findAll({
        where: { deletedAt: null },
        attributes: ['id', 'uuid', 'name', 'purchasedOn', 'vendorId', 'notes', 'status', 'createdAt', 'updatedAt'],
        include: [
            { model: Vendor, as: 'vendor', attributes: ['uuid', 'name'] },
        ],
        order: [['purchasedOn', 'DESC']],
    });

    return records.map(mapRecordDTO);
};

export const getIntakeRecordByUuid = async (intakeUuid) => {
    const record = await IntakeRecord.findOne({
        where: { uuid: intakeUuid, deletedAt: null },
        attributes: ['id', 'uuid', 'name', 'purchasedOn', 'vendorId', 'notes', 'status', 'createdAt', 'updatedAt'],
        include: [
            { model: Vendor, as: 'vendor', attributes: ['uuid', 'name'] },
            {
                model: IntakeTemplate,
                as: 'templates',
                where: { deletedAt: null },
                required: false,
                include: [{ model: ProductType, as: 'productType', attributes: ['uuid', 'name'] }],
            },
        ],
    });

    if (!record) {
        const error = new Error('Intake record not found');
        error.statusCode = 404;
        throw error;
    }

    const dto = mapRecordDTO(record);
    dto.templates = (record.templates || []).map(mapTemplateDTO);
    return dto;
};

export const createIntakeRecord = async ({ name, purchasedOn, vendorUuid, notes }) => {
    const transaction = await sequelize.transaction();
    try {
        let vendorId = null;
        if (vendorUuid) {
            const vendor = await Vendor.findOne({ where: { uuid: vendorUuid, deletedAt: null }, transaction });
            if (!vendor) {
                const error = new Error('Vendor not found');
                error.statusCode = 404;
                throw error;
            }
            vendorId = vendor.id;
        }

        const record = await IntakeRecord.create(
            {
                name,
                purchasedOn,
                vendorId,
                notes: notes || null,
                status: 'active',
            },
            { transaction }
        );

        await transaction.commit();

        const created = await IntakeRecord.findOne({
            where: { id: record.id },
            include: [{ model: Vendor, as: 'vendor', attributes: ['uuid', 'name'] }],
        });
        return mapRecordDTO(created);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const updateIntakeRecord = async (intakeUuid, updates) => {
    const transaction = await sequelize.transaction();
    try {
        const record = await IntakeRecord.findOne({ where: { uuid: intakeUuid, deletedAt: null }, transaction });
        if (!record) {
            const error = new Error('Intake record not found');
            error.statusCode = 404;
            throw error;
        }

        const patch = {};
        if (updates.name !== undefined) patch.name = updates.name;
        if (updates.purchasedOn !== undefined) patch.purchasedOn = updates.purchasedOn;
        if (updates.notes !== undefined) patch.notes = updates.notes ?? null;
        if (updates.status !== undefined) patch.status = updates.status;

        if (updates.vendorUuid !== undefined) {
            if (updates.vendorUuid === null) {
                patch.vendorId = null;
            } else {
                const vendor = await Vendor.findOne({ where: { uuid: updates.vendorUuid, deletedAt: null }, transaction });
                if (!vendor) {
                    const error = new Error('Vendor not found');
                    error.statusCode = 404;
                    throw error;
                }
                patch.vendorId = vendor.id;
            }
        }

        await record.update(patch, { transaction });
        await transaction.commit();

        const updated = await IntakeRecord.findOne({
            where: { id: record.id },
            include: [{ model: Vendor, as: 'vendor', attributes: ['uuid', 'name'] }],
        });
        return mapRecordDTO(updated);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const createIntakeTemplate = async (
    intakeUuid,
    { name, productTypeUuid, buyingPricePaise, defaultQuantity, defaultSellingPricePaise, defaultFloorPricePaise }
) => {
    const transaction = await sequelize.transaction();
    try {
        const record = await IntakeRecord.findOne({ where: { uuid: intakeUuid, deletedAt: null }, transaction });
        if (!record) {
            const error = new Error('Intake record not found');
            error.statusCode = 404;
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

        const template = await IntakeTemplate.create(
            {
                intakeRecordId: record.id,
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

        const created = await IntakeTemplate.findOne({
            where: { id: template.id },
            include: [{ model: ProductType, as: 'productType', attributes: ['uuid', 'name'] }],
        });
        return mapTemplateDTO(created);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const updateIntakeTemplate = async (intakeUuid, templateUuid, updates) => {
    const transaction = await sequelize.transaction();
    try {
        const record = await IntakeRecord.findOne({ where: { uuid: intakeUuid, deletedAt: null }, transaction });
        if (!record) {
            const error = new Error('Intake record not found');
            error.statusCode = 404;
            throw error;
        }

        const template = await IntakeTemplate.findOne({
            where: { uuid: templateUuid, intakeRecordId: record.id, deletedAt: null },
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

        const updated = await IntakeTemplate.findOne({
            where: { id: template.id },
            include: [{ model: ProductType, as: 'productType', attributes: ['uuid', 'name'] }],
        });
        return mapTemplateDTO(updated);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const deleteIntakeTemplate = async (intakeUuid, templateUuid) => {
    const transaction = await sequelize.transaction();
    try {
        const record = await IntakeRecord.findOne({ where: { uuid: intakeUuid, deletedAt: null }, transaction });
        if (!record) {
            const error = new Error('Intake record not found');
            error.statusCode = 404;
            throw error;
        }

        const template = await IntakeTemplate.findOne({
            where: { uuid: templateUuid, intakeRecordId: record.id, deletedAt: null },
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
