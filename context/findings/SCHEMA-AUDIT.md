# SCHEMA AUDIT — IMPOC Inventory/POS System

**Date:** 2026-09-04
**Auditor:** Database Architect (opencode)
**Scope:** Full backend models, migrations, services, and associations

---

## 1. Executive Summary

The IMPOC backend is a well-structured, production-grade inventory and POS system built on PostgreSQL with Sequelize ORM. The schema is clean, audit-friendly, and follows strong financial integrity patterns: all monetary rows are append-only, reversal records never mutate originals, and unit state transitions are guarded by a formal state machine with compare-and-swap race prevention.

The system's **current data model largely aligns with the owner's desired hierarchy**, but with one structural blocker and several feature gaps. The critical finding is that `stock_intakes` (shopping trips) carries a **single `vendor_id` FK** — meaning a trip can only involve one vendor. The owner wants multi-vendor trips. The rest of the hierarchy (Trip → Lines → Units, and the full traceability chain from Unit back to Vendor) is already solid. Customer contact data, consent tracking, and receipt delivery infrastructure are entirely absent (expected at this stage). Self-contained monetary snapshots on transaction lines are well-implemented for sales and rentals.

**Overall assessment: 1 structural blocker, 5 medium gaps, 4 nice-to-have gaps, and 2 future-scope items.**

---

## 2. Current Schema — Table-by-Table

### 2.1 Entity-Relationship Diagram (text-based)

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   vendors    │──1:N──│  stock_intakes   │──1:N──│stock_intake_lines│
│              │       │  (shopping trip) │       │     (lot)        │
└──────────────┘       └──────────────────┘       └────────┬─────────┘
                                                           │ 1:N
                                                           ▼
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   product_   │──N:1──│  intake_records  │──1:N──│ intake_templates │
│    types     │       └──────────────────┘       └──────────────────┘
└──────┬───────┘
       │ N:1
       ▼
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   colours    │       │     units        │──1:N──│ unit_status_     │
│              │       │                  │       │    events        │
│   sizes      │──────▶│                  │       └──────────────────┘
└──────────────┘       └───┬──────────┬───┘
                           │          │
                      1:N  │          │  1:N
                           ▼          ▼
               ┌──────────────┐  ┌──────────────┐
               │  sale_lines  │  │rental_lines  │
               └──────┬───────┘  └──────┬───────┘
                      │                 │
                   N:1│              N:1│
                      ▼                 ▼
               ┌──────────────┐  ┌──────────────────┐
               │    sales     │  │ rental_agreements │
               └──────┬───────┘  └──────┬───────────┘
                      │                 │
                   1:N│              1:N│
                      ▼                 ▼
               ┌──────────────┐  ┌──────────────┐
               │sale_reversals│  │rental_returns │
               └──────────────┘  └──────────────┘
                                  ┌──────────────────┐
                                  │ rental_reversals  │
                                  └──────────────────┘
               ┌──────────────┐
               │   expenses   │──1:N──┌──────────────────┐
               └──────────────┘       │expense_reversals  │
                                      └──────────────────┘

  Auth tables: users ↔ roles ↔ permissions (M:N via join tables)
               auth_sessions, request_keys, app_settings
  Catalogues:  colours, sizes, product_types (hierarchical), damage_grades
