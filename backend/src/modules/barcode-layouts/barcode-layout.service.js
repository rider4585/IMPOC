import { BarcodeLayout, BarcodeLayoutTemplate, User } from '../../../database/models/index.js';

import { DEFAULT_LAYOUT, computeSheetGeometry } from './barcode-layout.geometry.js';

const NUMERIC_FIELDS = [
    'pageCustomWidthMm', 'pageCustomHeightMm',
    'columns', 'rows',
    'marginTopMm', 'marginRightMm', 'marginBottomMm', 'marginLeftMm',
    'gapHorizontalMm', 'gapVerticalMm',
    'barcodeWidthMm', 'barcodeHeightMm',
    'textFontSizePt', 'textMarginTopMm',
    'labelPaddingTopMm', 'labelPaddingBottomMm', 'labelPaddingXMm',
    'borderWidthPt', 'borderRadiusMm',
    'infoBoxMinHeightMm',
];

export const LAYOUT_FIELDS = Object.freeze(Object.keys(DEFAULT_LAYOUT));

/** DECIMAL columns arrive as strings from pg; hand callers plain numbers. */
export function toPlainLayout(row) {
    const plain = {};
    for (const key of LAYOUT_FIELDS) {
        plain[key] = NUMERIC_FIELDS.includes(key) ? Number(row[key]) : row[key];
    }
    plain.updatedAt = row.updatedAt;
    return plain;
}

/**
 * The single layout row. Created from DEFAULT_LAYOUT if missing (test DBs are
 * built with sync(), which does not run the migration seed).
 */
export async function getLayout(transaction = null) {
    const [row] = await BarcodeLayout.findOrCreate({
        where: { id: 1 },
        defaults: { id: 1, ...DEFAULT_LAYOUT },
        transaction,
    });
    return toPlainLayout(row);
}

/**
 * Replace the layout (validated by the caller). Rejects a layout whose
 * geometry cannot be printed (grid off the page, barcode wider than label).
 */
export async function updateLayout(data, userUuid) {
    const geometry = computeSheetGeometry(data);
    if (geometry.problems.length > 0) {
        const error = new Error(`Layout does not fit: ${geometry.problems[0]}`);
        error.statusCode = 400;
        throw error;
    }

    const user = userUuid
        ? await User.findOne({ where: { uuid: userUuid }, attributes: ['id'] })
        : null;

    const [row] = await BarcodeLayout.findOrCreate({
        where: { id: 1 },
        defaults: { id: 1, ...DEFAULT_LAYOUT },
    });
    await row.update({ ...data, updatedBy: user?.id ?? null });

    return toPlainLayout(row);
}

/* ------------------------------------------------------------------ */
/* Templates (R-56): named snapshots; applying one is a client-side act */

/** DTO for a template row. */
export function toTemplateDTO(row) {
    return {
        uuid: row.uuid,
        name: row.name,
        layout: row.layout,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export async function listTemplates() {
    const rows = await BarcodeLayoutTemplate.findAll({ order: [['name', 'ASC']] });
    return rows.map(toTemplateDTO);
}

/**
 * Snapshot a (validated) layout under `name`. 409 when a live template already
 * uses the name (case-insensitive).
 */
export async function createTemplate({ name, layout }, userUuid) {
    const geometry = computeSheetGeometry(layout);
    if (geometry.problems.length > 0) {
        const error = new Error(`Layout does not fit: ${geometry.problems[0]}`);
        error.statusCode = 400;
        throw error;
    }
    const clash = await BarcodeLayoutTemplate.findOne({
        where: BarcodeLayoutTemplate.sequelize.where(
            BarcodeLayoutTemplate.sequelize.fn('lower', BarcodeLayoutTemplate.sequelize.col('name')),
            name.trim().toLowerCase()
        ),
    });
    if (clash) {
        const error = new Error('Layout template already exists');
        error.statusCode = 409;
        throw error;
    }
    const user = userUuid ? await User.findOne({ where: { uuid: userUuid }, attributes: ['id'] }) : null;
    const row = await BarcodeLayoutTemplate.create({ name: name.trim(), layout, createdBy: user?.id ?? null });
    return toTemplateDTO(row);
}

export async function deleteTemplate(uuid) {
    const row = await BarcodeLayoutTemplate.findOne({ where: { uuid } });
    if (!row) {
        const error = new Error('Layout template not found');
        error.statusCode = 404;
        throw error;
    }
    await row.destroy();
    return { uuid };
}
