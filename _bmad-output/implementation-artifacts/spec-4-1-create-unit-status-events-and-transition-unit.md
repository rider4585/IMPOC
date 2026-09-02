---
title: 'Epic 4 Story 1: Create unit_status_events and stand up units.service.transitionUnit() as the sole writer'
type: 'feature'
created: '2026-08-28'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context:
  - _bmad-output/specs/spec-impoc-core/unit-state-machine.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Currently, there is no centralized, atomic way to change a unit's status that enforces the state machine rules and writes audit trails. Every later epic (checkout, exchange, hand-over, return, recovery) will need to move units, and if each writes `units.status` directly, we lose the single source of truth for valid transitions, audit integrity, and race safety.

**Approach:** Build `units.service.transitionUnit()` as the sole writer of `units.status`, `units.channel`, rental snapshots, and `unit_status_events`. Use a conditional UPDATE with compare-and-swap to prevent races. House the complete state machine guard (all channel/from/to/cause tuples) in one table-driven object so later epics call into one place rather than spreading transition logic.

## Boundaries & Constraints

**Always:**
- `units.status` and `unit_status_events` inserts happen together in one transaction, or neither does (AD-8, NFR6).
- The guard table covers the **complete** state machine from `unit-state-machine.md` for both RETAIL and RENTAL channels, even transitions this epic doesn't itself call (later epics will).
- A compare-and-swap UPDATE (`WHERE id = :id AND status = :expectedFrom`) is the sole guard against concurrent transitions; no application-level locking or `SELECT … FOR UPDATE`.
- When UPDATE returns zero rows, the service re-reads the unit's actual status and throws a 409 naming the barcode and that real status (CAP-10).
- `unit_status_events` columns `sale_line_id` and `agreement_id` are NULL-constrained by CHECK but not FK-constrained; FK constraints are added by Epic 5 and Epic 7/8 once those tables exist.
- Every transition request carries a `requestUuid`; idempotency is resolved before `transitionUnit()` is called (Story 4.2/4.3/4.4 handle this, not this story).
- No booked-unit guard runs here; Epic 7 extends the guard list with that predicate once `rental_bookings` exists.
- UUID on the wire (AD-1), integer `id` never leaves the process (except `unit.barcode` as scan key).
- All money stored as `BIGINT` paise with `_paise` suffix (AD-2, already applied to existing snapshots).
- Constrained strings use VARCHAR + named CHECK, values are `UPPERCASE_SNAKE` (AD-3).
- Every new table carries `deleted_at`, `created_at`, `updated_at` per AD-4 and AD-5 (already applied; this story touches neither).

**Ask First:**
- If `unit_status_events` table migration differs significantly from the spec's schema (columns, constraints, naming), HALT before implementing and clarify.

**Never:**
- No other module may UPDATE `units.status` or INSERT into `unit_status_events`.
- No application-level locking or SELECT FOR UPDATE.
- No booked-unit guard predicate in `transitionUnit()`; that is Epic 7's concern.
- No new status values outside the enum in `unit-state-machine.md`.
- No cron, scheduler, or background worker.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path: Legal transition | unitUuid='abc-123', to='DAMAGED', cause='STAFF_MARKED_DAMAGED', reason='broken wheel', transaction provided | `UPDATE units SET status='damaged' ... RETURNING id` succeeds (1 row), one `unit_status_events` row inserted, both commit | N/A |
| Concurrent race: Another txn wins | unitUuid same, two calls with different legal transitions simultaneously | One UPDATE returns 1 row and commits; other returns 0 rows, service re-reads unit, throws 409 with barcode + real status | 409: status code, barcode, current status in message |
| Illegal transition from current status | Unit is `sold`, call with to='IN_STOCK' and cause='STAFF_MARKED_DAMAGED' (invalid on RETAIL for sold unit) | Guard refuses (expected from='sold' but table says sold cannot go to in_stock under that cause on retail) before UPDATE runs, throw 409 | 409: barcode, real status, reason "invalid transition" |
| Zero rows after UPDATE (race already lost) | unitUuid, any legal transition, but another txn already changed status since our read | UPDATE returns 0 rows → service re-reads unit, discovers new status, throws 409 with barcode and new real status | 409: barcode, current status |
| Recovery to LOST→RETIRED | Unit is lost, call with to='RETIRED', cause='RECOVERY' | Guard permits (recovery is special-case reachable only via RECOVERY cause); UPDATE returns 1 row, event inserted, one row total in history (not two) | N/A |
| Unknown transition tuple | (channel=RETAIL, from=IN_STOCK, to=UNKNOWN_STATUS, cause=STAFF_MARKED_DAMAGED) | Guard rejects before DB hit (status not in enum), throw error or return false from guard check | Validation error or 409 |

</frozen-after-approval>

## Code Map

