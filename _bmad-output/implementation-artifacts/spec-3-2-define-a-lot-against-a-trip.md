---
title: 'Story 3.2: Define a lot against a trip'
type: 'feature'
created: '2026-08-26'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inventory managers cannot define lots (product bundles with pricing) against a buying trip; without lots, staff cannot scan units into stock or associate pricing snapshots. A lot is the template for unit intake.

**Approach:** Build a `stock_intake_lines` table capturing product type, quantity, and complete pricing tier (buying, selling, floor prices) with optional rental terms. Create Sequelize model, service layer CRUD operations, and REST API endpoints for creating and updating lots. Pricing constraints are validated at insertion: floor price ≤ selling price, and for rental lots, overdue-per-day > rent-per-day. Lots are mutable — edits do not affect already-scanned units (which carry immutable pricing snapshots).

## Boundaries & Constraints

**Always:**
- API exposes `uuid` only; integer `id` never leaves the process (AD-1)
- All money is stored as `BIGINT` paise with `_paise` suffix and a named `CHECK (... >= 0)` constraint (AD-2). API responses return paise values as **strings** (not Number or float) to preserve precision beyond 2^53–1
- Rental lots require `overdue_per_day_paise > 0` (named CHECK constraint) because read-side divides by it (AD-2). For RETAIL channel, all rental fields must be null or omitted; for RENTAL channel, all three must be provided with overdue > rent
- `stock_intake_lines` table is mutable master data (AD-5 tier 3): ordinary UPDATE and soft-delete via `deleted_at` (AD-4)
- Every table carries `id`, `uuid`, `created_at`, `updated_at`, `deleted_at` columns (AD-4)
- Sequelize model registers `paranoid: true` with `deletedAt: 'deleted_at'` (AD-4)
- Foreign key on `stock_intake_id` uses `onDelete: 'SET NULL'` to preserve soft-deleted line recovery paths; parent trip deletion does NOT cascade-delete its lines
- Channel is `RETAIL` or `RENTAL` via named CHECK constraint, mirrored in `channel.js` constant (AD-3, Epic 3 spec)
- Pricing snapshot invariant (AD-24 tier 1): Lot edits do NOT re-sync already-scanned units; unit copies lot's prices at scan time only. Service layer enforces atomicity: lot insert or update completes, then scan resyncs if needed, but no retroactive resync.
- POST and PATCH require `authorize(PERMISSIONS.INVENTORY.CREATE)` and `authorize(PERMISSIONS.INVENTORY.UPDATE)` respectively (per Epic 3 spec). All lot operations (POST, GET, PATCH) require verification that the user has access to the specific trip's inventory
- GET routes require `authenticate` only
- Error objects attach `statusCode` property for HTTP middleware mapping
- **Concurrency & Transaction Isolation:** Service layer uses `READ_COMMITTED` isolation level (Sequelize default). ProductType active status validation happens inside the transaction to prevent deactivation between check and insert. Variance computation is best-effort and may briefly diverge from actual line sums during concurrent soft-deletes, but converges on next read
- Partial unique index on `(stock_intake_id, uuid) WHERE deleted_at IS NULL` ensures uniqueness within a trip for non-deleted lines only. Global `uuid` uniqueness constraint is NOT enforced to allow restoration of soft-deleted lines

**Ask First:**
- None — all requirements are settled in epic context and the story's acceptance criteria.

