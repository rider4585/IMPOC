---
title: 'Story 2.2: Colour and Size Picklists'
type: 'feature'
created: '2026-08-26'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inventory staff need to maintain standardized lists of product colours (e.g., "Red", "Blue", "Multicolour") and sizes (e.g., "Small", "Medium", "Large", "Free Size") for consistent intake and sales records, but currently have no way to enforce vocabulary. Without these picklists, intake records drift into inconsistent colour and size naming.

**Approach:** Build two flat (non-hierarchical) master-data tables (`colours` and `sizes`) with CRUD REST APIs and soft-deactivation support, following the same mutable master-data pattern as product types but without hierarchy.

## Boundaries & Constraints

**Always:**
- API exposes `uuid` only; integer `id` never leaves the process (AD-1)
- Deactivation is an UPDATE to `is_active = false`, not a soft delete via `deleted_at`
- Both tables have `deleted_at TIMESTAMPTZ NULL` for schema uniformity (AD-4), but are never written by this story
- Sequelize models register `paranoid: true` (AD-4 compliance), though soft-delete is not used
- Partial unique indexes on `name WHERE deleted_at IS NULL` for both tables (enforces unique colour and size names at the active level)
- GET routes require `authenticate` only; POST/PATCH routes require `authorize(PERMISSIONS.INVENTORY.CREATE)` or `authorize(PERMISSIONS.INVENTORY.UPDATE)` respectively
- Error objects have `statusCode` property for HTTP middleware mapping
- Both tables have `id` (SERIAL PK), `uuid` (unique), `name` (STRING, not null), `is_active` (BOOLEAN, default true), `deleted_at` (TIMESTAMPTZ null), `created_at`, `updated_at`

**Ask First:**
- None — all requirements are settled in epic context.

**Never:**
- Do not use Postgres ENUM for `is_active` (AD-3)
- Do not add a hard delete or allow `DELETE FROM colours/sizes` — soft-active is the only deactivation
- Do not return internal `id` in any response or accept it in any request
- Do not create a single `picklist_items` table; keep colours and sizes as separate tables (supports different business logic in later epics)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create colour | `{ name: "Red" }` | Returns `{ uuid, name, isActive, createdAt, updatedAt }` with 201 status | N/A (valid) |
| Create size | `{ name: "Medium" }` | Returns `{ uuid, name, isActive, createdAt, updatedAt }` with 201 status | N/A (valid) |
| Create colour, duplicate name | `{ name: "Red" }` when "Red" already exists and active | 409 error "Colour already exists", no row inserted | Constraint violation mapped via AD-11 |
| Create size, duplicate name | `{ name: "Medium" }` when "Medium" already exists and active | 409 error "Size already exists", no row inserted | Constraint violation mapped via AD-11 |
| Create colour, duplicate of deactivated | `{ name: "Red" }` when "Red" exists but is_active=false | 201 status; new row inserted (active), deactivated row untouched | N/A (valid — allows reuse after deactivation) |
| Update colour, set to inactive | `PATCH { isActive: false }` on active colour | Only `is_active` changes; `deleted_at` and other columns untouched | N/A (valid) |
| Update size, change name | `PATCH { name: "Small" }` on existing size | Only `name` and `updated_at` change | N/A (valid) |
| Reactivate colour | `PATCH { isActive: true }` on deactivated colour | Only `is_active` changes back to true | N/A (valid) |
| List all colours, active and inactive | GET `/api/picklists/colours` | Returns all non-deleted colours, both active and inactive | N/A |
| List all sizes, active and inactive | GET `/api/picklists/sizes` | Returns all non-deleted sizes, both active and inactive | N/A |
| Fetch one colour by UUID | GET `/api/picklists/colours/<uuid>` where colour exists | Returns colour object | N/A (valid) |
| Fetch one size by UUID | GET `/api/picklists/sizes/<uuid>` where size exists | Returns size object | N/A (valid) |
| Fetch one colour by UUID, not found | GET `/api/picklists/colours/<invalid-uuid>` | 404 error "Colour not found" | Error: Colour not found |
| Fetch one size by UUID, not found | GET `/api/picklists/sizes/<invalid-uuid>` | 404 error "Size not found" | Error: Size not found |
| Authentication missing | Any request without Authorization header | 401 Unauthorized | Middleware rejects |
| Authorization insufficient | POST request with `CASHIER` role (lacks `PERMISSIONS.INVENTORY.CREATE`) | 403 Forbidden | Middleware rejects |