- `backend/database/migrations/20260828000001-create-units.js` -- Contains existing units table with status column, channel, CHECK constraints; Story uses this as the base for transitions.
- `backend/database/migrations/20260828000002-create-unit-status-events.js` -- Ledger table (append-only); Story validates schema matches spec (id, uuid, unit_id FK, from_status, to_status, cause, reason, actor_user_id, occurred_at, sale_line_id, agreement_id, deleted_at, created_at, updated_at).
- `backend/database/models/Unit.js` -- Sequelize model for units; paranoid mode enabled; Story uses for UUID resolution and snapshots.
- `backend/database/models/UnitStatusEvent.js` -- Sequelize model for audit ledger; timestamps: false to prevent automatic created_at/updated_at management.
- `backend/src/modules/units/units.service.js` -- Existing service contains `createUnitFromScan()` which already inserts initial status event; Story adds `transitionUnit()` exported function here.
- `backend/src/constants/unit-status-cause.js` -- **NEW FILE**. Enumerate causes: INTAKE, STAFF_MARKED_DAMAGED, STAFF_MARKED_LOST, MAINTENANCE_COMPLETE, BEYOND_REPAIR, RECOVERY (plus placeholders for future epics: SALE, EXCHANGE, HAND_OVER, RETURN, WRITE_OFF).
- `backend/src/constants/gesture-type.js` -- Add UNIT_TRANSITION and UNIT_RECOVER constants (used by Story 4.2 and 4.4 respectively for idempotency tracking).
- `_bmad-output/specs/spec-impoc-core/unit-state-machine.md` -- Source of truth for all (channel, from, to) pairs; Story encodes the **complete** matrix in guard table, not just this epic's calls.
- `backend/src/middleware/error.middleware.js` -- Existing error handler; Story leverages for 409 responses per established patterns (e.g., vendor.service.js lines 29-37).
- `backend/src/modules/idempotency/idempotency.service.js` -- Existing service for idempotency lookup; Story 4.2/4.3/4.4 call this before `transitionUnit()`, not this story.
- `backend/src/modules/units/units.controller.js` -- Add four read routes: GET /api/units/:uuid, GET /api/units/:uuid/status-events, GET /api/units/by-barcode/:barcode.
- `backend/src/modules/units/units.routes.js` -- Wire up the four new read routes.
- `backend/src/modules/units/units.validation.js` -- Add Zod schemas for route params and responses (uuid format, pagination envelope).

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/constants/unit-status-cause.js` -- Create constants module enumerating INTAKE, STAFF_MARKED_DAMAGED, STAFF_MARKED_LOST, MAINTENANCE_COMPLETE, BEYOND_REPAIR, RECOVERY, plus comments noting future causes for Epics 5-8 -- Captures every cause this story or later epics issue, so later stories reference one shared source.
- [x] `backend/src/constants/gesture-type.js` -- Add UNIT_TRANSITION = 'unit_transition' and UNIT_RECOVER = 'unit_recover' -- Required by Story 4.2/4.3/4.4 for idempotency gesture types.
- [x] `backend/src/modules/units/units.service.js` -- Build state machine guard table covering all (channel, from, to, cause) tuples from unit-state-machine.md; implement `transitionUnit({ unitUuid, to, reason, actorUserId, cause }, { transaction })` using conditional UPDATE with compare-and-swap; throw 409 on zero rows with barcode + real status -- Consolidates state machine enforcement and race safety in one place, enforced before any later epic writes status.
- [x] `backend/src/modules/units/units.controller.js` -- Add GET /api/units/:uuid (returns uuid, barcode, status, channel, colour/size uuids, price/rental snapshots); GET /api/units/:uuid/status-events (returns items array with fromStatus, toStatus, cause, reason, occurredAt, acting user name, paginated with envelope); GET /api/units/by-barcode/:barcode (returns same as /api/units/:uuid or 404 if not bound) -- Exposes unit reads and audit trail per CAP-10 and Flow 10.
- [x] `backend/src/modules/units/units.routes.js` -- Wire up three new routes with authentication (no authorization gate needed, all routes are reads) -- Exposes the new controller methods.
- [x] `backend/src/modules/units/units.validation.js` -- Add Zod schemas for :uuid and :barcode params, and response envelope for status-events (items, page, pageSize, total per AD-26) -- Validates inbound requests and documents response shape.
- [x] **Automated test suite** -- Prove: (1) two concurrent `transitionUnit()` calls on same unit with different legal transitions result in exactly one successful UPDATE and one 409 with real status; (2) no module other than units.service.js contains `UPDATE units SET status` or `INSERT INTO unit_status_events`; (3) Story 3.3's creation-time insert still routes through units.service.js and is unchanged by this story; (4) guard table covers all (channel, from, to) pairs from unit-state-machine.md; (5) RECOVERY cause transitions are reachable only via cause='RECOVERY'; (6) routes return correct envelope and field names per spec.

**Acceptance Criteria:**

**Given** migration `12-create-units` has already run and migration `13-create-unit-status-events` exists with schema (id, uuid, unit_id FK, from_status VARCHAR NULL, to_status VARCHAR NOT NULL, cause VARCHAR NOT NULL, reason TEXT NULL, actor_user_id FK, occurred_at TIMESTAMPTZ, sale_line_id INTEGER NULL, agreement_id INTEGER NULL, deleted_at TIMESTAMPTZ NULL, created_at, updated_at) and CHECK constraints (to_status in status enum, from_status in status enum or NULL, cause in enum, sale_line_id XOR agreement_id, cause='RECOVERY' implies reason NOT NULL)
**When** `transitionUnit()` is built in units.service.js
**Then** it exports `transitionUnit({ unitUuid, to, reason, actorUserId, cause }, { transaction })` and:
- Resolves `unitUuid` to internal `id` via Sequelize `findOne()`
- Looks up expected `from_status` from guard table for `(channel, cause, to)` pair
- Executes: `UPDATE units SET status = :to WHERE id = :id AND status = :expectedFrom AND deleted_at IS NULL RETURNING id`
- On 1+ rows returned: inserts one `unit_status_events` row in same transaction with fromStatus, toStatus, reason, actorUserId, cause; both commit together
- On 0 rows returned: re-reads unit's actual status and throws error (statusCode 409, message includes barcode and real status)

**Given** the guard table is reviewed
**When** it is inspected
**Then** it contains every `(channel, from, to, cause)` tuple from unit-state-machine.md for both RETAIL and RENTAL channels, including transitions this epic's stories do not call (e.g., in_stock→sold, rented→in_stock)

**Given** RECOVERY cause transitions
**When** guard table is checked
**Then** LOST→IN_STOCK, LOST→IN_MAINTENANCE, LOST→RETIRED are **only** legal under cause='RECOVERY'; any call with one of those (from, to) pairs under another cause is refused before UPDATE runs

**Given** two concurrent transactions calling `transitionUnit()` on the same unit with different legal transitions
**When** both execute simultaneously
**Then** automated test proves: exactly one UPDATE returns a row and commits its event; the other returns 0 rows, service re-reads and throws 409 naming barcode and new real status; both transactions complete (no deadlock or indefinite wait)

**Given** the codebase after this story
**When** searched for `UPDATE units SET status` and `INSERT INTO unit_status_events`
**Then** no module other than units.service.js contains either statement (verified by automated test or documented manual check)

**Given** a unit exists (from Story 3.3)
**When** `GET /api/units/:uuid` is called
**Then** it returns `{uuid, barcode, status, channel, colourUuid, sizeUuid, buyingPricePaise, sellingPricePaise, floorPricePaise, rentPerDayPaise, depositPaise, overduePerDayPaise}` with 200 status

**Given** a unit with status-events rows
**When** `GET /api/units/:uuid/status-events?page=1&pageSize=50` is called
**Then** it returns `{items: [{fromStatus, toStatus, cause, reason, occurredAt, actorName}, ...], page: 1, pageSize: 50, total: N}` newest-first (ordered by created_at DESC), never includes internal actor_user_id

**Given** a barcode string
**When** `GET /api/units/by-barcode/:barcode` is called
**Then** it returns the non-deleted unit's detail (same shape as /api/units/:uuid) or 404 `{success: false, message: "Unit with barcode ABC123 not found"}`

**Given** an unauthenticated request to any of the three routes
**When** `authenticate` middleware runs
**Then** request is rejected with 401

**And** all three routes require only `authenticate`; no `authorize()` check needed (reads over data every screen already needs)

**Given** Story 3.3's `createUnitFromScan()` function exists
**When** this story ships
**Then** Story 3.3's code is unchanged; it continues to call a shared helper (or inline) that inserts initial status event and routes through units.service.js (already true today)

## Spec Change Log

(empty until first review loopback)

## Design Notes

**Guard table design:** Rather than nested if-then-else per (channel, cause, to) pair, the guard is a simple object keyed by channel, then cause, then to, returning the expected from status(es). This is efficient, complete, and readable:

```javascript
const guardTable = {
  RETAIL: {
    STAFF_MARKED_DAMAGED: { from: 'IN_STOCK', to: 'DAMAGED' },
    STAFF_MARKED_LOST: { from: 'IN_STOCK', to: 'LOST' },
    MAINTENANCE_COMPLETE: { from: 'IN_MAINTENANCE', to: 'IN_STOCK' },
    BEYOND_REPAIR: { from: 'IN_MAINTENANCE', to: 'RETIRED' },
    RECOVERY: {
      'LOST→IN_STOCK': 'LOST',
      'LOST→IN_MAINTENANCE': 'LOST',
      'LOST→RETIRED': 'LOST'
    },
    // ... future causes added by later epics
  },
  RENTAL: {
    // ... similar structure
  }
};
```

Later epics add new keys to the nested objects, never modifying existing keys. The guard list for `transitionUnit()` starts with this table check, and Epic 7 prepends the booked-unit predicate.

**Race guard rationale:** Compare-and-swap via conditional UPDATE is the sole guard because:
1. It is atomic — no application-level check-then-act window.
2. One statement, not two — no split between reading and updating.
3. Sequelize and Postgres handle it transparently; no advisory locks or `FOR UPDATE`.
4. The 409 on zero rows is the feedback mechanism; the service re-reads to report what actually happened.

## Verification

**Commands:**
- `npm run test -- backend/src/modules/units/__tests__/transitionUnit.test.js` -- expected: all tests pass, including concurrency test and guard-table audit.
- `npm run lint -- backend/src/modules/units/units.service.js` -- expected: no errors.
- `npm run migrate` (or equivalent) -- expected: migrations run without error; `unit_status_events` table exists with correct schema and constraints.
- `grep -r "UPDATE units SET status" backend/src --include="*.js" | grep -v units.service.js | wc -l` -- expected: 0 matches outside units.service.js.
- `grep -r "INSERT INTO unit_status_events" backend/src --include="*.js" | grep -v units.service.js | wc -l` -- expected: 0 matches outside units.service.js.

**Manual checks (if CLI test is impractical):**
- Open `backend/src/modules/units/units.service.js` and verify `transitionUnit()` is exported and used only by Story 4.2/4.3/4.4 controller routes (verified at code-review time).
- Open `backend/src/modules/units/__tests__/transitionUnit.test.js` and verify concurrency test simulates two transactions and asserts one wins, one loses with real status reported.

## Suggested Review Order

**State Machine & Concurrency (Core Design)**

- Complete guard table covering both RETAIL and RENTAL channels; compare-and-swap UPDATE pattern enforces atomicity.
  [`units.service.js:10-95`](../../backend/src/modules/units/units.service.js#L10)

- `transitionUnit()` function signature, reason validation for RECOVERY, concurrent soft-delete handling, and atomic event insert.
  [`units.service.js:232-340`](../../backend/src/modules/units/units.service.js#L232)

**Constants & Enumerations**

- All unit status transition causes defined once for reuse across epics; later epics extend, not duplicate.
  [`unit-status-cause.js`](../../backend/src/constants/unit-status-cause.js)

- UNIT_TRANSITION and UNIT_RECOVER gesture types added for Story 4.2/4.3/4.4 idempotency tracking.
  [`gesture-type.js`](../../backend/src/constants/gesture-type.js)

**Data Layer (Schema & Model)**

- `unit_status_events` table migration with columns (reason, occurred_at, sale_line_id, agreement_id), CHECKs for constraints.
  [`20260828000002-create-unit-status-events.js`](../../backend/database/migrations/20260828000002-create-unit-status-events.js)

- UnitStatusEvent model with timestamps and paranoid mode for soft-delete support.
  [`UnitStatusEvent.js`](../../backend/database/models/UnitStatusEvent.js)

**API Layer (Routes & Controller)**

- Routes wired with authentication; route ordering (by-barcode before :uuid) prevents param collisions.
  [`units.routes.js`](../../backend/src/modules/units/units.routes.js)

- Validation schemas for UUID, barcode, pagination; Zod typing for request/response envelopes.
  [`units.validation.js`](../../backend/src/modules/units/units.validation.js)

- Three read endpoints: GET /api/units/:uuid, GET /api/units/:uuid/status-events (paginated), GET /api/units/by-barcode/:barcode.
  [`units.controller.js:7-27`](../../backend/src/modules/units/units.controller.js#L7)

- Barcode validation (trim), pagination bounds checking, soft-delete filtering, 404 error handling.
  [`units.controller.js:33-80`](../../backend/src/modules/units/units.controller.js#L33)

**Service Layer (Queries & DTOs)**

- `getUnitByUuid()` and `getUnitByBarcode()` with colour/size associations and soft-delete filtering.
  [`units.service.js:345-409`](../../backend/src/modules/units/units.service.js#L345)

- `getUnitStatusEvents()` with pagination (newest-first), soft-delete filtering, actor name mapping (never raw ID).
  [`units.service.js:419-466`](../../backend/src/modules/units/units.service.js#L419)

**Testing & Verification**

- Comprehensive test suite covering race conditions, guard table coverage, RECOVERY constraints, Story 3.3 compatibility.
  [`transitionUnit.test.js`](../../backend/src/modules/units/__tests__/transitionUnit.test.js)