**Never:**
- Accept pricing tiers that fail constraint checks (floor > selling, or for rental: overdue-per-day ≤ rent-per-day)
- Allow a lot's quantity to be set to 0 or negative
- Accept rental fields (rent_per_day_paise, deposit_paise, overdue_per_day_paise) on RETAIL channel, or reject them on RENTAL channel
- Hard-delete lots; always use soft-delete via `deleted_at`
- Accept or return internal `id` in API responses or requests
- Retroactively resync a scanned unit's prices if its lot is edited (snapshot is immutable)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create lot, RETAIL channel, all fields | `{ tripUuid: "abc-...", productTypeUuid: "...", quantity: 10, buyingPricePaise: 1000, sellingPricePaise: 2000, floorPricePaise: 1500, channel: "RETAIL" }` | 201 with lot `{ uuid, tripUuid, productTypeUuid, quantity, buyingPricePaise, sellingPricePaise, floorPricePaise, channel, rentPerDayPaise: null, depositPaise: null, overduePerDayPaise: null, createdAt, updatedAt }` | N/A |
| Create lot, RENTAL channel, with rental terms | `{ tripUuid: "...", productTypeUuid: "...", quantity: 5, buyingPricePaise: 5000, sellingPricePaise: 10000, floorPricePaise: 8000, channel: "RENTAL", rentPerDayPaise: 500, depositPaise: 3000, overduePerDayPaise: 1000 }` | 201 with lot including rental fields; all paise values as specified | N/A |
| Create lot, floor price > selling price | `{ tripUuid: "...", productTypeUuid: "...", quantity: 10, buyingPricePaise: 1000, sellingPricePaise: 2000, floorPricePaise: 2500, channel: "RETAIL" }` | 400 validation error "Floor price cannot exceed selling price" | Service validates and rejects before INSERT |
| Create lot, RENTAL with overdue ≤ rent | `{ tripUuid: "...", productTypeUuid: "...", quantity: 5, buyingPricePaise: 5000, sellingPricePaise: 10000, floorPricePaise: 8000, channel: "RENTAL", rentPerDayPaise: 500, depositPaise: 3000, overduePerDayPaise: 500 }` | 400 validation error "Overdue per day must be greater than rent per day" | Zod schema rejects |
| Create lot, RETAIL channel with rental fields | `{ tripUuid: "...", productTypeUuid: "...", quantity: 10, buyingPricePaise: 1000, sellingPricePaise: 2000, floorPricePaise: 1500, channel: "RETAIL", rentPerDayPaise: 500 }` | 400 validation error "Rental fields are not allowed for RETAIL channel" | Zod schema rejects |
| Create lot, zero quantity | `{ tripUuid: "...", productTypeUuid: "...", quantity: 0, buyingPricePaise: 1000, sellingPricePaise: 2000, floorPricePaise: 1500, channel: "RETAIL" }` | 400 validation error "Quantity must be at least 1" | Zod schema rejects |
| Create lot, nonexistent trip | `{ tripUuid: "invalid-uuid", productTypeUuid: "...", quantity: 10, buyingPricePaise: 1000, sellingPricePaise: 2000, floorPricePaise: 1500, channel: "RETAIL" }` | 404 error "Trip not found" | Service throws 404 before INSERT |
| Create lot, nonexistent product type | `{ tripUuid: "...", productTypeUuid: "invalid-uuid", quantity: 10, buyingPricePaise: 1000, sellingPricePaise: 2000, floorPricePaise: 1500, channel: "RETAIL" }` | 404 error "Product type not found" | Service throws 404 before INSERT |
| Create lot, inactive product type | `{ tripUuid: "...", productTypeUuid: "uuid-of-inactive", quantity: 10, buyingPricePaise: 1000, sellingPricePaise: 2000, floorPricePaise: 1500, channel: "RETAIL" }` | 400 error "Product type is inactive" | Service validates and rejects |
| Edit lot, quantity increase | PATCH `{ quantity: 20 }` to existing lot with quantity 10, zero scans | 200 with updated lot; `quantity: 20` | N/A |
| Edit lot, price changes | PATCH `{ sellingPricePaise: 2500 }` to existing lot; trip variance recomputed | 200 with lot; trip's `variancePaise` reflects new price on next GET `/api/stock-intakes/:tripUuid` | N/A |
| Edit lot, scanned units unaffected | After 3 units scanned into lot, PATCH lot's `buyingPricePaise`; GET each unit | Each unit's `buyingPricePaise` unchanged from scan time; lot's `buyingPricePaise` reflects edit | N/A |
| List lots by trip | GET `/api/stock-intakes/:tripUuid/lines` | 200 with array of all non-deleted lots for that trip, ordered by `createdAt` ASC | N/A |
| Get lot by UUID | GET `/api/stock-intakes/:tripUuid/lines/:lotUuid` | 200 with single lot object | N/A |
| Get lot by UUID, not found | GET `/api/stock-intakes/:tripUuid/lines/:invalid-uuid` | 404 error "Lot not found" | Service throws 404 |
| Authentication missing | POST without Authorization header | 401 Unauthorized | Middleware rejects |
| Authorization insufficient | POST with role lacking `PERMISSIONS.INVENTORY.CREATE` | 403 Forbidden | Middleware rejects |

