'use strict';

/**
 * Create payment_methods picklist table + seed the two default cash-handling
 * options (Cash, UPI) the register records per transaction.
 */
export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_methods', {
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

        name: {
            type: Sequelize.STRING(100),
            allowNull: false,
        },

        is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
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

    // Active payment-method names are unique; deactivated names stay reusable.
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX idx_payment_methods_name ON payment_methods (name) WHERE deleted_at IS NULL AND is_active = true'
    );

    // Seed the defaults the register offers at checkout.
    await queryInterface.bulkInsert('payment_methods', [
        { name: 'Cash', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'UPI', is_active: true, created_at: new Date(), updated_at: new Date() },
    ]);
}

export async function down(queryInterface) {
    await queryInterface.dropTable('payment_methods');
}