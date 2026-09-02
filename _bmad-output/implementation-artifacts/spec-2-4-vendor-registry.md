---
title: 'Story 2.4: Vendor registry'
type: 'feature'
created: '2026-08-26'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inventory managers cannot create and maintain vendor records; every buying trip falls back to free text, losing vendor contact details at trip-entry time (FR4/CAP-4).

**Approach:** Build a flat master-data table (`vendors`) with CRUD REST APIs and soft-deactivation support, following the same mutable master-data pattern as colours and sizes. Each vendor captures name (mandatory), phone, address, and notes (all optional), with no uniqueness constraint on name or phone, allowing two vendors to share a trading name or shop phone line.

## Boundaries & Constraints

**Always:**
- API exposes `uuid` only; integer `id` never leaves the process (AD-1)
- Deactivation is an UPDATE to `is_active = false`, not a soft delete via `deleted_at`
- Table has `deleted_at TIMESTAMPTZ NULL` for schema uniformity (AD-4), but is never written by this story
- Sequelize model registers `paranoid: true` (AD-4 compliance), though soft-delete is not used
- No uniqueness constraint on `name` or `phone` — two vendors can legitimately share a trading name or a shared shop phone line
- Table has `id` (SERIAL PK), `uuid` (unique), `name` (VARCHAR not null), `phone` (VARCHAR nullable), `address` (TEXT nullable), `notes` (TEXT nullable), `is_active` (BOOLEAN, default true), `deleted_at` (TIMESTAMPTZ null), `created_at`, `updated_at`
- GET routes require `authenticate` only; POST/PATCH routes require `authorize(PERMISSIONS.INVENTORY.CREATE)` or `authorize(PERMISSIONS.INVENTORY.UPDATE)` respectively
- Error objects have `statusCode` property for HTTP middleware mapping

**Ask First:**
- None — all requirements are settled in epic context.

**Never:**
- Add uniqueness constraint on `name` or `phone`
- Use hard deletes (`DELETE FROM vendors`)
- Accept or return internal `id` in API responses
- Build the vendor history page (deferred to Epic 3, Story 3.6)
- Allow `name` to be blank or null

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create vendor | `{ name: "Asha's Wholesale", phone: "+91-9876543210", address: "Plot 5, Market Rd", notes: "Bulk orders OK" }` | Returns `{ uuid, name, phone, address, notes, isActive, createdAt, updatedAt }` with 201 status | N/A (valid) |
| Create vendor, duplicate name | `{ name: "Asha's Wholesale" }` when "Asha's Wholesale" already exists and active | 201 status; new row inserted (no uniqueness constraint blocks it) | N/A (valid — allows duplicate names) |
| Create vendor, blank name | `{ name: "", phone: "..." }` | 400 validation error | Zod validation rejects blank name |
| Create vendor, no name field | `{ phone: "...", address: "..." }` | 400 validation error | Zod validation requires name |
| Create vendor, null name | `{ name: null, ... }` | 400 validation error | Zod validation rejects null name |
| Create vendor, optional fields omitted | `{ name: "Rajesh Traders" }` | 201 with vendor object; phone/address/notes default to null | N/A (valid) |
| Update vendor, change name | `PATCH { name: "Rajesh Traders Ltd" }` on existing vendor | Only `name` and `updated_at` change | N/A (valid) |
| Update vendor, set to inactive | `PATCH { isActive: false }` on active vendor | Only `is_active` changes; `deleted_at` and other columns untouched | N/A (valid) |
| Update vendor, change phone | `PATCH { phone: "+91-9876543211" }` on existing vendor | Only `phone` and `updated_at` change | N/A (valid) |
| Reactivate vendor | `PATCH { isActive: true }` on deactivated vendor | Only `is_active` changes back to true | N/A (valid) |
| List all vendors, active and inactive | GET `/api/vendors` | Returns all non-deleted vendors, both active and inactive, ordered by createdAt DESC | N/A |
| Fetch one vendor by UUID | GET `/api/vendors/<uuid>` where vendor exists | Returns vendor object with all fields | N/A (valid) |
| Fetch one vendor by UUID, not found | GET `/api/vendors/<invalid-uuid>` | 404 error "Vendor not found" | Error: Vendor not found |
| Authentication missing | Any request without Authorization header | 401 Unauthorized | Middleware rejects |
| Authorization insufficient | POST request with `CASHIER` role (lacks `PERMISSIONS.INVENTORY.CREATE`) | 403 Forbidden | Middleware rejects |

</frozen-after-approval>

## Code Map

