/*
 * SEC-L-5: user-supplied search terms are interpolated into PostgreSQL
 * LIKE/ILIKE patterns. `%` and `_` are LIKE wildcards, so a literal search for
 * "50%" or "a_b" would otherwise match far more rows than intended (query
 * inefficiency plus fuzzy-result data exposure). PostgreSQL's default LIKE
 * escape character is backslash; escape the metacharacters with it.
 */
export const escapeLike = (value) =>
    String(value).replace(/[\\%_]/g, '\\$&');