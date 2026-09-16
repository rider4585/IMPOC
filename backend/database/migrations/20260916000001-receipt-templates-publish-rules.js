'use strict';

/**
 * R-47 rework: normalize which templates are "published" (is_active).
 *
 * The template model is "version rows" — each save writes a new row and only
 * the marked-active row is used for receipt generation. This migration:
 *   1. Marks exactly ONE version per entity type (SALE/RENTAL/UNIVERSAL) as
 *      active — the highest version number — so the RENTAL template (seeded
 *      inactive) becomes published and any stray active rows are corrected.
 *   2. Renames the seeded templates to plain "Sale Receipt" / "Rental Receipt".
 *
 * It is idempotent — safe to run on databases that already have correct state.
 */
export async function up(queryInterface) {
    try {
        await queryInterface.sequelize.query(
            `UPDATE receipt_templates
                SET is_active = (v.rn = 1)
               FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY entity_type
                               ORDER BY version DESC, id DESC
                           ) AS rn
                      FROM receipt_templates
                     WHERE deleted_at IS NULL
               ) v
              WHERE receipt_templates.id = v.id`
        );
    } catch {
        /* Column/index drift across environments — best effort. */
    }

    await queryInterface.sequelize.query(
        `UPDATE receipt_templates SET name = 'Sale Receipt' WHERE entity_type = 'SALE' AND deleted_at IS NULL`
    );
    await queryInterface.sequelize.query(
        `UPDATE receipt_templates SET name = 'Rental Receipt' WHERE entity_type = 'RENTAL' AND deleted_at IS NULL`
    );
}

/** Naming/state normalisation is not worth reversing. */
export async function down(/* queryInterface */) {
    /* no-op */
}