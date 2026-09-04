import { createDeliveryLogBodySchema, listDeliveryLogsQuerySchema, deliveryLogUuidParamSchema } from './delivery.validation.js';
import {
    createDeliveryLog as createDeliveryLogService,
    listDeliveryLogs as listDeliveryLogsService,
    getDeliveryLogByUuid as getDeliveryLogByUuidService,
} from './delivery.service.js';

/**
 * POST /api/delivery/logs - Create a delivery log
 */
export const createDeliveryLog = async (req, res, next) => {
    try {
        const body = createDeliveryLogBodySchema.parse(req.body);
        const log = await createDeliveryLogService(body);
        return res.status(201).json({ success: true, data: { log } });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/delivery/logs - List delivery logs (optionally by entity)
 */
export const listDeliveryLogs = async (req, res, next) => {
    try {
        const query = listDeliveryLogsQuerySchema.parse(req.query);
        const logs = await listDeliveryLogsService({
            entityType: query.entityType,
            entityUuid: query.entityUuid,
            limit: query.limit,
        });
        return res.status(200).json({ success: true, data: { logs } });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/delivery/logs/:uuid - Get a delivery log
 */
export const getDeliveryLogByUuid = async (req, res, next) => {
    try {
        const { uuid } = deliveryLogUuidParamSchema.parse(req.params);
        const log = await getDeliveryLogByUuidService(uuid);
        if (!log) {
            return res.status(404).json({ success: false, message: `Delivery log with UUID ${uuid} not found` });
        }
        return res.status(200).json({ success: true, data: { log } });
    } catch (error) {
        next(error);
    }
};