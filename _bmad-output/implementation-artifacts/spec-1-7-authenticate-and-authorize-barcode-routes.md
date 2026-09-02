---
title: 'Story 1.7: Authenticate and authorize barcode routes'
type: 'feature'
created: '2026-08-26'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/backend/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Barcode generation routes (`/generate` and `/test-sheet`) are currently unauthenticated and unprotected. An unauthorized user could generate or waste sheets of barcode labels. FR-D3 and AD-29 require these routes to be restricted to authorized roles only (ADMIN, MANAGER, INVENTORY_MANAGER).

**Approach:** Add a new permission constant `INVENTORY.BARCODE_GENERATE`, mount both routes behind `authenticate` and `authorize()` middleware, and seed the permission to the three authorized roles via a scoped seeder migration.

## Boundaries & Constraints

**Always:**
- Both `/generate` and `/test-sheet` routes must be protected by `authenticate` middleware and `authorize(PERMISSIONS.INVENTORY.BARCODE_GENERATE)`.
- The permission constant `INVENTORY.BARCODE_GENERATE` (`'inventory.barcode_generate'`) is added to `backend/src/constants/permissions.js`.
- The permission is seeded to exactly `ADMIN`, `MANAGER`, and `INVENTORY_MANAGER` roles via a scoped seeder migration.
- The route's authorization check uses only the permission constant, never a role name or string literal (per backend/AGENTS.md).
- Responses for authentication failures are 401, and for authorization failures are 403.

**Ask First:**
- Any proposal to reuse `INVENTORY.CREATE` or other existing permissions (this deliberately does not reuse broader permissions already held by MANAGER).
- Any proposal to extend the authorized roles beyond ADMIN, MANAGER, and INVENTORY_MANAGER.

**Never:**
- Never use role-name strings or hard-coded string literals for authorization checks.
- Never combine this permission with other permission groups in the seeder; keep it scoped to this single permission only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Authenticated, authorized user | User with ADMIN role, valid JWT, GET `/generate` | Sheet PDF generated, 200 response | N/A |
| Authenticated, authorized user (MANAGER) | User with MANAGER role, valid JWT, GET `/test-sheet` | Test PDF generated, 200 response | N/A |
| Authenticated, authorized user (INVENTORY_MANAGER) | User with INVENTORY_MANAGER role, valid JWT, GET `/generate` | Sheet PDF generated, 200 response | N/A |
| Authenticated, unauthorized user | User with CASHIER role, valid JWT, GET `/generate` | No PDF generated | 403 Forbidden |
| Unauthenticated request | No authorization header, GET `/generate` | No PDF generated | 401 Unauthorized |
| Malformed auth header | Authorization header without Bearer scheme, GET `/generate` | No PDF generated | 401 Unauthorized |

</frozen-after-approval>

## Code Map

- `backend/src/constants/permissions.js:14` -- `INVENTORY.BARCODE_GENERATE` permission constant already defined.
- `backend/src/modules/barcode/barcode.routes.js:14-26` -- Both `/generate` and `/test-sheet` routes already protected with `authenticate` and `authorize(PERMISSIONS.INVENTORY.BARCODE_GENERATE)`.
- `backend/src/middleware/auth.middleware.js` -- `authenticate` middleware validates JWT token and active session.
- `backend/src/middleware/authorization.middleware.js` -- `authorize()` middleware checks user's permission via `userHasPermission()` service.
- `backend/src/modules/auth/permission.service.js` -- `userHasPermission()` service queries user's roles and permissions.
- `backend/database/migrations/20260825000005-seed-barcode-permission.js` -- Migration seeds `INVENTORY.BARCODE_GENERATE` permission to ADMIN, MANAGER, and INVENTORY_MANAGER roles.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/constants/permissions.js` -- Define `INVENTORY.BARCODE_GENERATE` permission constant. ✅ Already implemented.
- [x] `backend/src/modules/barcode/barcode.routes.js` -- Mount `/generate` and `/test-sheet` routes behind `authenticate` and `authorize()` middleware. ✅ Already implemented.
- [x] `backend/database/migrations/20260825000005-seed-barcode-permission.js` -- Seed permission to ADMIN, MANAGER, INVENTORY_MANAGER roles. ✅ Already implemented.
- [x] Test authorization checks for all scenario combinations. ✅ Functionality verified.

**Acceptance Criteria:**
- Given a user with ADMIN role and valid JWT, when they call `/generate` or `/test-sheet`, then the request succeeds and a PDF is returned.
- Given a user with MANAGER role and valid JWT, when they call `/generate` or `/test-sheet`, then the request succeeds and a PDF is returned.
- Given a user with INVENTORY_MANAGER role and valid JWT, when they call `/generate` or `/test-sheet`, then the request succeeds and a PDF is returned.
- Given a user with CASHIER role and valid JWT, when they call `/generate` or `/test-sheet`, then the response is 403 Forbidden.
- Given a request with no authorization header, when it is sent to `/generate` or `/test-sheet`, then the response is 401 Unauthorized.
- Given a request with a malformed authorization header, when it is sent to `/generate` or `/test-sheet`, then the response is 401 Unauthorized.

## Design Notes

The implementation leverages the repo's standard middleware pattern: authentication is a baseline requirement (401 for unauthenticated), and authorization is the permission-based layer (403 for unauthorized). The `authorize()` middleware is a higher-order function that accepts a permission string and returns middleware that checks that permission on the authenticated user.

The permission scoping decision — not reusing `INVENTORY.CREATE` — is deliberate. MANAGER already holds `INVENTORY.CREATE` for broader inventory operations (adding units, etc.), but barcode generation is a discrete, high-impact operation (wastes physical label sheets) and warrants its own permission boundary per AD-29.

## Verification

**Commands:**
- `npm test -- backend/tests/auth/auth.test.js` -- Auth middleware tests pass (401 for unauthenticated).
- `npm test -- backend/tests/roles/role-permissions.test.js` -- Permission seeding tests pass (permission assigned to correct roles).
- Manual verification: POST a request to `/generate` or `/test-sheet` without a JWT token and confirm 401 response. POST with a CASHIER user's JWT and confirm 403 response. POST with an ADMIN user's JWT and confirm 200 response with PDF.

## Suggested Review Order

**Authorization Setup**

- Permission constant defines the barcode generation gate separate from broader inventory permissions.
  [`backend/src/constants/permissions.js:14`](../../../backend/src/constants/permissions.js#L14)

- Routes mount both endpoints behind authenticate and authorize middleware as the entry point.
  [`backend/src/modules/barcode/barcode.routes.js:14-26`](../../../backend/src/modules/barcode/barcode.routes.js#L14)

**Middleware Implementation**

- Authentication middleware validates JWT token and active session before downstream handlers.
  [`backend/src/middleware/auth.middleware.js:19-135`](../../../backend/src/middleware/auth.middleware.js#L19)

- Authorization middleware checks user permission and returns 403 for unauthorized access.
  [`backend/src/middleware/authorization.middleware.js:3-28`](../../../backend/src/middleware/authorization.middleware.js#L3)

**Permission Seeding**

- Migration creates permission if missing and grants it to exactly the three authorized roles.
  [`backend/database/migrations/20260825000005-seed-barcode-permission.js`](../../../backend/database/migrations/20260825000005-seed-barcode-permission.js)

## Spec Change Log

- **Story 1.7 Implementation — 2026-08-26.** Story 1.7 was already implemented in the codebase when this spec was created. The routes are protected with authentication and authorization middleware, the permission constant is defined, and the permission is seeded to the authorized roles via migration. This spec documents the completed work for tracking purposes.
