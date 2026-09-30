import { TransactionTag, Sequelize, sequelize } from '../../../database/models/index.js';

const TAG_ATTRIBUTES = ['id', 'uuid', 'name', 'isActive', 'showOnPos', 'isDefault'];

export const getTransactionTags = async () => {
    const tags = await TransactionTag.findAll({
        attributes: TAG_ATTRIBUTES,
        order: [['name', 'ASC']],
    });

    return tags;
};

export const getTransactionTagByUuid = async (uuid) => {
    const tag = await TransactionTag.findOne({
        where: { uuid },
        attributes: TAG_ATTRIBUTES,
    });

    if (!tag) {
        const error = new Error('Transaction tag not found');
        error.statusCode = 404;
        throw error;
    }

    return tag;
};

/**
 * R-73 shared read filter: turn a list of transaction_tags uuids into ids.
 *
 * paranoid:false on purpose - a deactivated or soft-deleted tag must still
 * select its historical sales. A uuid that matches nothing simply contributes
 * no id (an empty `IN ()` is not valid SQL, so callers must handle the empty
 * case before building a query).
 *
 * @param {string[]} uuids
 * @returns {Promise<{ requested: string[], uuids: string[], tagIds: number[] }>}
 * requested is the de-duplicated, non-empty input; `uuids` is the subset that
 * actually resolved; tagIds matches it 1:1.
 */
export const resolveTransactionTagIds = async (uuids) => {
    const requested = Array.from(new Set((uuids || []).filter(Boolean)));
    if (requested.length === 0) {
        return { requested, uuids: [], tagIds: [] };
    }

    const tags = await TransactionTag.findAll({
        where: { uuid: { [Sequelize.Op.in]: requested } },
        attributes: ['id', 'uuid'],
        paranoid: false,
    });

    return {
        requested,
        uuids: tags.map((tag) => tag.uuid),
        tagIds: tags.map((tag) => tag.id),
    };
};

/**
 * R-73 shared SQL fragment: keep only sales that carry at least one of the
 * tags in the `:tagIds` bind parameter (OR semantics).
 *
 * `saleAlias` must be a trusted, hardcoded table alias - it is interpolated on
 * purpose because the two callers query different aliases (`s` for the
 * v_sales_grid id query, `"Sale"` for a plain model findAll). It is never
 * derived from user input. `:tagIds` MUST be supplied via findAll `replacements`.
 *
 * @param {string} saleAlias
 * @returns {string}
 */
export const saleTagsExistsSql = (saleAlias) => `EXISTS (
    SELECT 1
    FROM sale_tags st
    WHERE st.sale_id = ${saleAlias}.id AND st.transaction_tag_id IN (:tagIds)
)`;

/**
 * R-73 / SEC-M-8 shape: a tag attached to the financial ledger (a sale) must be
 * an ACTIVE, non-deleted transaction_tags picklist entry. An empty list is
 * allowed (untagged sales are normal).
 *
 * @param {string[]} uuids
 * @param {object} transaction
 * @returns {Promise<TransactionTag[]>} the resolved tags, de-duplicated
 */
export const assertTransactionTagsInPicklist = async (uuids, transaction) => {
    if (!uuids || uuids.length === 0) {
        return [];
    }

    const unique = Array.from(new Set(uuids));

    const tags = await TransactionTag.findAll({
        where: { uuid: { [Sequelize.Op.in]: unique }, isActive: true, deletedAt: null },
        attributes: ['id', 'uuid', 'name'],
        transaction,
    });

    if (tags.length !== unique.length) {
        const found = new Set(tags.map((tag) => tag.uuid));
        const badUuid = unique.find((uuid) => !found.has(uuid));
        // SEC-M-7: a client-visible 4xx message may not embed a row uuid, so the
        // offending uuid rides on the error object (logged server-side by the
        // error middleware) instead of in the message.
        const error = new Error('transaction tag is not in the transaction tags picklist');
        error.statusCode = 400;
        error.badTagUuid = badUuid;
        throw error;
    }

    return tags;
};

export const createTransactionTag = async ({ name, isActive, showOnPos, isDefault }) => {
    const transaction = await sequelize.transaction();

    try {
        // Only active, non-deleted names block a create (deactivated names are reusable).
        const existing = await TransactionTag.findOne({
            where: { name, isActive: true, deletedAt: null },
            transaction,
        });

        if (existing) {
            const error = new Error('Transaction tag already exists');
            error.statusCode = 409;
            throw error;
        }

        const tag = await TransactionTag.create(
            {
                name,
                ...(isActive === undefined ? {} : { isActive }),
                ...(showOnPos === undefined ? {} : { showOnPos }),
                ...(isDefault === undefined ? {} : { isDefault }),
            },
            { transaction }
        );

        await transaction.commit();
        return tag;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const updateTransactionTag = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const tag = await TransactionTag.findOne({
            where: { uuid },
            attributes: TAG_ATTRIBUTES,
            transaction,
        });

        if (!tag) {
            const error = new Error('Transaction tag not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};

        if (data.name !== undefined) {
            updateData.name = data.name;

            const existing = await TransactionTag.findOne({
                where: { name: data.name, isActive: true, deletedAt: null },
                transaction,
            });

            if (existing && existing.id !== tag.id) {
                const error = new Error('Transaction tag already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        if (data.showOnPos !== undefined) {
            updateData.showOnPos = data.showOnPos;
        }

        if (data.isDefault !== undefined) {
            updateData.isDefault = data.isDefault;
        }

        await tag.update(updateData, { transaction });

        await transaction.commit();
        return tag;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};