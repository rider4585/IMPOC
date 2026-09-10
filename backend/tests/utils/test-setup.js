import * as db from '../../database/models/index.js';

let isInitialized = false;

export async function initializeTestDatabase() {
  try {
    // Only sync once per test run, not for each test file
    if (!isInitialized) {
      await db.sequelize.sync({ force: true });

      // Partial unique indexes that are in migrations but not created by sync()
      // (sync does not build partial index expressions)

      // Allows reusing names after soft-delete while preventing active duplicates
      await db.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_name ON vendors (name) WHERE deleted_at IS NULL'
      );

      // Prevents the same vendor appearing twice on one trip while allowing reuse after soft-delete
      await db.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_vendors_trip_vendor ON trip_vendors (trip_id, vendor_id) WHERE deleted_at IS NULL'
      );

      // Ensures a stock UUID is unique per trip while allowing reuse after soft-delete
      await db.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_stocks_trip_uuid ON stocks (trip_id, uuid) WHERE deleted_at IS NULL'
      );

      // Prevents duplicate template names per vendor/product-type while allowing reuse after soft-delete
      await db.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_templates_vendor_product_name ON stock_templates (vendor_id, product_type_id, name) WHERE deleted_at IS NULL'
      );

      // Ensures barcodes are unique across live units (from migration 20260828000001)
      await db.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_units_barcode_unique ON units (barcode) WHERE deleted_at IS NULL'
      );

      // Money-out race backstops (from migration 20260908000001): prevent
      // double-issue of refunds/cancels/returns for the same live parent.
      await db.sequelize.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_reversals_refund_sale ON sale_reversals (sale_id) WHERE reversal_type = 'REFUND' AND deleted_at IS NULL"
      );
      await db.sequelize.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_reversals_cancel_sale ON sale_reversals (sale_id) WHERE reversal_type = 'CANCEL' AND deleted_at IS NULL"
      );
      await db.sequelize.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_reversals_cancel_expense ON expense_reversals (expense_id) WHERE reversal_type = 'CANCEL' AND deleted_at IS NULL"
      );
      await db.sequelize.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_reversals_cancel_agreement ON rental_reversals (agreement_id) WHERE reversal_type = 'CANCEL' AND deleted_at IS NULL"
      );
      await db.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_returns_line ON rental_returns (rental_line_id) WHERE deleted_at IS NULL'
      );

      // Create triggers and constraints that are in migrations but not created by sync()
      await db.sequelize.query(`
        CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS app_settings_update_timestamp ON app_settings;

        CREATE TRIGGER app_settings_update_timestamp
        BEFORE UPDATE ON app_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_app_settings_updated_at();
      `);

      await db.sequelize.query(`
        CREATE OR REPLACE FUNCTION update_request_keys_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS request_keys_update_timestamp ON request_keys;

        CREATE TRIGGER request_keys_update_timestamp
        BEFORE UPDATE ON request_keys
        FOR EACH ROW
        EXECUTE FUNCTION update_request_keys_updated_at();
      `);

      // Add CHECK constraints that are in migrations but not created by sync()
      await db.sequelize.query(
        `ALTER TABLE app_settings ADD CONSTRAINT app_settings_value_type_check CHECK (value_type IN ('TEXT', 'INT'))`
      );

      await db.sequelize.query(
        `ALTER TABLE request_keys ADD CONSTRAINT request_keys_gesture_type_check CHECK (gesture_type IN ('SALE_CHECKOUT', 'SALE_EXCHANGE', 'SALE_CANCEL', 'SALE_REFUND', 'RENTAL_BOOK', 'RENTAL_HANDOVER', 'RENTAL_AMEND', 'RENTAL_CANCEL', 'RENTAL_SETTLE', 'RENTAL_WRITE_OFF', 'UNIT_RECOVER', 'UNIT_TRANSITION', 'EXPENSE_CREATE', 'EXPENSE_REVERSE', 'INTAKE_SCAN', 'BARCODE_GENERATE', 'BARCODE_GENERATE_TEST'))`
      );

      // Create barcode_seq sequence (from migration 20260824000002)
      try {
        await db.sequelize.query(
          'CREATE SEQUENCE public.barcode_seq AS bigint INCREMENT BY 1 START WITH 1 NO CYCLE CACHE 1 OWNED BY NONE;'
        );
      } catch (err) {
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }

      // Seed barcode geometry settings (from migration 20260825000006)
      const MM_TO_POINTS = 72 / 25.4;
      const mmToPoints = (mm) => (mm * MM_TO_POINTS).toFixed(2);

      const geometrySettings = [
        { key: 'barcode_width_pt', value_text: mmToPoints(35), value_type: 'TEXT' },
        { key: 'barcode_height_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_text_font_size_pt', value_text: '5', value_type: 'TEXT' },
        { key: 'barcode_clear_space_pt', value_text: '15', value_type: 'TEXT' },
        { key: 'barcode_margin_top_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_margin_right_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_margin_bottom_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_margin_left_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_gap_horizontal_pt', value_text: mmToPoints(5), value_type: 'TEXT' },
        { key: 'barcode_gap_vertical_pt', value_text: mmToPoints(6), value_type: 'TEXT' },
        { key: 'barcode_grid_columns', value_int: 3, value_type: 'INT' },
        { key: 'barcode_grid_rows', value_int: 5, value_type: 'INT' },
      ];

      for (const setting of geometrySettings) {
        const sql = `
          INSERT INTO app_settings (key, value_text, value_int, value_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (key) DO NOTHING
        `;
        await db.sequelize.query(sql, {
          replacements: [setting.key, setting.value_text || null, setting.value_int || null, setting.value_type],
          type: db.sequelize.QueryTypes.INSERT,
        });
      }

      // Grid + FK/date indexes (from migration 20260910000001): kept in sync
      // with the migrations the same way the partial-unique backstops above are.
      const gridIndexes = [
        ['idx_sales_sold_at', 'sales', ['sold_at']],
        ['idx_expenses_expense_date', 'expenses', ['expense_date']],
        ['idx_rental_agreements_start_date', 'rental_agreements', ['start_date']],
        ['idx_rental_returns_actual_return_date', 'rental_returns', ['actual_return_date']],
        ['idx_delivery_logs_entity', 'delivery_logs', ['entity_type', 'entity_id']],
        ['idx_sale_lines_sale_id', 'sale_lines', ['sale_id']],
        ['idx_sale_lines_unit_id', 'sale_lines', ['unit_id']],
        ['idx_sale_reversals_sale_id', 'sale_reversals', ['sale_id']],
        ['idx_rental_lines_agreement_id', 'rental_lines', ['agreement_id']],
        ['idx_rental_lines_unit_id', 'rental_lines', ['unit_id']],
        ['idx_rental_returns_agreement_id', 'rental_returns', ['agreement_id']],
        ['idx_rental_returns_rental_line_id', 'rental_returns', ['rental_line_id']],
        ['idx_rental_returns_unit_id', 'rental_returns', ['unit_id']],
        ['idx_rental_reversals_agreement_id', 'rental_reversals', ['agreement_id']],
        ['idx_expense_reversals_expense_id', 'expense_reversals', ['expense_id']],
        ['idx_stocks_trip_id', 'stocks', ['trip_id']],
        ['idx_stocks_vendor_id', 'stocks', ['vendor_id']],
        ['idx_stocks_trip_vendor_id', 'stocks', ['trip_vendor_id']],
        ['idx_stocks_product_type_id', 'stocks', ['product_type_id']],
        ['idx_stock_templates_vendor_id', 'stock_templates', ['vendor_id']],
        ['idx_stock_templates_product_type_id', 'stock_templates', ['product_type_id']],
        ['idx_units_stock_id', 'units', ['stock_id']],
        ['idx_units_colour_id', 'units', ['colour_id']],
        ['idx_units_size_id', 'units', ['size_id']],
        ['idx_trip_vendors_trip_id', 'trip_vendors', ['trip_id']],
        ['idx_trip_vendors_vendor_id', 'trip_vendors', ['vendor_id']],
        ['idx_sales_created_by', 'sales', ['created_by']],
        ['idx_sales_customer_id', 'sales', ['customer_id']],
        ['idx_rental_agreements_created_by', 'rental_agreements', ['created_by']],
        ['idx_rental_agreements_customer_id', 'rental_agreements', ['customer_id']],
        ['idx_expenses_created_by', 'expenses', ['created_by']],
        ['idx_product_types_parent_id', 'product_types', ['parent_id']],
        ['idx_request_keys_actor_user_id', 'request_keys', ['actor_user_id']],
        ['idx_unit_status_events_actor_user_id', 'unit_status_events', ['actor_user_id']],
      ];
      for (const [name, table, columns] of gridIndexes) {
        const cols = columns.map((c) => `"${c}"`).join(', ');
        await db.sequelize.query(`CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols})`);
      }

      // Grid read-layer views (from migration 20260910000002). sequelize sync()
      // DROPs tables with CASCADE, which also drops dependent views, so they are
      // recreated here exactly like the migrations create them.
      const gridViews = {
        v_sales_grid: `
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
        v_rentals_grid: `
          CREATE OR REPLACE VIEW v_rentals_grid AS
          SELECT
              a.id,
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
        v_expenses_grid: `
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
        v_units_grid: `
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
        v_stocks_grid: `
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
      };
      for (const [name, sql] of Object.entries(gridViews)) {
        await db.sequelize.query(`DROP VIEW IF EXISTS ${name}`);
        await db.sequelize.query(sql);
      }

      // Dashboard materialized views (from migration 20260910000003). Plain or
      // concurrent refresh is driven by reports.service.js, so the test DB gets
      // the same objects here.
      const matviews = {
        mv_dashboard_sales: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_sales AS
          SELECT
              s.sold_at AS metric_date,
              COALESCE((SELECT SUM(x.total_paise) FROM sales x
                        WHERE x.sold_at = s.sold_at AND x.deleted_at IS NULL AND x.status = 'completed'), 0)::bigint AS sales_total_paise,
              COALESCE((SELECT SUM(r.amount_paise) FROM sale_reversals r JOIN sales so ON so.id = r.sale_id
                        WHERE so.sold_at = s.sold_at AND so.deleted_at IS NULL AND r.deleted_at IS NULL
                          AND r.reversal_type = 'REFUND'), 0)::bigint AS refunded_paise,
              COALESCE((SELECT SUM(r.amount_paise) FROM sale_reversals r JOIN sales so ON so.id = r.sale_id
                        WHERE so.sold_at = s.sold_at AND so.deleted_at IS NULL AND r.deleted_at IS NULL
                          AND r.reversal_type = 'CANCEL'), 0)::bigint AS cancelled_paise,
              COUNT(*)::bigint AS sale_count,
              COALESCE((SELECT COUNT(*) FROM sale_lines sl JOIN sales so2 ON so2.id = sl.sale_id
                        WHERE so2.sold_at = s.sold_at AND so2.deleted_at IS NULL AND sl.deleted_at IS NULL), 0)::bigint AS units_sold,
              CURRENT_TIMESTAMP AS generated_at
          FROM sales s
          WHERE s.deleted_at IS NULL
          GROUP BY s.sold_at`,
        mv_dashboard_expenses: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_expenses AS
          SELECT
              e.expense_date AS metric_date,
              COALESCE(SUM(e.amount_paise) FILTER (WHERE e.status = 'completed'), 0)::bigint AS total_paise,
              COALESCE(SUM(e.amount_paise) FILTER (WHERE e.status = 'cancelled'), 0)::bigint AS cancelled_paise,
              COUNT(*)::bigint AS expense_count,
              CURRENT_TIMESTAMP AS generated_at
          FROM expenses e
          WHERE e.deleted_at IS NULL
          GROUP BY e.expense_date`,
        mv_dashboard_rentals: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_rentals AS
          SELECT
              ra.start_date AS metric_date,
              COALESCE(SUM(GREATEST(rr.actual_return_date - ra.start_date, 1)::bigint * rl.rent_per_day_paise), 0)::bigint AS earned_paise,
              COALESCE(SUM(rr.overdue_charge_paise), 0)::bigint AS overdue_paise,
              COALESCE(SUM(rr.damage_charge_paise), 0)::bigint AS damage_paise,
              COUNT(rr.id)::bigint AS return_count,
              CURRENT_TIMESTAMP AS generated_at
          FROM rental_agreements ra
          JOIN rental_lines rl ON rl.agreement_id = ra.id AND rl.deleted_at IS NULL
          JOIN rental_returns rr ON rr.rental_line_id = rl.id AND rr.deleted_at IS NULL
          WHERE ra.deleted_at IS NULL
          GROUP BY ra.start_date`,
        mv_inventory_snapshot: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_snapshot AS
          SELECT
              COUNT(u.id)::bigint AS total_units,
              COUNT(u.id) FILTER (WHERE u.channel = 'RETAIL' AND u.status = 'in_stock')::bigint AS retail_in_stock,
              COUNT(u.id) FILTER (WHERE u.channel = 'RETAIL')::bigint AS channel_retail,
              COUNT(u.id) FILTER (WHERE u.channel = 'RENTAL')::bigint AS channel_rental,
              COUNT(u.id) FILTER (WHERE u.status = 'in_stock')::bigint AS status_in_stock,
              COUNT(u.id) FILTER (WHERE u.status = 'sold')::bigint AS status_sold,
              COUNT(u.id) FILTER (WHERE u.status = 'rented')::bigint AS status_rented,
              COUNT(u.id) FILTER (WHERE u.status = 'in_maintenance')::bigint AS status_in_maintenance,
              COUNT(u.id) FILTER (WHERE u.status = 'retired')::bigint AS status_retired,
              COUNT(u.id) FILTER (WHERE u.status = 'lost')::bigint AS status_lost,
              COUNT(u.id) FILTER (WHERE u.status = 'damaged')::bigint AS status_damaged,
              CURRENT_TIMESTAMP AS generated_at
          FROM units u
          WHERE u.deleted_at IS NULL`,
      };
      for (const [name, sql] of Object.entries(matviews)) {
        await db.sequelize.query(`DROP MATERIALIZED VIEW IF EXISTS ${name}`);
        await db.sequelize.query(sql);
      }
      await db.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_dashboard_sales_date ON mv_dashboard_sales (metric_date)');
      await db.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_dashboard_expenses_date ON mv_dashboard_expenses (metric_date)');
      await db.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_dashboard_rentals_date ON mv_dashboard_rentals (metric_date)');

      await seedTestData();
      isInitialized = true;
    }
    return db;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

export async function seedTestData() {
  // Create roles
  const roles = await db.Role.bulkCreate([
    { name: 'ADMIN', description: 'Administrator with full access', isPrivileged: true },
    { name: 'MANAGER', description: 'Manager role', isPrivileged: false },
    { name: 'INVENTORY_MANAGER', description: 'Inventory manager role', isPrivileged: false },
    { name: 'CASHIER', description: 'Cashier role', isPrivileged: false },
    { name: 'ACCOUNTANT', description: 'Accountant role', isPrivileged: false },
  ], { ignoreDuplicates: true });

  // Create permissions
  const permissions = await db.Permission.bulkCreate([
    // User permissions
    { name: 'users.view', description: 'View users' },
    { name: 'users.create', description: 'Create users' },
    { name: 'users.update', description: 'Update users' },
    { name: 'users.delete', description: 'Delete users' },
    { name: 'users.view_pii', description: 'View staff contact details (privileged read scope)' },
    // Inventory permissions
    { name: 'inventory.view', description: 'View inventory' },
    { name: 'inventory.create', description: 'Create inventory items' },
    { name: 'inventory.update', description: 'Update inventory' },
    { name: 'inventory.delete', description: 'Delete inventory' },
    { name: 'inventory.barcode_generate', description: 'Generate barcodes' },
    // Sales permissions
    { name: 'sales.view', description: 'View sales' },
    { name: 'sales.create', description: 'Create sales' },
    { name: 'sales.update', description: 'Update sales' },
    { name: 'sales.cancel', description: 'Cancel sales' },
    { name: 'sales.refund', description: 'Process refunds' },
    // Rental permissions
    { name: 'rentals.view', description: 'View rentals' },
    { name: 'rentals.create', description: 'Create rentals' },
    { name: 'rentals.update', description: 'Update rentals' },
    { name: 'rentals.return', description: 'Process rental returns' },
    { name: 'rentals.cancel', description: 'Cancel rentals' },
    // Expenses permissions
    { name: 'expenses.view', description: 'View expenses' },
    { name: 'expenses.create', description: 'Create expenses' },
    { name: 'expenses.update', description: 'Update expenses' },
    // Reports permissions
    { name: 'reports.view', description: 'View reports' },
    // Role permissions
    { name: 'roles.view', description: 'View roles' },
    { name: 'roles.manage', description: 'Manage roles' },
    // User role assignment
    { name: 'users.assign_role', description: 'Assign and remove user roles' },
    // Picklists permissions
    { name: 'picklists.view', description: 'View picklists' },
    { name: 'picklists.create', description: 'Create picklists' },
    { name: 'picklists.update', description: 'Update picklists' },
    // Customer permissions
    { name: 'customers.view', description: 'View customers' },
    { name: 'customers.create', description: 'Create customers' },
    { name: 'customers.update', description: 'Update customers' },
    { name: 'customers.delete', description: 'Soft delete customers' },
    // Delivery permissions
    { name: 'delivery.view', description: 'View delivery logs' },
    { name: 'delivery.create', description: 'Create delivery logs' },
  ], { ignoreDuplicates: true });

  // Assign permissions to ADMIN role (all permissions)
  const adminRole = roles[0];
  await adminRole.addPermissions(permissions);

  // Assign permissions to MANAGER role
  const managerRole = roles[1];
  const managerPermissions = permissions.filter(p =>
    ['users.view', 'users.update', 'inventory.view', 'inventory.create', 'inventory.update', 'inventory.barcode_generate', 'picklists.view', 'picklists.create', 'picklists.update', 'sales.view', 'sales.create', 'sales.update', 'sales.cancel', 'sales.refund', 'rentals.view', 'rentals.create', 'rentals.update', 'rentals.return', 'rentals.cancel', 'expenses.view', 'expenses.create', 'expenses.update', 'reports.view', 'customers.view', 'customers.create', 'customers.update', 'customers.delete', 'delivery.view', 'delivery.create'].includes(p.name)
  );
  await managerRole.addPermissions(managerPermissions);

  // Assign permissions to INVENTORY_MANAGER role
  const invRole = roles[2];
  const invPermissions = permissions.filter(p =>
    ['inventory.view', 'inventory.create', 'inventory.update', 'inventory.delete', 'inventory.barcode_generate', 'picklists.view', 'picklists.create', 'picklists.update'].includes(p.name)
  );
  await invRole.addPermissions(invPermissions);

  // Assign permissions to CASHIER role
  const cashierRole = roles[3];
  const cashierPermissions = permissions.filter(p =>
    ['inventory.view', 'sales.view', 'sales.create'].includes(p.name)
  );
  await cashierRole.addPermissions(cashierPermissions);

  // Assign permissions to ACCOUNTANT role
  const accountantRole = roles[4];
  const accountantPermissions = permissions.filter(p =>
    ['sales.view', 'expenses.view', 'expenses.create', 'expenses.update', 'reports.view', 'roles.view'].includes(p.name)
  );
  await accountantRole.addPermissions(accountantPermissions);

  return { roles, permissions };
}

export async function cleanupTestDatabase() {
  try {
    // Clean ProductType records first (before other cleanups due to FK dependencies)
    if (db.ProductType) {
      await db.ProductType.destroy({
        where: {
          name: {
            [db.Sequelize.Op.like]: 'TestProductType_%'
          }
        }
      });
    }

    // Clean Colour and Size records
    if (db.Colour) {
      await db.Colour.destroy({
        where: {
          name: {
            [db.Sequelize.Op.like]: 'TEST_%'
          }
        }
      });
    }

    if (db.Size) {
      await db.Size.destroy({
        where: {
          name: {
            [db.Sequelize.Op.like]: 'TEST_%'
          }
        }
      });
    }

    // Clean only test-created data, not auth sessions or core users
    // Note: We do NOT truncate RolePermission because it contains core seeded data
    // that is needed by subsequent tests. Instead, we rely on tests to create and
    // clean up their own test-specific role-permission associations.
    const tablesToClean = ['UserRole'];

    for (const model of tablesToClean) {
      if (db[model]) {
        await db[model].truncate();
      }
    }

    // Clean test-created users (not admin)
    await db.User.destroy({
      where: {
        username: {
          [db.Sequelize.Op.like]: 'testuser_%'
        }
      }
    });

    // Clean test-created roles
    await db.Role.destroy({
      where: {
        name: {
          [db.Sequelize.Op.like]: 'TEST_ROLE_%'
        }
      }
    });

    // Clean test-created permissions
    await db.Permission.destroy({
      where: {
        name: {
          [db.Sequelize.Op.like]: 'test.%'
        }
      }
    });

    // Do NOT truncate AuthSession - allows tokens to persist for multiple tests
    // Do NOT truncate Users with admin accounts
  } catch (error) {
    console.error('Database cleanup failed:', error);
    throw error;
  }
}

export async function closeDatabase() {
  try {
    await db.sequelize.close();
  } catch (error) {
    console.error('Database close failed:', error);
    throw error;
  }
}

/*
 * Date.now() alone collides when two fixtures are built inside the same
 * millisecond, which made any test creating two records in a row fail on a
 * unique-name constraint. The counter makes every generated name unique
 * regardless of clock resolution.
 */
let uniqueCounter = 0;

function uniqueSuffix() {
  uniqueCounter += 1;
  return `${Date.now()}_${uniqueCounter}`;
}

export function generateTestUser(overrides = {}) {
  const suffix = uniqueSuffix();
  return {
    username: `testuser_${suffix}`,
    email: `test_${suffix}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    password: 'TestPassword123!',
    phone: '+1234567890',
    ...overrides,
  };
}

