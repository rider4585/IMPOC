'use strict';

export async function up(queryInterface, Sequelize) {
    const gestureTypeValues = [
        'SALE_CHECKOUT',
        'SALE_EXCHANGE',
        'RENTAL_BOOK',
        'RENTAL_HANDOVER',
        'RENTAL_AMEND',
        'RENTAL_CANCEL',
        'RENTAL_SETTLE',
        'RENTAL_WRITE_OFF',
        'UNIT_RECOVER',
        'UNIT_TRANSITION',
        'EXPENSE_CREATE',
        'EXPENSE_REVERSE',
        'INTAKE_SCAN',
        'BARCODE_GENERATE',
        'BARCODE_GENERATE_TEST',
    ];

    await queryInterface.createTable('request_keys', {
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

        gesture_type: {
            type: Sequelize.STRING(40),
            allowNull: false,
        },

        request_uuid: {
            type: Sequelize.UUID,
            allowNull: false,
        },

        result_kind: {
            type: Sequelize.STRING(40),
            allowNull: false,
        },

        result_uuid: {
            type: Sequelize.UUID,
            allowNull: false,
        },

        actor_user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
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

        deleted_at: {
            type: Sequelize.DATE,
            allowNull: true,
        },
    });

    // Partial unique index: (gesture_type, request_uuid) WHERE deleted_at IS NULL
    await queryInterface.addIndex('request_keys', {
        fields: ['gesture_type', 'request_uuid'],
        unique: true,
        name: 'request_keys_gesture_request',
        where: {
            deleted_at: null,
        },
    });

    // AD-3: constrained string column, never a Postgres ENUM
    const gestureTypeList = gestureTypeValues.map(v => `'${v}'`).join(', ');
    await queryInterface.sequelize.query(
        `ALTER TABLE request_keys ADD CONSTRAINT request_keys_gesture_type_check CHECK (gesture_type IN (${gestureTypeList}))`
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('request_keys');
}
