import { ReviewLink, sequelize } from '../../../database/models/index.js';

export const getReviewLinks = async () => {
    const reviewLinks = await ReviewLink.findAll({
        attributes: ['uuid', 'label', 'url', 'isActive', 'createdAt', 'updatedAt'],
        order: [['isActive', 'DESC'], ['createdAt', 'DESC']],
    });

    return reviewLinks;
};

export const createReviewLink = async ({ label, url }) => {
    const transaction = await sequelize.transaction();

    try {
        const existing = await ReviewLink.findOne({
            where: { label, isActive: true, deletedAt: null },
            transaction,
        });

        if (existing) {
            const error = new Error('Review link already exists');
            error.statusCode = 409;
            throw error;
        }

        const reviewLink = await ReviewLink.create({
            label,
            url,
        }, { transaction });

        await transaction.commit();
        return reviewLink;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getReviewLinkByUuid = async (uuid) => {
    const reviewLink = await ReviewLink.findOne({
        where: { uuid },
        attributes: ['uuid', 'label', 'url', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!reviewLink) {
        const error = new Error('Review link not found');
        error.statusCode = 404;
        throw error;
    }

    return reviewLink;
};

export const updateReviewLink = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const reviewLink = await ReviewLink.findOne({
            where: { uuid },
            attributes: ['id', 'uuid', 'label', 'url', 'isActive', 'createdAt', 'updatedAt'],
            transaction,
        });

        if (!reviewLink) {
            const error = new Error('Review link not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};

        if (data.label !== undefined) {
            updateData.label = data.label;

            const existing = await ReviewLink.findOne({
                where: { label: data.label, isActive: true, deletedAt: null },
                transaction,
            });

            if (existing && existing.id !== reviewLink.id) {
                const error = new Error('Review link already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        if (data.url !== undefined) {
            updateData.url = data.url;
        }

        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        await reviewLink.update(updateData, { transaction });

        await transaction.commit();
        return reviewLink;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};
