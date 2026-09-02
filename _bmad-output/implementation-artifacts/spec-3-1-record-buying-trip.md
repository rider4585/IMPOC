---
title: 'Story 3.1: Record a buying trip'
type: 'feature'
created: '2026-08-26'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inventory managers cannot record the real-world buying trips that serve as the backbone of lot definition and unit intake; without a buying trip, no lot can be created, and every unit's chain of custody is broken.

**Approach:** Build a `stock_intakes` table that captures vendor, purchase date, bill reference, and total paid, along with Sequelize model, service layer CRUD operations, and REST API endpoints for listing, creating, and fetching trips. A GET endpoint computes trip variance (total paid vs. sum of lot costs) on every read without storing it. The service rejects trips against inactive vendors, completing the validation Epic 2 explicitly deferred.

## Boundaries & Constraints

**Always:**
- API exposes `uuid` only; integer `id` never leaves the process (AD-1)
- All money is stored as `BIGINT` paise with `_paise` suffix and a named `CHECK (... >= 0)` constraint (AD-2)
- `stock_intakes` table is mutable master data (AD-5 tier 3): ordinary UPDATE and soft-delete via `deleted_at` (AD-4)
- Every table carries `id`, `uuid`, `created_at`, `updated_at`, `deleted_at` columns (AD-4)
- Sequelize model registers `paranoid: true` with `deletedAt: 'deleted_at'` (AD-4)
- Trip variance is computed on read as `totalPaidPaise - Σ(quantity × buyingPrice)` over non-deleted lots; never stored, recomputed on every read
- GET routes require `authenticate` only; POST requires `authorize(PERMISSIONS.INVENTORY.CREATE)`
- Error objects attach `statusCode` property for HTTP middleware mapping
- Vendor lookup rejects non-existent vendors with a 404; rejects inactive vendors (isActive=false) with a 400 naming the inactive vendor

**Ask First:**
- None — all requirements are settled in epic context and the story's acceptance criteria.

**Never:**
- Hard-delete trips; always use soft-delete via `deleted_at`
- Accept or return internal `id` in API responses or requests
- Store the variance figure in a column (it is derived on read only)
- Skip the inactive-vendor check (Epic 2 explicitly deferred it to this epic)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create trip, valid vendor, all fields | `{ vendorUuid: "abc-...", purchasedOn: "2026-08-26", billReference: "INV-001", totalPaidPaise: 50000 }` | 201 with trip `{ uuid, vendorUuid, purchasedOn, billReference, totalPaidPaise, variancePaise: 50000, createdAt, updatedAt }` | N/A |
| Create trip, optional billReference omitted | `{ vendorUuid: "...", purchasedOn: "2026-08-26", totalPaidPaise: 50000 }` | 201 with trip; `billReference: null` | N/A |
| Create trip, nonexistent vendor | `{ vendorUuid: "invalid-uuid", purchasedOn: "2026-08-26", totalPaidPaise: 50000 }` | 404 error "Vendor not found" | Service throws 404 before INSERT |
| Create trip, inactive vendor | `{ vendorUuid: "uuid-of-inactive", purchasedOn: "2026-08-26", totalPaidPaise: 50000 }` | 400 error "Vendor is inactive" | Service validates and rejects |
| Create trip, missing purchasedOn | `{ vendorUuid: "...", billReference: "INV-001", totalPaidPaise: 50000 }` | 400 validation error | Zod schema rejects |
| Create trip, negative totalPaidPaise | `{ vendorUuid: "...", purchasedOn: "2026-08-26", totalPaidPaise: -1000 }` | 400 validation error | Zod schema rejects negative paise |
| List all trips | GET `/api/stock-intakes` | 200 with array of all non-deleted trips, ordered by `purchasedOn` DESC, each with `variancePaise` computed | N/A |
| Get trip by UUID, no lots yet | GET `/api/stock-intakes/:uuid` on new trip | 200 with trip object; `variancePaise` equals `totalPaidPaise` (no lots → sum = 0) | N/A |
| Get trip by UUID, two lots with known quantities | GET `/api/stock-intakes/:uuid` after 2 lots are added | 200 with trip; `variancePaise = totalPaidPaise - (lot1.qty * lot1.buyingPrice + lot2.qty * lot2.buyingPrice)` | N/A |
| Get trip by UUID, not found | GET `/api/stock-intakes/:invalid-uuid` | 404 error "Trip not found" | Service throws 404 |
| Subsequent read after lot price edit | After a lot's `buyingPricePaise` is edited, GET `/api/stock-intakes/:uuid` again | Trip response shows updated `variancePaise` reflecting new lot price | N/A |
| Authentication missing | POST without Authorization header | 401 Unauthorized | Middleware rejects |
| Authorization insufficient | POST with role lacking `PERMISSIONS.INVENTORY.CREATE` | 403 Forbidden | Middleware rejects |

