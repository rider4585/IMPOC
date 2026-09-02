'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_types', {
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

        parent_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'product_types',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
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

    // Partial unique index: top-level names unique (using raw SQL)
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX idx_product_types_name_top_level ON product_types (name) WHERE parent_id IS NULL AND deleted_at IS NULL'
    );

    // Partial unique index: subtype names unique within parent (using raw SQL)
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX idx_product_types_parent_id_name ON product_types (parent_id, name) WHERE parent_id IS NOT NULL AND deleted_at IS NULL'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('product_types');
}