```

### 2.2 Complete Table Catalogue

| # | Table | Columns | FKs | Constraints |
|---|-------|---------|-----|-------------|
| 1 | **vendors** | id (PK), uuid (unique), name VARCHAR(100) NOT NULL, phone VARCHAR, address TEXT, notes TEXT, is_active BOOLEAN DEFAULT true, deleted_at, created_at, updated_at | — | — |
| 2 | **stock_intakes** | id (PK), uuid (unique), vendor_id → vendors NOT NULL, purchased_on DATEONLY NOT NULL, bill_reference VARCHAR(100), total_paid_paise BIGINT NOT NULL, deleted_at, created_at, updated_at | FK: vendor_id → vendors.id | CHECK total_paid_paise >= 0; UNIQUE (vendor_id, bill_reference) WHERE deleted_at IS NULL |
| 3 | **stock_intake_lines** | id (PK), uuid, stock_intake_id → stock_intakes NULL, product_type_id → product_types NOT NULL, quantity INT NOT NULL, buying_price_paise BIGINT NOT NULL, selling_price_paise BIGINT NOT NULL, floor_price_paise BIGINT NOT NULL, channel VARCHAR(50) NOT NULL, rent_per_day_paise BIGINT, deposit_paise BIGINT, overdue_per_day_paise BIGINT, deleted_at, created_at, updated_at | FK: stock_intake_id → stock_intakes.id ON DELETE SET NULL; FK: product_type_id → product_types.id | CHECK quantity > 0; CHECK all prices >= 0; CHECK floor <= selling; CHECK channel IN ('RETAIL','RENTAL'); UNIQUE (stock_intake_id, uuid) WHERE deleted_at IS NULL |
| 4 | **units** | id (PK), uuid (unique), barcode VARCHAR(12) NOT NULL, stock_intake_line_id → stock_intake_lines NOT NULL, colour_id → colours NOT NULL, size_id → sizes NOT NULL, status VARCHAR(20) DEFAULT 'in_stock', channel VARCHAR(10) NOT NULL, buying_price_paise BIGINT NOT NULL, selling_price_paise BIGINT NOT NULL, floor_price_paise BIGINT NOT NULL, rent_per_day_paise BIGINT, deposit_paise BIGINT, overdue_per_day_paise BIGINT, deleted_at, created_at, updated_at | FK: stock_intake_line_id → stock_intake_lines.id ON DELETE RESTRICT; FK: colour_id → colours.id ON DELETE RESTRICT; FK: size_id → sizes.id ON DELETE RESTRICT | UNIQUE barcode WHERE deleted_at IS NULL; CHECK status IN ('in_stock','sold','damaged','lost','in_maintenance','retired','rented'); CHECK channel IN ('RETAIL','RENTAL'); CHECK barcode 1-12 chars; CHECK all prices >= 0 |
| 5 | **unit_status_events** | id (PK), uuid (unique), unit_id → units NOT NULL, from_status VARCHAR(20), to_status VARCHAR(20) NOT NULL, cause VARCHAR(50) NOT NULL, reason TEXT, actor_user_id INT, occurred_at TIMESTAMP NOT NULL, sale_line_id INT, agreement_id INT, deleted_at, created_at, updated_at | FK: unit_id → units.id | — |
| 6 | **sales** | id (PK), uuid (unique), sale_number VARCHAR(20) unique NOT NULL, customer_name VARCHAR(255), sold_at DATEONLY NOT NULL, total_paise BIGINT NOT NULL, status VARCHAR(20) DEFAULT 'completed', notes TEXT, created_by → users, deleted_at, created_at, updated_at | FK: created_by → users.id ON DELETE SET NULL | CHECK status IN ('completed','cancelled','refunded'); CHECK total_paise >= 0 |
| 7 | **sale_lines** | id (PK), uuid (unique), sale_id → sales NOT NULL, unit_id → units NOT NULL, unit_uuid UUID NOT NULL, barcode VARCHAR(12) NOT NULL, selling_price_paise BIGINT NOT NULL, deleted_at, created_at, updated_at | FK: sale_id → sales.id ON DELETE RESTRICT; FK: unit_id → units.id ON DELETE RESTRICT | CHECK selling_price_paise >= 0 |
| 8 | **sale_reversals** | id (PK), uuid (unique), sale_id → sales NOT NULL, reversal_type VARCHAR(20) NOT NULL, amount_paise BIGINT NOT NULL, reason TEXT, deleted_at, created_at, updated_at | FK: sale_id → sales.id ON DELETE RESTRICT | CHECK reversal_type IN ('CANCEL','REFUND'); CHECK amount_paise >= 0 |
| 9 | **rental_agreements** | id (PK), uuid (unique), agreement_number VARCHAR(20) unique NOT NULL, customer_name VARCHAR(255), start_date DATEONLY NOT NULL, due_date DATEONLY NOT NULL, deposit_refundable_paise BIGINT DEFAULT 0, status VARCHAR(20) DEFAULT 'active', notes TEXT, created_by → users, deleted_at, created_at, updated_at | FK: created_by → users.id ON DELETE SET NULL | CHECK status IN ('active','completed','cancelled'); CHECK deposit_refundable_paise >= 0 |
| 10 | **rental_lines** | id (PK), uuid (unique), agreement_id → rental_agreements NOT NULL, unit_id → units NOT NULL, unit_uuid UUID NOT NULL, barcode VARCHAR(12) NOT NULL, rent_per_day_paise BIGINT NOT NULL, deposit_paise BIGINT NOT NULL, overdue_per_day_paise BIGINT NOT NULL, deleted_at, created_at, updated_at | FK: agreement_id → rental_agreements.id ON DELETE RESTRICT; FK: unit_id → units.id ON DELETE RESTRICT | CHECK all prices >= 0 |
| 11 | **rental_returns** | id (PK), uuid (unique), agreement_id → rental_agreements NOT NULL, rental_line_id → rental_lines NOT NULL, unit_id → units NOT NULL, unit_uuid UUID NOT NULL, actual_return_date DATEONLY NOT NULL, damage_grade_name VARCHAR(100), damage_grade_outcome VARCHAR(30), late_days INT DEFAULT 0, overdue_charge_paise BIGINT DEFAULT 0, damage_charge_paise BIGINT DEFAULT 0, deposit_refunded_paise BIGINT DEFAULT 0, notes TEXT, deleted_at, created_at, updated_at | FK: agreement_id → rental_agreements.id ON DELETE RESTRICT; FK: rental_line_id → rental_lines.id ON DELETE RESTRICT; FK: unit_id → units.id ON DELETE RESTRICT | CHECK damage_grade_outcome IN ('RETURN_TO_STOCK','SEND_TO_MAINTENANCE','RETIRE'); CHECK all amounts >= 0 |
| 12 | **rental_reversals** | id (PK), uuid (unique), agreement_id → rental_agreements NOT NULL, reversal_type VARCHAR(20) NOT NULL, amount_paise BIGINT NOT NULL, reason TEXT, deleted_at, created_at, updated_at | FK: agreement_id → rental_agreements.id ON DELETE RESTRICT | CHECK reversal_type IN ('CANCEL'); CHECK amount_paise >= 0 |
| 13 | **expenses** | id (PK), uuid (unique), amount_paise BIGINT NOT NULL, category VARCHAR(100) NOT NULL, purpose TEXT, expense_date DATEONLY NOT NULL, status VARCHAR(20) DEFAULT 'completed', notes TEXT, created_by → users, deleted_at, created_at, updated_at | FK: created_by → users.id ON DELETE SET NULL | CHECK status IN ('completed','cancelled'); CHECK amount_paise >= 0 |
| 14 | **expense_reversals** | id (PK), uuid (unique), expense_id → expenses NOT NULL, reversal_type VARCHAR(20) NOT NULL, amount_paise BIGINT NOT NULL, reason TEXT, deleted_at, created_at, updated_at | FK: expense_id → expenses.id ON DELETE RESTRICT | CHECK reversal_type IN ('CANCEL'); CHECK amount_paise >= 0 |
| 15 | **product_types** | id (PK), uuid (unique), name VARCHAR(100) NOT NULL, parent_id → product_types (self-ref), is_active BOOLEAN DEFAULT true, deleted_at, created_at, updated_at | FK: parent_id → product_types.id | — |
| 16 | **colours** | id (PK), uuid (unique), name VARCHAR(100) NOT NULL, is_active BOOLEAN, deleted_at, created_at, updated_at | — | — |
| 17 | **sizes** | id (PK), uuid (unique), name VARCHAR(100) NOT NULL, sort_order INT DEFAULT 0, is_active BOOLEAN, deleted_at, created_at, updated_at | — | — |
| 18 | **damage_grades** | id (PK), uuid (unique), name VARCHAR(100) NOT NULL, outcome VARCHAR(30) NOT NULL, is_active BOOLEAN, deleted_at, created_at, updated_at | — | — |
| 19 | **intake_records** | id (PK), uuid (unique), name VARCHAR(200) NOT NULL, purchased_on DATEONLY NOT NULL, vendor_id → vendors (nullable), notes TEXT, status VARCHAR(20) DEFAULT 'active', deleted_at, created_at, updated_at | FK: vendor_id → vendors.id | CHECK status IN ('active','closed') |
| 20 | **intake_templates** | id (PK), uuid (unique), intake_record_id → intake_records NOT NULL, name VARCHAR(200), product_type_id → product_types NOT NULL, buying_price_paise BIGINT NOT NULL, default_quantity INT, default_selling_price_paise BIGINT, default_floor_price_paise BIGINT, deleted_at, created_at, updated_at | FK: intake_record_id → intake_records.id; FK: product_type_id → product_types.id | CHECK buying_price_paise >= 0 |
| 21 | **users** | id (PK), uuid (unique), email, password_hash, name, status, deleted_at, created_at, updated_at | — | — |
| 22 | **roles** | id (PK), uuid (unique), name, deleted_at, created_at, updated_at | — | — |
| 23 | **permissions** | id (PK), uuid (unique), name, description, deleted_at, created_at, updated_at | — | — |
| 24 | **user_roles** | user_id, role_id (M:N join) | FK: user_id → users.id; FK: role_id → roles.id | — |
| 25 | **role_permissions** | role_id, permission_id (M:N join) | FK: role_id → roles.id; FK: permission_id → permissions.id | — |
| 26 | **auth_sessions** | id (PK), uuid, user_id → users, ... | FK: user_id → users.id | — |
| 27 | **request_keys** | id (PK), uuid, gesture_type, request_uuid, result_kind, result_uuid, actor_user_id, deleted_at | — | UNIQUE (gesture_type, request_uuid) WHERE deleted_at IS NULL |
| 28 | **app_settings** | key (PK), value_text, value_int, value_type | — | CHECK value_type IN ('TEXT','INT') |

### 2.3 Key Associations (from index.js)

| Parent | Child | FK | Alias | Notes |
|--------|-------|----|-------|-------|
| Vendor | StockIntake | vendor_id | stockIntakes / vendor | N:1 |
| StockIntake | StockIntakeLine | stock_intake_id | lines / trip | 1:N, ON DELETE SET NULL |
| StockIntakeLine | Unit | stock_intake_line_id | units / lot | 1:N, ON DELETE RESTRICT |
| Unit | Colour | colour_id | colour | N:1 |
| Unit | Size | size_id | size | N:1 |
| Unit | UnitStatusEvent | unit_id | statusEvents / unit | 1:N |
| Sale | SaleLine | sale_id | lines / sale | 1:N |
| SaleLine | Unit | unit_id | unit | N:1 |
| Sale | SaleReversal | sale_id | reversals / sale | 1:N |
| RentalAgreement | RentalLine | agreement_id | lines / agreement | 1:N |
| RentalLine | Unit | unit_id | unit | N:1 |
| RentalAgreement | RentalReturn | agreement_id | returns / agreement | 1:N |
| RentalLine | RentalReturn | rental_line_id | returns / line | 1:N |
| RentalAgreement | RentalReversal | agreement_id | reversals / agreement | 1:N |
| Expense | ExpenseReversal | expense_id | reversals / expense | 1:N |
| IntakeRecord | IntakeTemplate | intake_record_id | templates / intakeRecord | 1:N |
| Vendor | IntakeRecord | vendor_id | intakeRecords / vendor | 1:N |
| IntakeTemplate | ProductType | product_type_id | productType | N:1 |

---

## 3. Gap Analysis

### 3.1 Multi-Vendor Trips

| Aspect | Status | Detail |
|--------|--------|--------|
| **Can a single trip involve multiple vendors?** | **BLOCKER** | `stock_intakes.vendor_id` is a single NOT NULL FK. One trip = one vendor. The owner wants: *"a shopping trip can involve multiple vendors."* |
| **Can you have multiple trips on the same day from different vendors?** | OK | Yes — create separate `stock_intakes` rows per vendor. But this means "one shopping trip" (conceptually) must be split across multiple DB trips. |
| **IntakeRecord** | OK (partially) | `intake_records.vendor_id` is nullable — it can theoretically represent a trip to multiple vendors, but it's a planning/template system, not the executed trip. |

**Severity: CRITICAL / BLOCKING**

The single FK means a real-world shopping trip (the owner went to 3 vendors in one outing) must be modeled as 3 separate `stock_intakes` rows. This works but is semantically wrong — the "trip" abstraction is broken.

**Two migration options:**
1. **Junction table** (`stock_intake_vendors`): introduces M:N between trips and vendors, each `stock_intake_line` gains a `vendor_id` to say which vendor supplied that lot.
2. **Per-line vendor FK**: add `vendor_id` directly to `stock_intake_lines`, remove `vendor_id` from `stock_intakes` (or make it nullable/computed). This is simpler and matches the real model: each lot comes from a specific vendor.

### 3.2 Vendor → Stock → Unit Traceability

| Query | Supported? | FK Chain |
|-------|-----------|----------|
| "Which vendor supplied this unit?" | **YES** | Unit → stock_intake_line (lot) → stock_intake (trip) → vendor |
| "Which trip was this unit bought on?" | **YES** | Unit → stock_intake_line → stock_intake |
| "At what buying price?" | **YES** | Unit.buying_price_paise is snapshotted from lot at scan time (units.service.js:149) |
| "At what selling price was it sold?" | **YES** | sale_line.selling_price_paise is snapshotted at checkout |
| Traceability depth | **2 JOINs** | Unit → StockIntakeLine → StockIntake → Vendor (3 JOINs for full vendor name) |

**Verdict: FULLY SUPPORTED.** The FK chain is solid. The only issue is multi-vendor trips (see 3.1).

### 3.3 Self-Contained Monetary Records

| Record Type | Snapshotted Fields | Can compute total without JOINs? | Original mutated on reversal? |
|-------------|-------------------|----------------------------------|-------------------------------|
| **sale_lines** | selling_price_paise (from unit at checkout) | **YES** — sum of line selling_price_paise | N/A — sale.total_paise is a denormalized sum, never mutated |
| **rental_lines** | rent_per_day_paise, deposit_paise, overdue_per_day_paise (from unit at hand-out) | **YES** — all rental pricing on the line | N/A |
| **rental_returns** | late_days, overdue_charge_paise, damage_charge_paise, deposit_refunded_paise | **YES** — all charges are pre-computed snapshots | N/A |
| **sale_reversals** | amount_paise (snapshot of sale.total_paise at cancel/refund time) | **YES** — amount is on the row | **NO** — originals never mutated (good!) |
| **rental_reversals** | amount_paise | **YES** | **NO** — originals never mutated (good!) |
| **expense_reversals** | amount_paise | **YES** | **NO** — originals never mutated (good!) |
| **expenses** | amount_paise | **YES** | **NO** — status flipped to 'cancelled', amount untouched |
| **stock_intake_lines** | buying_price_paise, selling_price_paise, floor_price_paise | **YES** — all prices on the row | N/A |
| **units** | buying_price_paise, selling_price_paise, floor_price_paise, rent/deposit/overdue | **YES** — full price snapshot | N/A |

**Verdict: EXCELLENT.** All transaction rows are self-contained with snapshotted prices. Reversals are append-only. The only minor note is `sale.total_paise` is a denormalized aggregate — it's never mutated on reversal, which is correct. The pattern is sound.

### 3.4 Customer Data

| Field | On Sale | On RentalAgreement | On Customer table? |
|-------|---------|-------------------|-------------------|
| customer_name | `customer_name VARCHAR(255)` | `customer_name VARCHAR(255)` | **NO** — no customers table exists |
| phone | **MISSING** | **MISSING** | **NO** |
| email | **MISSING** | **MISSING** | **NO** |
| address | **MISSING** | **MISSING** | **NO** |
| customer_id FK | **MISSING** | **MISSING** | **NO** |

**Severity: MEDIUM** (required for receipt delivery, future scope)

Customer data is stored as a free-text `customer_name` string on sales and rental agreements. There is no `customers` table, no phone number, no email, no address, and no reusable customer entity. This means:
- Same customer appears as different text strings across sales/rentals
- No way to send receipts (no phone/email to send to)
- No way to track purchase history across transactions

### 3.5 Receipt Delivery Infrastructure

| Component | Exists? | Detail |
|-----------|---------|--------|
| Customer phone/email | **NO** | No contact fields anywhere |
| delivery_log table | **NO** | Nothing |
| Receipt template data | **NO** | No structured receipt payload |
| WhatsApp integration | **NO** | Nothing |
| Email integration | **NO** | Nothing |
| SMS integration | **NO** | Nothing |

**Severity: FUTURE-SCOPE** (not a blocker today, but requires schema changes)

### 3.6 WhatsApp/Email Consent

| Component | Exists? |
|-----------|---------|
| consent_consent table | **NO** |
| consent fields on customer | **NO** |
| opt-in/opt-out tracking | **NO** |

**Severity: FUTURE-SCOPE**

### 3.7 Inventory Tracking

| Query | Supported? | How |
|-------|-----------|-----|
| "From which trip was this unit bought?" | **YES** | `unit.stock_intake_line_id` → `stock_intake_line.stock_intake_id` |
| "From which vendor?" | **YES** | Chain: unit → lot → trip → vendor |
| "At what buying price?" | **YES** | `unit.buying_price_paise` |
| "How many units from stock X are left?" | **YES** | Count units WHERE stock_intake_line_id = X AND status = 'in_stock' AND deleted_at IS NULL |
| "Which stock is running low?" | **PARTIAL** | Can compute scanned vs lot.quantity, but no automated low-stock alerts or threshold table |
| "Current inventory by product type?" | **YES** | Join units → lots → product_types, filter by status |
| "What's the retail in-stock count?" | **YES** | `Unit.count({ channel: 'RETAIL', status: 'in_stock' })` — already in reports.service.js |

**Verdict: MOSTLY SUPPORTED.** The traceability chain is complete. The gap is only in low-stock alerting (no threshold config, no scheduled check).

### 3.8 Financial Integrity — Reversal Pattern

| Check | Status | Detail |
|-------|--------|--------|
| sale_reversals: amount-only, never mutate original sale | **PASS** | `cancelSale()` creates SaleReversal + flips status only. `sale.total_paise` untouched. (sales.service.js:225-255) |
| rental_reversals: amount-only | **PASS** | `cancelRental()` creates RentalReversal + flips status. deposit_refundable_paise untouched. (rental-agreement.service.js:474-503) |
| expense_reversals: amount-only | **PASS** | `cancelExpense()` creates ExpenseReversal + flips status. expense.amount_paise untouched. (expenses.service.js:131-143) |
| rental_returns: append-only | **PASS** | Returns only add rows, never update. Late days + charges are computed and snapshotted at return time. |
| Unit state machine | **PASS** | Compare-and-swap UPDATE prevents race conditions. State transitions are atomic with status event writes. (units.service.js:283-296) |
| CHECK constraints on all monetary columns | **PASS** | Every `*_paise` column has CHECK >= 0 at DB level |

**Verdict: EXCELLENT.** Financial integrity is a strength of this schema.

---

## 4. Gap Summary Table

| # | Gap | Severity | Current State | Needed State |
|---|-----|----------|---------------|--------------|
| G1 | Multi-vendor trips | **BLOCKING** | stock_intakes has single vendor_id FK | Support 1 trip → N vendors → N lots |
| G2 | No customer entity | MEDIUM | customer_name free text on sales/rentals | customers table with phone, email, address |
| G3 | No receipt delivery | FUTURE-SCOPE | No infrastructure | delivery_log, receipt templates, channel config |
| G4 | No consent tracking | FUTURE-SCOPE | Nothing | consent table with opt-in/opt-out per channel |
| G5 | No low-stock alerts | NICE-TO-HAVE | Manual count queries | threshold config + scheduled alert check |
| G6 | SaleLine missing buying_price_paise | NICE-TO-HAVE | Only selling_price_paise snapshot | Add buying_price_paise for margin calculation |
| G7 | RentalLine missing buying_price_paise | NICE-TO-HAVE | Only rental pricing snapshot | Add for asset valuation reporting |
| G8 | No unit-level notes/description | NICE-TO-HAVE | No text field on units | Optional description or notes for special items |
| G9 | IntakeRecord ↔ StockIntake link | NICE-TO-HAVE | IntakeRecord and StockIntake are completely separate systems | Link them to connect planning → execution |
| G10 | No stock_intake status | MINOR | No status field on stock_intakes | Add 'draft' → 'confirmed' lifecycle |
| G11 | RentalReversal only supports CANCEL | MINOR | CHECK constraint limits to 'CANCEL' only | May need 'REFUND' in future |
| G12 | UnitStatusEvent lacks FK indexes | MINOR | No explicit indexes on sale_line_id, agreement_id | Add indexes for query performance |

---

## 5. Migration Plan

### Phase 1: Multi-Vendor Trips (BLOCKING)

**Approach:** Add `vendor_id` to `stock_intake_lines` (per-line vendor) and make `stock_intakes.vendor_id` nullable. This is the cleanest approach because it matches reality: each lot comes from a specific vendor, and a trip can span multiple vendors.

**Migration 1.1: Add vendor_id to stock_intake_lines**

```js
// 20260905000003-add-vendor-id-to-stock-intake-lines.js
'use strict';

