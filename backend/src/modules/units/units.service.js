import { Unit, UnitStatusEvent, sequelize } from '../../../database/models/index.js';
import { CHANNEL } from '../../constants/channel.js';

/**
 * State machine guard table defining all legal transitions
 * Structure: guardTable[channel][cause][to] = expectedFromStatus(es)
 * Covers the complete unit state machine from unit-state-machine.md
 * Later epics add new causes and transitions by extending the table
 */
const guardTable = {
    [CHANNEL.RETAIL]: {
        INTAKE: {
            in_stock: null, // Initial creation, no from status
        },
        CHECKOUT: {
            sold: 'in_stock',
        },
        EXCHANGE: {
            in_stock: 'sold',
        },
        STAFF_MARKED_DAMAGED: {
            damaged: 'in_stock',
        },
        STAFF_MARKED_LOST: {
            lost: 'in_stock',
        },
        MAINTENANCE_COMPLETE: {
            in_stock: 'in_maintenance',
        },
        BEYOND_REPAIR: {
            retired: 'in_maintenance',
        },
        RECOVERY: {
            in_stock: 'lost',
            in_maintenance: 'lost',
            retired: 'lost',
        },
    },
    [CHANNEL.RENTAL]: {
        INTAKE: {
            in_stock: null, // Initial creation, no from status
        },
        HAND_OVER: {
            rented: 'in_stock',
        },
        RETURN: {
            in_stock: 'rented',
            in_maintenance: 'rented',
            retired: 'rented',
        },
        WRITE_OFF: {
            lost: 'rented',
        },
        STAFF_MARKED_DAMAGED: {
            damaged: 'in_stock',
        },
        STAFF_MARKED_LOST: {
            lost: 'in_stock',
        },
        MAINTENANCE_COMPLETE: {
            in_stock: 'in_maintenance',
        },
        BEYOND_REPAIR: {
            retired: 'in_maintenance',
        },
        RECOVERY: {
            in_stock: 'lost',
            in_maintenance: 'lost',
            retired: 'lost',
        },
    },
};

/**
 * Check if a transition is legal according to the state machine guard table
 *
 * @param {string} channel - RETAIL or RENTAL
 * @param {string} cause - Transition cause (e.g., STAFF_MARKED_DAMAGED)
 * @param {string} to - Target status
 * @param {string|null} from - Current status
 * @returns {boolean} - True if transition is legal
 */
function isLegalTransition(channel, cause, to, from) {
    const channelGuards = guardTable[channel];
    if (!channelGuards) return false;

    const causeGuards = channelGuards[cause];
    if (!causeGuards) return false;

    const expectedFrom = causeGuards[to];
    if (expectedFrom === undefined) return false;

    // RECOVERY cause transitions: from must be LOST
    if (cause === 'RECOVERY' && from !== 'lost') return false;

    return true;
}

/**
 * Get the expected from status for a given channel, cause, and to status
 *
 * @param {string} channel - RETAIL or RENTAL
 * @param {string} cause - Transition cause
 * @param {string} to - Target status
 * @returns {string|null} - Expected from status, or null for initial creation (INTAKE)
 */
function getExpectedFromStatus(channel, cause, to) {
    const channelGuards = guardTable[channel];
    if (!channelGuards) return undefined;

    const causeGuards = channelGuards[cause];
    if (!causeGuards) return undefined;

    return causeGuards[to];
}

/**
 * Create a unit from an intake scan, atomically with its initial status event
 * Delegates from intake.service to preserve AD-8: units.service is the sole writer of units.status
 *
 * @param {Object} params
 * @param {Object} params.stock - Stock object (the stock line the unit belongs to)
 * @param {Object} params.colour - Colour object
 * @param {Object} params.size - Size object
 * @param {string} params.barcode - Barcode string (1-12 chars)
 * @param {integer} params.actorUserId - User ID of the actor performing the scan
 * @param {Object} params.transaction - Sequelize transaction (opened by caller)
 * @returns {Object} Created unit DTO
 * @throws {Error} with statusCode property for HTTP mapping
 */
export const createUnitFromScan = async ({
    stock,
    colour,
    size,
    barcode,
    actorUserId,
    transaction,
}) => {
    try {
        // Create the unit row with prices copied from stock at scan time (AD-24 tier 1)
        const unit = await Unit.create(
            {
                barcode,
                stockId: stock.id,
                colourId: colour.id,
                sizeId: size.id,
                status: 'in_stock',
                channel: stock.channel,
                buyingPricePaise: stock.buyingPricePaise,
                sellingPricePaise: stock.sellingPricePaise,
                floorPricePaise: stock.floorPricePaise,
                rentPerDayPaise: stock.rentPerDayPaise,
                depositPaise: stock.depositPaise,
                overduePerDayPaise: stock.overduePerDayPaise,
            },
            { transaction }
        );

        // Create the initial unit status event atomically (from NULL to IN_STOCK with cause INTAKE)
        await UnitStatusEvent.create(
            {
                unitId: unit.id,
                fromStatus: null,
                toStatus: 'in_stock',
                cause: 'INTAKE',
                actorUserId,
                occurredAt: new Date(),
            },
            { transaction }
        );

        // Patch 11: Fetch the full row to ensure timestamps are populated
        const fullUnit = await Unit.findByPk(unit.id, {
            transaction,
            include: [
                { association: 'stock', attributes: ['uuid'] },
                { association: 'colour', attributes: ['uuid'] },
                { association: 'size', attributes: ['uuid'] },
            ],
        });

        return mapUnitDTO(fullUnit);
    } catch (error) {
        throw error;
    }
};

