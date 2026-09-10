'use strict';

/**
 * R-32 Phase B: dashboard/analytics materialized views.
 *
 * Strategy decision (documented in code as the card requires):
 *   MATERIALIZED VIEWS refreshed CONCURRENTLY on a short interval instead of a
 *   trigger-maintained `reporting_daily` row. Rationale:
 *   - Zero risk to the money ledger: no triggers on sales/sale_reversals/
 *     rental_returns/expenses, so we cannot accidentally double-count, break
 *     the R-29 partial-unique backstop indexes, or make a status-UPDATE
 *     cascade into wrong summary rows.
 *   - Revenue semantics (e.g. rental earned is attributed by agreement
 *     start_date and uses Math.max(1, days)) live in ONE place (the view SQL)
 *     and evolve in lockstep with the dashboard instead of being mirrored in
 *     trigger logic.
 *   - With the dev DB essentially empty, a short-interval concurrent refresh
 *     is trivial; a day-close job can later drive the same refresh.
 *
 * Money columns stay BIGINT; the dashboard layer converts to String exactly as
 * the previous JS aggregator did. Reversals are summed (not zeroed) and are
 * reported separately from completed totals.
 *
 * Each grouped matview carries a UNIQUE index on metric_date so that
 * REFRESH MATERIALIZED VIEW CONCURRENTLY can be used. mv_inventory_snapshot is
 * a single row with no natural unique key, so it uses a plain REFRESH.
 */
const migration = {
    // [name, uniqueIndexName?, createSql]
    MATVIEWS: [
        {
            name: 'mv_dashboard_sales',
            uniqueIndex: 'uq_mv_dashboard_sales_date',
            sql: `
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_sales AS
SELECT
    s.sold_at AS metric_date,
    COALESCE((SELECT SUM(x.total_paise) FROM sales x
              WHERE x.sold_at = s.sold_at AND x.deleted_at IS NULL AND x.status = 'completed'), 0)::bigint AS sales_total_paise,
    COALESCE((SELECT SUM(r.amount_paise) FROM sale_reversals r JOIN sales so ON so.id = r.sale_id
              WHERE so.sold_at = s.sold_at AND so.deleted_at IS NULL AND r.deleted_at IS NULL
                AND r.reversal_type = 'REFUND'), 0)::bigint AS refunded_paise,
    COALESCE((SELECT SUM(r.amount_paise) FROM sale_reversals r JOIN sales so ON so.id = r.sale_id
              WHERE so.sold_at = s.sold_at AND so.deleted_at IS NULL AND r.deleted_at IS NULL
                AND r.reversal_type = 'CANCEL'), 0)::bigint AS cancelled_paise,
    COUNT(*)::bigint AS sale_count,
    COALESCE((SELECT COUNT(*) FROM sale_lines sl JOIN sales so2 ON so2.id = sl.sale_id
              WHERE so2.sold_at = s.sold_at AND so2.deleted_at IS NULL AND sl.deleted_at IS NULL), 0)::bigint AS units_sold,
    CURRENT_TIMESTAMP AS generated_at
FROM sales s
WHERE s.deleted_at IS NULL
GROUP BY s.sold_at`,
        },
        {
            name: 'mv_dashboard_expenses',
            uniqueIndex: 'uq_mv_dashboard_expenses_date',
            sql: `
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_expenses AS
SELECT
    e.expense_date AS metric_date,
    COALESCE(SUM(e.amount_paise) FILTER (WHERE e.status = 'completed'), 0)::bigint AS total_paise,
    COALESCE(SUM(e.amount_paise) FILTER (WHERE e.status = 'cancelled'), 0)::bigint AS cancelled_paise,
    COUNT(*)::bigint AS expense_count,
    CURRENT_TIMESTAMP AS generated_at
FROM expenses e
WHERE e.deleted_at IS NULL
GROUP BY e.expense_date`,
        },
        {
            name: 'mv_dashboard_rentals',
            uniqueIndex: 'uq_mv_dashboard_rentals_date',
            sql: `
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_rentals AS
SELECT
    ra.start_date AS metric_date,
    COALESCE(SUM(GREATEST(rr.actual_return_date - ra.start_date, 1)::bigint * rl.rent_per_day_paise), 0)::bigint AS earned_paise,
    COALESCE(SUM(rr.overdue_charge_paise), 0)::bigint AS overdue_paise,
    COALESCE(SUM(rr.damage_charge_paise), 0)::bigint AS damage_paise,
    COUNT(rr.id)::bigint AS return_count,
    CURRENT_TIMESTAMP AS generated_at
FROM rental_agreements ra
JOIN rental_lines rl ON rl.agreement_id = ra.id AND rl.deleted_at IS NULL
JOIN rental_returns rr ON rr.rental_line_id = rl.id AND rr.deleted_at IS NULL
WHERE ra.deleted_at IS NULL
GROUP BY ra.start_date`,
        },
        {
            name: 'mv_inventory_snapshot',
            uniqueIndex: null,
            sql: `
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_snapshot AS
SELECT
    COUNT(u.id)::bigint AS total_units,
    COUNT(u.id) FILTER (WHERE u.channel = 'RETAIL' AND u.status = 'in_stock')::bigint AS retail_in_stock,
    COUNT(u.id) FILTER (WHERE u.channel = 'RETAIL')::bigint AS channel_retail,
    COUNT(u.id) FILTER (WHERE u.channel = 'RENTAL')::bigint AS channel_rental,
    COUNT(u.id) FILTER (WHERE u.status = 'in_stock')::bigint AS status_in_stock,
    COUNT(u.id) FILTER (WHERE u.status = 'sold')::bigint AS status_sold,
    COUNT(u.id) FILTER (WHERE u.status = 'rented')::bigint AS status_rented,
    COUNT(u.id) FILTER (WHERE u.status = 'in_maintenance')::bigint AS status_in_maintenance,
    COUNT(u.id) FILTER (WHERE u.status = 'retired')::bigint AS status_retired,
    COUNT(u.id) FILTER (WHERE u.status = 'lost')::bigint AS status_lost,
    COUNT(u.id) FILTER (WHERE u.status = 'damaged')::bigint AS status_damaged,
    CURRENT_TIMESTAMP AS generated_at
FROM units u
WHERE u.deleted_at IS NULL`,
        },
    ],

    async up(queryInterface) {
        for (const mv of this.MATVIEWS) {
            await queryInterface.sequelize.query(mv.sql);
            if (mv.uniqueIndex) {
                await queryInterface.sequelize.query(
                    `CREATE UNIQUE INDEX IF NOT EXISTS ${mv.uniqueIndex}
                     ON ${mv.name} (metric_date)`
                );
            }
        }
    },

    async down(queryInterface) {
        for (const mv of this.MATVIEWS) {
            if (mv.uniqueIndex) {
                await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${mv.uniqueIndex}`);
            }
            await queryInterface.sequelize.query(`DROP MATERIALIZED VIEW IF EXISTS ${mv.name}`);
        }
    },
};

export const up = migration.up.bind(migration);
export const down = migration.down.bind(migration);