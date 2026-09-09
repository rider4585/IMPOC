import { DeliveryLog, Sale, RentalAgreement } from '../../../database/models/index.js';

/**
 * Delivery log entities backed by a real record. SALE/RENTAL logs must point at
 * an existing (non-deleted) row; QUOTE/GENERAL are generic system types with no
 * persisted table to check against (SEC-M-6).
 */
const ENTITY_MODELS = {
    SALE: Sale,
    RENTAL: RentalAgreement,
};

async function assertEntityExists(entityType, entityUuid) {
    const model = ENTITY_MODELS[entityType];
    if (!model) {
        return;
    }
    const record = await model.findOne({
        where: { uuid: entityUuid, deletedAt: null },
        attributes: ['id'],
    });
    if (!record) {
        const error = new Error(`Delivery log references unknown ${entityType} entity`);
        error.statusCode = 400;
        throw error;
    }
}

function mapDeliveryLogDTO(log) {
    return {
        uuid: log.uuid,
        entityType: log.entityType,
        entityUuid: log.entityId,
        channel: log.channel,
        status: log.status,
        receiptPayload: log.receiptPayload,
        providerMessageId: log.providerMessageId,
        provider: log.provider,
        sentAt: log.sentAt,
        deliveredAt: log.deliveredAt,
        failedAt: log.failedAt,
        notes: log.notes,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
    };
}

/**
 * Create a delivery log. Purely a data record - the actual WhatsApp/SMTP/SMS
 * integration is deferred; future integration code will write here.
 */
export const createDeliveryLog = async (payload) => {
    await assertEntityExists(payload.entityType, payload.entityUuid);

    const log = await DeliveryLog.create({
        entityType: payload.entityType,
        entityId: payload.entityUuid,
        channel: payload.channel,
        status: payload.status,
        receiptPayload: payload.receiptPayload ?? null,
        providerMessageId: payload.providerMessageId ?? null,
        provider: payload.provider ?? null,
        sentAt: payload.sentAt ?? null,
        deliveredAt: payload.deliveredAt ?? null,
        failedAt: payload.failedAt ?? null,
        notes: payload.notes ?? null,
    });

    return mapDeliveryLogDTO(log);
};

/**
 * List delivery logs, newest first. Optionally filtered by entity.
 */
export const listDeliveryLogs = async ({ entityType, entityUuid, limit } = {}) => {
    const where = { deletedAt: null };
    if (entityType) where.entityType = entityType;
    if (entityUuid) where.entityId = entityUuid;

    const logs = await DeliveryLog.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: limit || 50,
    });

    return logs.map(mapDeliveryLogDTO);
};

/**
 * Get a single delivery log by uuid.
 */
export const getDeliveryLogByUuid = async (uuid) => {
    const log = await DeliveryLog.findOne({ where: { uuid, deletedAt: null } });
    return log ? mapDeliveryLogDTO(log) : null;
};