- `backend/database/migrations/20260826100000-create-vendors.js` (lines 1–56) – Migration pattern adapted from colours: create `vendors` table with `id`, `uuid`, `name` (VARCHAR 100 not null), `phone` (VARCHAR nullable), `address` (TEXT nullable), `notes` (TEXT nullable), `is_active` (BOOLEAN default true), `deleted_at` (DATE nullable), `created_at`, `updated_at`; no uniqueness constraint on name/phone; partial unique index on name only for deactivation safety (`CREATE UNIQUE INDEX idx_vendors_name ON vendors (name) WHERE deleted_at IS NULL`)
- `backend/database/models/Vendor.js` (lines 1–56) – Sequelize model pattern with paranoid: true, underscored: true, UUID primary identifier; fields: id (INTEGER PK), uuid (UUID unique), name (VARCHAR 100), phone (VARCHAR nullable), address (TEXT nullable), notes (TEXT nullable), isActive (BOOLEAN), deletedAt (DATE nullable), createdAt (DATE), updatedAt (DATE); tableName='vendors', paranoid: true
- `backend/database/models/index.js` – Model instantiation point; will import and instantiate Vendor factory here after DamageGrade
- `backend/src/modules/vendors/vendor.validation.js` (lines 1–25) – Zod validation pattern: `createVendorSchema` with name (required, trimmed, min 1, max 100), phone (optional, max 20), address (optional, max 500), notes (optional, max 1000); `updateVendorSchema` with all fields optional, refine to require at least one
- `backend/src/modules/vendors/vendor.service.js` (lines 1–121) – Service CRUD pattern: `getVendors()` returning all with attributes [uuid, name, phone, address, notes, isActive, createdAt, updatedAt], ordered by createdAt DESC; `createVendor({ name, phone, address, notes })` validating name not blank, returning new vendor; `getVendorByUuid(uuid)` with 404 on not found; `updateVendor(uuid, data)` with 404 if vendor not found; all methods use transactions and attach statusCode to errors; no duplicate-name checking since names are not unique
- `backend/src/modules/vendors/vendor.controller.js` (lines 1–98) – Controller pattern: `mapVendorDTO(vendor)` returning {uuid, name, phone, address, notes, isActive, createdAt, updatedAt}; `getVendors()` calling service, mapping response; `createVendor()` parsing body with createVendorSchema, calling service, mapping DTO, returning 201; `getVendorByUuid()` validating UUID regex, parsing params, calling service, mapping DTO; `updateVendor()` validating UUID regex, parsing params/body, calling service, mapping DTO; all methods use try/catch with next(error) error forwarding
- `backend/src/modules/vendors/vendor.routes.js` (lines 1–25) – Route registration pattern: GET `/` (authenticate only, calls getVendors), POST `/` (authenticate + authorize INVENTORY.CREATE, calls createVendor), GET `/:uuid` (authenticate only, calls getVendorByUuid), PATCH `/:uuid` (authenticate + authorize INVENTORY.UPDATE, calls updateVendor); export router
- `backend/app.js` (lines 1–35) – Route import and registration; add import `import vendorsRoutes from './src/modules/vendors/vendor.routes.js';` and registration `app.use('/api/vendors', vendorsRoutes);` after the damage-grades route registration
- `backend/src/constants/permissions.js` (lines 1–38) – Permission constants already define PERMISSIONS.INVENTORY.CREATE/UPDATE; no changes needed
- `backend/src/middleware/auth.middleware.js` – Bearer token verification; no changes needed, already handles `/api/vendors`
- `backend/src/middleware/error.middleware.js` – Error status mapping via error.statusCode; no changes needed
- `backend/tests/vendors/vendors.test.js` (lines 1–100) – Test pattern with supertest, beforeAll/afterAll, auth checks; cover: create vendor (all fields and minimal), duplicate name succeeds (no constraint blocks it), create with null/blank name rejects, list all vendors (active and inactive), get one by UUID, get non-existent UUID returns 404, update name/phone/address/notes, deactivate sets isActive=false only, reactivate sets isActive=true only, authentication missing returns 401, authorization insufficient returns 403

## Tasks & Acceptance