</frozen-after-approval>

## Code Map

- `backend/database/migrations/20260828000000-create-stock-intake-lines.js` -- Migration creating `stock_intake_lines` table with columns: id (SERIAL PK), uuid (unique via gen_random_uuid), stock_intake_id (INTEGER NOT NULL REFERENCES stock_intakes(id) ON DELETE CASCADE), product_type_id (INTEGER NOT NULL REFERENCES product_types(id)), quantity (INTEGER NOT NULL with CHECK > 0), buying_price_paise (BIGINT NOT NULL with CHECK >= 0), selling_price_paise (BIGINT NOT NULL with CHECK >= 0), floor_price_paise (BIGINT NOT NULL with CHECK >= 0 and CHECK <= selling_price_paise), channel (VARCHAR NOT NULL with named CHECK restricting to 'RETAIL' or 'RENTAL'), rent_per_day_paise (BIGINT nullable with CHECK >= 0), deposit_paise (BIGINT nullable with CHECK >= 0), overdue_per_day_paise (BIGINT nullable with named CHECK > 0 for read-side division), deleted_at (TIMESTAMPTZ nullable), created_at (CURRENT_TIMESTAMP), updated_at (CURRENT_TIMESTAMP); add partial unique index on (stock_intake_id, uuid) WHERE deleted_at IS NULL

- `backend/database/models/StockIntakeLine.js` -- Sequelize model with pattern from StockIntake.js: id (INTEGER PK), uuid (UUID unique), stockIntakeId (INTEGER FK to stock_intakes), productTypeId (INTEGER FK to product_types), quantity (INTEGER), buyingPricePaise (BIGINT), sellingPricePaise (BIGINT), floorPricePaise (BIGINT), channel (VARCHAR), rentPerDayPaise (BIGINT nullable), depositPaise (BIGINT nullable), overduePerDayPaise (BIGINT nullable), deletedAt (TIMESTAMPTZ nullable), createdAt (TIMESTAMPTZ), updatedAt (TIMESTAMPTZ); tableName='stock_intake_lines', paranoid: true, underscored: true, timestamps: true; hasMany and belongsTo associations for StockIntake and ProductType

- `backend/database/models/index.js` -- Add StockIntakeLine model instantiation and associations; `StockIntake.hasMany(StockIntakeLine, { foreignKey: 'stock_intake_id', as: 'lines' })` and `StockIntakeLine.belongsTo(StockIntake, { foreignKey: 'stock_intake_id', as: 'trip' })` and `StockIntakeLine.belongsTo(ProductType, { foreignKey: 'product_type_id', as: 'productType' })`

- `backend/src/modules/intake/stock-intake-line.validation.js` -- Zod schemas: `createStockIntakeLineSchema` with tripUuid (required UUID), productTypeUuid (required UUID), quantity (required integer >= 1), buyingPricePaise (required integer >= 0), sellingPricePaise (required integer >= 0), floorPricePaise (required integer >= 0), channel (required enum: "RETAIL" | "RENTAL"), rentPerDayPaise (required for RENTAL, forbidden for RETAIL, integer >= 0), depositPaise (required for RENTAL, forbidden for RETAIL, integer >= 0), overduePerDayPaise (required for RENTAL, forbidden for RETAIL, integer > 0); discriminated union or refine() to enforce channel-specific fields; constraint: floorPricePaise <= sellingPricePaise, overduePerDayPaise > rentPerDayPaise (for RENTAL); `stockIntakeLineUuidParamSchema` and `updateStockIntakeLineSchema` for PATCH operations (all fields optional, same constraints apply)

