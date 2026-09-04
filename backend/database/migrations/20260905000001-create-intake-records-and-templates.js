'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('intake_records', {
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
            type: Sequelize.STRING(200),
            allowNull: false,
        },

        purchased_on: {
            type: Sequelize.DATEONLY,
            allowNull: false,
        },

        vendor_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'vendors',
                key: 'id',
            },
        },

        notes: {
            type: Sequelize.TEXT,
            allowNull: true,
        },

        status: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'active',
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

    await queryInterface.createTable('intake_templates', {
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

        intake_record_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'intake_records',
                key: 'id',
            },
        },

        name: {
            type: Sequelize.STRING(200),
            allowNull: true,
        },

        product_type_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'product_types',
                key: 'id',
            },
        },

        buying_price_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },

        default_quantity: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },

        default_selling_price_paise: {
            type: Sequelize.BIGINT,
            allowNull: true,
        },

        default_floor_price_paise: {
            type: Sequelize.BIGINT,
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

    await queryInterface.sequelize.query(
        'ALTER TABLE intake_templates ADD CONSTRAINT intake_templates_buying_price_check CHECK (buying_price_paise >= 0)'
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE intake_records ADD CONSTRAINT intake_records_status_check CHECK (status IN (\'active\', \'closed\'))'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('intake_templates');
    await queryInterface.dropTable('intake_records');
}