export async function up(queryInterface, Sequelize) {
  // Step 1: Add vendor_id column (nullable initially for backfill)
  await queryInterface.addColumn('stock_intake_lines', 'vendor_id', {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { model: 'vendors', key: 'id' },
    onDelete: 'SET NULL',
  });

  // Step 2: Backfill from parent stock_intake.vendor_id
  await queryInterface.sequelize.query(`
    UPDATE stock_intake_lines sil
    SET vendor_id = si.vendor_id
    FROM stock_intakes si
    WHERE sil.stock_intake_id = si.id
      AND sil.vendor_id IS NULL
  `);

  // Step 3: Make vendor_id NOT NULL after backfill
  await queryInterface.changeColumn('stock_intake_lines', 'vendor_id', {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: { model: 'vendors', key: 'id' },
    onDelete: 'SET NULL',
  });

  // Step 4: Make stock_intakes.vendor_id nullable (trip no longer requires single vendor)
  await queryInterface.changeColumn('stock_intakes', 'vendor_id', {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { model: 'vendors', key: 'id' },
    onDelete: 'SET NULL',
  });

  // Step 5: Add index for vendor-based lot queries
  await queryInterface.addIndex('stock_intake_lines', ['vendor_id'], {
    name: 'idx_stock_intake_lines_vendor_id',
  });
}