- `backend/src/modules/intake/stock-intake-line.service.js` -- Service layer: `createStockIntakeLine({ tripUuid, productTypeUuid, quantity, buyingPricePaise, sellingPricePaise, floorPricePaise, channel, rentPerDayPaise, depositPaise, overduePerDayPaise })` resolving UUIDs to StockIntake and ProductType, rejecting nonexistent (404) or inactive ProductType (400), validating channel and pricing constraints, opening transaction, inserting row; `getStockIntakeLines(tripUuid)` returning all non-deleted lots for a trip ordered by createdAt ASC; `getStockIntakeLineByUuid(tripUuid, lotUuid)` returning single lot or 404; `updateStockIntakeLine(tripUuid, lotUuid, updates)` validating updates (same constraints), opening transaction, updating row; all methods attach statusCode to errors

- `backend/src/modules/intake/stock-intake-line.controller.js` -- Controller: `mapStockIntakeLineDTO(lot)` returning {uuid, tripUuid, productTypeUuid, quantity, buyingPricePaise, sellingPricePaise, floorPricePaise, channel, rentPerDayPaise, depositPaise, overduePerDayPaise, createdAt, updatedAt}; `createStockIntakeLine()` validating body with createStockIntakeLineSchema, calling service, mapping DTO, returning 201; `getStockIntakeLines()` validating tripUuid regex, calling service, mapping each DTO, returning 200; `getStockIntakeLineByUuid()` validating UUIDs, calling service, mapping DTO, returning 200; `updateStockIntakeLine()` validating UUIDs and body with updateStockIntakeLineSchema, calling service, mapping DTO, returning 200; all methods use try/catch with next(error)

- `backend/src/modules/intake/stock-intake-line.routes.js` -- Route registration: POST `/stock-intakes/:tripUuid/lines` (authenticate + authorize PERMISSIONS.INVENTORY.CREATE, calls createStockIntakeLine), GET `/stock-intakes/:tripUuid/lines` (authenticate only, calls getStockIntakeLines), GET `/stock-intakes/:tripUuid/lines/:uuid` (authenticate only, calls getStockIntakeLineByUuid), PATCH `/stock-intakes/:tripUuid/lines/:uuid` (authenticate + authorize PERMISSIONS.INVENTORY.UPDATE, calls updateStockIntakeLine); export router

- `backend/app.js` -- Add import `import intakeLineRoutes from './src/modules/intake/stock-intake-line.routes.js';` and registration `app.use('/api/stock-intakes/:tripUuid/lines', intakeLineRoutes);` after stock-intake route registration (or integrate into existing intake router with sub-routes)

- `backend/src/constants/channel.js` -- Define constant `export const CHANNEL = { RETAIL: 'RETAIL', RENTAL: 'RENTAL' };` if not already present; use in Zod enum validation and database CHECK constraint

- `backend/tests/intake/stock-intake-lines.test.js` -- Integration test file following stock-intakes.test.js pattern: beforeAll/afterAll setup; cover: create lot RETAIL (all fields), create lot RENTAL (with rental terms), pricing constraint rejections (floor > selling, overdue ≤ rent), channel-specific field rejections, quantity validation, nonexistent/inactive product type rejects, list lots by trip, get one by UUID, get nonexistent lot UUID returns 404, edit lot (quantity, prices), verify unit pricing snapshots unaffected by lot edits (integration with Story 3.3), authentication/authorization checks

## Tasks & Acceptance

