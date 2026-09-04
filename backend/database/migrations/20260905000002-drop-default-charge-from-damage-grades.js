'use strict';

export async function up(queryInterface) {
    await queryInterface.sequelize.query(
        'ALTER TABLE damage_grades DROP CONSTRAINT IF EXISTS chk_damage_grades_default_charge_paise_non_negative'
    );
    await queryInterface.removeColumn('damage_grades', 'default_charge_paise');
}

export async function down(queryInterface, Sequelize) {
    await queryInterface.addColumn('damage_grades', 'default_charge_paise', {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
    });
    await queryInterface.sequelize.query(
        'ALTER TABLE damage_grades ADD CONSTRAINT chk_damage_grades_default_charge_paise_non_negative CHECK (default_charge_paise >= 0)'
    );
}