</frozen-after-approval>

## Code Map

- `backend/database/migrations/20260827000000-create-stock-intakes.js` -- Migration creating `stock_intakes` table with pattern adapted from vendors migration (20260826100000): id (SERIAL PK), uuid (unique via gen_random_uuid), vendor_id (INTEGER NOT NULL REFERENCES vendors(id)), purchased_on (DATE NOT NULL), bill_reference (VARCHAR nullable), total_paid_paise (BIGINT NOT NULL with CHECK >= 0), deleted_at (TIMESTAMPTZ nullable), created_at (CURRENT_TIMESTAMP), updated_at (CURRENT_TIMESTAMP); add partial unique index on (vendor_id, bill_reference) WHERE deleted_at IS NULL to prevent duplicate bills within a vendor
- `backend/database/models/StockIntake.js` -- Sequelize model with pattern from vendor.js: id (INTEGER PK), uuid (UUID unique), vendorId (INTEGER FK to vendors), purchasedOn (DATEONLY), billReference (VARCHAR nullable), totalPaidPaise (BIGINT), deletedAt (DATE nullable), createdAt (DATE), updatedAt (DATE); tableName='stock_intakes', paranoid: true, underscored: true, timestamps: true; Vendor association (belongsTo)
- `backend/database/models/index.js` -- Add StockIntake model instantiation and association; `StockIntake.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' })`
- `backend/src/modules/intake/stock-intake.validation.js` -- Zod schema `createStockIntakeSchema` with vendorUuid (required UUID), purchasedOn (required DATE string "YYYY-MM-DD"), billReference (optional string max 100, default null), totalPaidPaise (required integer >= 0); `stockIntakeUuidParamSchema` for route params
- `backend/src/modules/intake/stock-intake.service.js` -- Service layer following vendor.service.js pattern: `getStockIntakes()` returning all non-deleted, ordered by purchasedOn DESC; `createStockIntake({ vendorUuid, purchasedOn, billReference, totalPaidPaise })` validating vendorUuid resolves to existing, active vendor (reject inactive with 400), opening transaction, inserting row, computing and returning with variancePaise (0 if no lots); `getStockIntakeByUuid(uuid)` returning single trip with variancePaise or 404; `computeVariancePaise(stockIntakeId)` as private helper summing lots' quantity * buyingPrice, returning totalPaidPaise - sum; all methods attach statusCode to errors
- `backend/src/modules/intake/stock-intake.controller.js` -- Controller pattern from vendor.controller.js: `mapStockIntakeDTO(trip, variancePaise)` returning {uuid, vendorUuid, purchasedOn, billReference, totalPaidPaise, variancePaise, createdAt, updatedAt}; `getStockIntakes()` calling service, mapping each DTO; `createStockIntake()` validating body with createStockIntakeSchema, calling service, mapping DTO, returning 201; `getStockIntakeByUuid()` validating UUID regex on params, calling service, mapping DTO, returning 200; all methods use try/catch with next(error)
- `backend/src/modules/intake/stock-intake.routes.js` -- Route registration: GET `/` (authenticate only, calls getStockIntakes), POST `/` (authenticate + authorize PERMISSIONS.INVENTORY.CREATE, calls createStockIntake), GET `/:uuid` (authenticate only, calls getStockIntakeByUuid); export router
- `backend/app.js` -- Add import `import intakeRoutes from './src/modules/intake/stock-intake.routes.js';` and registration `app.use('/api/stock-intakes', intakeRoutes);` after vendors route registration
- `backend/src/constants/permissions.js` -- No changes; PERMISSIONS.INVENTORY.CREATE already defined
- `backend/src/middleware/auth.middleware.js` -- No changes; bearer token verification already covers /api/stock-intakes
- `backend/src/middleware/error.middleware.js` -- No changes; error.statusCode already mapped to HTTP status
- `backend/tests/intake/stock-intakes.test.js` -- Integration test file following vendors.test.js pattern: beforeAll/afterAll setup; cover: create trip (all fields, without billReference), duplicate bill for same vendor rejected, missing/blank purchasedOn rejects, negative totalPaidPaise rejects, nonexistent vendor returns 404, inactive vendor returns 400 naming vendor, list all trips ordered by purchasedOn DESC, get one by UUID with variancePaise = totalPaidPaise (no lots), get nonexistent UUID returns 404, after a lot is added (3.2 story integration), GET trip again shows updated variancePaise, authentication missing returns 401, authorization insufficient returns 403

