---
title: 'Story 3.6: Vendor Detail - Trip, Lot and Unit History'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
story_key: '3-6-vendor-detail-trip-lot-and-unit-history'
context:
  - 'database/models/index.js'
  - 'backend/src/constants/permissions.js'
---

<!-- Target: 900–1300 tokens. Above 1600 = high risk of context rot.
     Never over-specify "how" — use boundaries + examples instead.
     Cohesive cross-layer stories (DB+BE+UI) stay in ONE file.
     IMPORTANT: Remove all HTML comments when filling this template. -->

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inventory managers need to see a vendor's complete purchase history (all trips, lots, and units) in one place. Currently, trips, lots, and units must be cross-referenced separately, making it hard to audit what was sourced from a vendor.

**Approach:** Build a read-only GET endpoint that returns a vendor's trips (stock_intakes) with nested lots (stock_intake_lines) and units, sorted by purchase date, with computed variance for each trip.

## Boundaries & Constraints

**Always:**
- `GET /api/vendors/:uuid/history` requires `authenticate` only (read-only, no new permission constant; NFR-15)
- Endpoint returns vendor with three nested arrays: `trips`, each trip contains `lines` (lots), each lot contains `units`
- Trips sorted by `purchasedOn DESC` (most recent first)
- Lots sorted by `createdAt ASC` (creation order within trip)
- Units sorted by `createdAt ASC` (scan order within lot)
- Each trip includes computed `variancePaise` (totalPaidPaise - sum of lot quantities × buying prices), never stored
- Empty arrays returned for trips/lots/units with no data (no 404 for a vendor with no history)
- 404 only if vendor UUID does not resolve to any existing, non-deleted vendor
- API exposes UUIDs only; internal `id` never exposed (AD-1)
- Deactivated vendors (`isActive = false`) return full history unchanged (deactivation only blocks future trip entry per Story 3.1)
- All fields as strings for money columns (paise values as `"50000"` not `50000`) per AD-24 tier one

**Ask First:**
- None — all requirements settled in epic context and acceptance criteria

**Never:**
- Return internal `id` columns
- Return deleted trips, lots, or units
- Store variance; compute on every read
- Omit trips/lots/units that exist and match filters
- Accept malformed UUID without returning 400 or 404
- Apply pagination or limit results (accept full history in one response)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vendor with trips/lots/units | `GET /api/vendors/:uuid/history` with valid vendor, ≥1 trip | 200 with nested structure: `{ vendor, trips: [ { uuid, purchasedOn, totalPaidPaise, variancePaise, lines: [ { uuid, productTypeUuid, quantity, channel, prices, rentTerms, units: [ { uuid, barcode, status, colour, size } ] } ] } ] }` | N/A |
| Vendor with no trips | Valid vendor but zero stock_intakes | 200 with `{ vendor, trips: [] }` (not 404) | N/A |
| Trip with no lots | Trip exists but zero non-deleted stock_intake_lines | Trip appears with `lines: []` in response | N/A |
| Lot with no units | Lot exists but zero non-deleted units | Lot appears with `units: []` in response | N/A |
| Deactivated vendor | Vendor exists with `isActive = false` | 200 with full history unchanged; deactivation does not filter history | N/A |
| Non-existent vendor | Non-existent or malformed UUID | 404 `{ statusCode: 404, message: "Vendor not found" }` | N/A |
| Unauthorized actor | Valid vendor but actor lacks session | 401 or 403 per auth middleware | Middleware intercepts before route |

</frozen-after-approval>

## Code Map