export async function down(queryInterface) {
  await queryInterface.removeIndex('stock_intake_lines', 'idx_stock_intake_lines_vendor_id');
  await queryInterface.removeColumn('stock_intake_lines', 'vendor_id');
  await queryInterface.changeColumn('stock_intakes', 'vendor_id', {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: { model: 'vendors', key: 'id' },
  });
}
```

**Service changes needed:**
- `stock-intake-line.service.js`: Accept `vendorUuid` in `createStockIntakeLine()`, resolve to vendor_id, store on line
- `stock-intake.service.js`: `createStockIntake()` — make vendorUuid optional; compute trip-level vendor from lines
- `vendor.service.js`: Update variance computation to support per-line vendor costing
- `reports.service.js`: Update queries to use `stock_intake_line.vendor_id` instead of `stock_intake.vendor_id`

### Phase 2: Customer Entity

**Migration 2.1: Create customers table**

```js
// 20260905000004-create-customers.js
'use strict';

export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('customers', {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), allowNull: false, unique: true },
    name: { type: Sequelize.STRING(255), allowNull: false },
    phone: { type: Sequelize.STRING(20), allowNull: true },
    email: { type: Sequelize.STRING(255), allowNull: true },
    address: { type: Sequelize.TEXT, allowNull: true },
    notes: { type: Sequelize.TEXT, allowNull: true },
    consent_whatsapp: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    consent_email: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    consent_sms: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    consent_whatsapp_group: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    consent_recorded_at: { type: Sequelize.DATE, allowNull: true },
    is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    deleted_at: { type: Sequelize.DATE, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  });

  // Partial unique index on phone (only non-null, non-deleted)
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique
    ON customers (phone) WHERE phone IS NOT NULL AND deleted_at IS NULL
  `);

  // Partial unique index on email
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique
    ON customers (email) WHERE email IS NOT NULL AND deleted_at IS NULL
  `);
}
```

**Migration 2.2: Add customer_id FK to sales and rental_agreements**

```js
// 20260905000005-add-customer-id-to-sales-and-rentals.js
'use strict';

