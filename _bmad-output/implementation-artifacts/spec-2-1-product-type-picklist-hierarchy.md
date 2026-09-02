---
title: 'Story 2.1: Product type picklist with self-referencing hierarchy'
type: 'feature'
created: '2026-08-26'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inventory managers need to create and maintain product types in a nested hierarchy (e.g., "Saree" → "Paithani", "Kurti" → "V-neck"), but currently have no way to organize them beyond free text. Without this picklist, intake records drift into inconsistent categories.

**Approach:** Build a self-referencing `product_types` table with optional parent-child relationships, a REST API with CRUD operations for hierarchy manipulation, and service-layer validation to prevent cycles (a type may not be its own ancestor).

## Boundaries & Constraints

**Always:**
- API exposes `uuid` only; integer `id` never leaves the process (AD-1)
- Deactivation is an UPDATE to `is_active = false`, not a soft delete via `deleted_at`
- Table has `deleted_at TIMESTAMPTZ NULL` for schema uniformity, but is never written by this story
- Sequelize model registers `paranoid: true` for AD-4 compliance, though soft-delete is not used
- Two partial unique indexes: one on `name WHERE parent_id IS NULL AND deleted_at IS NULL` (top-level names unique) and one on `(parent_id, name) WHERE parent_id IS NOT NULL AND deleted_at IS NULL` (subtype names unique within parent)
- Cycle detection walks the ancestry chain before INSERT or UPDATE; a type may not be its own ancestor or any descendant's ancestor
- Missing parent UUIDs throw a 404-mapped error naming the missing parent; missing creates no row
- GET routes require `authenticate` only; POST/PATCH routes require `authorize(PERMISSIONS.INVENTORY.CREATE)` or `authorize(PERMISSIONS.INVENTORY.UPDATE)` respectively
- Error objects have `statusCode` property for HTTP middleware mapping

**Ask First:**
- Whether to add a `sort_order` column for display ordering (currently omitted; can be added to a future epic if ordering becomes important)
- Whether to validate parent type names for case-sensitivity (current spec treats names case-sensitively; Epic 3 intake validation will define case-folding rules for lookup)

**Never:**
- Do not use Postgres ENUM for `is_active` or any constrained value (AD-3)
- Do not add a hard delete or allow `DELETE FROM product_types` — soft-active is the only deactivation
- Do not permit narrowing a hierarchy (a child may never be reassigned to a "shallower" parent or become top-level once assigned)
- Do not resolve a parent UUID at read time; freeze the `parent_id` at write time and never navigate the hierarchy in queries
- Do not return internal `id` in any response or accept it in any request

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create top-level type | `{ name: "Saree" }` (no parentUuid) | Returns `{ uuid, name, isActive, createdAt, updatedAt }`, `parent_id = NULL` in DB | N/A (valid) |
| Create subtype | `{ name: "Paithani", parentUuid: "<saree-uuid>" }` where parent exists | Returns new type's `uuid` and parent's `uuid` as `parentUuid` (never `parent_id`) | N/A (valid) |
| Create subtype, parent missing | `{ name: "Paithani", parentUuid: "<nonexistent-uuid>" }` | 404 error naming the missing parent, no row inserted | Error: "Product type not found" |
| Create type, duplicate name at top level | `{ name: "Saree" }` when "Saree" already exists | 409 error, no row inserted | Constraint violation mapped via AD-11 |
| Create type, duplicate name within parent | `{ name: "V-neck", parentUuid: "kurti-uuid" }` when V-neck already exists under that parent | 409 error, no row inserted | Constraint violation mapped via AD-11 |
| Create type, cycle detection — self-reference | `{ name: "Self", parentUuid: "<own-uuid>" }` | 409 error "type may not be its own ancestor", no row inserted | Cycle detected in ancestry walk |
| Create type, cycle detection — descendant loop | Type A → B → C; attempt to set A's parent to C | 409 error naming the cycle, no row updated | Cycle detected in ancestry walk |
| Update type, valid parent change | Update type's `parentUuid` from "old-uuid" to "new-uuid" | Only `parent_id`, `updated_at` change; `is_active` untouched | N/A (valid) |
| Update type, set to inactive | `PATCH { isActive: false }` on active type | Only `is_active` changes; `deleted_at` and other columns untouched | N/A (valid) |
| List all types, active and inactive | GET `/api/picklists/product-types` | Returns all non-deleted types, both active and inactive | N/A |
| Fetch one type by UUID | GET `/api/picklists/product-types/<uuid>` where type exists | Returns type object | N/A (valid) |
| Fetch one type by UUID, not found | GET `/api/picklists/product-types/<invalid-uuid>` | 404 error "Product type not found" | Error: Type not found |
| Authentication missing | Any request without Authorization header | 401 Unauthorized | Middleware rejects |
| Authorization insufficient | POST request with `CASHIER` role (lacks `PERMISSIONS.INVENTORY.CREATE`) | 403 Forbidden | Middleware rejects |

