'use strict';

export async function up(queryInterface, Sequelize) {
    try {
        // All 17 gesture types that should be allowed in the constraint
        const gestureTypeValues = [
            'SALE_CHECKOUT',
            'SALE_EXCHANGE',
            'SALE_CANCEL',
            'SALE_REFUND',
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

        // Drop the existing constraint if it exists
        await queryInterface.sequelize.query(
            'ALTER TABLE request_keys DROP CONSTRAINT IF EXISTS request_keys_gesture_type_check'
        );

        // Recreate the constraint with all 17 values
        const gestureTypeList = gestureTypeValues.map(v => `'${v}'`).join(', ');
        await queryInterface.sequelize.query(
            `ALTER TABLE request_keys ADD CONSTRAINT request_keys_gesture_type_check CHECK (gesture_type IN (${gestureTypeList}))`
        );

        // Verify the constraint was created successfully
        const constraintVerify = await queryInterface.sequelize.query(
            `SELECT 1 FROM pg_constraint WHERE conname = 'request_keys_gesture_type_check' LIMIT 1`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (!constraintVerify || constraintVerify.length === 0) {
            throw new Error(
                'Failed to verify constraint creation: request_keys_gesture_type_check not found in pg_constraint'
            );
        }
    } catch (error) {
        throw new Error(
            `Failed to extend gesture_type constraint: ${error.message}`
        );
    }
}

export async function down(queryInterface, Sequelize) {
    try {
        // Restore the original 15-value constraint (without SALE_CANCEL/SALE_REFUND)
        const originalGestureTypeValues = [
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

        // Drop the updated constraint if it exists
        await queryInterface.sequelize.query(
            'ALTER TABLE request_keys DROP CONSTRAINT IF EXISTS request_keys_gesture_type_check'
        );

        // Delete any rows with SALE_CANCEL/SALE_REFUND gesture types that would
        // violate the original constraint
        await queryInterface.sequelize.query(
            `DELETE FROM request_keys WHERE gesture_type IN ('SALE_CANCEL', 'SALE_REFUND')`
        );

        // Recreate the original 15-value constraint
        const gestureTypeList = originalGestureTypeValues.map(v => `'${v}'`).join(', ');
        await queryInterface.sequelize.query(
            `ALTER TABLE request_keys ADD CONSTRAINT request_keys_gesture_type_check CHECK (gesture_type IN (${gestureTypeList}))`
        );

        // Verify the constraint was restored successfully
        const constraintVerify = await queryInterface.sequelize.query(
            `SELECT 1 FROM pg_constraint WHERE conname = 'request_keys_gesture_type_check' LIMIT 1`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (!constraintVerify || constraintVerify.length === 0) {
            throw new Error(
                'Failed to verify constraint restoration: request_keys_gesture_type_check not found in pg_constraint'
            );
        }
    } catch (error) {
        throw new Error(
            `Failed to restore gesture_type constraint: ${error.message}`
        );
    }
}