export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('sales', 'customer_id', {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { model: 'customers', key: 'id' },
    onDelete: 'SET NULL',
  });

  await queryInterface.addColumn('rental_agreements', 'customer_id', {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { model: 'customers', key: 'id' },
    onDelete: 'SET NULL',
  });

  // Indexes
  await queryInterface.addIndex('sales', ['customer_id'], { name: 'idx_sales_customer_id' });
  await queryInterface.addIndex('rental_agreements', ['customer_id'], { name: 'idx_rental_agreements_customer_id' });
}

export async function down(queryInterface) {
  await queryInterface.removeIndex('sales', 'idx_sales_customer_id');
  await queryInterface.removeIndex('rental_agreements', 'idx_rental_agreements_customer_id');
  await queryInterface.removeColumn('sales', 'customer_id');
  await queryInterface.removeColumn('rental_agreements', 'customer_id');
}
```

### Phase 3: SaleLine Enrichment (Nice-to-Have)

**Migration 3.1: Add buying_price_paise to sale_lines and rental_lines**

```js
// 20260905000006-add-buying-price-to-transaction-lines.js
'use strict';

export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('sale_lines', 'buying_price_paise', {
    type: Sequelize.BIGINT,
    allowNull: true, // nullable for backward compat with existing rows
  });

  await queryInterface.addColumn('rental_lines', 'buying_price_paise', {
    type: Sequelize.BIGINT,
    allowNull: true,
  });

  // Backfill from unit's buying_price_paise
  await queryInterface.sequelize.query(`
    UPDATE sale_lines sl
    SET buying_price_paise = u.buying_price_paise
    FROM units u
    WHERE sl.unit_id = u.id AND sl.buying_price_paise IS NULL
  `);

  await queryInterface.sequelize.query(`
    UPDATE rental_lines rl
    SET buying_price_paise = u.buying_price_paise
    FROM units u
    WHERE rl.unit_id = u.id AND rl.buying_price_paise IS NULL
  `);
}

