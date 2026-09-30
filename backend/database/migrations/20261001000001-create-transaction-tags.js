export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('transaction_tags', {
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

        // R-73: "show on POS" - the counter offers this tag during checkout.
        show_on_pos: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },

        // R-73: "select by default" - preselected in the POS checkout step.
        is_default: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
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

    // One live active tag per name; deactivated/soft-deleted names are reusable.
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX idx_transaction_tags_name ON transaction_tags (name) WHERE deleted_at IS NULL AND is_active = true'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('transaction_tags');
}