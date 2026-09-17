'use strict';

/**
 * R-63 follow-up: allow ENQUIRY in delivery_logs.entity_type.
 *
 * The close-as-available path (enquiries.service.js, DeliveryLog.create with
 * entityType 'ENQUIRY') always 500'd on databases created from migrations,
 * because the original CHECK from 20260905000004 only listed
 * ('SALE','RENTAL','QUOTE','GENERAL'). The jest test database never re-creates
 * this CHECK (tests/utils/test-setup.js adds only app_settings + request_keys
 * checks), so the suite missed it. Drop + re-add with ENQUIRY.
 */

export async function up(queryInterface) {
    await queryInterface.sequelize.query(
        "ALTER TABLE delivery_logs DROP CONSTRAINT IF EXISTS delivery_logs_entity_type_check"
    );
    await queryInterface.sequelize.query(
        "ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_entity_type_check " +
        "CHECK (entity_type IN ('SALE', 'RENTAL', 'QUOTE', 'GENERAL', 'ENQUIRY'))"
    );
}

export async function down(queryInterface) {
    await queryInterface.sequelize.query(
        "ALTER TABLE delivery_logs DROP CONSTRAINT IF EXISTS delivery_logs_entity_type_check"
    );
    await queryInterface.sequelize.query(
        "ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_entity_type_check " +
        "CHECK (entity_type IN ('SALE', 'RENTAL', 'QUOTE', 'GENERAL'))"
    );
}