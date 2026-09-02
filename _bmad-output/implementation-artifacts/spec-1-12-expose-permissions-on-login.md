---
title: 'Story 1.12: Expose the signed-in user''s permission set on login and session restore'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `/auth/login` and `/auth/me` response envelopes carry no permission information, leaving the frontend with no source to drive permission-based navigation and route guards as AD-29 requires.

**Approach:** Wire the existing `getUserPermissions(userUuid)` accessor (already used by the authorize middleware) into both auth response envelopes, adding a `permissions` field as a sorted array of permission-name strings.

## Boundaries & Constraints

**Always:** 
- Both `/auth/login` and `/auth/me` must call the same `getUserPermissions()` accessor so their arrays can never drift apart.
- The `permissions` field must be a sorted array of permission-name strings, not a Set or any other structure.
- Do not add an `preferences` field to either response — AD-37's user preferences do not exist until Epic 12 ships; the absence of a key is intentional and different from a null default.
- The existing `getUserPermissions()` function in `backend/src/modules/auth/permission.service.js` requires an active user (status = 'ACTIVE'), matching the existing validation in getCurrentUser.

**Ask First:** None.

**Never:** 
- Do not create new tables, columns, or queries to resolve permissions — reuse the existing accessor entirely.
- Do not introduce role-name string comparisons in the auth responses.
- Do not default the `preferences` field to empty or null.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CASHIER login | username/password for CASHIER user | permissions array = `['inventory.view', 'sales.create', 'sales.view']` (sorted) | N/A |
| INVENTORY_MANAGER login | username/password for INVENTORY_MANAGER user | permissions array = `['inventory.barcode_generate', 'inventory.create', 'inventory.delete', 'inventory.update', 'inventory.view']` (sorted) | N/A |
| GET /auth/me after CASHIER login | valid session for CASHIER user | permissions array = `['inventory.view', 'sales.create', 'sales.view']` (sorted) — identical to login response | N/A |
| GET /auth/me after INVENTORY_MANAGER login | valid session for INVENTORY_MANAGER user | permissions array = `['inventory.barcode_generate', 'inventory.create', 'inventory.delete', 'inventory.update', 'inventory.view']` (sorted) | N/A |
| Inactive user login | username/password for inactive user | Existing 401 behavior preserved; permissions field never evaluated | Existing 401 error |
| Non-existent user | valid session with deleted user UUID | Existing 401 behavior; getUserPermissions throws 401 and auth.controller catches it | Existing 401 error |

</frozen-after-approval>

## Code Map

- `backend/src/modules/auth/auth.controller.js:15-42` -- `login` handler currently returns user data + tokens with no permissions; needs to add permissions array to response
- `backend/src/modules/auth/auth.controller.js:91-115` -- `getCurrentUser` handler returns user data with no permissions; needs to add permissions array to response
- `backend/src/modules/auth/permission.service.js:7-52` -- Existing `getUserPermissions(userUuid)` returns Set of permission names; already used by authorize middleware; import and call from auth.controller
- `backend/tests/auth/auth.test.js` -- Existing test file where login and getCurrentUser tests live; add assertions for permissions array presence and values

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/modules/auth/auth.controller.js` -- Import `getUserPermissions` from `permission.service.js` at top of file
- [x] `backend/src/modules/auth/auth.controller.js` -- Modify `login` handler to call `getUserPermissions(user.uuid)` after successful login, spread the Set into a sorted array, and add `permissions` field to response data
- [x] `backend/src/modules/auth/auth.controller.js` -- Modify `getCurrentUser` handler to call `getUserPermissions(req.auth.userUuid)`, spread the Set into a sorted array, and add `permissions` field to response data
- [x] `backend/tests/auth/auth.test.js` -- Add test: login as CASHIER user and assert returned permissions array is exactly `['inventory.view', 'sales.create', 'sales.view']`
- [x] `backend/tests/auth/auth.test.js` -- Add test: login as INVENTORY_MANAGER user and assert returned permissions array is exactly `['inventory.barcode_generate', 'inventory.create', 'inventory.delete', 'inventory.update', 'inventory.view']`
- [x] `backend/tests/auth/auth.test.js` -- Add test: call GET /auth/me with valid CASHIER session and assert permissions array is identical to that role's login response

**Acceptance Criteria:**
- Given `/auth/login` is called with valid CASHIER credentials, when the response is received, then the `data` object contains a `permissions` array = `['inventory.view', 'sales.create', 'sales.view']` and no `preferences` key at all
- Given `/auth/login` is called with valid INVENTORY_MANAGER credentials, when the response is received, then the `data` object contains a `permissions` array = `['inventory.barcode_generate', 'inventory.create', 'inventory.delete', 'inventory.update', 'inventory.view']` and no `preferences` key
- Given `GET /auth/me` is called with an active CASHIER session, when the response is received, then the `data` object contains an identical `permissions` array to the login response for that role
- Given `GET /auth/me` is called with an active INVENTORY_MANAGER session, when the response is received, then the `data` object contains an identical `permissions` array to the login response for that role
- Given a user with a new or modified permission set logs in, when the login response is received, then the `permissions` array reflects the current resolved set from `getUserPermissions()`

## Spec Change Log

**Review Loop 1 (2026-09-01):**
- **Finding:** Verification Gap Hunter identified missing test coverage for INVENTORY_MANAGER GET /auth/me endpoint
- **Amendment:** Added test case in backend/tests/auth/auth.test.js to verify INVENTORY_MANAGER user returns identical permissions array in GET /auth/me as in POST /auth/login
- **State Avoided:** INVENTORY_MANAGER permissions could break in GET /auth/me response without verification catching it
- **KEEP:** Both login and GET /me tests now cover CASHIER and INVENTORY_MANAGER roles with identical assertions (tests 1-2 for login, tests 3-4 for GET /me)

## Verification

**Commands:**
- `cd backend && npm test -- auth.test.js` -- All auth tests pass, including the three new permission-related tests
- `cd backend && npm test -- role-permissions.test.js` -- Existing role-permission tests continue to pass

**Manual checks:**
- Verify login response contains `permissions` array for both test users and no `preferences` key exists
- Verify GET /auth/me response contains `permissions` array matching the login response for the same session

## Suggested Review Order

**Permission Retrieval & Response Integration**

- Import `getUserPermissions` and wire into login response — establishes the core data flow.
  [`auth.controller.js:15-39`](../../../backend/src/modules/auth/auth.controller.js#L15)

- Apply identical permission retrieval pattern to session-restore endpoint — ensures consistency between login and GET /auth/me.
  [`auth.controller.js:103-117`](../../../backend/src/modules/auth/auth.controller.js#L103)

**Test Coverage**

- Login tests for both roles verify permissions array and sorted order — confirms data structure contract.
  [`auth.test.js:111-173`](../../../backend/tests/auth/auth.test.js#L111)

- GET /auth/me tests for both roles verify consistency between login and session restore — closes verification gap.
  [`auth.test.js:357-430`](../../../backend/tests/auth/auth.test.js#L357)
