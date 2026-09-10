/**
 * R-32 Phase A: shared LIMIT/OFFSET pagination helpers for the grid list
 * endpoints. When no pagination params are supplied the endpoints keep their
 * historical behaviour (return every matching row), so existing clients are
 * unaffected; when `limit`/`offset` are supplied the row set is windowed and
 * capped at MAX_PAGE_SIZE.
 */
export const MAX_PAGE_SIZE = 200;

export const parsePagination = (query = {}) => {
    const { limit: rawLimit, offset: rawOffset } = query;
    const pagination = { limit: null, offset: null };

    if (rawLimit !== undefined && rawLimit !== null && rawLimit !== '') {
        const limit = Number(rawLimit);
        if (!Number.isInteger(limit) || limit < 1) {
            const error = new Error('limit must be a positive integer');
            error.statusCode = 400;
            throw error;
        }
        pagination.limit = Math.min(limit, MAX_PAGE_SIZE);
    }

    if (rawOffset !== undefined && rawOffset !== null && rawOffset !== '') {
        const offset = Number(rawOffset);
        if (!Number.isInteger(offset) || offset < 0) {
            const error = new Error('offset must be a non-negative integer');
            error.statusCode = 400;
            throw error;
        }
        pagination.offset = offset;
    }

    return pagination;
};

/**
 * Append `LIMIT :limit` / `OFFSET :offset` fragments to a SQL string, seeding
 * the replacements object only for the params actually supplied. The caller
 * still builds each fragment (the grid views use quoted, case-sensitive
 * aliases), so the LIMIT/OFFSET text itself is the caller's responsibility.
 */
export const applySqlPagination = (sql, params) => {
    if (params.limit !== undefined && params.limit !== null) {
        sql += ' LIMIT :limit';
    }
    if (params.offset !== undefined && params.offset !== null) {
        sql += ' OFFSET :offset';
    }
    return sql;
};