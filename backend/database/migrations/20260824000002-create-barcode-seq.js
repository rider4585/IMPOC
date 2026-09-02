'use strict';

export async function up(queryInterface) {
    // CREATE without IF NOT EXISTS: a pre-existing barcode_seq with wrong options must fail loudly, not be silently adopted.
    // DROP with IF EXISTS: rolling back a deployment mistake in dev is safe; re-apply starts the counter fresh.
    await queryInterface.sequelize.query(
        'CREATE SEQUENCE public.barcode_seq AS bigint INCREMENT BY 1 START WITH 1 NO CYCLE CACHE 1 OWNED BY NONE;',
    );
}

export async function down(queryInterface) {
    await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS public.barcode_seq;');
}
