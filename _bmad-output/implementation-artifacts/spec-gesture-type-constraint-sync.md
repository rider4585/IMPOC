---
title: 'Fix gesture-type CHECK constraint drift'
type: 'bugfix'
created: '2026-09-02'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `BARCODE_GENERATE_TEST` was added to `gesture-type.js` and used by the `/test-sheet` route, but the database `request_keys_gesture_type_check` constraint was never extended. The original migration 04 has been applied to dev, so editing it won't propagate the fix. Any attempt to insert a request with `BARCODE_GENERATE_TEST` gesture_type fails on the constraint.

**Approach:** Create a new migration that drops and recreates the `request_keys_gesture_type_check` constraint with the full fifteen-value list. Add a test that asserts the database constraint values exactly match the keys exported by `gesture-type.js`, preventing future drift.

## Boundaries & Constraints

**Always:**
- Do NOT edit migration 20260825000004 — it has already been applied to dev; editing applied migrations is what enabled this drift.
- The new migration must have its own sequence number (after 20260828000002, the current latest).
- The down() method must restore the original fourteen-value constraint so the migration is reversible.
- The test must validate against a real migrated database, not a synced one (since sync() omits the CHECK).

**Ask First:**
- If the test setup needs changes to how migrations are run in tests, ask before proceeding.

**Never:**
- Do not add the constraint to the Sequelize model — it is raw SQL and belongs only in migrations.
- Do not attempt to auto-generate the gesture types list; hardcode the full list in both the migration up() and a test constant.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path: insert with valid BARCODE_GENERATE_TEST | gesture_type = 'BARCODE_GENERATE_TEST' | Insert succeeds | N/A |
| Constraint enforces new type | gesture_type = 'BARCODE_GENERATE_TEST' after migration | Insert allowed; no constraint violation | N/A |
| Test catches drift | gesture-type.js exports new type; constraint omits it | Test fails; alert developer | Assertion failure names missing/unexpected types |
| Rollback removes new type | down() runs after up() | Constraint reverts to 14 values; insert with BARCODE_GENERATE_TEST fails | Constraint violation on insert |

</frozen-after-approval>

## Code Map

- `backend/src/constants/gesture-type.js` (line 1–20) — Exports GESTURE_TYPES with 15 keys including BARCODE_GENERATE_TEST
- `backend/database/models/RequestKey.js` (line 20–24) — Model defines gesture_type column but NO CHECK (sync() won't create it)
- `backend/database/migrations/20260825000004-create-request-keys.js` (line 4–20, 96–99) — Original migration with CHECK constraint; now carries 15 values but database only has 14
- `backend/tests/barcode.idempotency.test.js` (line 20–60) — Test setup pattern: sequelize.sync(), create models, run test

## Tasks & Acceptance

**Execution:**
- [x] `backend/database/migrations/20260902000003-extend-request-keys-gesture-type-check.js` — Create new migration with up() that drops and recreates the constraint with all 15 gesture types, and down() that restores the 14-value form. Use the same pattern as 20260825000004 (queryInterface.sequelize.query with raw SQL).
- [x] `backend/tests/request-keys-constraint.test.js` — Add test that creates a real migrated database, inserts test rows for each gesture type, and asserts the set of permitted types exactly matches GESTURE_TYPES_ARRAY from gesture-type.js. Document that this test MUST run against a migrated database, not sync().

**Acceptance Criteria:**
- Given migration is applied to a migrated database, when a row is inserted with gesture_type='BARCODE_GENERATE_TEST', then the insert succeeds (no constraint violation).
- Given the test runs against a migrated database, when it queries the constraint and compares to gesture-type.js, then no missing or unexpected types are found.
- Given down() is called on the new migration, when a row is inserted with gesture_type='BARCODE_GENERATE_TEST', then the insert fails with a constraint violation.

## Design Notes

The constraint is enforced only by raw SQL in migrations, not by the Sequelize model. The test database (created with sync()) will not have the CHECK constraint at all — sync() only creates what the models define. Therefore, the new test must either:

1. Run against a migrated database (preferred for this constraint test), not a synced one.
2. Or spin up a separate test database connection that runs migrations before testing.

The test should live alongside other database-specific tests, not model unit tests. Use the same Jest setup pattern as `barcode.idempotency.test.js`.

## Verification

**Commands:**
- `npm run db:migrate` — Applies all pending migrations, including the new one; expected: no errors, constraint extended.
- `npm test` — Runs full test suite; expected: all tests pass, including the new gesture-type constraint test.

**Manual checks (if no CLI):**
- After `npm run db:migrate`, query the database: `\d+ request_keys` in psql to verify the constraint includes all 15 types.
- Attempt to insert a test row with gesture_type='BARCODE_GENERATE_TEST' in psql; should succeed.

## Suggested Review Order

**Migration: Extend CHECK constraint**

- Drops old constraint idempotently (IF EXISTS) and recreates with all 15 gesture types.
  [`20260902000003:1-50`](../../backend/database/migrations/20260902000003-extend-request-keys-gesture-type-check.js#L1)

- Restores original 14-value constraint on downgrade; shows reversibility and error handling.
  [`20260902000003:53-100`](../../backend/database/migrations/20260902000003-extend-request-keys-gesture-type-check.js#L53)

**Test: Constraint synchronization and drift prevention**

- Accepts all 15 gesture types from GESTURE_TYPES_ARRAY; validates constraint allows new BARCODE_GENERATE_TEST.
  [`request-keys-constraint:130-180`](../../backend/tests/request-keys-constraint.test.js#L130)

- Rejects invalid gesture types; confirms constraint enforces its specification at database level.
  [`request-keys-constraint:172-198`](../../backend/tests/request-keys-constraint.test.js#L172)

- Queries pg_constraint and validates values exactly match gesture-type.js; prevents future drift.
  [`request-keys-constraint:213-266`](../../backend/tests/request-keys-constraint.test.js#L213)