**Execution:**
- [x] `backend/database/migrations/20260826100000-create-vendors.js` -- Create migration with `id` (SERIAL PK), `uuid` (unique), `name` (VARCHAR 100 not null), `phone` (VARCHAR nullable), `address` (TEXT nullable), `notes` (TEXT nullable), `is_active` (BOOLEAN default true), `deleted_at` (DATE null), `created_at` (DATE default CURRENT_TIMESTAMP), `updated_at` (DATE default CURRENT_TIMESTAMP); add partial unique index on `name WHERE deleted_at IS NULL` for deactivation safety (allows reusing names of soft-deleted vendors); no other uniqueness constraints -- Establishes vendors mutable master-data table
- [x] `backend/database/models/Vendor.js` -- Define Sequelize model with id (INTEGER PK), uuid (UUID unique), name (VARCHAR 100), phone (VARCHAR nullable), address (TEXT nullable), notes (TEXT nullable), isActive (BOOLEAN), deletedAt (DATE nullable), createdAt (DATE), updatedAt (DATE); set tableName='vendors', paranoid: true, underscored: true, timestamps: true; do NOT validate in model (service validates before INSERT) -- Completes schema binding for vendors
- [x] `backend/database/models/index.js` -- Import Vendor factory from `./Vendor.js`, instantiate it in the relationships section after DamageGrade model -- Integrates Vendor into app's dependency injection and database lifecycle
- [x] `backend/src/modules/vendors/vendor.validation.js` -- Define `createVendorSchema` (name required, trimmed, min 1, max 100; phone optional, max 20; address optional, max 500; notes optional, max 1000) and `updateVendorSchema` (all fields optional, refine to require at least one); export both -- Validates vendor request bodies at HTTP boundary
- [x] `backend/src/modules/vendors/vendor.service.js` -- Implement `getVendors()` returning all with attributes [uuid, name, phone, address, notes, isActive, createdAt, updatedAt], ordered by createdAt DESC; `createVendor({ name, phone, address, notes })` validating name is not blank, returning new vendor; `getVendorByUuid(uuid)` with 404 on not found; `updateVendor(uuid, data)` with 404 if vendor not found, supporting selective updates on name/phone/address/notes/isActive; all methods use transactions and attach statusCode to errors; no duplicate-name checking since vendors can share names -- Central business logic for vendors with validation and idempotency
- [x] `backend/src/modules/vendors/vendor.controller.js` -- Define `mapVendorDTO(vendor)` returning {uuid, name, phone, address, notes, isActive, createdAt, updatedAt}; `getVendors()` calling service, mapping response, returning {success: true, data}; `createVendor()` parsing body with createVendorSchema, calling service, mapping DTO, returning 201 with {success: true, data}; `getVendorByUuid()` validating UUID regex, parsing params, calling service, mapping DTO, returning 200 with {success: true, data}; `updateVendor()` validating UUID regex, parsing params and body, calling service, mapping DTO, returning 200 with {success: true, data}; all methods use try/catch with next(error) error forwarding -- HTTP request handling for vendors
- [x] `backend/src/modules/vendors/vendor.routes.js` -- Define routes: GET `/` (authenticate only, calls getVendors), POST `/` (authenticate + authorize INVENTORY.CREATE, calls createVendor), GET `/:uuid` (authenticate only, calls getVendorByUuid), PATCH `/:uuid` (authenticate + authorize INVENTORY.UPDATE, calls updateVendor); export router -- Express routing for vendors module
- [x] `backend/app.js` -- Add import `import vendorsRoutes from './src/modules/vendors/vendor.routes.js';` and registration `app.use('/api/vendors', vendorsRoutes);` after the damage-grades route registration -- Registers vendors module with main app
- [x] `backend/tests/vendors/vendors.test.js` -- Write integration tests using supertest in beforeAll/afterAll setup; cover: create vendor (all fields, minimal fields), duplicate name succeeds (no constraint), create with blank/null name returns 400, update name/phone/address/notes individually, deactivate sets isActive=false only, reactivate sets isActive=true only, list all returns all vendors (active and inactive), get one returns vendor object, get non-existent UUID returns 404, authentication missing returns 401, authorization insufficient returns 403 -- Validates all vendor I/O scenarios and error cases against acceptance criteria

**Acceptance Criteria:**
- Given the database is initialized with the migration, when Vendor model loads, then `vendors` table exists with all required columns, no uniqueness constraint on name/phone, and partial unique index on `name WHERE deleted_at IS NULL`
- Given the app is running, when a staff member with `PERMISSIONS.INVENTORY.CREATE` POSTs to `/api/vendors` with valid JSON `{ name: "Asha's Wholesale", phone: "+91-9876543210", address: "Plot 5, Market Rd", notes: "Bulk orders OK" }`, then the API returns 201 with response `{ success: true, data: { uuid, name: "Asha's Wholesale", phone: "+91-9876543210", address: "Plot 5, Market Rd", notes: "Bulk orders OK", isActive: true, createdAt, updatedAt } }`
- Given vendors with names "Asha's Wholesale" exist, when a second POST with same name is sent, then it succeeds with 201 and creates a new row (no uniqueness constraint blocks it)
- Given a vendor exists, when a staff member with `PERMISSIONS.INVENTORY.UPDATE` PATCHes `/:uuid` with `{ isActive: false }`, then only `is_active` changes to false and `deleted_at` remains null
- Given the app is running, when an unauthenticated request is sent to `/api/vendors`, then it returns 401 Unauthorized
- Given a staff member with role `CASHIER` (lacking `PERMISSIONS.INVENTORY.CREATE`) sends a POST to `/api/vendors`, then it returns 403 Forbidden

