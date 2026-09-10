'use strict';

/**
 * R-32 Phase A (grid read layer): derived SQL views for the sales, rentals,
 * expenses, units, and stocks tabs. These are READ-ONLY derived layers - the
 * underlying ledger tables remain the single source of truth and are never
 * rewritten here; reversals are SUBTRACTED / excluded, not zeroed, and every
 * money column stays BIGINT (consumers convert to String, matching the DTOs).
 *
 * Each view exposes the exact DTO payloads as JSONB columns (lines, returns,
 * reversals, customer) so the list endpoints can be served from the view via
 * one round-trip while keeping response shapes byte-identical, plus a few
 * pre-aggregated grid columns (units/refunded/cancelled, earned/damage/etc).
 *
 * Views are idempotent. CREATE OR REPLACE VIEW cannot change an existing
 * column's type (e.g. sold_at date -> text), so each view is dropped first
 * when a previous shape exists; DROP VIEW IF EXISTS keeps re-runs safe.
 */
const migration = {
    VIEWS: [
        // ---------------------------------------------------------------- sales
        {
            name: 'v_sales_grid',
            sql: `
CREATE OR REPLACE VIEW v_sales_grid AS
SELECT
    s.id,
    s.uuid,
    s.sale_number AS "saleNumber",
    s.customer_name AS "customerName",
    s.customer_mobile AS "customerMobile",
    CASE WHEN c.id IS NOT NULL AND c.deleted_at IS NULL
         THEN jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email, 'deletedAt', NULL::text)
         ELSE NULL END AS customer,
    s.sold_at::text AS "soldAt",
    s.payment_method AS "paymentMethod",
    s.customer_source AS "customerSource",
    s.total_paise AS "totalPaise",
    s.status,
    s.notes,
    s.created_by AS "createdBy",
    s.created_at AS "createdAt",
    s.updated_at AS "updatedAt",
    COALESCE((SELECT COUNT(*) FROM sale_lines l WHERE l.sale_id = s.id AND l.deleted_at IS NULL), 0)::bigint AS units,
    COALESCE((SELECT SUM(r.amount_paise) FROM sale_reversals r
              WHERE r.sale_id = s.id AND r.reversal_type = 'REFUND' AND r.deleted_at IS NULL), 0)::bigint AS "refundedPaise",
    COALESCE((SELECT SUM(r.amount_paise) FROM sale_reversals r
              WHERE r.sale_id = s.id AND r.reversal_type = 'CANCEL' AND r.deleted_at IS NULL), 0)::bigint AS "cancelledPaise",
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                'uuid', l.uuid,
                'unitUuid', l.unit_uuid,
                'barcode', l.barcode,
                'sellingPricePaise', l.selling_price_paise::text,
                'unitStatus', u.status) ORDER BY l.id)
        FROM sale_lines l
        LEFT JOIN units u ON u.id = l.unit_id AND u.deleted_at IS NULL
        WHERE l.sale_id = s.id AND l.deleted_at IS NULL), '[]'::jsonb) AS lines,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                'uuid', r.uuid,
                'reversalType', r.reversal_type,
                'amountPaise', r.amount_paise::text,
                'reason', r.reason,
                'createdAt', r.created_at) ORDER BY r.id)
        FROM sale_reversals r
        WHERE r.sale_id = s.id AND r.deleted_at IS NULL), '[]'::jsonb) AS reversals
FROM sales s
LEFT JOIN customers c ON c.id = s.customer_id
WHERE s.deleted_at IS NULL`,
        },
        // -------------------------------------------------------------- rentals
        {
            name: 'v_rentals_grid',
            sql: `
CREATE OR REPLACE VIEW v_rentals_grid AS
SELECT
    a.id,
    a.customer_id,
    a.uuid,
    a.agreement_number AS "agreementNumber",
    a.customer_name AS "customerName",
    a.customer_mobile AS "customerMobile",
    CASE WHEN c.id IS NOT NULL AND c.deleted_at IS NULL
         THEN jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email, 'deletedAt', NULL::text)
         ELSE NULL END AS customer,
    a.start_date::text AS "startDate",
    a.due_date::text AS "dueDate",
    a.payment_method AS "paymentMethod",
    a.customer_source AS "customerSource",
    a.deposit_refundable_paise AS "depositRefundablePaise",
    a.status,
    a.notes,
    a.created_by AS "createdBy",
    a.created_at AS "createdAt",
    a.updated_at AS "updatedAt",
    COALESCE(lc.line_count, 0)::bigint AS "lineCount",
    COALESCE(lc.return_count, 0)::bigint AS "returnCount",
    COALESCE(rev.earned_paise, 0)::bigint AS "earnedPaise",
    COALESCE(rev.overdue_charge_paise, 0)::bigint AS "overdueChargePaise",
    COALESCE(rev.damage_charge_paise, 0)::bigint AS "damageChargePaise",
    COALESCE(rc.cancelled_paise, 0)::bigint AS "cancelledPaise",
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                'uuid', l.uuid,
                'unitUuid', l.unit_uuid,
                'barcode', l.barcode,
                'rentPerDayPaise', l.rent_per_day_paise::text,
                'depositPaise', l.deposit_paise::text,
                'overduePerDayPaise', l.overdue_per_day_paise::text,
                'unitStatus', u.status,
                'returns', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                            'uuid', rr.uuid,
                            'actualReturnDate', rr.actual_return_date,
                            'damageGradeName', rr.damage_grade_name,
                            'damageGradeOutcome', rr.damage_grade_outcome,
                            'lateDays', rr.late_days,
                            'overdueChargePaise', rr.overdue_charge_paise::text,
                            'damageChargePaise', rr.damage_charge_paise::text,
                            'depositRefundedPaise', rr.deposit_refunded_paise::text) ORDER BY rr.id)
                    FROM rental_returns rr
                    WHERE rr.rental_line_id = l.id AND rr.deleted_at IS NULL), '[]'::jsonb)
                ) ORDER BY l.id)
        FROM rental_lines l
        LEFT JOIN units u ON u.id = l.unit_id AND u.deleted_at IS NULL
        WHERE l.agreement_id = a.id AND l.deleted_at IS NULL), '[]'::jsonb) AS lines,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                'uuid', rr.uuid,
                'unitUuid', rr.unit_uuid,
                'actualReturnDate', rr.actual_return_date,
                'damageGradeName', rr.damage_grade_name,
                'damageGradeOutcome', rr.damage_grade_outcome,
                'lateDays', rr.late_days,
                'overdueChargePaise', rr.overdue_charge_paise::text,
                'damageChargePaise', rr.damage_charge_paise::text,
                'depositRefundedPaise', rr.deposit_refunded_paise::text) ORDER BY rr.id)
        FROM rental_returns rr
        WHERE rr.agreement_id = a.id AND rr.deleted_at IS NULL), '[]'::jsonb) AS returns,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                'uuid', r.uuid,
                'reversalType', r.reversal_type,
                'amountPaise', r.amount_paise::text,
                'reason', r.reason,
                'createdAt', r.created_at) ORDER BY r.id)
        FROM rental_reversals r
        WHERE r.agreement_id = a.id AND r.deleted_at IS NULL), '[]'::jsonb) AS reversals
FROM rental_agreements a
LEFT JOIN customers c ON c.id = a.customer_id
LEFT JOIN (
    SELECT rl.agreement_id,
           COUNT(DISTINCT rl.id)::bigint AS line_count,
           COUNT(rr.id)::bigint AS return_count
    FROM rental_lines rl
    LEFT JOIN rental_returns rr ON rr.rental_line_id = rl.id AND rr.deleted_at IS NULL
    WHERE rl.deleted_at IS NULL
    GROUP BY rl.agreement_id
) lc ON lc.agreement_id = a.id
LEFT JOIN (
    SELECT rl.agreement_id,
           SUM(GREATEST(rr.actual_return_date - ra.start_date, 0)::bigint * rl.rent_per_day_paise)::bigint AS earned_paise,
           SUM(rr.overdue_charge_paise)::bigint AS overdue_charge_paise,
           SUM(rr.damage_charge_paise)::bigint AS damage_charge_paise
    FROM rental_returns rr
    JOIN rental_lines rl ON rl.id = rr.rental_line_id AND rl.deleted_at IS NULL
    JOIN rental_agreements ra ON ra.id = rl.agreement_id
    WHERE rr.deleted_at IS NULL
    GROUP BY rl.agreement_id
) rev ON rev.agreement_id = a.id
LEFT JOIN (
    SELECT agreement_id, SUM(amount_paise)::bigint AS cancelled_paise
    FROM rental_reversals
    WHERE reversal_type = 'CANCEL' AND deleted_at IS NULL
    GROUP BY agreement_id
) rc ON rc.agreement_id = a.id
WHERE a.deleted_at IS NULL`,
        },
        // ------------------------------------------------------------ expenses
        {
            name: 'v_expenses_grid',
            sql: `
CREATE OR REPLACE VIEW v_expenses_grid AS
SELECT
    e.id,
    e.uuid,
    e.amount_paise AS "amountPaise",
    e.category,
    e.purpose,
    e.expense_date::text AS "expenseDate",
    e.status,
    e.notes,
    e.created_by AS "createdBy",
    e.created_at AS "createdAt",
    e.updated_at AS "updatedAt",
    COALESCE(rc.cancelled_paise, 0)::bigint AS "cancelledPaise",
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                'uuid', r.uuid,
                'reversalType', r.reversal_type,
                'amountPaise', r.amount_paise::text,
                'reason', r.reason,
                'createdAt', r.created_at) ORDER BY r.id)
        FROM expense_reversals r
        WHERE r.expense_id = e.id AND r.deleted_at IS NULL), '[]'::jsonb) AS reversals
FROM expenses e
LEFT JOIN (
    SELECT expense_id, SUM(amount_paise)::bigint AS cancelled_paise
    FROM expense_reversals
    WHERE reversal_type = 'CANCEL' AND deleted_at IS NULL
    GROUP BY expense_id
) rc ON rc.expense_id = e.id
WHERE e.deleted_at IS NULL`,
        },
        // ---------------------------------------------------------------- units
        {
            name: 'v_units_grid',
            sql: `
CREATE OR REPLACE VIEW v_units_grid AS
SELECT
    u.id,
    u.uuid,
    u.barcode,
    st.uuid AS "stockUuid",
    NULLIF(CONCAT_WS(' ', pt.name, SUB.name), '') AS "stockName",
    v.uuid AS "vendorUuid",
    v.name AS "vendorName",
    t.uuid AS "tripUuid",
    c.uuid AS "colourUuid",
    c.name AS "colourName",
    s.uuid AS "sizeUuid",
    s.name AS "sizeName",
    u.status,
    u.channel,
    u.buying_price_paise AS "buyingPricePaise",
    u.selling_price_paise AS "sellingPricePaise",
    u.floor_price_paise AS "floorPricePaise",
    u.created_at AS "createdAt",
    u.updated_at AS "updatedAt"
FROM units u
LEFT JOIN stocks st ON st.id = u.stock_id
LEFT JOIN product_types pt ON pt.id = st.product_type_id AND pt.deleted_at IS NULL
LEFT JOIN product_types SUB ON SUB.id = st.sub_type_id AND SUB.deleted_at IS NULL
LEFT JOIN vendors v ON v.id = st.vendor_id AND v.deleted_at IS NULL
LEFT JOIN trips t ON t.id = st.trip_id AND t.deleted_at IS NULL
LEFT JOIN colours c ON c.id = u.colour_id AND c.deleted_at IS NULL
LEFT JOIN sizes s ON s.id = u.size_id AND s.deleted_at IS NULL
WHERE u.deleted_at IS NULL`,
        },
        // ---------------------------------------------------------------- stocks
        {
            name: 'v_stocks_grid',
            sql: `
CREATE OR REPLACE VIEW v_stocks_grid AS
SELECT
    st.id,
    st.uuid,
    t.uuid AS "tripUuid",
    tv.uuid AS "tripVendorUuid",
    v.uuid AS "vendorUuid",
    v.name AS "vendorName",
    pt.uuid AS "productTypeUuid",
    SUB.uuid AS "subTypeUuid",
    pt.name AS "productTypeName",
    SUB.name AS "subTypeName",
    st.quantity,
    st.buying_price_paise AS "buyingPricePaise",
    st.whole_buying_price_paise AS "wholeBuyingPricePaise",
    st.selling_price_paise AS "sellingPricePaise",
    st.floor_price_paise AS "floorPricePaise",
    st.channel,
    st.rent_per_day_paise AS "rentPerDayPaise",
    st.deposit_paise AS "depositPaise",
    st.overdue_per_day_paise AS "overduePerDayPaise",
    st.created_at AS "createdAt",
    st.updated_at AS "updatedAt",
    COALESCE(uc.unit_count, 0)::bigint AS "unitsScannedCount"
FROM stocks st
LEFT JOIN trips t ON t.id = st.trip_id AND t.deleted_at IS NULL
LEFT JOIN trip_vendors tv ON tv.id = st.trip_vendor_id AND tv.deleted_at IS NULL
LEFT JOIN vendors v ON v.id = st.vendor_id AND v.deleted_at IS NULL
LEFT JOIN product_types pt ON pt.id = st.product_type_id AND pt.deleted_at IS NULL
LEFT JOIN product_types SUB ON SUB.id = st.sub_type_id AND SUB.deleted_at IS NULL
LEFT JOIN (
    SELECT stock_id, COUNT(*)::bigint AS unit_count
    FROM units
    WHERE deleted_at IS NULL
    GROUP BY stock_id
) uc ON uc.stock_id = st.id
WHERE st.deleted_at IS NULL`,
        },
    ],

    async up(queryInterface) {
        for (const view of this.VIEWS) {
            await queryInterface.sequelize.query(`DROP VIEW IF EXISTS ${view.name}`);
            await queryInterface.sequelize.query(view.sql);
        }
    },

    async down(queryInterface) {
        for (const view of this.VIEWS) {
            await queryInterface.sequelize.query(`DROP VIEW IF EXISTS ${view.name}`);
        }
    },
};

export const up = migration.up.bind(migration);
export const down = migration.down.bind(migration);