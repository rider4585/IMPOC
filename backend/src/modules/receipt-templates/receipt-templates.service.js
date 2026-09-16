import { ReceiptTemplate, ReceiptSnapshot, User, sequelize } from '../../../database/models/index.js';
import { buildReceipt } from '../receipts/receipts.service.js';
import { getBranding } from '../branding/branding.service.js';
import { buildBrandedReceiptHtml } from '../receipts/receipts.html.js';

// ---- DTO Mappers ----

export function mapTemplateDTO(template) {
    const plain = template.get({ plain: true });
    return {
        uuid: plain.uuid,
        name: plain.name,
        entityType: plain.entityType,
        version: plain.version,
        isActive: plain.isActive,
        htmlContent: plain.htmlContent,
        editorState: plain.editorState,
        createdBy: plain.createdByUser
            ? [plain.createdByUser.firstName, plain.createdByUser.lastName].filter(Boolean).join(' ')
            : null,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
        snapshotsCount: plain.snapshots ? plain.snapshots.length : undefined,
    };
}

export function mapSnapshotDTO(snapshot) {
    const plain = snapshot.get({ plain: true });
    return {
        uuid: plain.uuid,
        entityType: plain.entityType,
        entityUuid: plain.entityUuid,
        templateVersion: plain.templateVersion,
        renderedHtml: plain.renderedHtml,
        editorState: plain.editorState,
        renderedAt: plain.renderedAt,
        template: plain.template ? { name: plain.template.name, version: plain.template.version } : null,
    };
}

// ---- Sample data for preview ----

function renderSampleData(entityType) {
    const lines =
        entityType === 'RENTAL'
            ? [
                  { productName: 'Anarkali Suit', productType: 'Ethnic Wear', colour: 'Royal Blue', size: 'M', quantity: 1, unitPricePaise: '50000', lineTotalPaise: '50000' },
                  { productName: 'Silk Dupatta', productType: 'Accessories', colour: 'Gold', size: null, quantity: 1, unitPricePaise: '15000', lineTotalPaise: '15000' },
              ]
            : [
                  { productName: 'Lehenga Set', productType: 'Ethnic Wear', colour: 'Red', size: 'S', quantity: 1, unitPricePaise: '350000', lineTotalPaise: '350000' },
                  { productName: 'Bangle Set', productType: 'Accessories', colour: 'Gold', size: null, quantity: 2, unitPricePaise: '25000', lineTotalPaise: '50000' },
              ];

    const totalPaise = lines.reduce((sum, l) => sum + BigInt(l.lineTotalPaise), 0n);

    return {
        store: { name: 'Shree Fashion Store', address: 'Sample Market, Mumbai', phone: '+91 98765 43210' },
        transaction: {
            type: entityType,
            number: entityType === 'RENTAL' ? 'RA-2026-001' : 'SALE-2026-001',
            date: new Date().toISOString().slice(0, 10),
            paymentMethod: 'CASH',
            totalPaise: String(totalPaise),
            paidPaise: String(totalPaise),
            changePaise: '0',
            status: 'completed',
        },
        customer: { name: 'Preview Customer', phone: '+91 99999 00000' },
        lines,
        totals: {
            subtotalPaise: String(totalPaise),
            discountPaise: '0',
            totalPaise: String(totalPaise),
            amountPaidPaise: String(totalPaise),
            balancePaise: '0',
            itemsCount: lines.length,
        },
    };
}

// ---- Service Functions ----

export async function listTemplates({ entityType } = {}) {
    const where = {};
    if (entityType) where.entityType = entityType;

    const templates = await ReceiptTemplate.findAll({
        where,
        include: [
            { model: User, as: 'createdByUser', attributes: ['firstName', 'lastName'] },
            { model: ReceiptSnapshot, as: 'snapshots', attributes: ['id'] },
        ],
        order: [['entityType', 'ASC'], ['version', 'DESC']],
        paranoid: true,
    });

    return templates.map(mapTemplateDTO);
}

export async function getTemplateByUuid(uuid) {
    const template = await ReceiptTemplate.findOne({
        where: { uuid },
        include: [
            { model: User, as: 'createdByUser', attributes: ['firstName', 'lastName'] },
            { model: ReceiptSnapshot, as: 'snapshots', attributes: ['id'] },
        ],
        paranoid: true,
    });

    if (!template) return null;
    return mapTemplateDTO(template);
}

export async function createTemplate({ name, entityType, htmlContent, editorState, createdByUserId }) {
    const template = await ReceiptTemplate.create({
        name,
        entityType,
        htmlContent,
        editorState: editorState ?? null,
        version: 1,
        isActive: false,
        createdBy: createdByUserId || null,
    });

    const created = await ReceiptTemplate.findByPk(template.id, {
        include: [
            { model: User, as: 'createdByUser', attributes: ['firstName', 'lastName'] },
        ],
        paranoid: true,
    });

    return mapTemplateDTO(created);
}

