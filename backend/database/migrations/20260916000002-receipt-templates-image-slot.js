'use strict';

/**
 * R-47 rework: add image-slot placeholders to the seeded receipt templates.
 *
 * The template engine now understands an "image slot" —
 *     <div class="receipt-image-slot">...</div>
 * — shown as a dashed box in the editor preview and stripped from final
 * receipts until the owner replaces it with a real <img> tag. This migration
 * pushes the updated HTML (slot + supporting CSS) into the currently
 * published SALE and RENTAL templates so existing databases pick it up
 * without waiting for a reseed.
 *
 * Content-only; idempotent.
 */

import { SALE_TEMPLATE_HTML } from '../seeders/20260915000007-receipt-templates-seed.js';

export async function up(queryInterface) {
    const escaped = SALE_TEMPLATE_HTML.replace(/'/g, "''");
    await queryInterface.sequelize.query(`
        UPDATE receipt_templates
           SET html_content = '${escaped}',
               updated_at = NOW()
         WHERE entity_type IN ('SALE', 'RENTAL')
           AND is_active = true
           AND deleted_at IS NULL
    `);
}

/** Content-only migration — nothing to reverse. */
export async function down(/* queryInterface */) {
    /* no-op */
}