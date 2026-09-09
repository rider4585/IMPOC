import { Sale, RentalAgreement } from '../../../database/models/index.js';

const LINE_PRODUCT_INCLUDE = {
    association: 'unit',
    include: [
        { association: 'stock', include: [{ association: 'productType', attributes: ['id', 'name'] }] },
        { association: 'colour', attributes: ['name'] },
        { association: 'size', attributes: ['name'] },
    ],
};

const SALE_FIND_OPTIONS = {
    include: [
        { association: 'lines', include: [LINE_PRODUCT_INCLUDE] },
        { association: 'customer' },
    ],
};

const RENTAL_FIND_OPTIONS = {
    include: [
        { association: 'lines', include: [LINE_PRODUCT_INCLUDE] },
        { association: 'customer' },
    ],
};

function storeInfo() {
    return {
        name: process.env.STORE_NAME || 'SHREE Fashion Store',
        address: process.env.STORE_ADDRESS || '',
        phone: process.env.STORE_PHONE || '',
    };
}

function productTypeName(line) {
    const pt = line.unit && line.unit.stock && line.unit.stock.productType;
    return pt ? pt.name : 'Item';
}

function productCategory(unit) {
    if (!unit || !unit.stock || !unit.stock.productType) return null;
    return unit.stock.productType.name;
}

function colourName(line) {
    return line.unit && line.unit.colour ? line.unit.colour.name : null;
}

function sizeName(line) {
    return line.unit && line.unit.size ? line.unit.size.name : null;
}

function rentalDaysBetween(fromStr, toStr) {
    const [fy, fm, fd] = fromStr.split('-').map(Number);
    const [ty, tm, td] = toStr.split('-').map(Number);
    const from = Date.UTC(fy, fm - 1, fd);
    const to = Date.UTC(ty, tm - 1, td);
    return Math.max(1, Math.round((to - from) / 86400000));
}

function customerBlock(entity, isPrivileged = false) {
    if (entity.customer) {
        if (isPrivileged) {
            return {
                name: entity.customer.name,
                phone: entity.customer.phone,
                email: entity.customer.email,
            };
        }
        return {
            name: entity.customer.name,
        };
    }
    if (entity.customerName || entity.customerMobile) {
        if (isPrivileged) {
            return {
                name: entity.customerName || null,
                phone: entity.customerMobile || null,
                email: null,
            };
        }
        return {
            name: entity.customerName || null,
        };
    }
    return null;
}

/**
 * Build the structured receipt payload for a sale.
 * Totals are always recomputed from unit price snapshots on the lines.
 */
async function buildSaleReceipt(uuid, isPrivileged = false) {
    const sale = await Sale.findOne({
        where: { uuid, deletedAt: null },
        ...SALE_FIND_OPTIONS,
    });
    if (!sale) return null;

    const lines = (sale.lines || []).map((line) => {
        const unitPrice = BigInt(line.sellingPricePaise || 0);
        const unit = line.unit;
        return {
            productName: productTypeName(line),
            productType: productCategory(unit),
            colour: colourName(line),
            size: sizeName(line),
            quantity: 1,
            unitPricePaise: String(unitPrice),
            lineTotalPaise: String(unitPrice),
        };
    });

    const subtotalPaise = lines.reduce((sum, l) => sum + BigInt(l.lineTotalPaise), 0n);
    const discountPaise = 0n;
    const totalPaise = subtotalPaise - discountPaise;
    const amountPaidPaise = totalPaise;
    const balancePaise = 0n;

    return {
        store: storeInfo(),
        transaction: {
            type: 'SALE',
            number: sale.saleNumber,
            date: sale.soldAt,
            paymentMethod: sale.paymentMethod || null,
            totalPaise: String(totalPaise),
            paidPaise: String(amountPaidPaise),
            changePaise: '0',
            status: sale.status,
        },
        customer: customerBlock(sale, isPrivileged),
        lines,
        totals: {
            subtotalPaise: String(subtotalPaise),
            discountPaise: String(discountPaise),
            totalPaise: String(totalPaise),
            amountPaidPaise: String(amountPaidPaise),
            balancePaise: String(balancePaise),
            itemsCount: lines.length,
        },
    };
}

/**
 * Build the structured receipt payload for a rental agreement.
 * Line totals = deposit + rent for the hand-out period (start -> due).
 */
async function buildRentalReceipt(uuid, isPrivileged = false) {
    const agreement = await RentalAgreement.findOne({
        where: { uuid, deletedAt: null },
        ...RENTAL_FIND_OPTIONS,
    });
    if (!agreement) return null;

    const days = rentalDaysBetween(agreement.startDate, agreement.dueDate);

    const lines = (agreement.lines || []).map((line) => {
        const unit = line.unit;
        const rentPerDay = BigInt(line.rentPerDayPaise || 0);
        const deposit = BigInt(line.depositPaise || 0);
        const rentTotal = rentPerDay * BigInt(days);
        return {
            productName: productTypeName(line),
            productType: productCategory(unit),
            colour: colourName(line),
            size: sizeName(line),
            quantity: 1,
            unitPricePaise: String(rentPerDay),
            lineTotalPaise: String(rentTotal + deposit),
        };
    });

    const rentTotalPaise = lines.reduce((sum, l) => sum + BigInt(l.lineTotalPaise), 0n);
    const depositTotalPaise = (agreement.lines || []).reduce(
        (sum, line) => sum + BigInt(line.depositPaise || 0),
        0n
    );
    const rentOnlyPaise = rentTotalPaise - depositTotalPaise;
    const discountPaise = 0n;
    const balancePaise = rentOnlyPaise;
    const amountPaidPaise = BigInt(agreement.depositRefundablePaise || 0);

    return {
        store: storeInfo(),
        transaction: {
            type: 'RENTAL',
            number: agreement.agreementNumber,
            date: agreement.startDate,
            paymentMethod: agreement.paymentMethod || null,
            totalPaise: String(rentTotalPaise),
            paidPaise: String(amountPaidPaise),
            changePaise: '0',
            status: agreement.status,
        },
        customer: customerBlock(agreement, isPrivileged),
        lines,
        totals: {
            subtotalPaise: String(rentOnlyPaise),
            discountPaise: String(discountPaise),
            totalPaise: String(rentTotalPaise),
            amountPaidPaise: String(amountPaidPaise),
            balancePaise: String(balancePaise),
            itemsCount: lines.length,
        },
    };
}