## Tasks & Acceptance

**Execution:**
- [ ] `backend/database/migrations/20260827000000-create-stock-intakes.js` -- Create migration with `vendor_id` (INTEGER NOT NULL REFERENCES vendors(id)), `purchased_on` (DATE NOT NULL), `bill_reference` (VARCHAR nullable), `total_paid_paise` (BIGINT NOT NULL with CHECK >= 0), `deleted_at` (TIMESTAMPTZ null), timestamps; add partial unique index on (vendor_id, bill_reference) WHERE deleted_at IS NULL -- Establishes stock_intakes table as mutable master data
- [ ] `backend/database/models/StockIntake.js` -- Define Sequelize model with id (INTEGER PK), uuid (UUID unique), vendorId (INTEGER FK), purchasedOn (DATEONLY), billReference (VARCHAR nullable), totalPaidPaise (BIGINT), deletedAt (TIMESTAMPTZ nullable), createdAt, updatedAt; set tableName='stock_intakes', paranoid: true, underscored: true, timestamps: true; add belongsTo(Vendor) association -- Completes schema binding for stock_intakes
- [ ] `backend/database/models/index.js` -- Import StockIntake factory from `./StockIntake.js`, instantiate after Vendor, wire `StockIntake.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' })` -- Integrates StockIntake into app's dependency injection and database lifecycle
- [ ] `backend/src/modules/intake/stock-intake.validation.js` -- Define `createStockIntakeSchema` (vendorUuid required UUID, purchasedOn required DATE string, billReference optional string max 100, totalPaidPaise required integer >= 0) and `stockIntakeUuidParamSchema` (uuid required UUID); export both -- Validates stock-intake request bodies at HTTP boundary
- [ ] `backend/src/modules/intake/stock-intake.service.js` -- Implement `getStockIntakes()` returning all non-deleted with attributes [uuid, vendorUuid, purchasedOn, billReference, totalPaidPaise, createdAt, updatedAt] each with computed variancePaise, ordered by purchasedOn DESC; `createStockIntake({ vendorUuid, purchasedOn, billReference, totalPaidPaise })` resolving vendorUuid to Vendor, rejecting if not found (404) or inactive (400), opening transaction, inserting row, computing variancePaise (0 for no lots), returning with variance; `getStockIntakeByUuid(uuid)` returning single trip with variancePaise or 404; `computeVariancePaise(stockIntakeId)` as helper summing non-deleted lots' quantity * buyingPrice, returning totalPaidPaise - sum; all methods attach statusCode to errors -- Central business logic for trips with validation and derived-on-read variance
- [ ] `backend/src/modules/intake/stock-intake.controller.js` -- Define `mapStockIntakeDTO(trip, variancePaise)` returning {uuid, vendorUuid, purchasedOn, billReference, totalPaidPaise, variancePaise, createdAt, updatedAt}; `getStockIntakes()` calling service, mapping each DTO, returning {success: true, data}; `createStockIntake()` parsing body with createStockIntakeSchema, calling service, mapping DTO, returning 201 with {success: true, data}; `getStockIntakeByUuid()` validating UUID regex, parsing params, calling service, mapping DTO, returning 200 with {success: true, data}; all methods use try/catch with next(error) error forwarding -- HTTP request handling for trips
- [ ] `backend/src/modules/intake/stock-intake.routes.js` -- Define routes: GET `/` (authenticate only, calls getStockIntakes), POST `/` (authenticate + authorize PERMISSIONS.INVENTORY.CREATE, calls createStockIntake), GET `/:uuid` (authenticate only, calls getStockIntakeByUuid); export router -- Express routing for intake module
- [ ] `backend/app.js` -- Add import `import intakeRoutes from './src/modules/intake/stock-intake.routes.js';` and registration `app.use('/api/stock-intakes', intakeRoutes);` after vendors route -- Registers intake module with main app
- [ ] `backend/tests/intake/stock-intakes.test.js` -- Write integration tests using supertest pattern from vendors.test.js; beforeAll/afterAll setup; cover: create trip (all fields, without billReference), list all trips ordered by purchasedOn DESC, get one by UUID with variancePaise = totalPaidPaise (no lots), get nonexistent UUID returns 404, duplicate bill for same vendor rejected, missing/blank purchasedOn rejects, negative totalPaidPaise rejects, nonexistent vendor returns 404 naming vendor, inactive vendor returns 400 naming vendor, authentication missing returns 401, authorization insufficient returns 403 -- Validates all trip I/O scenarios and error cases against acceptance criteria