</frozen-after-approval>

## Code Map

- `backend/database/migrations/20260807174936-create-users.js` (lines 1–49) – UUID and timestamp patterns for new migration
- `backend/database/migrations/20260826084342-create-product-types.js` (lines 1–72) – Schema pattern for flat tables (adapting by removing parent_id and hierarchy)
- `backend/database/models/index.js` (lines 1–145) – Model factory index; import Colour and Size factories, instantiate models
- `backend/src/modules/product-types/product-type.service.js` (lines 1–143) – Service CRUD pattern for flat tables (get all, create, get one by UUID, update, deactivate) — no cycle detection needed
- `backend/src/modules/product-types/product-type.validation.js` (lines 1–37) – Zod schema patterns; create `colour.validation.js` and `size.validation.js` with `.trim()`, `.max()` for name
- `backend/src/modules/product-types/product-type.controller.js` (lines 10–110) – HTTP request handling pattern; use `try/catch` with `next(error)`, schema parsing, DTO mapping
- `backend/src/modules/product-types/product-type.routes.js` (lines 1–55) – Route registration with `authenticate` and `authorize()` middleware
- `backend/src/constants/permissions.js` (lines 1–38) – Permission constants; reuse existing `PERMISSIONS.INVENTORY.CREATE` and `PERMISSIONS.INVENTORY.UPDATE`
- `backend/src/middleware/auth.middleware.js` (lines 1–135) – Bearer token verification; already handles `/api/picklists/*` routes
- `backend/src/middleware/authorization.middleware.js` (lines 1–28) – Permission checking; already handles PERMISSIONS constants
- `backend/src/middleware/error.middleware.js` (lines 1–25) – Error status mapping; converts `error.statusCode` to HTTP response
- `backend/tests/roles/roles.test.js` (lines 1–100) – Testing pattern with `supertest`, `beforeAll`/`afterAll`, happy path + error cases, auth checks
- `backend/app.js` (lines 1–29) – Module registration pattern; add colour and size routes

## Tasks & Acceptance

