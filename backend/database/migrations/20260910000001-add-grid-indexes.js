'use strict';

/**
 * R-32 Phase A (grid read layer): missing indexes found by the R-28
 * Postgres review (POSTGRES-REVIEW-FINDINGS.md).
 *
 * PG-8  date-range columns scanned by the reports/grids modules
 * PG-9  ~25 unindexed FK columns on financial + inventory children
 * PG-12 delivery_logs(entity_type, entity_id) entity lookup index
 *
 * All are plain b-tree "support" indexes with distinct names, so they can
 * never collide with the partial unique backstop indexes added in
 * 20260908000001-add-money-out-race-backstops.js (they are NOT redundant:
 * a partial unique index with a WHERE clause does not serve a plain
 * b-tree lookup on the same column).
 */
const migration = {
    // [name, table, columns[], whereClause?]
    // whereClause uses column names wrapped in double quotes by the builder.
    INDEXES: [
        // PG-8: date-range lookups used by grids + reports + dashboard
        ['idx_sales_sold_at', 'sales', ['sold_at']],
        ['idx_expenses_expense_date', 'expenses', ['expense_date']],
        ['idx_rental_agreements_start_date', 'rental_agreements', ['start_date']],
        ['idx_rental_returns_actual_return_date', 'rental_returns', ['actual_return_date']],

        // PG-12: entity lookup on delivery logs
        ['idx_delivery_logs_entity', 'delivery_logs', ['entity_type', 'entity_id']],

        // PG-9: financial children (note: sale_reversals may also be queried
        // across reversal types, beyond the partial-unique REFUND/CANCEL backstops)
        ['idx_sale_lines_sale_id', 'sale_lines', ['sale_id']],
        ['idx_sale_lines_unit_id', 'sale_lines', ['unit_id']],
        ['idx_sale_reversals_sale_id', 'sale_reversals', ['sale_id']],
        ['idx_rental_lines_agreement_id', 'rental_lines', ['agreement_id']],
        ['idx_rental_lines_unit_id', 'rental_lines', ['unit_id']],
        ['idx_rental_returns_agreement_id', 'rental_returns', ['agreement_id']],
        ['idx_rental_returns_rental_line_id', 'rental_returns', ['rental_line_id']],
        ['idx_rental_returns_unit_id', 'rental_returns', ['unit_id']],
        ['idx_rental_reversals_agreement_id', 'rental_reversals', ['agreement_id']],
        ['idx_expense_reversals_expense_id', 'expense_reversals', ['expense_id']],

        // PG-9: inventory children
        ['idx_stocks_trip_id', 'stocks', ['trip_id']],
        ['idx_stocks_vendor_id', 'stocks', ['vendor_id']],
        ['idx_stocks_trip_vendor_id', 'stocks', ['trip_vendor_id']],
        ['idx_stocks_product_type_id', 'stocks', ['product_type_id']],
        ['idx_stock_templates_vendor_id', 'stock_templates', ['vendor_id']],
        ['idx_stock_templates_product_type_id', 'stock_templates', ['product_type_id']],
        ['idx_units_stock_id', 'units', ['stock_id']],
        ['idx_units_colour_id', 'units', ['colour_id']],
        ['idx_units_size_id', 'units', ['size_id']],
        ['idx_trip_vendors_trip_id', 'trip_vendors', ['trip_id']],
        ['idx_trip_vendors_vendor_id', 'trip_vendors', ['vendor_id']],

        // PG-9: ledger creator / linked-customer lookups (SEC-M-5 row scoping)
        ['idx_sales_created_by', 'sales', ['created_by']],
        ['idx_sales_customer_id', 'sales', ['customer_id']],
        ['idx_rental_agreements_created_by', 'rental_agreements', ['created_by']],
        ['idx_rental_agreements_customer_id', 'rental_agreements', ['customer_id']],
        ['idx_expenses_created_by', 'expenses', ['created_by']],

        // PG-9: misc FK lookups
        ['idx_product_types_parent_id', 'product_types', ['parent_id']],
        ['idx_request_keys_actor_user_id', 'request_keys', ['actor_user_id']],
        ['idx_unit_status_events_actor_user_id', 'unit_status_events', ['actor_user_id']],
    ],

    async up(queryInterface) {
        for (const [name, table, columns] of this.INDEXES) {
            const cols = columns.map((c) => `"${c}"`).join(', ');
            await queryInterface.sequelize.query(
                `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols})`
            );
        }
    },

    async down(queryInterface) {
        for (const [name] of this.INDEXES) {
            await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${name}"`);
        }
    },
};

export const up = migration.up.bind(migration);
export const down = migration.down.bind(migration);