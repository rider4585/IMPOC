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

/**
 * Reverting a constraint WIDENING is only possible while nothing depends on the
 * extra value: the CHECK cannot be narrowed back to the pre-R-63 list if rows
 * carrying 'ENQUIRY' exist, because Postgres validates the new CHECK against
 * existing rows and aborts the whole transaction.
 *
 * That made `sequelize db:migrate:undo:all` (and therefore `npm run db:refresh`)
 * permanently fail on any database that had R-63 applied and had actually
 * recorded an enquiry close - which is every real shop database. Fixed 2026-10-01.
 *
 * So: if no ENQUIRY row exists, revert exactly as before. If one does, leave the
 * widened constraint in place untouched - narrowing is not a legal operation at
 * that point, and dropping the constraint without re-adding it would leave
 * `delivery_logs.entity_type` completely unvalidated, which is strictly worse
 * than keeping the widened CHECK. The end state after `undo:all` is therefore
 * "R-63 not reverted", which is honest and safe.
 */
export async function down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
        "SELECT 1 FROM delivery_logs WHERE entity_type = 'ENQUIRY' LIMIT 1"
    );
    if (rows.length > 0) return;
    await queryInterface.sequelize.query(
        "ALTER TABLE delivery_logs DROP CONSTRAINT IF EXISTS delivery_logs_entity_type_check"
    );
    await queryInterface.sequelize.query(
        "ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_entity_type_check " +
        "CHECK (entity_type IN ('SALE', 'RENTAL', 'QUOTE', 'GENERAL'))"
    );
}