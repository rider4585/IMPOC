---
title: 'Fix barcode test failures from gesture type split'
type: 'bugfix'
created: '2026-09-02'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 1 backend correctly split barcode gesture types into `BARCODE_GENERATE` (/generate) and `BARCODE_GENERATE_TEST` (/test-sheet), but two tests in `backend/tests/barcode.integration.test.js` were not updated. They seed request_keys rows with the wrong gesture type, causing test failures: "should return cached result on /test-sheet replay with same requestUuid" and "should generate test sheet PDF with geometry from app_settings" both fail because the test sheet lookup uses `BARCODE_GENERATE_TEST` but the seeded row uses `BARCODE_GENERATE`.

**Approach:** Fix the two failing tests to use `BARCODE_GENERATE_TEST` when seeding rows for /test-sheet. Verify the constant is present in both `gesture-type.js` and the request_keys CHECK constraint. Scan the codebase for other places where two distinct gestures might share one gesture type (the pattern that caused this bug), confirming no similar latent issues exist elsewhere. Run the full test suite to confirm all 386 tests pass.

## Boundaries & Constraints

**Always:** 
- Do NOT undo the gesture type split—it is correct and necessary to prevent AD-22 replay bugs where one route's cached result returns a different route's document.
- The migration 20260825000004-create-request-keys.js has already been applied; any changes to the CHECK constraint must use a new migration.

**Ask First:** None.

**Never:** 
- Merge BARCODE_GENERATE and BARCODE_GENERATE_TEST back into a single gesture type.

</frozen-after-approval>

## Code Map

- `backend/src/constants/gesture-type.js` -- Gesture type constants; BARCODE_GENERATE_TEST should be present alongside BARCODE_GENERATE.
- `backend/database/migrations/20260825000004-create-request-keys.js` -- Migration that creates request_keys table with CHECK constraint on gesture_type; both gesture type values should be listed.
- `backend/tests/barcode.integration.test.js` -- Test file with two failing tests (lines 318–342 and 344–377) that seed rows with the wrong gesture type.
- `backend/src/modules/barcode/barcode.controller.js` -- Controller using idempotency lookup; lines 24 and 113 show the split is already implemented correctly.
- `backend/src/modules/barcode/barcode.service.js` -- Service inserting request_keys rows; lines 162 and 219 show both gesture types are used correctly.

## Tasks & Acceptance

**Execution:**
- [x] `backend/tests/barcode.integration.test.js` -- Update line 324 from `GESTURE_TYPES.BARCODE_GENERATE` to `GESTURE_TYPES.BARCODE_GENERATE_TEST` in the test "should return cached result on /test-sheet replay with same requestUuid" -- This test seeded a /test-sheet result, so the gesture type must match the /test-sheet route.
- [x] `backend/tests/barcode.integration.test.js` -- Update line 369 from `GESTURE_TYPES.BARCODE_GENERATE` to `GESTURE_TYPES.BARCODE_GENERATE_TEST` in the test "should generate test sheet PDF with geometry from app_settings" -- This test verifies /test-sheet creates a request_keys row with the correct gesture type.
- [x] `backend/src/constants/gesture-type.js` -- Verify BARCODE_GENERATE_TEST is present in the GESTURE_TYPES object.
- [x] `backend/database/migrations/20260825000004-create-request-keys.js` -- Verify both BARCODE_GENERATE and BARCODE_GENERATE_TEST are listed in the gestureTypeValues array used for the CHECK constraint.
- [x] Scan codebase for other routes/services that might share a gesture type between two distinct operations (the anti-pattern that caused this issue) -- No existing similar issues should be found.
- [x] Run `npm test` in backend directory and report the final count (should be 386 passing, 0 failing).

**Acceptance Criteria:**
- Given the two failing tests in barcode.integration.test.js, when the gesture types are changed to match the routes they test, then all 386 tests pass.
- Given BARCODE_GENERATE_TEST is used in /test-sheet controller and service, when the migration CHECK constraint is inspected, then BARCODE_GENERATE_TEST is listed as a valid value.
- Given the codebase has been scanned, when no other route/operation pair shares a single gesture type, then no additional changes are needed.

## Spec Change Log

(Empty until review loopback)

## Suggested Review Order

**Gesture Type Split Verification**

- Confirms /test-sheet endpoint uses BARCODE_GENERATE_TEST for cache lookups and request_keys creation.
  [`barcode.controller.js:113`](../../../backend/src/modules/barcode/barcode.controller.js#L113)

- Service layer creates request_keys with correct gesture type; no regressions from split.
  [`barcode.service.js:219`](../../../backend/src/modules/barcode/barcode.service.js#L219)

**Test Fixes**

- Fixes failing test by using BARCODE_GENERATE_TEST instead of BARCODE_GENERATE for cache replay.
  [`barcode.integration.test.js:324`](../../../backend/tests/barcode.integration.test.js#L324)

- Fixes second failing test to use correct gesture type for request_keys verification.
  [`barcode.integration.test.js:369`](../../../backend/tests/barcode.integration.test.js#L369)

**Constants and Constraints**

- Gesture type constant present and available for use in tests.
  [`gesture-type.js:16`](../../../backend/src/constants/gesture-type.js#L16)

- Migration CHECK constraint includes BARCODE_GENERATE_TEST; both gesture types listed.
  [`20260825000004-create-request-keys.js:19`](../../../backend/database/migrations/20260825000004-create-request-keys.js#L19)