export function generateTestRole(overrides = {}) {
  const suffix = uniqueSuffix();
  return {
    name: `TEST_ROLE_${suffix}`.toUpperCase(),
    description: 'Test role',
    ...overrides,
  };
}

export function generateTestPermission(overrides = {}) {
  const suffix = uniqueSuffix();
  return {
    name: `test.permission.${suffix}`,
    description: 'Test permission',
    ...overrides,
  };
}

export function generateTestProductType(overrides = {}) {
  const suffix = uniqueSuffix();
  return {
    name: `TestProductType_${suffix}`,
    ...overrides,
  };
}

/**
 * Schema V2 fixtures
 * A trip is no longer tied to a single vendor; the vendor is linked through a
 * trip_vendors junction row that carries its own bill (billReference,
 * totalPaidPaise, notes). Tests mocking stock intake must build
 * Vendor -> Trip + TripVendor -> Stock instead of the old StockIntake/Lots.
 */

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Create a Trip plus a TripVendor bill for the given vendor.
 * @param {Object} params
 * @returns {{trip: Object, tripVendor: Object}}
 */
export async function createTripWithVendor({ vendor, name, purchasedOn, billReference, totalPaidPaise, notes } = {}) {
  if (!vendor) {
    throw new Error('createTripWithVendor requires a vendor instance');
  }
  const trip = await db.Trip.create({
    name: name || `TEST_Trip_${uniqueSuffix()}`,
    purchasedOn: purchasedOn || todayStr(),
  });
  const tripVendor = await db.TripVendor.create({
    tripId: trip.id,
    vendorId: vendor.id,
    billReference: billReference || null,
    totalPaidPaise: totalPaidPaise ?? 100000,
    notes: notes || null,
  });
  return { trip, tripVendor };
}