</frozen-after-approval>

## Code Map

- `backend/app.js` (lines 1–29) – Module registration pattern; add `productTypesRoutes` import and `app.use('/api/picklists/product-types', productTypesRoutes)`
- `backend/database/models/index.js` (lines 1–145) – Model factory index; import ProductType factory, instantiate, define relationships (self-referential `hasMany`/`belongsTo` for parent-child)
- `backend/database/migrations/20260807174936-create-users.js` (lines 1–49) – UUID and timestamp patterns for new migration; use `Sequelize.literal('gen_random_uuid()')` and `Sequelize.literal('CURRENT_TIMESTAMP')`
- `backend/src/modules/roles/role.service.js` (lines 1–143) – Service CRUD pattern; use for `productTypes.service.js` structure (get all, create, get one by UUID with 404 handling, update, deactivate)
- `backend/src/modules/roles/role.validation.js` (lines 1–37) – Zod schema patterns; create `product-type.validation.js` with `.trim()`, `.max()`, `.optional().nullable()` for validation
- `backend/src/modules/roles/role.controller.js` (lines 10–110) – HTTP request handling pattern; use `try/catch` with `next(error)`, schema parsing, DTO mapping, `{ success: true, data: ... }` response shape
- `backend/src/modules/roles/role.routes.js` (lines 1–55) – Route registration with `authenticate` and `authorize()` middleware; apply to `productTypesRoutes`
- `backend/src/constants/permissions.js` (lines 1–38) – Permission constants; add `PICKLISTS: { VIEW: 'picklists.view', CREATE: 'picklists.create', UPDATE: 'picklists.update' }` (or reuse existing `INVENTORY.*`)
- `backend/src/middleware/auth.middleware.js` (lines 1–135) – Bearer token verification; already handles `/api/picklists/*` routes
- `backend/src/middleware/authorization.middleware.js` (lines 1–28) – Permission checking; already handles PERMISSIONS constants
- `backend/src/middleware/error.middleware.js` (lines 1–25) – Error status mapping; converts `error.statusCode` to HTTP response
- `backend/tests/roles/roles.test.js` (lines 1–100) – Testing pattern with `supertest`, `beforeAll`/`afterAll`, happy path + error cases, auth checks, validation checks, conflict checks; use for `product-types.test.js`

## Tasks & Acceptance

