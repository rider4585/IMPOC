'use strict';

/**
 * Create customer_sources picklist table + seed the default "how did they hear
 * about the shop" options the register asks at checkout.
 */
export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('customer_sources', {
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

    // Active source names are unique; deactivated names stay reusable.
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX idx_customer_sources_name ON customer_sources (name) WHERE deleted_at IS NULL AND is_active = true'
    );

    // Seed the defaults the register offers at checkout.
    await queryInterface.bulkInsert('customer_sources', [
        { name: 'Instagram', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'WhatsApp group', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Pamphlet', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Word of mouth', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Walk-in', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Other', is_active: true, created_at: new Date(), updated_at: new Date() },
    ]);
}

export async function down(queryInterface) {
    await queryInterface.dropTable('customer_sources');
}