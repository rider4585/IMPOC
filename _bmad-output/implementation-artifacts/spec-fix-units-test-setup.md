---
title: 'Fix test setup for Story 3.3 unit scan tests'
type: 'bugfix'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `tests/intake/units.test.js` has 12 failing test cases because the test setup is incomplete. The suite sends a literal `Bearer test_token` string instead of a real JWT token (failing auth), creates a role with no permissions (failing authorization), and uses an invalid passwordHash that won't survive real-world auth flows.

**Approach:** Refactor the test suite to use the same patterns already proven in `tests/roles/roles.test.js`: initialize the test database with `initializeTestDatabase()` and test helpers from `tests/utils/test-setup.js`, grant the test role the required `inventory.create` permission, mint a real JWT token via login, and use that token for all requests.

## Boundaries & Constraints

**Always:**
- Use `initializeTestDatabase()` to set up the database, which automatically seeds predefined roles and permissions
- Grant the test role the `inventory.create` permission that the `/api/stock-intake-lines/:uuid/scan` route requires (line 28 of stock-intake-line.routes.js)
- Mint a real JWT token by POSTing to `/api/auth/login` with a valid user (matching the pattern in roles.test.js lines 28–34)
- Use a real argon2-hashed password (use `argon2.hash()` as shown in roles.test.js line 22)
- Do not modify production code to accommodate the test; only fix test setup
- All 12 tests in this file must pass after the fix

**Ask First:**
- None — all requirements are settled and the pattern is proven in the codebase

**Never:**
- Keep the literal `Bearer test_token` token
- Leave the test role without the `inventory.create` permission
- Use an invalid passwordHash like `'hash'`
- Modify the scan route's auth/permission logic

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| POST to scan with valid JWT | `Bearer ${realToken}` from login | 201 Created with unit data | N/A |
| POST to scan with invalid token | `Bearer test_token` (literal) | 401 Unauthorized | Already failing (fix should resolve) |
| Scan by user with no INVENTORY.CREATE | Valid JWT but permissionless role | 403 Forbidden | Already failing (fix should resolve) |
| Multiple scan requests in same test | Different barcodes | Each gets 201 (or expected error like 409) | Reuse same token across tests |

</frozen-after-approval>

## Code Map

- `backend/tests/intake/units.test.js` -- Test file with 12 failing tests; needs refactoring to use real JWT
- `backend/tests/roles/roles.test.js` (lines 13–34) -- Working pattern: `initializeTestDatabase()`, `generateTestUser()`, login to get `adminToken`, use `Bearer ${adminToken}`
- `backend/tests/utils/test-setup.js` -- Exports `initializeTestDatabase()`, `generateTestUser()`, `generateTestRole()`, `closeDatabase()`, `cleanupTestDatabase()`; seeds INVENTORY_MANAGER role with `inventory.create` permission
- `backend/src/modules/intake/stock-intake-line.routes.js` (line 28) -- Scan route requires `authenticate` and `authorize(PERMISSIONS.INVENTORY.CREATE)`
- `backend/src/constants/permissions.js` (line 11) -- `PERMISSIONS.INVENTORY.CREATE` resolves to `'inventory.create'`
- `backend/database/models/index.js` -- Exports `sequelize`, `User`, `Role`, `Permission`, and other models

## Tasks & Acceptance

**Execution:**
- [x] `backend/tests/intake/units.test.js` -- Replace the entire `beforeAll` hook and test helper logic with the pattern from `tests/roles/roles.test.js`: (1) import `initializeTestDatabase`, `generateTestUser`, `cleanupTestDatabase`, `closeDatabase` from test-setup; (2) call `initializeTestDatabase()` in `beforeAll`; (3) use `generateTestUser()` to create a test user object with valid password; (4) hash password with `argon2.hash()`; (5) create user in database; (6) find INVENTORY_MANAGER role (which has `inventory.create` permission) or create a test role and explicitly add the permission; (7) add role to user; (8) login via POST `/api/auth/login` to get a real JWT token; (9) use `Bearer ${token}` in all test requests -- Rationale: Closes auth gap, permission gap, and passwordHash gap in one unified refactor; reuses proven patterns from roles.test.js to minimize new code
- [x] `backend/tests/intake/units.test.js` -- Update all 12 test cases to use the real JWT token variable instead of `Bearer test_token` -- Rationale: Each test must send valid auth to reach the scan logic; without this the server rejects before the scan code even runs
- [x] Run `npm test` -- expected: 365 pass (353 existing + 12 fixed in this file), 0 fail -- Rationale: Verifies the entire suite passes; no production code was modified, only test setup

**Acceptance Criteria:**
- Given a test user with the INVENTORY_MANAGER role (which has `inventory.create` permission), when a POST request is sent to `/api/stock-intake-lines/:uuid/scan` with `Bearer ${realJwtToken}` and valid barcode/colour/size, then the response is 201 with the created unit object
- Given a test user with INVENTORY_MANAGER role and a valid JWT token, when 12 separate scan tests run (different scenarios: valid barcode, duplicate barcode, quantity limit, inactive colour, etc.), then all 12 pass without 401 or 403 errors
- Given the test file runs after all other test suites, when `npm test` is executed, then 365 tests pass and 0 tests fail

## Design Notes

The existing `tests/utils/test-setup.js` already:
- Seeds five predefined roles: ADMIN, MANAGER, INVENTORY_MANAGER, CASHIER, ACCOUNTANT (lines 35–41)
- Assigns `inventory.create` (line 52) to INVENTORY_MANAGER (lines 87–91)
- Provides generator functions to create unique test users/roles (generateTestUser, generateTestRole)

This means the test can reuse INVENTORY_MANAGER directly instead of creating a new role. If creating a custom role is preferred, the pattern is:
1. Use `generateTestRole()` to get a unique role name
2. Create the role with `db.Role.create()`
3. Attach permissions with `role.addPermissions([permission])`

However, reusing INVENTORY_MANAGER is simpler and matches how roles.test.js reuses the ADMIN role.

## Verification

**Commands:**
- `npm test` -- expected: 365 pass, 0 fail (353 existing tests + 12 fixed in units.test.js)
- `npm test -- --testPathPattern="units.test"` -- expected: 12 pass, 0 fail (only units tests)

**Manual checks:**
- Open `backend/tests/intake/units.test.js` and verify all `.set('Authorization', ...)` lines use `Bearer ${token}` (or similar) where `token` is the real JWT from login, not a literal string
- Verify `beforeAll` imports and calls `initializeTestDatabase()`
- Verify the test role is either INVENTORY_MANAGER or explicitly has the `inventory.create` permission added