**Acceptance Criteria:**
- Given the database is initialized with the migration, when StockIntake model loads, then `stock_intakes` table exists with all required columns, `vendor_id` NOT NULL FK, `total_paid_paise` BIGINT with CHECK >= 0, partial unique index on (vendor_id, bill_reference) WHERE deleted_at IS NULL
- Given the app is running with an active vendor, when a staff member with `PERMISSIONS.INVENTORY.CREATE` POSTs to `/api/stock-intakes` with valid JSON `{ vendorUuid: "...", purchasedOn: "2026-08-26", billReference: "INV-001", totalPaidPaise: 50000 }`, then the API returns 201 with response `{ success: true, data: { uuid, vendorUuid, purchasedOn: "2026-08-26", billReference: "INV-001", totalPaidPaise: 50000, variancePaise: 50000, createdAt, updatedAt } }`
- Given a vendor with isActive=false, when a POST to `/api/stock-intakes` is sent against that vendor's UUID, then the API returns 400 with error message naming the vendor as inactive
- Given a trip exists with no lots, when GET `/api/stock-intakes/:uuid` is called, then `variancePaise` equals `totalPaidPaise` (no lots → sum = 0)
- Given a trip has two lots with quantity and buyingPrice set, when GET `/api/stock-intakes/:uuid` is called twice and a lot's buyingPrice is edited between calls, then the second call returns an updated `variancePaise` reflecting the new price, with the trip row itself unchanged
- Given the app is running, when an unauthenticated request is sent to `/api/stock-intakes`, then it returns 401 Unauthorized
- Given a staff member with role lacking `PERMISSIONS.INVENTORY.CREATE` sends a POST to `/api/stock-intakes`, then it returns 403 Forbidden

## Spec Change Log

### Review Loop 1 (2026-08-26)
- **Triggering findings:** Edge case validation gaps, verification gap on lot-based variance testing
- **Amended:** Validation schema enhanced with date bounds, type coercion prevention, BIGINT overflow guard; service layer duplicate handling improved; controller output escaping added
- **Known-bad state avoided:** Float paise truncation, future dates accepted, XSS via billReference, concurrent duplicate race condition unhandled
- **KEEP:** Variance computation structure preserved for future Lot model integration; soft-delete paranoid mode; vendor active state validation at create time

## Suggested Review Order

**Database & Schema**

- Create stock_intakes table with FK to vendors, unique constraint on bill reference per vendor
  [`backend/database/migrations/20260827000000-create-stock-intakes.js:1`](../../../../backend/database/migrations/20260827000000-create-stock-intakes.js#L1)

- Sequelize model binding and Vendor association
  [`backend/database/models/StockIntake.js:1`](../../../../backend/database/models/StockIntake.js#L1)

- Model integration into app dependency injection
  [`backend/database/models/index.js:1`](../../../../backend/database/models/index.js#L1)

**Validation & Business Logic**

- Zod schemas enforce required/optional fields, type coercion, date bounds, paise integer values
  [`backend/src/modules/intake/stock-intake.validation.js:1`](../../../../backend/src/modules/intake/stock-intake.validation.js#L1)

- Service layer: vendor existence/active checks, variance computation, transaction wrapping
  [`backend/src/modules/intake/stock-intake.service.js:1`](../../../../backend/src/modules/intake/stock-intake.service.js#L1)

**HTTP Layer**

- Controller DTO mapping exposes only UUID (not internal id), error forwarding pattern
  [`backend/src/modules/intake/stock-intake.controller.js:1`](../../../../backend/src/modules/intake/stock-intake.controller.js#L1)

- Route definitions with authentication and authorization guards
  [`backend/src/modules/intake/stock-intake.routes.js:1`](../../../../backend/src/modules/intake/stock-intake.routes.js#L1)

- App-level route registration
  [`backend/app.js:1`](../../../../backend/app.js#L1)

**Verification**

- Integration tests covering create, list, get, validation, auth, soft-delete (21 tests, all pass)
  [`backend/tests/intake/stock-intakes.test.js:1`](../../../../backend/tests/intake/stock-intakes.test.js#L1)