**Execution:**
- [x] `backend/database/migrations/20260828000000-create-stock-intake-lines.js` -- Create migration with `stock_intake_id` (INTEGER NOT NULL REFERENCES stock_intakes(id) ON DELETE CASCADE), `product_type_id` (INTEGER NOT NULL REFERENCES product_types(id)), `quantity` (INTEGER NOT NULL with CHECK > 0), pricing columns (BIGINT with CHECK >= 0, floor CHECK <= selling), `channel` (VARCHAR with named CHECK), rental columns (nullable with zero-check on overdue), soft-delete columns -- Establishes stock_intake_lines table as mutable master data
- [x] `backend/database/models/StockIntakeLine.js` -- Define Sequelize model with all columns, associations to StockIntake and ProductType, paranoid soft-delete -- Completes schema binding for stock_intake_lines
- [x] `backend/database/models/index.js` -- Import StockIntakeLine, instantiate, wire associations (hasMany, belongsTo) -- Integrates StockIntakeLine into app DI
- [x] `backend/src/modules/intake/stock-intake-line.validation.js` -- Define createStockIntakeLineSchema and updateStockIntakeLineSchema with discriminated union or refine for channel-specific fields, pricing constraints -- Validates lot request bodies
- [x] `backend/src/modules/intake/stock-intake-line.service.js` -- Implement CRUD: create (UUID resolution, inactive check, constraint validation, transaction), list by trip, get by UUID, update (same constraints); all error handling -- Central business logic for lots
- [x] `backend/src/modules/intake/stock-intake-line.controller.js` -- Define DTO mapping and HTTP handlers for CRUD, all try/catch with error forwarding -- HTTP request handling
- [x] `backend/src/modules/intake/stock-intake-line.routes.js` -- Define routes with auth/authz guards for POST/PATCH -- Express routing for lots
- [x] `backend/app.js` -- Add import and registration of lot routes under `/api/stock-intakes/:tripUuid/lines` -- Registers lot routes with main app
- [x] `backend/src/constants/channel.js` -- Define CHANNEL constant if missing -- Reused by validation and database
- [x] `backend/tests/intake/stock-intake-lines.test.js` -- Write integration tests covering all I/O scenarios, validation errors, auth checks, unit snapshot immutability (integration with 3.3) -- Validates acceptance criteria

**Acceptance Criteria:**
- Given the database is initialized with the migration, when StockIntakeLine model loads, then `stock_intake_lines` table exists with all required columns, `stock_intake_id` NOT NULL FK with CASCADE delete, `quantity` INTEGER with CHECK > 0, pricing BIGINT with CHECK >= 0, named floor <= selling CHECK, `channel` VARCHAR with named CHECK, rental columns nullable with overdue CHECK > 0
- Given the app is running with a valid trip and active product type, when a staff member with `PERMISSIONS.INVENTORY.CREATE` POSTs to `/api/stock-intakes/:tripUuid/lines` with valid RETAIL lot JSON, then the API returns 201 with response including all lot fields, UUIDs only, no internal id
- Given a lot with floor_price_paise > selling_price_paise is submitted, when the POST is executed, then the API returns 400 with error naming the constraint violation
- Given a RENTAL lot with overdue_per_day_paise ≤ rent_per_day_paise, when the POST is executed, then the API returns 400 with error naming the constraint
- Given a RENTAL lot is created and units are scanned into it at time T1 with snapshot prices, when the lot's buyingPricePaise is edited at time T2, then each scanned unit retains its T1 price snapshot and is not re-synced (verified in integration with Story 3.3)
- Given a trip has multiple lots, when GET `/api/stock-intakes/:tripUuid/lines` is called, then the API returns 200 with array of all non-deleted lots ordered by createdAt ASC
- Given a lot is edited (e.g., quantity or price change), when the associated trip is fetched with GET `/api/stock-intakes/:tripUuid`, then `variancePaise` reflects the new lot pricing on the next read
- Given the app is running, when an unauthenticated request is sent to POST `/api/stock-intakes/:tripUuid/lines`, then it returns 401 Unauthorized
- Given a staff member with role lacking `PERMISSIONS.INVENTORY.UPDATE` sends a PATCH to `/api/stock-intakes/:tripUuid/lines/:lotUuid`, then it returns 403 Forbidden

