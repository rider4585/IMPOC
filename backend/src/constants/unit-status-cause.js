export const UNIT_STATUS_CAUSE = Object.freeze({
    // Story 3.3: Initial intake scan
    INTAKE: 'INTAKE',

    // Story 4.1: Unit transitions on this epic
    STAFF_MARKED_DAMAGED: 'STAFF_MARKED_DAMAGED',
    STAFF_MARKED_LOST: 'STAFF_MARKED_LOST',
    MAINTENANCE_COMPLETE: 'MAINTENANCE_COMPLETE',
    BEYOND_REPAIR: 'BEYOND_REPAIR',
    RECOVERY: 'RECOVERY',

    // Story 4.5 / Epic 5: Retail checkout and exchange
    CHECKOUT: 'CHECKOUT',
    EXCHANGE: 'EXCHANGE',

    // Epic 6: Rental hand-over and return
    HAND_OVER: 'HAND_OVER',
    RETURN: 'RETURN',
    WRITE_OFF: 'WRITE_OFF',
});