- `backend/src/modules/vendors/vendor.routes.js` (line ~25) -- Add `GET /:uuid/history` route before or after existing vendor routes; mount with `authenticate` middleware only
- `backend/src/modules/vendors/vendor.controller.js` (line ~60+) -- Add `getVendorHistory()` controller that calls service, handles 404, returns DTO with nested structure
- `backend/src/modules/vendors/vendor.service.js` (line ~120+) -- Add `getVendorHistory(vendorUuid)` service method that queries Vendor → StockIntake (trips) → StockIntakeLine (lots) → Unit, includes related ProductType/Colour/Size, computes variance per trip
- `backend/src/modules/intake/stock-intake.service.js` (line ~127) -- Already has `computeVariancePaise(stockIntakeId, totalPaidPaise)` helper; reuse it in vendor service
- Database models: `Vendor`, `StockIntake`, `StockIntakeLine`, `Unit`, `ProductType`, `Colour`, `Size` — already exist and have associations configured
- `backend/tests/vendors/vendor.test.js` — Add comprehensive tests for history endpoint covering happy path (trips/lots/units), empty collections, deactivated vendor, 404, auth checks, soft-delete filtering, price precision (strings)

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/modules/vendors/vendor.routes.js` -- Add `GET /:uuid/history` route with `authenticate` middleware, call controller handler -- Integrates new endpoint into vendor routing
- [x] `backend/src/modules/vendors/vendor.controller.js` -- Add `getVendorHistory(req, res)` controller that extracts UUID, calls service, returns 404 if vendor not found, otherwise returns 200 with nested DTO -- Request → service → response layer
- [x] `backend/src/modules/vendors/vendor.service.js` -- Add `getVendorHistory(vendorUuid)` service that queries vendor, fetches all non-deleted trips with nested lots/units/related tables, computes variance per trip, maps to response DTO -- Core query logic and variance computation
- [x] `backend/tests/vendors/vendor.test.js` -- Add comprehensive tests covering: vendor with trips/lots/units; vendor with no trips; trip with no lots; lot with no units; deactivated vendor returns history; non-existent vendor 404; unauthorized 401; soft-delete filtering; price precision as strings; one automated test verifies unit price snapshot differs from edited lot price (AD-24) -- All I/O matrix scenarios + acceptance criteria

**Acceptance Criteria:**
- Given a vendor with trips, when `GET /api/vendors/:uuid/history` is called, then response is 200 with trips sorted by `purchasedOn DESC`, each trip containing its non-deleted lots sorted by `createdAt ASC`, each lot containing its non-deleted units sorted by `createdAt ASC`
- Given a trip with units and a later lot edit (Story 3.2 PATCH), when history is fetched, then each unit's `buyingPricePaise` (and other prices) remain unchanged from intake time, and differ from the lot's edited value, and an automated test asserts this invariant (AD-24 tier one)
- Given a trip, when history is fetched, then `variancePaise` for that trip equals `totalPaidPaise - Σ(line.quantity × line.buyingPricePaise)` for all non-deleted lines, computed fresh on every read, never stored
- Given a vendor with no trips, when history is fetched, then response is 200 with `trips: []`, not 404
- Given a deactivated vendor (`isActive = false`), when history is fetched, then full history returns unchanged
- Given a non-existent vendor UUID, when history is fetched, then response is 404 naming the vendor
- All money fields (totalPaidPaise, prices, variance) are serialized as strings; no precision loss on round-trip
- All UUIDs (vendor, trip, lot, unit, product type, colour, size) are exposed; no internal `id` in response

## Spec Change Log

<!-- Empty until review loopback -->

## Design Notes

**Nested Structure & N+1 Prevention:**
The history endpoint must avoid N+1 queries. Use Sequelize `include` with `attributes` to eagerly load related tables in one query tree:
- Vendor → StockIntakes (trips) → StockIntakeLines (lots) + ProductType → Units + Colour + Size

Example query structure:
```javascript
Vendor.findOne({
  where: { uuid: vendorUuid },
  include: [
    {
      association: 'stockIntakes',
      where: { deletedAt: null },
      include: [
        {
          association: 'lines',
          where: { deletedAt: null },
          include: [
            { association: 'productType', attributes: ['uuid'] },
            { association: 'units', where: { deletedAt: null }, include: [{ association: 'colour' }, { association: 'size' }] }
          ]
        }
      ]
    }
  ]
});
```

**Variance Computation:**
Reuse the existing `computeVariancePaise(stockIntakeId, totalPaidPaise)` helper from stock-intake.service.js. It safely handles null sums and returns totalPaidPaise when no lots exist.

**Unit Status & Channel Snapshots:**
Units carry `status` (from unit-state-machine.md, starting at `IN_STOCK` at intake) and `channel` (RETAIL or RENTAL) as snapshots from their lot. These are read-only in the history view; no status transitions belong here (Story 4.1 owns transitionUnit).

## Verification

**Commands:**
- `cd {project-root} && npm run test -- backend/src/modules/vendors/__tests__/vendor.service.test.js` -- All tests pass; history service queries correctly, computes variance, filters soft-deletes, handles empty collections
- `cd {project-root} && npm run test -- backend/src/modules/vendors/__tests__/vendor.routes.test.js` -- All endpoint tests pass; 200, 404, 401 responses match expected shape; nested structure validates
- `cd {project-root} && npm run lint -- backend/src/modules/vendors/vendor*.js` -- No linting errors; code follows project style

**Manual checks:**
- Open Swagger/OpenAPI docs; verify `GET /vendors/{uuid}/history` is documented with correct nested response schema (trips, lines, units arrays; prices as strings; UUIDs only)
- In browser dev tools, inspect network tab after calling history endpoint; verify response JSON has prices as strings (e.g., `"totalPaidPaise": "500000"`, `"buyingPricePaise": "75000"`)
- Verify in database: fetch a vendor with trips, edit one lot's price, fetch history again, confirm unit prices remain unchanged while lot price changed

## Suggested Review Order

**Route & Controller (entry point)**

- Exposes read-only history endpoint, validates UUID format before calling service.
  [`vendor.routes.js:22`](../../../backend/src/modules/vendors/vendor.routes.js#L22)

- Request handler extracts UUID, delegates to service, returns error-handled response.
  [`vendor.controller.js:102`](../../../backend/src/modules/vendors/vendor.controller.js#L102)

**Service Layer (core logic)**

- Main service query: eager-loads vendor with nested trips, lots, units; filters soft-deletes at each level.
  [`vendor.service.js:127`](../../../backend/src/modules/vendors/vendor.service.js#L127)

- Variance computation per trip (totalPaidPaise - sum of lot costs); handles empty lots safely.
  [`vendor.service.js:206`](../../../backend/src/modules/vendors/vendor.service.js#L206)

- DTO mapper: transforms query results to API response; ensures money as strings, UUIDs only, proper sorting.
  [`vendor.service.js:225`](../../../backend/src/modules/vendors/vendor.service.js#L225)

**Data Model (associations)**

- Bidirectional associations enable eager-loading: Vendor→StockIntake→StockIntakeLine→Unit with Colour/Size.
  [`database/models/index.js:202`](../../../database/models/index.js#L202)

**Tests (comprehensive coverage)**

- Soft-delete filtering with variance verification (regression gap fix).
  [`vendors.test.js:815`](../../../backend/tests/vendors/vendors.test.js#L815)

- All 17 new tests: empty collections, deactivated vendor, 404, 401, soft-delete at each level, money precision, AD-24 invariant.
  [`vendors.test.js`](../../../backend/tests/vendors/vendors.test.js)