export async function updateTemplate({ uuid, name, htmlContent, editorState }) {
    const existing = await ReceiptTemplate.findOne({ where: { uuid }, paranoid: true });
    if (!existing) return null;

    const transaction = await sequelize.transaction();
    try {
        await existing.update({ isActive: false }, { transaction });

        const newTemplate = await ReceiptTemplate.create(
            {
                name: name ?? existing.name,
                entityType: existing.entityType,
                htmlContent: htmlContent ?? existing.htmlContent,
                editorState: editorState !== undefined ? editorState : existing.editorState,
                version: existing.version + 1,
                isActive: false,
                createdBy: existing.createdBy,
            },
            { transaction }
        );

        await transaction.commit();

        const created = await ReceiptTemplate.findByPk(newTemplate.id, {
            include: [
                { model: User, as: 'createdByUser', attributes: ['firstName', 'lastName'] },
            ],
            paranoid: true,
        });

        return mapTemplateDTO(created);
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

export async function activateTemplate({ uuid }) {
    const template = await ReceiptTemplate.findOne({ where: { uuid }, paranoid: true });
    if (!template) return null;

    const transaction = await sequelize.transaction();
    try {
        await ReceiptTemplate.update(
            { isActive: false },
            { where: { entityType: template.entityType, isActive: true }, transaction }
        );

        await template.update({ isActive: true }, { transaction });

        await transaction.commit();

        const activated = await ReceiptTemplate.findByPk(template.id, {
            include: [
                { model: User, as: 'createdByUser', attributes: ['firstName', 'lastName'] },
                { model: ReceiptSnapshot, as: 'snapshots', attributes: ['id'] },
            ],
            paranoid: true,
        });

        return mapTemplateDTO(activated);
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

export async function deactivateAllTemplates(entityType) {
    await ReceiptTemplate.update(
        { isActive: false },
        { where: { entityType, isActive: true } }
    );
}

export async function getActiveTemplate(entityType) {
    const template = await ReceiptTemplate.findOne({
        where: { entityType, isActive: true },
        include: [
            { model: User, as: 'createdByUser', attributes: ['firstName', 'lastName'] },
            { model: ReceiptSnapshot, as: 'snapshots', attributes: ['id'] },
        ],
        paranoid: true,
    });

    if (!template) {
        const fallback = await ReceiptTemplate.findOne({
            where: { entityType: 'UNIVERSAL', isActive: true },
            include: [
                { model: User, as: 'createdByUser', attributes: ['firstName', 'lastName'] },
                { model: ReceiptSnapshot, as: 'snapshots', attributes: ['id'] },
            ],
            paranoid: true,
        });
        return fallback ? mapTemplateDTO(fallback) : null;
    }

    return mapTemplateDTO(template);
}

export async function previewTemplate({ htmlContent, entityType }) {
    const sampleReceipt = renderSampleData(entityType);
    const { logoDataUrl } = await getBranding();
    const renderedHtml = buildBrandedReceiptHtml(sampleReceipt, { logoSrc: logoDataUrl || undefined });

    return { renderedHtml };
}

export async function captureSnapshot({ entityType, entityUuid }) {
    let rawTemplate = await ReceiptTemplate.findOne({
        where: { entityType, isActive: true },
        paranoid: true,
    });
    if (!rawTemplate) {
        rawTemplate = await ReceiptTemplate.findOne({
            where: { entityType: 'UNIVERSAL', isActive: true },
            paranoid: true,
        });
    }
    if (!rawTemplate) throw new Error('No active template found for ' + entityType);

    const receipt = await buildReceipt({ entityType, entityUuid, isPrivileged: true });
    if (!receipt) throw new Error(`${entityType} with UUID ${entityUuid} not found`);

    const { logoDataUrl } = await getBranding();
    const renderedHtml = buildBrandedReceiptHtml(receipt, { logoSrc: logoDataUrl || undefined });

    const snapshot = await ReceiptSnapshot.create({
        entityType,
        entityUuid,
        templateId: rawTemplate.id,
        templateVersion: rawTemplate.version,
        renderedHtml,
        editorState: rawTemplate.editorState,
        renderedAt: new Date(),
    });

    const created = await ReceiptSnapshot.findByPk(snapshot.id, {
        include: [{ model: ReceiptTemplate, as: 'template', attributes: ['name', 'version'] }],
        paranoid: true,
    });

    return mapSnapshotDTO(created);
}

export async function getSnapshot({ entityType, entityUuid }) {
    const snapshot = await ReceiptSnapshot.findOne({
        where: { entityType, entityUuid },
        include: [{ model: ReceiptTemplate, as: 'template', attributes: ['name', 'version'] }],
        paranoid: true,
        order: [['renderedAt', 'DESC']],
    });

    if (!snapshot) return null;
    return mapSnapshotDTO(snapshot);
}

export async function listSnapshots({ entityType, limit = 50, offset = 0 } = {}) {
    const where = {};
    if (entityType) where.entityType = entityType;

    const { count, rows } = await ReceiptSnapshot.findAndCountAll({
        where,
        include: [{ model: ReceiptTemplate, as: 'template', attributes: ['name', 'version'] }],
        order: [['renderedAt', 'DESC']],
        limit,
        offset,
        paranoid: true,
    });

    return { total: count, snapshots: rows.map(mapSnapshotDTO) };
}

export async function exportSnapshots() {
    const snapshots = await ReceiptSnapshot.findAll({
        include: [{ model: ReceiptTemplate, as: 'template', attributes: ['name', 'version'] }],
        order: [['renderedAt', 'DESC']],
        paranoid: true,
    });

    return snapshots.map(mapSnapshotDTO);
}