/** Paise -> "1234.56" */
function paiseToRupees(paise) {
    const b = BigInt(paise);
    const rupees = Number(b / 100n);
    const paisePart = Number(b % 100n);
    return `${rupees}.${String(paisePart).padStart(2, '0')}`;
}

function padRight(text, width) {
    const s = String(text);
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function padLeft(text, width) {
    const s = String(text);
    return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

/**
 * Render a 58mm monospace plain-text receipt.
 */
function renderTextReceipt(receipt) {
    const W = 32;
    const rule = '='.repeat(W);
    const thin = '-'.repeat(W);
    const out = [];

    out.push(' '.repeat(Math.max(0, Math.floor((W - receipt.store.name.length) / 2))) + receipt.store.name);
    if (receipt.store.address) {
        out.push(' '.repeat(Math.max(0, Math.floor((W - receipt.store.address.length) / 2))) + receipt.store.address);
    }
    if (receipt.store.phone) {
        out.push(' '.repeat(Math.max(0, Math.floor((W - receipt.store.phone.length) / 2))) + receipt.store.phone);
    }
    out.push(rule);

    if (receipt.transaction.type === 'RENTAL') {
        out.push(padRight('RENTAL AGREEMENT', W));
        out.push(`Agreement: ${receipt.transaction.number}`);
        out.push(`Start:     ${receipt.transaction.date}`);
    } else {
        out.push(padRight('SALE', W));
        out.push(`Receipt:   ${receipt.transaction.number}`);
        out.push(`Date:      ${receipt.transaction.date}`);
    }
    out.push(thin);

    for (const line of receipt.lines) {
        const nameParts = [line.productName];
        if (line.colour) nameParts.push(line.colour);
        if (line.size) nameParts.push(line.size);
        let desc = nameParts.join(' ').slice(0, 22);
        const qty = String(line.quantity);
        const price = paiseToRupees(line.unitPricePaise);
        const lineTotal = paiseToRupees(line.lineTotalPaise);
        // "T-Shirt Blue L    1  2000.00"
        out.push(padRight(desc, W - 14) + padLeft(qty, 2) + padLeft(price, 12));
        // line total right-aligned on its own row
        out.push(padRight('', W - 8) + padLeft(lineTotal, 8));
    }
    out.push(thin);

    if (receipt.totals && typeof receipt.totals.subtotalPaise === 'string') {
        out.push(padRight('Subtotal', W - 10) + padLeft(paiseToRupees(receipt.totals.subtotalPaise), 10));
    }
    if (receipt.totals && typeof receipt.totals.discountPaise === 'string' && BigInt(receipt.totals.discountPaise) > 0n) {
        out.push(padRight('Discount', W - 10) + padLeft(paiseToRupees(receipt.totals.discountPaise), 10));
    }
    out.push(padRight('TOTAL', W - 10) + padLeft(paiseToRupees(receipt.totals.totalPaise), 10));
    out.push(padRight('Paid', W - 10) + padLeft(paiseToRupees(receipt.totals.amountPaidPaise), 10));
    out.push(padRight('Balance', W - 10) + padLeft(paiseToRupees(receipt.totals.balancePaise), 10));
    if (receipt.transaction.paymentMethod) {
        out.push(padRight('Payment', W - 10) + receipt.transaction.paymentMethod);
    }
    out.push(thin);

    if (receipt.customer) {
        out.push(`Customer: ${receipt.customer.name}`);
        if (receipt.customer.phone) out.push(`Phone:    ${receipt.customer.phone}`);
        if (receipt.customer.email) out.push(`Email:    ${receipt.customer.email}`);
        out.push(thin);
    }

    out.push(' '.repeat(Math.max(0, Math.floor((W - 'THANK YOU - VISIT AGAIN'.length) / 2))) + 'THANK YOU - VISIT AGAIN');
    out.push('');

    return out.join('\n');
}

/**
 * Build a receipt for a sale or rental and return the structured payload.
 */
export const buildReceipt = async ({ entityType, entityUuid, isPrivileged = false }) => {
    if (entityType === 'SALE') {
        return buildSaleReceipt(entityUuid, isPrivileged);
    }
    if (entityType === 'RENTAL') {
        return buildRentalReceipt(entityUuid, isPrivileged);
    }
    return null;
};

/**
 * Build a receipt and return its 58mm plain-text rendering.
 */
export const buildReceiptText = async ({ entityType, entityUuid, isPrivileged = false }) => {
    const receipt = await buildReceipt({ entityType, entityUuid, isPrivileged });
    if (!receipt) return null;
    return renderTextReceipt(receipt);
};