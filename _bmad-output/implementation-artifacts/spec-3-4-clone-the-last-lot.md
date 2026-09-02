---
title: 'Story 3.4: Clone the Last Lot'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Intake staff spend time re-entering identical product details, pricing, and rental terms when creating multiple lots from the same vendor in a single trip. Without a clone feature, every lot requires manual entry of all fields.

**Approach:** Build a read-only GET endpoint that returns the most recent lot's configuration (product type, prices, channel, rental terms) for a trip, enabling staff to pre-populate a new lot creation form.

## Boundaries & Constraints

**Always:**
- `GET /api/stock-intakes/:tripUuid/clone-last-lot` returns the most recent non-deleted lot for the trip, sorted by `created_at DESC, id DESC`
- Response includes: `productTypeUuid`, `quantity`, `buyingPricePaise`, `sellingPricePaise`, `floorPricePaise`, `channel`, `rentPerDayPaise`, `depositPaise`, `overduePerDayPaise` (all numeric fields as strings per AD-24 tier 1)
- Endpoint requires `authenticate` only (read-only, no new permission constant needed; NFR-15)
- Returns 200 with pre-fill data, or 404 if no lots exist or trip not found
- API exposes uuid only; internal `id` never leaves process (AD-1)
- Trip access validated via existing `verifyTripAccess()` helper; unauthorized actors receive 403

**Ask First:**
- None — all requirements settled in epic context and acceptance criteria

**Never:**
- Create, modify, or delete lots; this is read-only
- Return internal `id` columns
- Return deleted or inactive lots
- Accept malformed tripUuid without returning 400 or 404

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path — get last lot | `GET /api/stock-intakes/:tripUuid/clone-last-lot` with valid trip and ≥1 non-deleted lot | 200 with `{ productTypeUuid, quantity, buyingPricePaise, sellingPricePaise, floorPricePaise, channel, rentPerDayPaise, depositPaise, overduePerDayPaise (as strings), createdAt }` | N/A |
| No lots in trip | Valid trip but zero non-deleted lots in `stock_intake_lines` | 404 `{ statusCode: 404, message: "No lots found to clone for this trip" }` | Service returns `null`; handler returns 404 |
| Trip not found | Non-existent or malformed `tripUuid` | 404 `{ statusCode: 404, message: "Trip not found" }` | `verifyTripAccess()` throws or returns falsy; handler catches and returns 404 |
| Unauthorized actor | Valid trip but actor lacks `authenticate` session | 401 or 403 per existing auth middleware | Middleware intercepts before route handler |

</frozen-after-approval>

## Code Map

