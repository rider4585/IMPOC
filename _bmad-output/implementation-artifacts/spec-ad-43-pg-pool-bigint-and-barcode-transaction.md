---
title: 'AD-43 pg pool BIGINT parsing and barcode transaction fix'
type: 'bugfix'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Two architectural bugs prevent tests from passing: (1) BIGINT columns are parsed as strings instead of JavaScript numbers, breaking damage-grades and sizes test suites; (2) barcode.service.js calls User.findOne with a second positional argument that Sequelize silently ignores, causing the user lookup to run outside its transaction and violating AD-10's transaction boundary guarantee.

**Approach:** (1) Create a pg driver pool configuration that registers an int8 type parser at pool startup, applied in database/models/index.js. Remove the redundant parseInt workaround from app-settings.service.js; keep the Number.isSafeInteger guard. (2) Fix the barcode.service.js User.findOne call to pass transaction inside a single options object, matching the pattern already used in generateBarcodeTestSheet. Do not relax the transaction-wiring test — it is the only guard against this pattern recurring.

## Boundaries & Constraints

**Always:** 
- Keep the Number.isSafeInteger guard even after removing parseInt; it catches values beyond 2^53 that would silently lose precision
- Preserve the transaction-wiring test that asserts findOne receives exactly one argument; this test is the only defense against future regressions
- Apply pool config at startup, before any queries run

**Ask First:** None

**Never:** 
- Modify test acceptance criteria
- Add new test fixtures or user-facing behavior
- Change the damage-grades, sizes, or barcode.service test suites beyond fixing the real bugs they catch

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Read money column after fix | value_int: BIGINT in database | Parsed as JavaScript number, not string | N/A |
| Value beyond safe integer | value_int: > 2^53-1 | Number.isSafeInteger guard throws | Error with statusCode 500 |
| generateBarcodes transaction | User lookup, sequence draw, RequestKey.create | All three use the same transaction | N/A |

</frozen-after-approval>

## Code Map

- `backend/database/models/index.js` — Creates Sequelize instance; must apply pool config at line 7-17 before instance is used
- `backend/src/database/pg-pool-config.js` — **NEW FILE**. Exports function to register int8 (OID 20) type parser that converts BIGINT to JavaScript number
- `backend/src/modules/app-settings/app-settings.service.js:40-62` — INT branch: remove parseInt call (line 48) and UPSTREAM MARKER comment block (lines 50-52); fix indentation of remaining comment block
- `backend/src/modules/barcode/barcode.service.js:115-121` — generateBarcodes: merge { transaction } into single options object; line 179-183 shows correct pattern
- `backend/tests/barcode.service.test.js:105-134` — Test that verifies User.findOne receives exactly one argument; do NOT modify
- `backend/tests/damage-grades.test.js` — Tests BIGINT parsing from app_settings; currently fails with "Expected: 1000, Received: '1000'"
- `backend/tests/sizes.test.js` — Tests BIGINT parsing from app_settings; currently fails with "Expected: 1000, Received: '1000'"

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/database/pg-pool-config.js` -- Create new file with function to register pg type parser for int8 (OID 20) that converts BIGINT to JavaScript number, returns configured options object -- Implements the driver-level parsing that removes the need for application-level parseInt
- [x] `backend/database/models/index.js` -- Import pg-pool-config and apply it to the Sequelize constructor options (lines 7-17) -- Applies the type parser at pool startup before any queries
- [x] `backend/src/modules/app-settings/app-settings.service.js` -- Remove parseInt call (line 48) and delete the UPSTREAM MARKER comment block (lines 50-52); fix indentation of the Number.isSafeInteger guard comment -- Removes redundant workaround and cleans up mis-indented comment
- [x] `backend/src/modules/barcode/barcode.service.js:115-121` -- Merge { transaction } into the options object as a single argument to User.findOne -- Fixes the silently-ignored second argument bug
- [x] `backend/tests/barcode.service.test.js` -- Add invariant test: assert that a money column read from database is a number and not a string, verifying pool config does not revert -- Regression guard for AD-43

**Acceptance Criteria:**
- Given the pg pool is configured with the int8 type parser, when an INT app_setting is read from the database, then its value_int is a JavaScript number and not a string
- Given the barcode.service fixes, when generateBarcodes runs, then User.findOne is called with one options object containing the transaction, and the transaction argument passed to findOne is the same instance passed to RequestKey.create and the nextval draw
- Given the invariant test is added, when the pool config is inadvertently removed or changed, then the test fails with clear evidence that money columns are no longer parsed as numbers

## Spec Change Log

**Review Loop 1 (2026-08-31):** Code review uncovered five patch findings in pg-pool-config.js and models/index.js around error handling and edge-case guards. Applied fixes: (1) null/undefined guard at function entry, (2) updated parser callback to guard undefined, (3) added NaN validation, (4) wrapped setTypeParser in try-catch, (5) wrapped configureBigintParser call in try-catch in models/index.js. Barcode.service.js audit confirmed all Sequelize operations correctly pass transaction in single options object. All 62 targeted tests pass with no regressions. KEEP: pool config initialization order (before model imports), transaction wiring pattern (single options object).

## Verification

**Commands:**
- `cd backend && npm test` — expected: All 62 damage-grades (36), sizes (23), and barcode.service (3) tests pass. Tests in intake/units still fail due to separate User fixture bug (not in scope).

## Suggested Review Order

**Pool Configuration (Entry Point)**

- Sequelize pool initialization wraps parser setup in error handling; must run before any queries.
  [`models/index.js:22-27`](../../../backend/database/models/index.js#L22)

**BIGINT Type Parsing**

- Registers pg driver parser for OID 20 (int8) at pool startup; validates inputs and handles edge cases.
  [`pg-pool-config.js`](../../../backend/src/database/pg-pool-config.js)

- Removed redundant parseInt workaround; preserves Number.isSafeInteger guard for overflow detection.
  [`app-settings.service.js:48-55`](../../../backend/src/modules/app-settings/app-settings.service.js#L48)

**Transaction Boundary Fix**

- User lookup merged into single options object to ensure it runs inside gesture transaction.
  [`barcode.service.js:115-119`](../../../backend/src/modules/barcode/barcode.service.js#L115)

- Audited all Sequelize operations in file; confirmed correct transaction wiring throughout.
  [`barcode.service.js:146-154,177-180,203-211`](../../../backend/src/modules/barcode/barcode.service.js#L146)

**Regression Guards**

- Invariant test verifies money column reads as JavaScript number, catching pool config reversion.
  [`barcode.service.test.js:157-170`](../../../backend/tests/barcode.service.test.js#L157)

