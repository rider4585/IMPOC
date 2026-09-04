'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('trip_vendors', {
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

        trip_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'trips',
                key: 'id',
            },
            onDelete: 'RESTRICT',
        },

        vendor_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'vendors',
                key: 'id',
            },
            onDelete: 'RESTRICT',
        },

        bill_reference: {
            type: Sequelize.STRING(100),
            allowNull: true,
            // VARCHAR(100) UTF-8 encoded; output is HTML-escaped by controller to prevent XSS
        },

        total_paid_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },

        notes: {
            type: Sequelize.TEXT,
            allowNull: true,
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

    // CHECK constraint: total_paid_paise >= 0
    await queryInterface.sequelize.query(
        'ALTER TABLE trip_vendors ADD CONSTRAINT trip_vendors_total_paid_paise_check CHECK (total_paid_paise >= 0)'
    );

    // Partial unique index on (trip_id, vendor_id) WHERE deleted_at IS NULL
    // Allows re-adding a vendor after soft-delete while enforcing one active bill per vendor per trip
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_vendors_trip_vendor ON trip_vendors (trip_id, vendor_id) WHERE deleted_at IS NULL'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('trip_vendors');
}