**Execution:**
- [x] `backend/database/migrations/YYYYMMDDHHMMSS-create-colours.js` -- Create migration with `id` (SERIAL PK), `uuid` (unique), `name`, `is_active`, `deleted_at`, `created_at`/`updated_at`, plus partial unique index on `name WHERE deleted_at IS NULL` -- Establishes the colours mutable master-data table
- [x] `backend/database/migrations/YYYYMMDDHHMMSS-create-sizes.js` -- Create migration with `id` (SERIAL PK), `uuid` (unique), `name`, `is_active`, `deleted_at`, `created_at`/`updated_at`, plus partial unique index on `name WHERE deleted_at IS NULL` -- Establishes the sizes mutable master-data table
- [x] `backend/database/models/Colour.js` -- Define Sequelize model with `paranoid: true`, `underscored: true`, standard mutable master-data columns -- Completes schema binding for colours
- [x] `backend/database/models/Size.js` -- Define Sequelize model with `paranoid: true`, `underscored: true`, standard mutable master-data columns -- Completes schema binding for sizes
- [x] `backend/database/models/index.js` -- Import Colour and Size factories, instantiate both models in the relationships section -- Integrates models into app's dependency injection
- [x] `backend/src/modules/colours/colour.validation.js` -- Define Zod schema for `createColourSchema` (name required, trimmed, max 100) and `updateColourSchema` (any field optional, refine to require at least one) -- Validates colour request bodies
- [x] `backend/src/modules/sizes/size.validation.js` -- Define Zod schema for `createSizeSchema` (name required, trimmed, max 100) and `updateSizeSchema` (any field optional, refine to require at least one) -- Validates size request bodies
- [x] `backend/src/modules/colours/colour.service.js` -- Implement service with `getColours()`, `createColour({ name })`, `getColourByUuid(uuid)`, `updateColour(uuid, data)`, `deactivateColour(uuid)` methods; add 409 error for duplicate name (from unique index); use `statusCode` on all errors -- Central business logic for colours
- [x] `backend/src/modules/sizes/size.service.js` -- Implement service with `getSizes()`, `createSize({ name })`, `getSizeByUuid(uuid)`, `updateSize(uuid, data)`, `deactivateSize(uuid)` methods; add 409 error for duplicate name (from unique index); use `statusCode` on all errors -- Central business logic for sizes
- [x] `backend/src/modules/colours/colour.controller.js` -- Define controller methods mirroring service methods; parse request bodies with Zod, call service, map response to DTO, return `{ success: true, data }` shape, handle errors with `next(error)` -- HTTP request handling for colours
- [x] `backend/src/modules/sizes/size.controller.js` -- Define controller methods mirroring service methods; parse request bodies with Zod, call service, map response to DTO, return `{ success: true, data }` shape, handle errors with `next(error)` -- HTTP request handling for sizes
- [x] `backend/src/modules/colours/colour.routes.js` -- Define routes: GET `/` (authenticate only), POST `/` (authenticate + authorize INVENTORY.CREATE), GET `/:uuid` (authenticate only), PATCH `/:uuid` (authenticate + authorize INVENTORY.UPDATE); mount on `/api/picklists/colours` -- Express routing for colours
- [x] `backend/src/modules/sizes/size.routes.js` -- Define routes: GET `/` (authenticate only), POST `/` (authenticate + authorize INVENTORY.CREATE), GET `/:uuid` (authenticate only), PATCH `/:uuid` (authenticate + authorize INVENTORY.UPDATE); mount on `/api/picklists/sizes` -- Express routing for sizes
- [x] `backend/app.js` -- Add imports for `coloursRoutes` and `sizesRoutes`, then `app.use('/api/picklists/colours', coloursRoutes)` and `app.use('/api/picklists/sizes', sizesRoutes)` after product-types registration -- Registers both new modules with the main app
- [x] `backend/tests/colours/colours.test.js` -- Write integration tests using `supertest`; cover: create colour, duplicate name (409), create after deactivation (201), update name, deactivate, reactivate, list all, get one, not found (404), authentication missing (401), authorization insufficient (403) -- Validates all colour I/O scenarios and error cases
- [x] `backend/tests/sizes/sizes.test.js` -- Write integration tests using `supertest`; cover: create size, duplicate name (409), create after deactivation (201), update name, deactivate, reactivate, list all, get one, not found (404), authentication missing (401), authorization insufficient (403) -- Validates all size I/O scenarios and error cases

**Acceptance Criteria:**
- Given the database is initialized with the migrations, when the Colour and Size models are loaded, then `colours` and `sizes` tables exist with `id`, `uuid`, `name`, `is_active`, `deleted_at`, `created_at`, `updated_at` columns and partial unique indexes on `name WHERE deleted_at IS NULL`
- Given a user with `INVENTORY.CREATE` permission, when `POST /api/picklists/colours { name: "Red" }` is called, then the service inserts the row and returns `{ success: true, data: { uuid, name, isActive, createdAt, updatedAt } }` with 201 status
- Given a user without `INVENTORY.CREATE` permission, when `POST /api/picklists/colours { name }` is called, then the authorization middleware rejects with 403
- Given an existing active colour and an attempt to create another with the same name, when `POST /api/picklists/colours { name }` is called, then the unique index constraint is violated and a 409 error is returned
- Given an existing deactivated colour and an attempt to create a new one with the same name, when `POST /api/picklists/colours { name }` is called, then the new row is inserted successfully and the constraint is satisfied (deactivated rows are excluded from uniqueness)
- Given an active colour, when `PATCH /api/picklists/colours/:uuid { isActive: false }` is called, then only `is_active` changes to false, `deleted_at` remains NULL, and the colour can be reactivated with `PATCH { isActive: true }`
- Given multiple colours and sizes, when `GET /api/picklists/colours` and `GET /api/picklists/sizes` are called, then all non-deleted entries (active and inactive) are returned, and no `id` fields are exposed

## Design Notes

**Flat Structure:** Unlike product types, colours and sizes have no hierarchy, parent references, or cycle detection. Uniqueness is enforced solely by the partial unique index, which allows the same name to be reused after deactivation (the index only considers active, non-deleted rows). This simplicity keeps the implementation lean and mirrors the intake vocabulary pattern in later epics.

