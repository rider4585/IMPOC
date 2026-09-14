import { sequelize } from '../../../database/models/index.js';

/**
 * Shop branding (R-58): name + logo, shared by every device, receipt and the
 * public customer display. Stored as two app_settings rows so nothing else
 * needs a new table:
 *   shop_name  TEXT  - display name (falls back to STORE_NAME env / default)
 *   shop_logo  TEXT  - data-URL (png/jpeg/webp/svg, capped) or absent
 */
export const BRANDING_KEYS = Object.freeze({ name: 'shop_name', logo: 'shop_logo' });
export const DEFAULT_SHOP_NAME = 'Shree Fashion Store';
export const LOGO_MAX_BYTES = 200 * 1024;

async function readSetting(key, transaction = null) {
    const rows = await sequelize.query('SELECT value_text FROM app_settings WHERE key = ?', {
        replacements: [key],
        type: sequelize.QueryTypes.SELECT,
        transaction,
    });
    return rows.length > 0 ? rows[0].value_text : null;
}

async function writeSetting(key, value, transaction) {
    await sequelize.query(
        `INSERT INTO app_settings (key, value_text, value_int, value_type, created_at, updated_at)
         VALUES (?, ?, NULL, 'TEXT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = CURRENT_TIMESTAMP`,
        { replacements: [key, value], transaction }
    );
}

/** Name only — used by the receipt builder (hot path, no logo payload). */
export async function getShopName(transaction = null) {
    const stored = await readSetting(BRANDING_KEYS.name, transaction);
    return (stored && stored.trim()) || process.env.STORE_NAME || DEFAULT_SHOP_NAME;
}

export async function getBranding() {
    const [name, logo] = await Promise.all([getShopName(), readSetting(BRANDING_KEYS.logo)]);
    return { shopName: name, logoDataUrl: logo || null };
}

/**
 * @param {{shopName: string, logoDataUrl?: string|null}} data - logoDataUrl undefined = keep, null = remove
 */
export async function updateBranding(data) {
    const transaction = await sequelize.transaction();
    try {
        await writeSetting(BRANDING_KEYS.name, data.shopName.trim(), transaction);
        if (data.logoDataUrl === null) {
            await sequelize.query('DELETE FROM app_settings WHERE key = ?', { replacements: [BRANDING_KEYS.logo], transaction });
        } else if (typeof data.logoDataUrl === 'string') {
            await writeSetting(BRANDING_KEYS.logo, data.logoDataUrl, transaction);
        }
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
    return getBranding();
}