/**
 * Map Unit to DTO response
 * Paise values are returned as STRINGS (not Number) to preserve BIGINT precision (AD-24 tier 1)
 * Only uuid is exposed in API; internal id never leaves process (AD-1)
 * 
 * @param {Object} unit - Unit from database
 * @returns {Object} DTO with uuid, barcode, status, channel, prices as strings, createdAt, updatedAt
 */
function mapUnitDTO(unit) {
    return {
        uuid: unit.uuid,
        barcode: unit.barcode,
        status: unit.status,
        channel: unit.channel,
        colourUuid: unit.colour?.uuid || null,
        sizeUuid: unit.size?.uuid || null,
        buyingPricePaise: String(unit.buyingPricePaise),
        sellingPricePaise: String(unit.sellingPricePaise),
        floorPricePaise: String(unit.floorPricePaise),
        rentPerDayPaise: unit.rentPerDayPaise !== null ? String(unit.rentPerDayPaise) : null,
        depositPaise: unit.depositPaise !== null ? String(unit.depositPaise) : null,
        overduePerDayPaise: unit.overduePerDayPaise !== null ? String(unit.overduePerDayPaise) : null,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
    };
}

/**
 * Transition a unit's status atomically with its event record
 * Only writer of units.status and unit_status_events (AD-8, NFR6)
 * Uses conditional UPDATE (compare-and-swap) to prevent concurrent race conditions
 *
 * @param {Object} params
 * @param {string} params.unitUuid - Unit UUID (external identifier)
 * @param {string} params.to - Target status
 * @param {string} params.cause - Cause of transition (e.g., STAFF_MARKED_DAMAGED)
 * @param {string} params.reason - Optional reason/notes for the transition
 * @param {integer} params.actorUserId - User ID performing the transition
 * @param {integer} params.saleLineId - Optional sale line ID (for checkout/exchange)
 * @param {integer} params.agreementId - Optional rental agreement ID
 * @param {Object} options
 * @param {Object} options.transaction - Sequelize transaction (opened by caller)
 * @returns {Object} Updated unit DTO
 * @throws {Error} with statusCode 409 on race condition or illegal transition
 */
export const transitionUnit = async (
    {
        unitUuid,
        to,
        cause,
        reason,
        actorUserId,
        saleLineId = null,
        agreementId = null,
    },
    { transaction }
) => {
    try {
        // Validate reason for RECOVERY cause (must not be empty/whitespace)
        if (cause === 'RECOVERY' && (!reason || !reason.trim())) {
            const error = new Error('RECOVERY transitions require a non-empty reason');
            error.statusCode = 400;
            throw error;
        }

        // Step 1: Resolve unitUuid to internal ID and get current state
        const unit = await Unit.findOne(
            {
                where: { uuid: unitUuid, deletedAt: null },
                attributes: ['id', 'uuid', 'barcode', 'status', 'channel'],
            },
            { transaction }
        );

        if (!unit) {
            const error = new Error('Unit not found');
            error.statusCode = 404;
            throw error;
        }

        const { id: unitId, status: currentStatus, channel } = unit;

        // Step 2: Validate transition against guard table
        if (!isLegalTransition(channel, cause, to, currentStatus)) {
            const error = new Error(
                `Invalid transition: cannot move from ${currentStatus} to ${to} with cause ${cause} on channel ${channel}`
            );
            error.statusCode = 409;
            throw error;
        }

        // Step 3: Get expected from status for compare-and-swap
        const expectedFrom = getExpectedFromStatus(channel, cause, to);

        // Step 4: Conditional UPDATE with compare-and-swap (atomic race guard)
        const [affectedCount] = await sequelize.query(
            `UPDATE units
             SET status = :to, updated_at = CURRENT_TIMESTAMP
             WHERE id = :unitId AND status = :expectedFrom AND deleted_at IS NULL`,
            {
                replacements: {
                    unitId,
                    to,
                    expectedFrom,
                },
                type: sequelize.QueryTypes.UPDATE,
                transaction,
            }
        );

        // Step 5: Handle race condition (another txn already changed status)
        if (affectedCount === 0) {
            // Re-read the unit to discover what actually happened
            const realUnit = await Unit.findByPk(unitId, {
                attributes: ['barcode', 'status', 'deletedAt'],
                transaction,
            });

            // Handle case where unit was deleted concurrently
            if (!realUnit || realUnit.deletedAt) {
                const error = new Error(
                    `Unit ${unit.barcode} was deleted`
                );
                error.statusCode = 409;
                throw error;
            }

            const realStatus = realUnit.status || 'unknown';
            const error = new Error(
                `Unit ${unit.barcode} is already ${realStatus}, cannot transition to ${to}`
            );
            error.statusCode = 409;
            throw error;
        }

        // Step 6: Insert status event atomically (same transaction)
        await UnitStatusEvent.create(
            {
                unitId,
                fromStatus: currentStatus,
                toStatus: to,
                cause,
                reason: reason || null,
                actorUserId: actorUserId || null,
                occurredAt: new Date(),
                saleLineId: saleLineId || null,
                agreementId: agreementId || null,
            },
            { transaction }
        );

        // Step 7: Return updated unit DTO
        const updatedUnit = await Unit.findByPk(unitId, {
            transaction,
            include: [
                { association: 'stock', attributes: ['uuid'] },
                { association: 'colour', attributes: ['uuid'] },
                { association: 'size', attributes: ['uuid'] },
            ],
        });

        return mapUnitDTO(updatedUnit);
    } catch (error) {
        // Preserve statusCode if already set, otherwise re-throw
        throw error;
    }
};