**Execution:**
- [ ] `backend/database/migrations/YYYYMMDDHHMMSS-create-product-types.js` -- Create migration with `id` (SERIAL PK), `uuid` (unique), `name`, `parent_id` (nullable FK to self), `is_active`, `deleted_at`, `created_at`/`updated_at`, plus two partial unique indexes and CHECK constraints per AD-4/AD-3 -- Establishes the mutable master-data table for product type hierarchy
- [ ] `backend/database/models/ProductType.js` -- Define Sequelize model with `paranoid: true`, `underscored: true`, self-referential `hasMany`/`belongsTo` relationships, UUID `field` mappings -- Completes schema binding and allows service/controller to query relationships
- [ ] `backend/database/models/index.js` -- Import ProductType factory, instantiate model, define parent-child relationships in the relationships section -- Integrates model into app's dependency injection
- [ ] `backend/src/constants/permissions.js` -- Add or reuse `INVENTORY.CREATE` and `INVENTORY.UPDATE` constants if not present; if new `PICKLISTS` namespace preferred, add `PICKLISTS.VIEW`, `PICKLISTS.CREATE`, `PICKLISTS.UPDATE` -- Enables authorization middleware to guard routes
- [ ] `backend/src/modules/product-types/product-type.validation.js` -- Define Zod schemas for `createProductTypeSchema` (name, parentUuid optional) and `updateProductTypeSchema` (any field optional, refine to require at least one) -- Validates request bodies before service layer
- [ ] `backend/src/modules/product-types/product-type.service.js` -- Implement service with `getProductTypes()`, `createProductType({ name, parentUuid })`, `getProductTypeByUuid(uuid)`, `updateProductType(uuid, data)`, `deactivateProductType(uuid)` methods; add cycle detection in create and update that walks the ancestry chain and throws 409 if cycle found; add parent UUID validation (404 if parent missing); use `statusCode` on all errors -- Central business logic layer
- [ ] `backend/src/modules/product-types/product-type.controller.js` -- Define controller methods mirroring service methods; parse request bodies with Zod, call service, map response to DTO (uuid, name, parentUuid, isActive, createdAt, updatedAt), return `{ success: true, data }` shape, handle errors with `next(error)` -- HTTP request handling
- [ ] `backend/src/modules/product-types/product-type.routes.js` -- Define routes: GET `/` (authenticate only), POST `/` (authenticate + authorize INVENTORY.CREATE), GET `/:uuid` (authenticate only), PATCH `/:uuid` (authenticate + authorize INVENTORY.UPDATE); mount on `/api/picklists/product-types` -- Express routing and middleware stacking
- [ ] `backend/app.js` -- Add import `import productTypesRoutes from './src/modules/product-types/product-type.routes.js'` and `app.use('/api/picklists/product-types', productTypesRoutes)` after the roles routes registration -- Registers new module with the main app
- [ ] `backend/tests/product-types/product-types.test.js` -- Write integration tests using `supertest`; cover: create top-level type, create subtype with valid parent, create subtype with missing parent (404), duplicate name at top level (409), duplicate name within parent (409), cycle self-reference (409), cycle descendant loop (409), update parent, deactivate, list all, get one, authentication missing (401), authorization insufficient (403) -- Validates all I/O scenarios and error cases

**Acceptance Criteria:**
- Given the database is initialized with the migration, when the ProductType model is loaded, then `product_types` table exists with `id`, `uuid`, `parent_id`, `name`, `is_active`, `deleted_at`, `created_at`, `updated_at` columns and two partial unique indexes on (`name WHERE parent_id IS NULL AND deleted_at IS NULL`) and (`(parent_id, name) WHERE parent_id IS NOT NULL AND deleted_at IS NULL`)
- Given a user with `INVENTORY.CREATE` permission and a valid parent UUID, when `POST /api/picklists/product-types { name, parentUuid }` is called, then the service walks the ancestry chain, detects no cycle, finds the parent, inserts the row, and returns `{ success: true, data: { uuid, name, parentUuid, isActive, createdAt, updatedAt } }` with 201 status
- Given a user without `INVENTORY.CREATE` permission, when `POST /api/picklists/product-types { name }` is called, then the authorization middleware rejects with 403
- Given an existing product type, when a request attempts to set its `parentUuid` to its own UUID or to a descendant's UUID, then the service's ancestry walk detects the cycle, returns a 409 error naming the cycle, and inserts or updates no row
- Given an active product type referenced by existing units (in a later epic), when `PATCH /api/picklists/product-types/:uuid { isActive: false }` is called, then only `is_active` changes, `deleted_at` remains NULL, and units already referencing the type still resolve it unchanged
- Given a deactivated product type and an intake form (in Epic 3) that filters to active types only, when the type is listed in the admin screen via `GET /api/picklists/product-types`, then the inactive type is returned and the admin can see it is inactive and optionally reactivate it

## Design Notes

