---
title: 'Story 3.3: Scan units into a lot'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inventory managers cannot scan physical units into a lot; without this capability, lots are just templates with no actual stock tracked, and every unit's pricing snapshot and channel assignment (retail vs. rental) cannot be captured at intake.

**Approach:** Build a `units` table with id/uuid, barcode (unique per unit's lifetime), price snapshots copied from the lot at scan time, colour/size references, status (starting at IN_STOCK), and channel. Create an `intake.service.scanIntoLot()` method that validates barcode uniqueness, lot quantity limits, inactive picklists, and delegates row insertion to `units.service` to preserve AD-8's rule that `units.service` is the sole writer of `units.status` and `unit_status_events`. A successful scan inserts both a `units` row and its first `unit_status_events` row (from NULL to IN_STOCK with cause INTAKE) atomically.

## Boundaries & Constraints

**Always:**
- `units` table carries `id`, `uuid`, `created_at`, `updated_at`, `deleted_at` (AD-4, soft-delete only)
- Columns: `barcode VARCHAR(12) NOT NULL UNIQUE WHERE deleted_at IS NULL` (partial unique index, the **only** guard against double-binding), `stock_intake_line_id INTEGER NOT NULL REFERENCES stock_intake_lines(id)`, `colour_id INTEGER NOT NULL REFERENCES colours(id)`, `size_id INTEGER NOT NULL REFERENCES sizes(id)`, `status VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK'` with named CHECK enforcing values from `unit-state-machine.md`, `channel VARCHAR(10) NOT NULL` with named CHECK restricting to RETAIL/RENTAL (mirrored from `stock_intake_lines.channel`, AD-3)
- Pricing columns on `units` copy from lot at scan time verbatim and never re-sync: `buying_price_paise`, `selling_price_paise`, `floor_price_paise` (BIGINT with CHECK >= 0), and when rental: `rent_per_day_paise`, `deposit_paise`, `overdue_per_day_paise` (BIGINT nullable with appropriate CHECKs) — all values stored as strings in API responses to preserve precision (AD-24 tier 1)
- `scanIntoLot({ barcode, stockIntakeLineUuid, colourUuid, sizeUuid, actorUserId })` is called within a service-opened transaction (AD-10); delegates unit row creation to `units.service.createUnitFromScan()` to preserve AD-8; inserts one `unit_status_events` row (from NULL to IN_STOCK, cause INTAKE, actor_user_id) in same transaction — both rows exist or neither does
- A scan rejects if barcode already bound to a non-deleted unit (names that unit's barcode, status, colour, size); if lot quantity reached (names lot and its declared quantity); if colour or size is inactive (names the inactive entry); if colour or size does not exist (404)
- API exposes uuid only; internal id never leaves process (AD-1)
- POST `/api/stock-intake-lines/:stockIntakeLineUuid/scan` requires `authenticate` and `authorize(PERMISSIONS.INVENTORY.CREATE)` — reuses the same permission as Story 3.1/3.2 (no new permission constant, NFR15)
- GET `/api/stock-intake-lines/:uuid` includes `unitsScannedCount` (non-deleted unit count, recomputed on every read)
- Error objects attach `statusCode` property for HTTP middleware mapping

**Ask First:**
- None — all requirements are settled in epic context and acceptance criteria

**Never:**
- Allow a barcode to bind to two different units; rejects already-bound barcode by naming the existing unit
- Accept an inactive colour or size; reject with clear naming
- Scan into a lot that has reached its declared quantity
- Retroactively resync a unit's prices if its lot is edited
- Hard-delete units; always soft-delete via `deleted_at`
- Accept or return internal `id` in API responses

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Scan into open lot, valid barcode | POST `/api/stock-intake-lines/:uuid/scan` with `{ barcode: "123456789012", colourUuid: "...", sizeUuid: "..." }` | 201 with unit `{ uuid, barcode, stockIntakeLineUuid, colourUuid, sizeUuid, status: "IN_STOCK", channel (from lot), prices as strings, createdAt, updatedAt }` | N/A |
| Scan already-bound barcode | barcode already exists on a non-deleted unit | 409 Conflict "Barcode already bound to unit <uuid>" naming barcode, status, colour, size | Service rejects before INSERT |
| Lot quantity reached | `COUNT(non-deleted units) = lot.quantity` | 400 "Lot has reached its declared quantity of X" | Service validates and rejects |
| Inactive colour selected | colourUuid resolves to `isActive = false` | 400 "Colour is inactive" | Service validates and rejects |
| Inactive size selected | sizeUuid resolves to `isActive = false` | 400 "Size is inactive" | Service validates and rejects |
| Colour UUID not found | colourUuid does not resolve to any row | 404 "Colour not found" | Service throws 404 before INSERT |
| Size UUID not found | sizeUuid does not resolve to any row | 404 "Size not found" | Service throws 404 before INSERT |
| Scan with RENTAL lot | scan into lot with channel=RENTAL | unit row includes `rent_per_day_paise`, `deposit_paise`, `overdue_per_day_paise` copied from lot at scan time | N/A |
| Lot edited after scan | unit scanned at T1, lot prices edited at T2, unit fetched | unit retains T1 prices; lot's prices reflect T2 edit | N/A |
| Authentication missing | POST without Authorization header | 401 Unauthorized | Middleware rejects |
| Authorization insufficient | POST with role lacking `PERMISSIONS.INVENTORY.CREATE` | 403 Forbidden | Middleware rejects |
| Get lot with scanned units | GET `/api/stock-intake-lines/:uuid` | Response includes `unitsScannedCount` reflecting true non-deleted unit count | N/A |

</frozen-after-approval>

## Code Map

- `backend/database/migrations/20260828000000-create-units.js` -- Migration creating `units` table with: `id` (SERIAL PK), `uuid` (unique via gen_random_uuid), `barcode VARCHAR(12) NOT NULL` (partial unique index `WHERE deleted_at IS NULL`), `stock_intake_line_id INTEGER NOT NULL REFERENCES stock_intake_lines(id)`, `colour_id INTEGER NOT NULL REFERENCES colours(id)`, `size_id INTEGER NOT NULL REFERENCES sizes(id)`, `status VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK'` with named CHECK enforcing unit-state-machine.md values, `channel VARCHAR(10) NOT NULL` with named CHECK restricting to RETAIL/RENTAL, pricing columns (`buying_price_paise`, `selling_price_paise`, `floor_price_paise`, `rent_per_day_paise`, `deposit_paise`, `overdue_per_day_paise` as BIGINT with appropriate CHECKs), `deleted_at TIMESTAMPTZ NULL`, `created_at CURRENT_TIMESTAMP`, `updated_at CURRENT_TIMESTAMP`

- `backend/database/models/Unit.js` -- Sequelize model mirroring Story 3.2's StockIntakeLine pattern: `id`, `uuid`, `barcode`, `stockIntakeLineId`, `colourId`, `sizeId`, `status`, `channel`, pricing fields, `deletedAt`, `createdAt`, `updatedAt`; `tableName='units'`, `paranoid: true`, `underscored: true`, `timestamps: true`; associations: `belongsTo(StockIntakeLine)`, `belongsTo(Colour)`, `belongsTo(Size)`

- `backend/src/modules/intake/unit.validation.js` -- Zod schema `scanIntoLotSchema` with `barcode` (string, 1-12 chars), `stockIntakeLineUuid` (UUID), `colourUuid` (UUID), `sizeUuid` (UUID); validates barcode format and UUID presence

- `backend/src/modules/intake/intake.service.js` -- New service method `scanIntoLot({ barcode, stockIntakeLineUuid, colourUuid, sizeUuid, actorUserId })`: resolves UUIDs to models, validates barcode uniqueness (partial unique index query), validates lot quantity not reached, validates colour and size are active, opens transaction, calls `units.service.createUnitFromScan()` (defined below), returns unit DTO; all errors attach statusCode

- `backend/src/modules/units/units.service.js` -- New service method `createUnitFromScan({ lot, colour, size, barcode, actorUserId })`: creates unit row with status IN_STOCK copying lot's prices/channel, creates initial `unit_status_events` row (from NULL to IN_STOCK, cause INTAKE, actor_user_id), both in same transaction passed by caller (intake.service); returns created unit; error handling with statusCode

- `backend/src/modules/intake/intake.controller.js` -- New controller method `scanIntoLot()` validating request body with `scanIntoLotSchema`, calling `intake.service.scanIntoLot()`, mapping DTO, returning 201; uses try/catch with `next(error)`; GET `/api/stock-intake-lines/:uuid` updated to include `unitsScannedCount` in response (count of non-deleted units)

- `backend/src/modules/intake/intake.routes.js` -- Route registration: POST `/api/stock-intake-lines/:uuid/scan` (authenticate + authorize PERMISSIONS.INVENTORY.CREATE, calls scanIntoLot)

- `backend/database/models/index.js` -- Add Unit model instantiation and associations; wire `Unit.belongsTo(StockIntakeLine)`, `Unit.belongsTo(Colour)`, `Unit.belongsTo(Size)`

- `backend/tests/intake/units.test.js` -- Integration test file: beforeAll/afterAll; cover: scan into open lot (RETAIL and RENTAL), barcode uniqueness validation, lot quantity limit, inactive colour/size rejection, missing colour/size 404, verify unit prices snapshot unchanged after lot edit, verify unitsScannedCount on lot GET, authentication/authorization checks

## Tasks & Acceptance

**Execution:**
- [x] `backend/database/migrations/20260828000001-create-units.js` -- Create migration with units table, barcode partial unique index, status/channel named CHECKs, price columns with CHECKs -- Establishes units table as append-only ledger (write at intake, transition via units.service)
- [x] `backend/database/migrations/20260828000002-create-unit-status-events.js` -- Create migration for unit_status_events table with status tracking -- Supports unit lifecycle auditing
- [x] `backend/database/models/Unit.js` -- Define Sequelize model with all columns, associations to StockIntakeLine/Colour/Size, paranoid soft-delete -- Completes schema binding for units
- [x] `backend/database/models/UnitStatusEvent.js` -- Define Sequelize model for status events with associations to Unit -- Supports lifecycle tracking
- [x] `backend/database/models/index.js` -- Import Unit and UnitStatusEvent models, instantiate, wire associations (belongsTo, hasMany) -- Integrates both into app DI
- [x] `backend/src/modules/intake/unit.validation.js` -- Define scanIntoLotSchema with barcode and UUID validation -- Validates scan request bodies
- [x] `backend/src/modules/units/units.service.js` -- Implement createUnitFromScan() delegated from intake.service, creates unit row + initial unit_status_events row atomically -- Preserves AD-8's units.service monopoly on unit writes
- [x] `backend/src/modules/intake/intake.service.js` -- Implement scanIntoLot() with UUID resolution, barcode uniqueness check, lot quantity validation, colour/size active validation, transaction opening, delegation to units.service, error handling -- Central business logic for unit intake
- [x] `backend/src/modules/intake/intake.controller.js` -- Define DTO mapping and HTTP handler for scan, update GET to include unitsScannedCount, all try/catch with error forwarding -- HTTP request handling
- [x] `backend/src/modules/intake/intake.routes.js` -- Define POST `/api/stock-intake-lines/:uuid/scan` route with auth/authz guards -- Express routing for scan
- [x] `backend/tests/intake/units.test.js` -- Write integration tests covering all I/O scenarios, validation errors, auth checks, pricing snapshot immutability after lot edit, unitsScannedCount accuracy -- Validates acceptance criteria

**Acceptance Criteria:**
- Given the database is initialized with the migration, when Unit model loads, then `units` table exists with all required columns, `barcode` partial unique `WHERE deleted_at IS NULL`, `status` VARCHAR with named CHECK enforcing unit-state-machine.md values, `channel` VARCHAR with named CHECK restricting to RETAIL/RENTAL, pricing columns BIGINT with appropriate CHECKs
- Given an open lot with room, when a staff member with `PERMISSIONS.INVENTORY.CREATE` POSTs to `/api/stock-intake-lines/:uuid/scan` with valid barcode/colour/size, then the API returns 201 with unit row and unit_status_events row both created atomically, unit carries pricing copied from lot at scan time
- Given a barcode already bound to a non-deleted unit, when the POST is executed, then the API returns 409 Conflict naming the existing unit's barcode, status, colour, size
- Given a lot has reached its declared quantity, when POST is executed, then the API returns 400 naming the lot and its quantity limit
- Given a colour or size is inactive, when POST is executed, then the API returns 400 naming the inactive entry (validation from Story 2.2 completed here)
- Given a unit was scanned into a lot at T1, when that lot's prices are edited at T2 and the unit is fetched, then the unit retains its T1 price snapshot and is not re-synced (AD-24 tier 1)
- Given a lot has units scanned into it, when GET `/api/stock-intake-lines/:uuid` is called, then `unitsScannedCount` reflects the true count of non-deleted units
- Given the app is running, when an unauthenticated request is sent to POST `/api/stock-intake-lines/:uuid/scan`, then it returns 401 Unauthorized
- Given a staff member with role lacking `PERMISSIONS.INVENTORY.CREATE` sends a POST to `/api/stock-intake-lines/:uuid/scan`, then it returns 403 Forbidden

## Spec Change Log

### Review Loop 1 (2026-08-27)
- **Triggering findings:** 11 patch findings from review layers (Blind Hunter, Edge Case Hunter, Verification Gap)
- **Amended:** Implementation applied all patches: race condition locking, soft-delete filtering, null guards, strengthened tests, static imports, eager-loaded associations
- **Known-bad state avoided:** Race conditions on quantity, audit trail gaps, weak tests, soft-deleted record leaks
- **KEEP:** Partial unique index, atomic unit+event insertion, price immutability, paranoid soft-delete, authorization

## Design Notes

**Barcode Uniqueness:** The partial unique index on `barcode WHERE deleted_at IS NULL` is the **only guard** against double-binding per the domain model and spec's explicit constraint. No application-level duplicate detection is needed; the database constraint enforces it.

**Pricing Snapshots at Intake:** When a unit is scanned, it immediately copies the lot's prices (`buying_price_paise`, `selling_price_paise`, `floor_price_paise`) and channel into its own columns. Later lot edits do not trigger any resync. This is enforced by the absence of any "update unit price" logic after insertion — the scan is atomic and complete (AD-24 tier 1).

**Delegation to units.service:** Even at intake, the unit row insertion delegates to `units.service.createUnitFromScan()` to preserve AD-8's invariant that `units.service` is the sole writer of `units.status` and `unit_status_events`. This ensures that every unit's lifecycle, from first creation to later transitions, flows through one place.

**Atomic Insertion:** A successful scan inserts both a `units` row and a `unit_status_events` row (from NULL→IN_STOCK, cause INTAKE) in one transaction opened by the service. The two rows both exist or neither does; there is no inconsistency between them.

## Verification

**Commands:**
- `npm test -- backend/tests/intake/units.test.js` -- expected: all tests pass, no barcode uniqueness escapes, no inactive picklist leaks, unit prices verified unchanged after lot edit, unitsScannedCount verified accurate

**Manual checks (if no CLI):**
- Inspect database with `SELECT * FROM units WHERE id = <test-unit-id>` — confirm all columns exist, barcode partial unique index applied, status is IN_STOCK, channel matches lot, prices match lot at scan time
- Call POST `/api/stock-intake-lines/<lot-uuid>/scan` with already-bound barcode — confirm 409 response naming the existing unit
- Call POST with lot at capacity — confirm 400 naming the lot and quantity limit
- Create a lot, scan a unit, edit lot's buyingPricePaise, fetch unit — confirm unit price is unchanged

## Suggested Review Order

**Entry Point: Core Intake Logic**

- Scans units into lots with validation: barcode uniqueness, quantity limits, active picklists, pessimistic locking
  [`intake.service.js:scanIntoLot`](../../../backend/src/modules/intake/intake.service.js#L42)

**Database Schema & Models**

- Units table with barcode partial unique index WHERE deleted_at IS NULL — foundation for double-binding prevention
  [`20260828000001-create-units.js`](../../../backend/database/migrations/20260828000001-create-units.js#L1)

- Unit status event history table tracking from/to status, cause, actor — audit trail for lifecycle
  [`20260828000002-create-unit-status-events.js`](../../../backend/database/migrations/20260828000002-create-unit-status-events.js#L1)

- Unit model with paranoid soft-delete and associations to StockIntakeLine, Colour, Size
  [`Unit.js`](../../../backend/database/models/Unit.js#L1)

- UnitStatusEvent model linking to Unit with status transition tracking
  [`UnitStatusEvent.js`](../../../backend/database/models/UnitStatusEvent.js#L1)

**Service Layer**

- createUnitFromScan delegates unit creation to preserve AD-8 (units.service is sole writer)
  [`units.service.js:createUnitFromScan`](../../../backend/src/modules/units/units.service.js#L30)

- Validates: barcode uniqueness, lot quantity not exceeded, colour/size active, soft-deleted lot/colour/size
  [`intake.service.js:scanIntoLot`](../../../backend/src/modules/intake/intake.service.js#L42)

**API Binding**

- HTTP handler for POST scan endpoint with DTO mapping
  [`intake.controller.js:scanIntoLot`](../../../backend/src/modules/intake/intake.controller.js#L88)

- Route registration: POST /:uuid/scan with authenticate + authorize(PERMISSIONS.INVENTORY.CREATE)
  [`intake.routes.js`](../../../backend/src/modules/intake/intake.routes.js#L15)

- Zod schema validating barcode and UUIDs including URL parameter
  [`unit.validation.js:scanIntoLotSchema`](../../../backend/src/modules/intake/unit.validation.js#L1)

**Supporting Changes**

- Updated lot GET to include unitsScannedCount (non-deleted unit count)
  [`stock-intake-line.service.js:getStockIntakeLineByUuid`](../../../backend/src/modules/intake/stock-intake-line.service.js#L198)

- Integration tests: valid scans, barcode/quantity/picklist validation, pricing snapshot, event creation
  [`units.test.js`](../../../backend/tests/intake/units.test.js#L1)
