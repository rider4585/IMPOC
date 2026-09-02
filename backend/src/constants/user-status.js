export const USER_STATUS = Object.freeze({
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    SUSPENDED: 'SUSPENDED',
    DELETED: 'DELETED',
});

export const USER_STATUSES = Object.freeze(
    Object.values(USER_STATUS)
);