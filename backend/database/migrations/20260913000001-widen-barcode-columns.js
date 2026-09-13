'use strict';

import { VIEWS as GRID_VIEWS } from './20260910000002-create-grid-views.js';

/**
 * R-48: barcode values become 'SHREE' + timestamp + counter (15 chars) instead
 * of a 12-digit counter, so every barcode column must hold more than 12 chars.
 *
 * Postgres refuses to ALTER the type of a column that a view depends on, and
 * the R-32 grid views read units.barcode / sale_lines.barcode /
 * rental_lines.barcode. So: drop those views, widen, re-create them from the
 * same VIEWS definitions the R-32 migration uses (single source of truth).
 *
 * Existing 12-digit barcodes remain valid (length check is 1..32).
 */
const BARCODE_MAX_LENGTH = 32;

const BARCODE_COLUMNS = [
    { table: 'units', column: 'barcode' },
    { table: 'sale_lines', column: 'barcode' },
    { table: 'rental_lines', column: 'barcode' },
];

const migration = {
    async dropViews(queryInterface) {
        for (const view of GRID_VIEWS) {
            await queryInterface.sequelize.query(`DROP VIEW IF EXISTS ${view.name}`);
        }
    },

    async createViews(queryInterface) {
        for (const view of GRID_VIEWS) {
            await queryInterface.sequelize.query(view.sql);
        }
    },

    async setLength(queryInterface, length) {
        for (const { table, column } of BARCODE_COLUMNS) {
            await queryInterface.sequelize.query(
                `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE VARCHAR(${length})`,
            );
        }
        await queryInterface.sequelize.query(
            'ALTER TABLE units DROP CONSTRAINT IF EXISTS units_barcode_length_check',
        );
        await queryInterface.sequelize.query(
            `ALTER TABLE units ADD CONSTRAINT units_barcode_length_check CHECK (LENGTH(barcode) >= 1 AND LENGTH(barcode) <= ${length})`,
        );
    },

    async up(queryInterface) {
        await this.dropViews(queryInterface);
        await this.setLength(queryInterface, BARCODE_MAX_LENGTH);
        await this.createViews(queryInterface);
    },

    async down(queryInterface) {
        // Narrowing back to 12 fails if any R-48 barcode exists - intended: those labels are printed.
        await this.dropViews(queryInterface);
        await this.setLength(queryInterface, 12);
        await this.createViews(queryInterface);
    },
};

export const up = migration.up.bind(migration);
export const down = migration.down.bind(migration);
