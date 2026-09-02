'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('damage_grades', {
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

        default_charge_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },

        outcome: {
            type: Sequelize.STRING(30),
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

    // Partial unique index: active damage grade names unique (using raw SQL)
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX idx_damage_grades_name ON damage_grades (name) WHERE deleted_at IS NULL'
    );

    // CHECK constraint for default_charge_paise >= 0
    await queryInterface.sequelize.query(
        'ALTER TABLE damage_grades ADD CONSTRAINT chk_damage_grades_default_charge_paise_non_negative CHECK (default_charge_paise >= 0)'
    );

    // CHECK constraint for outcome values
    await queryInterface.sequelize.query(
        `ALTER TABLE damage_grades ADD CONSTRAINT chk_damage_grades_outcome CHECK (outcome IN ('RETURN_TO_STOCK', 'SEND_TO_MAINTENANCE', 'RETIRE'))`
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('damage_grades');
}
