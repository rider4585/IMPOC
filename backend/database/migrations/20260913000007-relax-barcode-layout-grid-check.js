'use strict';

/**
 * R-56 follow-up: the 10-row / 10-column CHECK blocked tall and custom
 * sheets. The fit check (label must hold barcode + price box) is the real
 * guard; the DB keeps only a generous ceiling matching GRID_MAX.
 */
const migration = {
    async up(queryInterface) {
        await queryInterface.sequelize.query('ALTER TABLE barcode_layouts DROP CONSTRAINT IF EXISTS barcode_layouts_grid_check');
        await queryInterface.sequelize.query(
            'ALTER TABLE barcode_layouts ADD CONSTRAINT barcode_layouts_grid_check CHECK (columns BETWEEN 1 AND 100 AND rows BETWEEN 1 AND 100)',
        );
    },
    async down(queryInterface) {
        await queryInterface.sequelize.query('ALTER TABLE barcode_layouts DROP CONSTRAINT IF EXISTS barcode_layouts_grid_check');
        // A saved sheet may already use more than 10 rows/columns: clamp it so the old CHECK can be re-added.
        await queryInterface.sequelize.query('UPDATE barcode_layouts SET columns = LEAST(columns, 10), rows = LEAST(rows, 10)');
        await queryInterface.sequelize.query(
            'ALTER TABLE barcode_layouts ADD CONSTRAINT barcode_layouts_grid_check CHECK (columns BETWEEN 1 AND 10 AND rows BETWEEN 1 AND 10)',
        );
    },
};

export const up = migration.up.bind(migration);
export const down = migration.down.bind(migration);
