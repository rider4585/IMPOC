import { RequestKey } from '../../../database/models/index.js';

/**
 * Lookup a previous request by gesture type and request UUID.
 * Returns the result information if found and not deleted, otherwise signals not found.
 * This function performs a pure read — it never opens, commits, or rolls back transactions.
 *
 * @param {string} gestureType - The gesture type (e.g., 'BARCODE_GENERATE')
 * @param {string} requestUuid - The client-provided request UUID
 * @returns {Promise<{found: true, result_kind: string, result_uuid: string} | {found: false}>}
 */
export const lookup = async (gestureType, requestUuid) => {
    if (!gestureType || typeof gestureType !== 'string' || gestureType.trim() === '') {
        return { found: false };
    }

    if (!requestUuid || typeof requestUuid !== 'string' || requestUuid.trim() === '') {
        return { found: false };
    }

    const requestKey = await RequestKey.findOne({
        where: {
            gesture_type: gestureType,
            request_uuid: requestUuid,
            deleted_at: null,
        },
        attributes: ['result_kind', 'result_uuid'],
        raw: true,
    });

    if (!requestKey) {
        return { found: false };
    }

    return {
        found: true,
        result_kind: requestKey.result_kind,
        result_uuid: requestKey.result_uuid,
    };
};

/**
 * Record a processed request by gesture type and request UUID.
 * Inserted last inside the caller's transaction so a concurrent duplicate
 * request hits the unique (gesture_type, request_uuid) constraint and fails
 * the whole transaction; the controller then re-lookups and replays the cached
 * result instead of double-processing the money write.
 *
 * @param {Object} params - { gestureType, requestUuid, resultKind, resultUuid, actorUserId }
 * @param {Object} [transaction] - The caller's transaction (optional)
 * @returns {Promise<RequestKey>}
 */
export const record = async ({ gestureType, requestUuid, resultKind, resultUuid, actorUserId }, transaction) => {
    if (!gestureType || !requestUuid || !resultKind || !resultUuid) {
        const error = new Error('Cannot record request key: missing required fields');
        error.statusCode = 500;
        throw error;
    }

    return RequestKey.create(
        {
            gesture_type: gestureType,
            request_uuid: requestUuid,
            result_kind: resultKind,
            result_uuid: resultUuid,
            actor_user_id: actorUserId ?? null,
        },
        transaction ? { transaction } : undefined
    );
};