**Cycle Detection Strategy:** The service walks the ancestry chain before any INSERT or UPDATE. For a new or updated parent UUID, it follows the chain from parent → grandparent → great-grandparent → ... until it reaches a root (NULL) or detects a cycle. If the chain ever reaches the current type's own `id`, a cycle is detected and rejected. This is simpler than a full graph-traversal algorithm because trees (not DAGs) are the only valid state. The walk is done in application code, not a recursive SQL query, for clarity and error reporting.

**Deactivation vs. Soft Delete:** `is_active` is a separate boolean (mutable master-data tier, AD-5) from `deleted_at` (uniform across schema, AD-4, never written by this story). This lets intake (Epic 3) reject inactive types while admins can still reactivate them without a full restore operation. A soft-deleted row would be harder to reason about: if it's not returned by the model, the admin screen can't show it; if it is returned, the model's implicit filtering becomes fragile.

**Example: Hierarchy Creation**
```
POST /api/picklists/product-types
{ "name": "Saree" }
→ { "uuid": "abc-123", "name": "Saree", "parentUuid": null, "isActive": true, ... }

POST /api/picklists/product-types
{ "name": "Paithani", "parentUuid": "abc-123" }
→ { "uuid": "def-456", "name": "Paithani", "parentUuid": "abc-123", "isActive": true, ... }
```

## Verification

**Commands:**
- `npm run migrate:latest -- --env test` -- expected: Migration `05-create-product-types` runs without error, creating the table and indexes
- `npm run test -- backend/tests/product-types/product-types.test.js` -- expected: All test cases pass (create, cycle detection, uniqueness, deactivation, authorization)
- `npm run lint -- backend/src/modules/product-types/` -- expected: No linting errors or style violations

**Manual checks (if no CLI):**
- Verify in psql that `product_types` table exists with correct columns and constraints: `\d product_types`
- Verify partial indexes were created: `SELECT indexname FROM pg_indexes WHERE tablename='product_types'`
- Call `GET /api/picklists/product-types` with a Bearer token and verify the response shape has `data: [...]` with no `id` fields visible
- Call `POST /api/picklists/product-types { name, parentUuid: <self-uuid> }` and verify 409 error with cycle message is returned

## Suggested Review Order

**Schema & Database Foundation**

- Self-referencing table with partial unique indexes for hierarchy uniqueness constraints
  [`20260826084342-create-product-types.js:1`](../../../backend/database/migrations/20260826084342-create-product-types.js#L1)

- Sequelize model with paranoid support and self-referential relationships (parent-child)
  [`ProductType.js:1`](../../../backend/database/models/ProductType.js#L1)

- Model integration into app's dependency injection and relationship setup
  [`models/index.js:1`](../../../backend/database/models/index.js#L1)

**Business Logic & Validation**

- Service layer with cycle detection ancestry walk and transaction-wrapped operations
  [`product-type.service.js:1`](../../../backend/src/modules/product-types/product-type.service.js#L1)

- Zod validation schemas for request shape validation (name, parentUuid)
  [`product-type.validation.js:1`](../../../backend/src/modules/product-types/product-type.validation.js#L1)

**HTTP Handling & Authorization**

- Controller request handlers with UUID-only response DTO mapping
  [`product-type.controller.js:1`](../../../backend/src/modules/product-types/product-type.controller.js#L1)

- Express routes with authenticate/authorize middleware stacking (PICKLISTS permissions)
  [`product-type.routes.js:1`](../../../backend/src/modules/product-types/product-type.routes.js#L1)

- App registration and PICKLISTS permission constants
  [`app.js:1`](../../../backend/app.js#L1) and [`permissions.js:1`](../../../backend/src/constants/permissions.js#L1)

**Testing & Infrastructure**

- Comprehensive test suite covering all I/O matrix scenarios (create, hierarchy, cycle detection, deactivation, authorization)
  [`product-types.test.js:1`](../../../backend/tests/product-types/product-types.test.js#L1)

- Test setup and cleanup enhancements for ProductType records
  [`test-setup.js:1`](../../../backend/tests/utils/test-setup.js#L1)