/**
 * Transition a unit's status via the HTTP endpoint boundary.
 * Opens and commits its own transaction (unlike transitionUnit which expects
 * a caller-opened transaction for use inside larger workflows like a sale).
 * Keeps units.service the sole writer of units.status / unit_status_events.
 *
 * @param {Object} params - { unitUuid, to, cause, reason, actorUserId }
 * @returns {Object} Updated unit DTO
 * @throws {Error} with statusCode for HTTP mapping
 */
export const transitionUnitEndpoint = async ({ unitUuid, to, cause, reason, actorUserId }) => {
    const transaction = await sequelize.transaction();
    try {
        const result = await transitionUnit(
            { unitUuid, to, cause, reason, actorUserId },
            { transaction }
        );
        await transaction.commit();
        return result;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Get a unit by UUID with full details
 *
 * @param {string} unitUuid - Unit UUID
 * @returns {Object} Unit DTO or null
 */
export const getUnitByUuid = async (unitUuid) => {
    const unit = await Unit.findOne({
        where: { uuid: unitUuid, deletedAt: null },
        attributes: [
            'uuid',
            'barcode',
            'status',
            'channel',
            'buyingPricePaise',
            'sellingPricePaise',
            'floorPricePaise',
            'rentPerDayPaise',
            'depositPaise',
            'overduePerDayPaise',
            'createdAt',
            'updatedAt',
        ],
        include: [
            { association: 'colour', attributes: ['uuid'] },
            { association: 'size', attributes: ['uuid'] },
        ],
    });

    if (!unit) {
        return null;
    }

    return mapUnitDTO(unit);
};

/**
 * Get a unit by barcode with full details
 *
 * @param {string} barcode - Unit barcode
 * @returns {Object} Unit DTO or null
 */
export const getUnitByBarcode = async (barcode) => {
    const unit = await Unit.findOne({
        where: { barcode, deletedAt: null },
        attributes: [
            'uuid',
            'barcode',
            'status',
            'channel',
            'buyingPricePaise',
            'sellingPricePaise',
            'floorPricePaise',
            'rentPerDayPaise',
            'depositPaise',
            'overduePerDayPaise',
            'createdAt',
            'updatedAt',
        ],
        include: [
            { association: 'colour', attributes: ['uuid'] },
            { association: 'size', attributes: ['uuid'] },
        ],
    });

    if (!unit) {
        return null;
    }

    return mapUnitDTO(unit);
};

/**
 * Get status events for a unit, newest first
 *
 * @param {string} unitUuid - Unit UUID
 * @param {integer} page - Page number (1-indexed)
 * @param {integer} pageSize - Items per page
 * @returns {Object} { items: [...], page, pageSize, total }
 */
export const getUnitStatusEvents = async (unitUuid, page = 1, pageSize = 50) => {
    // Find unit by UUID
    const unit = await Unit.findOne({
        where: { uuid: unitUuid, deletedAt: null },
        attributes: ['id'],
    });

    if (!unit) {
        return { items: [], page, pageSize, total: 0 };
    }

    // Count total events (excluding deleted)
    const total = await UnitStatusEvent.count({
        where: { unitId: unit.id, deletedAt: null },
    });

    // Fetch paginated events, newest first
    const offset = (page - 1) * pageSize;
    const events = await UnitStatusEvent.findAll({
        where: { unitId: unit.id, deletedAt: null },
        attributes: [
            'uuid',
            'fromStatus',
            'toStatus',
            'cause',
            'reason',
            'occurredAt',
            'createdAt',
            'actorUserId',
        ],
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset,
    });

    // Map to response DTO (no internal actorUserId exposed)
    const items = events.map((event) => ({
        uuid: event.uuid,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        cause: event.cause,
        reason: event.reason,
        occurredAt: event.occurredAt,
        createdAt: event.createdAt,
    }));

    return { items, page, pageSize, total };
};

export { mapUnitDTO };
