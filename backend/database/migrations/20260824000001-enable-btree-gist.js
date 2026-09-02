'use strict';

export async function up(queryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist;');
}

export async function down(queryInterface) {
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS btree_gist;');
}