export async function down(queryInterface) {
  await queryInterface.removeColumn('sale_lines', 'buying_price_paise');
  await queryInterface.removeColumn('rental_lines', 'buying_price_paise');
}
```

### Phase 4: Receipt Delivery Infrastructure (Future-Scope)

**Migration 4.1: Create delivery_log table**

```js
// 20260905000007-create-delivery-log.js
'use strict';

export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('delivery_logs', {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), allowNull: false, unique: true },

    // Polymorphic: which transaction triggered this receipt
    entity_type: { type: Sequelize.STRING(30), allowNull: false }, // 'SALE' or 'RENTAL'
    entity_id: { type: Sequelize.INTEGER, allowNull: false },
    entity_uuid: { type: Sequelize.UUID, allowNull: false },

    // Customer & delivery target
    customer_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'customers', key: 'id' }, onDelete: 'SET NULL' },
    channel: { type: Sequelize.STRING(20), allowNull: false }, // 'WHATSAPP', 'EMAIL', 'SMS'

    // Delivery state
    status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' }, // pending, sent, delivered, failed
    sent_at: { type: Sequelize.DATE, allowNull: true },
    delivered_at: { type: Sequelize.DATE, allowNull: true },
    error_message: { type: Sequelize.TEXT, allowNull: true },

    // Receipt payload (JSON for template rendering)
    receipt_payload: { type: Sequelize.JSONB, allowNull: false },

    // External provider tracking
    provider_message_id: { type: Sequelize.STRING(255), allowNull: true },
    provider_response: { type: Sequelize.JSONB, allowNull: true },

    deleted_at: { type: Sequelize.DATE, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  });

  await queryInterface.addIndex('delivery_logs', ['entity_type', 'entity_id'], { name: 'idx_delivery_logs_entity' });
  await queryInterface.addIndex('delivery_logs', ['customer_id'], { name: 'idx_delivery_logs_customer' });
  await queryInterface.addIndex('delivery_logs', ['status'], { name: 'idx_delivery_logs_status' });

  await queryInterface.sequelize.query(`
    ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_entity_type_check
    CHECK (entity_type IN ('SALE', 'RENTAL'))
  `);
  await queryInterface.sequelize.query(`
    ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_channel_check
    CHECK (channel IN ('WHATSAPP', 'EMAIL', 'SMS'))
  `);
  await queryInterface.sequelize.query(`
    ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_status_check
    CHECK (status IN ('pending', 'sent', 'delivered', 'failed'))
  `);
}