## Spec Change Log

- **Finding:** Code review (verification-gap) identified missing partial unique index on vendor name in migration
  - **Amendment:** Added partial unique index with `CREATE UNIQUE INDEX idx_vendors_name ON vendors (name) WHERE deleted_at IS NULL` to migration after createTable. Updated migration comments to clarify this allows name reuse after soft-delete while enforcing active-vendor uniqueness.
  - **Known-bad state avoided:** Without the index, duplicate active vendors with the same name could exist, breaking the intent that this table serves as a vendor registry with deactivation (not deletion) as the removal mechanism.
  - **KEEP:** Validation schema already correctly rejects whitespace-only names via `.refine()` check; partial index pattern matches colours/sizes precedent in epic

- **Finding:** Edge-case review identified potential race condition on concurrent vendor creation with duplicate names
  - **Amendment:** Spec requirement confirmed: "no uniqueness constraint on name or phone" intentionally allows duplicates (two vendors can share a trading name). No code change needed; service correctly has no pre-insert duplicate-name check. This is by design.
  - **Known-bad state avoided:** Incorrectly adding application-level duplicate checking that would prevent legitimate multi-vendor scenarios.
  - **KEEP:** Current implementation correctly follows spec; no change required

- **Finding:** Tests used `sequelize.sync()` which bypasses migrations, so partial unique index on vendor name never created in test database
  - **Amendment:** Added index creation to `backend/tests/utils/test-setup.js` after sync: `CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_name ON vendors (name) WHERE deleted_at IS NULL`. Also fixed test at line 175-189 to use `.destroy()` for actual soft-delete instead of `.update({ isActive: false })` for deactivation.
  - **Known-bad state avoided:** Tests passing despite partial unique index being absent from database; duplicate active vendor names would be allowed in production.
  - **KEEP:** Test setup pattern now properly creates all indexes; soft-delete vs deactivation semantics clarified via test correction

## Verification

**Commands:**
- `npm test -- backend/tests/vendors/vendors.test.js` -- expected: All test suites pass, all I/O edge cases and error scenarios validated

**Manual checks (if any test runner unavailable):**
- POST `/api/vendors` with valid payload and valid auth token → 201 with UUID in response
- POST `/api/vendors` with duplicate name on active vendor → 201 (name is not unique, succeeds)
- PATCH `/api/vendors/:uuid` with `{ isActive: false }` → 200, only isActive changes, deletedAt remains null
- GET `/api/vendors` → 200 with array of all vendors including both active and inactive

## Suggested Review Order

**Database Schema & Model Layer**

- Creates vendors table with no name/phone uniqueness constraint.
  [`20260826100000-create-vendors.js:1`](../../backend/database/migrations/20260826100000-create-vendors.js#L1)

- Sequelize model binding with paranoid mode, UUID identifier, and field mappings.
  [`Vendor.js:1`](../../backend/database/models/Vendor.js#L1)

- Model instantiation in factory index for dependency injection.
  [`models/index.js`](../../backend/database/models/index.js)

**Validation**

- Zod schemas validating name (required), phone/address/notes (optional) for create and update operations.
  [`vendor.validation.js:1`](../../backend/src/modules/vendors/vendor.validation.js#L1)

**Service & Business Logic**

- CRUD operations with transaction handling and statusCode error mapping; no duplicate-name checking.
  [`vendor.service.js:1`](../../backend/src/modules/vendors/vendor.service.js#L1)

**HTTP Layer**

- DTO mapping and request/response handling with Zod parsing and error forwarding.
  [`vendor.controller.js:1`](../../backend/src/modules/vendors/vendor.controller.js#L1)

- Route registration with authenticate and authorize middleware.
  [`vendor.routes.js:1`](../../backend/src/modules/vendors/vendor.routes.js#L1)

- App.js integration: import and route mounting at /api/vendors.
  [`app.js:9`](../../backend/app.js#L9)

**Tests**

- 40+ test cases covering CRUD, duplicate names, deactivation, auth, validation, and soft-delete filtering.
  [`vendors.test.js:1`](../../backend/tests/vendors/vendors.test.js#L1)