- `backend/src/modules/intake/stock-intake.routes.js` (line ~16–30) -- Entry point for intake endpoints; add `GET /:tripUuid/clone-last-lot` handler
- `backend/src/modules/intake/stock-intake.service.js` (line ~95–120) -- Core service layer; add `getLastLotForTrip(tripUuid)` method following existing patterns (`getStockIntakeByUuid`)
- `backend/src/modules/intake/stock-intake-line.service.js` (line ~112+) -- Contains `getStockIntakeLines()` pattern; demonstrates query structure for filtering by `stock_intake_id`, `deleted_at IS NULL`, ordering by `created_at DESC`
- Migrations: `20260827000000-create-stock-intakes.js` and `20260828000000-create-stock-intake-lines.js` -- Schema reference; confirms columns and constraints

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/modules/intake/stock-intake.routes.js` -- Add `GET /:tripUuid/clone-last-lot` route with handler that calls service and returns response -- Integrates read-only endpoint into existing routing structure
- [x] `backend/src/modules/intake/stock-intake.service.js` -- Add `getLastLotForTrip(tripUuid)` method that queries `stock_intake_lines` ordered by `created_at DESC`, returns pre-fill object with all pricing/rental fields as strings -- Core query logic for cloning; reuses `verifyTripAccess()` helper
- [x] `backend/src/modules/intake/stock-intake.controller.js` -- Add `getCloneLastLot()` controller handler -- Routes request through authentication and service layer
- [x] `backend/tests/intake/stock-intakes.test.js` -- Add comprehensive tests covering happy path, no lots, trip not found, RETAIL/RENTAL channels, multiple lots, soft-deleted filtering, 404/401/400 errors, and price precision -- Validates all I/O matrix scenarios and acceptance criteria

**Acceptance Criteria:**
- Given a trip with at least one non-deleted lot, when `GET /api/stock-intakes/:tripUuid/clone-last-lot` is called with valid auth, then response is 200 with the most recently created lot's `productTypeUuid`, `quantity`, prices (as strings), `channel`, and rental terms (if `channel = RENTAL`)
- Given a trip with no lots, when `GET /api/stock-intakes/:tripUuid/clone-last-lot` is called, then response is 404 with message naming the missing lots
- Given an invalid or non-existent `tripUuid`, when `GET /api/stock-intakes/:tripUuid/clone-last-lot` is called, then response is 404 with message naming the missing trip
- No price precision is lost: all paise values are serialized as strings and remain unrounded and untruncated

## Spec Change Log

- **Iteration 1 review finding (review_loop_iteration=1):** Timestamp in response is ambiguous — `createdAt` from original lot included in DTO, but when frontend uses this data to pre-fill a new lot creation form, it should use current timestamp, not historical. Amended I/O Matrix and Design Notes to clarify: response includes `createdAt` for reference only; frontend must NOT use it as-is when creating a new lot. Added Design Notes section.
  - **Known-bad state avoided:** Frontend incorrectly re-using original lot's timestamp when creating new lot, causing wrong purchase date tracking.
  - **KEEP:** Query pattern (order by createdAt DESC), soft-delete filtering, price-as-strings serialization all work well. Keep all 8 test cases and verification commands as-is.

## Design Notes

**Timestamp Handling:** The response includes `createdAt` from the cloned lot for reference (audit trail), but it is **read-only information only**. When the frontend receives this data to pre-fill a new lot creation form:
- The `createdAt` field **must not** be used as the new lot's timestamp.
- The new lot's `purchasedOn` must be set by the user (or defaulted to today) and represents when the NEW purchase occurred, not when the original lot was created.
- Example: If lot A was created on 2026-01-15 but cloned on 2026-08-27, the response includes `createdAt: 2026-01-15` for reference, but the new lot created from the clone uses today's `purchasedOn: 2026-08-27`.

## Verification

**Commands:**
- `cd {project-root} && npm run test -- backend/src/modules/intake/__tests__/stock-intake.service.test.js` -- All tests pass; `getLastLotForTrip()` queries correctly and formats strings
- `cd {project-root} && npm run test -- backend/src/modules/intake/__tests__/stock-intake.routes.test.js` -- All endpoint tests pass; 200, 404, and 401 responses match expected shape
- `cd {project-root} && npm run lint -- backend/src/modules/intake/stock-intake*.js` -- No linting errors; code follows project style

**Manual checks:**
- Open Swagger/OpenAPI docs; verify `GET /stock-intakes/{tripUuid}/clone-last-lot` is documented with correct response schema (prices as strings, `createdAt` for reference)
- In browser dev tools, inspect network tab after calling clone endpoint; verify response JSON has prices as strings (e.g., `"buyingPricePaise": "50000"`, not `50000`)

## Suggested Review Order

**Entry Point & Routing**

- Route added before generic /:uuid to avoid path priority conflicts; authenticate middleware only
  [`stock-intake.routes.js:21`](../../../backend/src/modules/intake/stock-intake.routes.js#L21)

**Business Logic**

- Validates trip exists; queries most recent non-deleted lot ordered by createdAt DESC, id DESC
  [`stock-intake.service.js:161`](../../../backend/src/modules/intake/stock-intake.service.js#L161)

- Formats response: prices as strings (AD-24), createdAt for reference only, validates ProductType relation
  [`stock-intake.service.js:237`](../../../backend/src/modules/intake/stock-intake.service.js#L237)

**API Handler**

- Validates UUID format; calls service; returns 200 with cloned lot data or catches errors
  [`stock-intake.controller.js:94`](../../../backend/src/modules/intake/stock-intake.controller.js#L94)

**Verification**

- 8 comprehensive tests: happy path (RETAIL/RENTAL), multiple lots, soft-delete filtering, missing lots/trips, auth, UUID, prices
  [`stock-intakes.test.js:473`](../../../backend/tests/intake/stock-intakes.test.js#L473)