export async function down(queryInterface) {
  await queryInterface.dropTable('delivery_logs');
}
```

---

## 6. Future-Scope Design: Receipt Delivery & Consent

### 6.1 Customer Table with Consent

The `customers` table (Phase 2) includes consent fields directly:

```
customers
├── id, uuid
├── name, phone, email, address
├── consent_whatsapp BOOLEAN DEFAULT false
├── consent_email BOOLEAN DEFAULT false
├── consent_sms BOOLEAN DEFAULT false
├── consent_whatsapp_group BOOLEAN DEFAULT false  ← for offers/promotions
├── consent_recorded_at TIMESTAMP  ← when consent was last updated
├── is_active, notes
└── timestamps
```

**Rationale:** Consent is stored on the customer (not a separate table) because:
- A customer has one consent state per channel
- It's simpler to query and maintain
- The `consent_recorded_at` timestamp provides audit trail

For detailed consent history (if needed later), a `consent_history` table can be added:
```
consent_history
├── customer_id → customers
├── channel (WHATSAPP/EMAIL/SMS)
├── consented (BOOLEAN)
├── recorded_at TIMESTAMP
└── recorded_by_user_id → users
```

### 6.2 Delivery Log Structure

The `delivery_logs` table stores each receipt delivery attempt:

```
delivery_logs
├── id, uuid
├── entity_type + entity_id  ← polymorphic: which sale/rental
├── customer_id → customers
├── channel (WHATSAPP/EMAIL/SMS)
├── status (pending → sent → delivered | failed)
├── receipt_payload JSONB  ← pre-rendered receipt data
├── provider_message_id  ← WhatsApp/SMS provider tracking
├── timestamps
```

### 6.3 Receipt Payload Structure

The `receipt_payload` JSONB column should contain all data needed for template rendering without any additional DB queries:

```jsonc
{
  "transaction": {
    "type": "SALE",          // or "RENTAL"
    "number": "S-0042",
    "date": "2026-09-04",
    "status": "completed",
    "totalPaise": "450000",
    "notes": null
  },
  "customer": {
    "name": "Rajesh Kumar",
    "phone": "+919876543210",
    "email": "rajesh@example.com"
  },
  "shop": {
    "name": "IMPOC Store",
    "address": "123 Main St",
    "phone": "+911122334455"
  },
  "lines": [
    {
      "barcode": "ABC12345",
      "productName": "Shirt > Cotton",
      "colour": "Blue",
      "size": "L",
      "sellingPricePaise": "150000"
    }
  ],
  "totals": {
    "totalPaise": "450000",
    "itemsCount": 3
  }
}
```

### 6.4 Service Layer for Receipt Delivery

New service files needed:
- `backend/src/modules/delivery/delivery.service.js` — orchestrate sending receipts
- `backend/src/modules/delivery/delivery.validation.js` — validate delivery requests
- `backend/src/modules/delivery/delivery.routes.js` — API endpoints
- `backend/src/modules/delivery/templates/` — receipt templates per channel

**New API endpoints:**
- `POST /api/delivery/receipt` — send receipt for a sale or rental
- `GET /api/delivery/log` — list delivery attempts
- `PATCH /api/delivery/log/:uuid/retry` — retry failed delivery
- `PUT /api/customers/:uuid/consent` — update customer consent

---

## 7. Implementation Priority

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| **P0** | Phase 1: Multi-vendor trips | 1 day | Unblocks owner's core workflow |
| **P1** | Phase 2: Customer entity | 1-2 days | Enables receipt delivery & purchase history |
| **P2** | Phase 3: SaleLine enrichment | 0.5 day | Enables margin reporting |
| **P3** | Phase 4: Receipt delivery | 2-3 days | Customer-facing feature |
| **P4** | Low-stock alerts | 0.5 day | Operational convenience |
| **P5** | Consent history audit trail | 0.5 day | Compliance (if needed) |

---

## 8. Backward Compatibility Notes

- **Phase 1 (multi-vendor):** The vendor_id backfill runs BEFORE making stock_intakes.vendor_id nullable. All existing lots get their parent trip's vendor. Zero data loss.
- **Phase 2 (customers):** Both `customer_id` columns are nullable. Existing sales/rentals with `customer_name` continue working. Migration script can optionally match existing `customer_name` values to newly created customers.
- **Phase 3 (buying_price_paise):** Columns are nullable, backfilled from units. Existing transaction lines show null for historical data (acceptable since they're pre-existing).
- **Phase 4 (delivery_log):** Pure additive — new table, no changes to existing tables.

---

*End of SCHEMA-AUDIT.md*
