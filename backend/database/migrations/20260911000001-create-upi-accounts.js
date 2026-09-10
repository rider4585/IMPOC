export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('upi_accounts', {
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

        label: {
            type: Sequelize.STRING(100),
            allowNull: false,
        },

        vpa: {
            type: Sequelize.STRING(255),
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

    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX idx_upi_accounts_label ON upi_accounts (label) WHERE deleted_at IS NULL AND is_active = true'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('upi_accounts');
}
