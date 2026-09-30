export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('sale_tags', {
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

        // R-73: the sale is the money ledger row; deleting it drops its tags.
        sale_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'sales', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },

        // RESTRICT (not CASCADE): picklist history must not disappear silently.
        transaction_tag_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'transaction_tags', key: 'id' },
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
    });

    // A sale carries a given tag at most once (idempotent re-tagging).
    await queryInterface.addIndex('sale_tags', ['sale_id', 'transaction_tag_id'], {
        unique: true,
        name: 'uq_sale_tags_sale_tag',
    });

    // Reverse lookup: "every sale carrying this tag".
    await queryInterface.addIndex('sale_tags', ['transaction_tag_id'], {
        name: 'idx_sale_tags_transaction_tag_id',
    });
}

export async function down(queryInterface) {
    await queryInterface.dropTable('sale_tags');
}