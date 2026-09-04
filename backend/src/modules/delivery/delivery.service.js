import { DeliveryLog } from '../../../database/models/index.js';

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