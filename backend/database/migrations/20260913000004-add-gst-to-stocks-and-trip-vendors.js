'use strict';

import { dropGridViews, createGridViews } from './20260910000002-create-grid-views.js';

/**
 * R-51: record the GST vendors charge on purchases.
 *  - stocks.cgst_rate_pct / sgst_rate_pct  DECIMAL(5,2) 0..100 (per-line rates on the bill)
 *  - trip_vendors.cgst_paise / sgst_paise  BIGINT >= 0 (final amounts at the bill subtotal;
 *    total_paid_paise is entered GST-inclusive, so no reconciliation is derived)
 * Existing rows default to 0 (untaxed history stays as-is). v_stocks_grid is re-created
 * so the rates are available to the grid (views are dropped/re-created as in R-48).
 */
const migration = {
    async up(queryInterface, Sequelize) {
        await dropGridViews(queryInterface);

        for (const column of ['cgst_rate_pct', 'sgst_rate_pct']) {
            await queryInterface.addColumn('stocks', column, {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 0,
            });
        }
        await queryInterface.sequelize.query(
            'ALTER TABLE stocks ADD CONSTRAINT stocks_gst_rate_check CHECK (cgst_rate_pct BETWEEN 0 AND 100 AND sgst_rate_pct BETWEEN 0 AND 100)',
        );

        for (const column of ['cgst_paise', 'sgst_paise']) {
            await queryInterface.addColumn('trip_vendors', column, {
                type: Sequelize.BIGINT,
                allowNull: false,
                defaultValue: 0,
            });
        }
        await queryInterface.sequelize.query(
            'ALTER TABLE trip_vendors ADD CONSTRAINT trip_vendors_gst_paise_check CHECK (cgst_paise >= 0 AND sgst_paise >= 0)',
        );

        await createGridViews(queryInterface);
    },

    async down(queryInterface) {
        await dropGridViews(queryInterface);
        await queryInterface.sequelize.query('ALTER TABLE stocks DROP CONSTRAINT IF EXISTS stocks_gst_rate_check');
        await queryInterface.removeColumn('stocks', 'cgst_rate_pct');
        await queryInterface.removeColumn('stocks', 'sgst_rate_pct');
        await queryInterface.sequelize.query('ALTER TABLE trip_vendors DROP CONSTRAINT IF EXISTS trip_vendors_gst_paise_check');
        await queryInterface.removeColumn('trip_vendors', 'cgst_paise');
        await queryInterface.removeColumn('trip_vendors', 'sgst_paise');
        // createGridViews omits the GST projections now that the columns are gone.
        await createGridViews(queryInterface);
    },
};

export const up = migration.up.bind(migration);
export const down = migration.down.bind(migration);
