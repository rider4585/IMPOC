'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_intakes', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },

        uuid: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            allowNull: false,
            unique: true,
        },

        vendor_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'vendors',
                key: 'id',
            },
        },

        purchased_on: {
            type: Sequelize.DATEONLY,
            allowNull: false,
        },

        bill_reference: {
            type: Sequelize.STRING(100),
            allowNull: true,
            // VARCHAR(100) UTF-8 encoded; output is HTML-escaped by controller to prevent XSS
        },

        total_paid_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
            validate: {
                isInt: true,
            },
        },

        deleted_at: {
            type: Sequelize.DATE,
            allowNull: true,
        },

        created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },

        updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
    });

    // Add CHECK constraint for total_paid_paise >= 0
    await queryInterface.sequelize.query(
        'ALTER TABLE stock_intakes ADD CONSTRAINT stock_intakes_total_paid_paise_check CHECK (total_paid_paise >= 0)'
    );

    // Partial unique index on (vendor_id, bill_reference) WHERE deleted_at IS NULL
    // Allows reusing bill references after soft-delete while enforcing uniqueness on active intakes
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX idx_stock_intakes_vendor_bill ON stock_intakes (vendor_id, bill_reference) WHERE deleted_at IS NULL'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('stock_intakes');
}