/**
 * Create a Stock for a trip/vendor. The vendor must already be a member of the
 * trip (a trip_vendors row must exist) to mirror createStock's constraint.
 * @param {Object} params
 * @returns {Object} Stock instance
 */
export async function createTestStock({ trip, tripVendor, vendor, productType, overrides = {} } = {}) {
  if (!trip || !tripVendor || !vendor || !productType) {
    throw new Error('createTestStock requires trip, tripVendor, vendor and productType');
  }
  return db.Stock.create({
    tripId: trip.id,
    tripVendorId: tripVendor.id,
    vendorId: vendor.id,
    productTypeId: productType.id,
    quantity: 10,
    buyingPricePaise: 100000,
    sellingPricePaise: 200000,
    floorPricePaise: 150000,
    channel: 'RETAIL',
    rentPerDayPaise: null,
    depositPaise: null,
    overduePerDayPaise: null,
    ...overrides,
  });
}

/**
 * Build a valid customer fixture. Overrides win over defaults so tests can
 * control phone/email collisions easily.
 */
export function generateTestCustomer(overrides = {}) {
  const suffix = uniqueSuffix();
  return {
    name: `TEST_Customer_${suffix}`,
    phone: `+9199${String(suffix).slice(-8).padStart(8, '0')}`,
    email: `cust_${suffix}@example.com`,
    dob: '1990-01-15',
    address: '1 Test Street, Testville',
    notes: 'Created by test setup',
    consentWhatsapp: false,
    consentEmail: false,
    consentSms: false,
    consentWhatsappGroup: false,
    ...overrides,
  };
}