## Design Notes

**Pricing Constraints and Rental Logic:**
The pricing tiers follow a hierarchy: buying ≤ floor ≤ selling (no explicit lower bound on buying). Rental lots add a time-based tier: rent-per-day must be less than overdue-per-day because the read-side divides overdue-per-day to cap rental periods — overdue-per-day ≤ 0 would cause division errors or infinite caps, hence the CHECK (> 0) on the column and the rejection of overdue ≤ rent in validation.

**Channel and Rental Terms:**
RETAIL and RENTAL are mutually exclusive channels (named CHECK constraint). RETAIL lots ignore rental fields; RENTAL lots require all three rental fields (rent_per_day_paise, deposit_paise, overdue_per_day_paise). Use Zod's `.refine()` or discriminated union to enforce this at the HTTP boundary.

**Lot Immutability for Scanned Units:**
When a unit is scanned into a lot (Story 3.3), it copies the lot's prices at that instant into its own columns (`unit.buying_price_paise`, etc.) and never re-syncs. Lot edits do not retroactively change a unit's snapshot. This is enforced by not loading or calling any "resync" logic after a unit is inserted — the insert is atomic and complete.

**Variance Recalculation:**
Trip variance (totalPaidPaise - Σ(lot.quantity × lot.buyingPrice)) is recalculated on every GET `/api/stock-intakes/:tripUuid`. When a lot is edited, the next trip fetch shows the new variance without any explicit resync — it is computed on read.

## Spec Change Log

### Review Loop 1 (2026-08-27)
- **Triggering findings:** Race condition in soft-deleted lines variance computation, CASCADE delete conflicts with soft-delete pattern, BIGINT lossy conversion, concurrent inactive product type validation window, missing trip-level authorization, partial unique index design flaw
- **Amended:** 
  - Added **Concurrency & Transaction Isolation** section to specify READ_COMMITTED isolation for variance computations and product type validation
  - Clarified **Cascade Delete Strategy**: Changed FK onDelete from CASCADE to SET NULL to preserve soft-delete recovery paths
  - Amended **API Response Format**: Specify paise values returned as strings (not Number) to preserve BIGINT precision
  - Added **Trip-Level Authorization** requirement to controller: all lot operations must verify user has access to the specific trip
  - Redesigned **Unique Constraint Strategy**: Removed global uuid unique constraint, rely only on partial index (stock_intake_id, uuid) WHERE deleted_at IS NULL
  - Added **ProductType Validation** inside transaction to prevent deactivation race condition
- **Known-bad state avoided:** Stale variance due to concurrent soft-deletes, truncated paise values for large prices, cascade hard-deletes breaking soft-delete recovery, orphaned lots on vendor/product type deactivation, authorization bypass on trip-scoped operations, inability to restore soft-deleted lines
- **KEEP:** Soft-delete pattern via paranoid mode, pricing constraint hierarchy (floor ≤ selling), channel exclusivity (RETAIL vs RENTAL), pricing snapshot immutability for scanned units, variance recalculation on read (not stored)

## Verification

**Commands:**
- `npm test -- backend/tests/intake/stock-intake-lines.test.js` -- expected: all tests pass, no pricing constraint escapes, no channel field leaks, unit snapshots verified unchanged

**Manual checks (if no CLI):**
- Inspect database with `SELECT * FROM stock_intake_lines WHERE id = <test-lot-id>` — confirm all columns exist, constraints applied, channel is RETAIL or RENTAL
- Call POST `/api/stock-intakes/<trip-uuid>/lines` with floor > selling — confirm 400 response
- Call POST `/api/stock-intakes/<trip-uuid>/lines` with RETAIL channel and rentPerDayPaise — confirm 400 response
- Create a RENTAL lot, scan a unit (Story 3.3 integration), edit lot's buyingPricePaise, fetch unit — confirm unit price is unchanged