**Separate Tables:** Colours and sizes are distinct tables despite similar schemas, enabling independent business logic in later epics (e.g., colour filtering rules in Epic 3 intake validation, size-based stock rules in later inventory features). A single `picklist_items` table with a type discriminator was considered but deferred to avoid premature abstraction.

**Example: Creating Colours and Sizes**
```
POST /api/picklists/colours
{ "name": "Red" }
→ { "uuid": "abc-123", "name": "Red", "isActive": true, ... }

POST /api/picklists/sizes
{ "name": "Medium" }
→ { "uuid": "def-456", "name": "Medium", "isActive": true, ... }

POST /api/picklists/colours
{ "name": "Red" }
→ 409 error "Colour already exists"
```

## Verification

**Commands:**
- `npm run migrate:latest -- --env test` -- expected: Migrations for colours and sizes run without error, creating both tables and indexes
- `npm run test -- backend/tests/colours/colours.test.js backend/tests/sizes/sizes.test.js` -- expected: All test cases pass (create, duplicate name, update, deactivation, authorization)
- `npm run lint -- backend/src/modules/colours/ backend/src/modules/sizes/` -- expected: No linting errors or style violations

**Manual checks (if no CLI):**
- Verify in psql that `colours` and `sizes` tables exist: `\d colours` and `\d sizes`
- Verify partial indexes: `SELECT indexname FROM pg_indexes WHERE tablename IN ('colours', 'sizes')`
- Call `GET /api/picklists/colours` with a Bearer token and verify response has no `id` fields
- Call `POST /api/picklists/colours { name: "Red" }` twice and verify second call returns 409

## Suggested Review Order

**Schema & Database Foundation**

- Partial unique index on active, non-deleted names only; soft-delete via is_active (not deleted_at)
  [`backend/database/migrations/20260826090000-create-colours.js:1`](../../../backend/database/migrations/20260826090000-create-colours.js#L1)

- Identical pattern for sizes table with matching schema and indexes
  [`backend/database/migrations/20260826090001-create-sizes.js:1`](../../../backend/database/migrations/20260826090001-create-sizes.js#L1)

**Model Layer**

- Sequelize model with paranoid: true and underscored: true for database binding
  [`backend/database/models/Colour.js:1`](../../../backend/database/models/Colour.js#L1)

- Identical sizes model registered in DI chain
  [`backend/database/models/Size.js:1`](../../../backend/database/models/Size.js#L1)

- Model imports and instantiation integrated into app's dependency injection
  [`backend/database/models/index.js:50`](../../../backend/database/models/index.js#L50)

**Validation & Business Logic**

- Zod schemas with trimmed names, max 100 chars, and whitespace rejection after trim
  [`backend/src/modules/colours/colour.validation.js:1`](../../../backend/src/modules/colours/colour.validation.js#L1)

- Service layer CRUD with duplicate-name check filtering by is_active=true and deleted_at IS NULL
  [`backend/src/modules/colours/colour.service.js:15`](../../../backend/src/modules/colours/colour.service.js#L15)

- Identical sizes service with same pattern
  [`backend/src/modules/sizes/size.service.js:15`](../../../backend/src/modules/sizes/size.service.js#L15)

**HTTP Layer**

- Controllers with UUID format validation (regex), DTO mapping, and no id field exposure
  [`backend/src/modules/colours/colour.controller.js:50`](../../../backend/src/modules/colours/colour.controller.js#L50)

- Routes with authenticate and authorize(PERMISSIONS.INVENTORY.CREATE/UPDATE) middleware
  [`backend/src/modules/colours/colour.routes.js:1`](../../../backend/src/modules/colours/colour.routes.js#L1)

- App.js integration: imports and route registration for both modules
  [`backend/app.js:45`](../../../backend/app.js#L45)

**Verification**

- 23 test cases per module covering create, duplicate, deactivation/reactivation, auth, errors
  [`backend/tests/colours/colours.test.js:1`](../../../backend/tests/colours/colours.test.js#L1)

- Sizes tests with identical coverage pattern
  [`backend/tests/sizes/sizes.test.js:1`](../../../backend/tests/sizes/sizes.test.js#L1)
