'use strict';

/**
 * R-29 money-out race backstops.
 *
 * Add partial UNIQUE indexes that prevent concurrent double-issue of a
 * refund/cancel/return (real money-out) for the same parent record. These are
 * data-integrity safety nets: even if application-level CAS logic is bypassed,
 * a second reversal/return row for the same live parent fails at the DB.
 */
export async function up(queryInterface) {
    await queryInterface.sequelize.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_reversals_refund_sale ON sale_reversals (sale_id) WHERE reversal_type = 'REFUND' AND deleted_at IS NULL"
    );
    await queryInterface.sequelize.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_reversals_cancel_sale ON sale_reversals (sale_id) WHERE reversal_type = 'CANCEL' AND deleted_at IS NULL"
    );
    await queryInterface.sequelize.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_reversals_cancel_expense ON expense_reversals (expense_id) WHERE reversal_type = 'CANCEL' AND deleted_at IS NULL"
    );
    await queryInterface.sequelize.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_reversals_cancel_agreement ON rental_reversals (agreement_id) WHERE reversal_type = 'CANCEL' AND deleted_at IS NULL"
    );
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_returns_line ON rental_returns (rental_line_id) WHERE deleted_at IS NULL'
    );
}

export async function down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_sale_reversals_refund_sale');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_sale_reversals_cancel_sale');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_expense_reversals_cancel_expense');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_rental_reversals_cancel_agreement');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_rental_returns_line');
}
