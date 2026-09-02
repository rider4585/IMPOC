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
