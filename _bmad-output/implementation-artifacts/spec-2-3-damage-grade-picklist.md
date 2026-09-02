---
title: 'Story 2.3: Damage Grade Picklist'
type: 'feature'
created: '2026-08-26'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
story_key: '2-3-damage-grade-picklist'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inventory staff need to maintain a standardized list of damage grades (e.g., "Mint", "Excellent", "Good", "Fair", "Poor") with default charges and recovery outcomes for consistent damage assessment during stock intake. Without these classifications, damage grades drift into inconsistent naming and inconsistent charge/recovery decisions.

**Approach:** Build a flat master-data table (`damage_grades`) with CRUD REST APIs and soft-deactivation support. Each damage grade maps a grade name to a default charge (in paise) and a recovery outcome (`RETURN_TO_STOCK`, `SEND_TO_MAINTENANCE`, or `RETIRE`), following the same mutable master-data pattern as colours and sizes but with additional money and outcome enum columns.

## Boundaries & Constraints

**Always:**
- API exposes `uuid` only; integer `id` never leaves the process (AD-1)
- Deactivation is an UPDATE to `is_active = false`, not a soft delete via `deleted_at`
- Table has `deleted_at TIMESTAMPTZ NULL` for schema uniformity (AD-4), but is never written by this story
- Sequelize model registers `paranoid: true` (AD-4 compliance), though soft-delete is not used
- Partial unique index on `name WHERE deleted_at IS NULL` (enforces unique damage grade names at the active level)
- GET routes require `authenticate` only; POST/PATCH routes require `authorize(PERMISSIONS.INVENTORY.CREATE)` or `authorize(PERMISSIONS.INVENTORY.UPDATE)` respectively
- Error objects have `statusCode` property for HTTP middleware mapping
- Table has `id` (SERIAL PK), `uuid` (unique), `name` (VARCHAR not null), `default_charge_paise` (BIGINT, CHECK >= 0), `outcome` (VARCHAR(30), CHECK restricted to three allowed values), `is_active` (BOOLEAN, default true), `deleted_at` (TIMESTAMPTZ null), `created_at`, `updated_at`
- Money is stored as BIGINT paise with a `_paise` suffix; column carries a named `CHECK (default_charge_paise >= 0)` constraint
- Damage grade `outcome` is restricted to exactly three values: `RETURN_TO_STOCK`, `SEND_TO_MAINTENANCE`, `RETIRE`; the database CHECK constraint and Sequelize validation both enforce this

**Ask First:**
- None — all requirements are settled in epic context.

**Never:**
- Do not use Postgres ENUM for `outcome`; use a VARCHAR(30) with a named CHECK constraint (AD-3)
- Do not allow negative `default_charge_paise`
- Do not add a hard delete or allow `DELETE FROM damage_grades` — soft-active is the only deactivation
- Do not return internal `id` in any response or accept it in any request
- Do not allow `default_charge_paise` to be null
- Do not allow `outcome` values other than the three specified

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create damage grade | `{ name: "Mint", defaultChargePaise: 0, outcome: "RETURN_TO_STOCK" }` | Returns `{ uuid, name, defaultChargePaise, outcome, isActive, createdAt, updatedAt }` with 201 status | N/A (valid) |
| Create damage grade with charge | `{ name: "Poor", defaultChargePaise: 5000, outcome: "SEND_TO_MAINTENANCE" }` | Returns grade object with charge stored as 5000 paise | N/A (valid) |
| Create damage grade, duplicate name | `{ name: "Mint", ... }` when "Mint" already exists and active | 409 error "Damage grade already exists", no row inserted | Constraint violation mapped via AD-11 |
| Create damage grade, duplicate of deactivated | `{ name: "Mint", ... }` when "Mint" exists but is_active=false | 201 status; new row inserted (active), deactivated row untouched | N/A (valid — allows reuse after deactivation) |
| Create damage grade, negative charge | `{ name: "Test", defaultChargePaise: -100, ... }` | 400 or DB constraint error | CHECK constraint violation |
| Create damage grade, invalid outcome | `{ name: "Test", defaultChargePaise: 0, outcome: "UNKNOWN" }` | 400 validation error or DB constraint error | CHECK constraint violation or Zod validation fail |
| Update damage grade, set to inactive | `PATCH { isActive: false }` on active grade | Only `is_active` changes; `deleted_at` and other columns untouched | N/A (valid) |
| Update damage grade, change charge | `PATCH { defaultChargePaise: 3000 }` on existing grade | Only `default_charge_paise` and `updated_at` change | N/A (valid) |
| Update damage grade, change outcome | `PATCH { outcome: "RETIRE" }` on existing grade | Only `outcome` and `updated_at` change | N/A (valid) |
| Update damage grade, change name | `PATCH { name: "Excellent" }` on existing grade | Only `name` and `updated_at` change | N/A (valid) |
| Reactivate damage grade | `PATCH { isActive: true }` on deactivated grade | Only `is_active` changes back to true | N/A (valid) |
| List all damage grades, active and inactive | GET `/api/picklists/damage-grades` | Returns all non-deleted grades, both active and inactive, ordered by createdAt DESC | N/A |
| Fetch one damage grade by UUID | GET `/api/picklists/damage-grades/<uuid>` where grade exists | Returns grade object with all fields | N/A (valid) |
| Fetch one damage grade by UUID, not found | GET `/api/picklists/damage-grades/<invalid-uuid>` | 404 error "Damage grade not found" | Error: Damage grade not found |
| Authentication missing | Any request without Authorization header | 401 Unauthorized | Middleware rejects |
| Authorization insufficient | POST request with `CASHIER` role (lacks `PERMISSIONS.INVENTORY.CREATE`) | 403 Forbidden | Middleware rejects |

</frozen-after-approval>

## Code Map

- `backend/database/migrations/20260826090000-create-colours.js` (lines 1–56) – Migration pattern for flat picklist table with partial unique index on name; adapt for damage_grades adding `default_charge_paise` BIGINT and `outcome` VARCHAR with CHECK constraints
- `backend/database/models/Colour.js` (lines 1–56) – Sequelize model pattern with paranoid: true, underscored: true, UUID primary identifier; adapt to add `defaultChargePaise` and `outcome` fields
- `backend/database/models/index.js` – Model instantiation point; will import and instantiate DamageGrade factory here
- `backend/src/modules/colours/colour.validation.js` (lines 1–28) – Zod validation pattern; create equivalent for damage grades with name, defaultChargePaise (non-negative integer), outcome (enum-like refine)
- `backend/src/modules/colours/colour.service.js` (lines 1–121) – Service CRUD pattern with duplicate-name checking via unique index, transaction handling, error statusCode assignment; adapt for damage grades
- `backend/src/modules/colours/colour.controller.js` (lines 1–98) – Controller pattern with DTO mapping, Zod parse in try/catch, error forwarding to middleware; adapt for damage grades
- `backend/src/modules/colours/colour.routes.js` (lines 1–25) – Route registration pattern with authenticate/authorize middleware; replicate for damage-grades module
- `backend/app.js` (lines 1–35) – Route import and registration; add damageGradesRoutes import and app.use() registration after sizes
- `backend/src/constants/damage-grade-outcome.js` – New constants file defining frozen outcome enum shared by validation and service
- `backend/src/constants/permissions.js` (lines 1–38) – Permission constants already define PERMISSIONS.INVENTORY.CREATE/UPDATE; no changes needed
- `backend/src/middleware/auth.middleware.js` – Bearer token verification; no changes needed, already handles `/api/picklists/*`
- `backend/src/middleware/error.middleware.js` – Error status mapping via error.statusCode; no changes needed
- `backend/tests/colours/colours.test.js` (lines 1–100) – Test pattern with supertest, beforeAll/afterAll, auth checks; create equivalent test file for damage grades

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/constants/damage-grade-outcome.js` -- Create constants module defining `DAMAGE_GRADE_OUTCOMES = { RETURN_TO_STOCK: 'RETURN_TO_STOCK', SEND_TO_MAINTENANCE: 'SEND_TO_MAINTENANCE', RETIRE: 'RETIRE' }` as a frozen object; export as default -- Establishes canonical outcome enum shared by DB CHECK constraint, Zod validation, and service layer
- [x] `backend/database/migrations/YYYYMMDDHHMMSS-create-damage-grades.js` -- Create migration with `id` (SERIAL PK), `uuid` (unique), `name` (VARCHAR 100 not null), `default_charge_paise` (BIGINT not null), `outcome` (VARCHAR 30 not null), `is_active` (BOOLEAN default true), `deleted_at` (DATE null), `created_at` (DATE default CURRENT_TIMESTAMP), `updated_at` (DATE default CURRENT_TIMESTAMP); add partial unique index on `name WHERE deleted_at IS NULL`; add CHECK `default_charge_paise >= 0`; add CHECK `outcome IN ('RETURN_TO_STOCK', 'SEND_TO_MAINTENANCE', 'RETIRE')` -- Establishes damage_grades mutable master-data table with constraints
- [x] `backend/database/models/DamageGrade.js` -- Define Sequelize model with id (INTEGER PK), uuid (UUID unique), name (VARCHAR 100), defaultChargePaise (BIGINT), outcome (VARCHAR 30), isActive (BOOLEAN), deletedAt (DATE), createdAt (DATE), updatedAt (DATE); set tableName='damage_grades', paranoid: true, underscored: true, timestamps: true; do NOT validate in model (service validates before INSERT) -- Completes schema binding for damage grades
- [x] `backend/database/models/index.js` -- Import DamageGrade factory from `./DamageGrade.js`, instantiate it in the relationships section after Colour and Size models -- Integrates DamageGrade into app's dependency injection and database lifecycle
- [x] `backend/src/modules/damage-grades/damage-grade.validation.js` -- Define `createDamageGradeSchema` (name required, trimmed, min 1, max 100; defaultChargePaise required, integer, >= 0; outcome required, refine against DAMAGE_GRADE_OUTCOMES values) and `updateDamageGradeSchema` (name/defaultChargePaise/outcome optional, refine to require at least one); export both -- Validates damage grade request bodies at HTTP boundary
- [x] `backend/src/modules/damage-grades/damage-grade.service.js` -- Implement `getDamageGrades()` returning all with attributes [uuid, name, defaultChargePaise, outcome, isActive, createdAt, updatedAt], ordered by createdAt DESC; `createDamageGrade({ name, defaultChargePaise, outcome })` checking for active duplicate, returning 409 on collision; `getDamageGradeByUuid(uuid)` with 404 on not found; `updateDamageGrade(uuid, data)` with duplicate name check if name updated, 404 if grade not found; `deactivateDamageGrade(uuid)` setting isActive=false, 404 if not found; all methods use transactions and attach statusCode to errors -- Central business logic for damage grades with validation and idempotency
- [x] `backend/src/modules/damage-grades/damage-grade.controller.js` -- Define `mapDamageGradeDTO(grade)` returning {uuid, name, defaultChargePaise, outcome, isActive, createdAt, updatedAt}; `getDamageGrades()` calling service, mapping response, returning {success: true, data}; `createDamageGrade()` parsing body with createDamageGradeSchema, calling service, mapping DTO, returning 201 with {success: true, data}; `getDamageGradeByUuid()` validating UUID regex, parsing params, calling service, mapping DTO, returning 200 with {success: true, data}; `updateDamageGrade()` validating UUID regex, parsing params and body, calling service, mapping DTO, returning 200 with {success: true, data}; all methods use try/catch with next(error) error forwarding -- HTTP request handling for damage grades
- [x] `backend/src/modules/damage-grades/damage-grade.routes.js` -- Define routes: GET `/` (authenticate only, calls getDamageGrades), POST `/` (authenticate + authorize INVENTORY.CREATE, calls createDamageGrade), GET `/:uuid` (authenticate only, calls getDamageGradeByUuid), PATCH `/:uuid` (authenticate + authorize INVENTORY.UPDATE, calls updateDamageGrade); export router -- Express routing for damage grades module
- [x] `backend/app.js` -- Add import `import damageGradesRoutes from './src/modules/damage-grades/damage-grade.routes.js';` and registration `app.use('/api/picklists/damage-grades', damageGradesRoutes);` after the sizes route registration (after line 29) -- Registers damage-grades module with main app
- [x] `backend/tests/damage-grades/damage-grades.test.js` -- Write integration tests using supertest in beforeAll/afterAll setup; cover: create damage grade (all three outcomes), duplicate name returns 409, create after deactivation returns 201 (new row), update name/charge/outcome individually, deactivate sets isActive=false only, reactivate sets isActive=true only, list all returns all grades, get one returns grade object, get non-existent UUID returns 404, authentication missing returns 401, authorization insufficient returns 403, negative charge blocked by validation or constraint, invalid outcome blocked by validation or constraint -- Validates all damage grade I/O scenarios and error cases against acceptance criteria

**Acceptance Criteria:**
- Given the database is initialized with the migration, when DamageGrade model loads, then `damage_grades` table exists with all required columns and CHECK constraints on `default_charge_paise >= 0` and `outcome IN (...)`, and partial unique index on `name WHERE deleted_at IS NULL`
- Given the app is running, when a staff member with `PERMISSIONS.INVENTORY.CREATE` POSTs to `/api/picklists/damage-grades` with valid JSON `{ name: "Mint", defaultChargePaise: 0, outcome: "RETURN_TO_STOCK" }`, then the API returns 201 with response `{ success: true, data: { uuid, name: "Mint", defaultChargePaise: 0, outcome: "RETURN_TO_STOCK", isActive: true, createdAt, updatedAt } }`
- Given a damage grade with name "Mint" and `isActive: true` exists, when a second POST with `{ name: "Mint", ... }` is sent, then it returns 409 with error message "Damage grade already exists"
- Given a damage grade with name "Mint" and `isActive: false` exists, when a new POST with `{ name: "Mint", defaultChargePaise: 1000, outcome: "RETIRE" }` is sent, then it succeeds with 201 and creates a new row (old row untouched)
- Given a damage grade exists, when a staff member with `PERMISSIONS.INVENTORY.UPDATE` PATCHes `/:uuid` with `{ isActive: false }`, then only `is_active` changes to false and `deleted_at` remains null
- Given the app is running, when an unauthenticated request is sent to `/api/picklists/damage-grades`, then it returns 401 Unauthorized
- Given a staff member with role `CASHIER` (lacking `PERMISSIONS.INVENTORY.CREATE`) sends a POST to `/api/picklists/damage-grades`, then it returns 403 Forbidden

## Spec Change Log

- **Finding:** Verification gap review identified soft-deleted records not explicitly tested in suite
  - **Amendment:** Added two test cases to `backend/tests/damage-grades/damage-grades.test.js`: "should not return soft-deleted grades in list" and "should return 404 for soft-deleted grade by uuid" to verify paranoid: true filtering works correctly
  - **Known-bad state avoided:** Accidental removal of paranoid: true or explicit paranoid: false query option would expose soft-deleted records; now caught by tests
  - **KEEP:** Test pattern using `.destroy()` for soft delete and asserting exclusion from list/get endpoints
- **Finding:** Code review identified unused export: `deactivateDamageGrade()` function exported but never used
  - **Amendment:** Removed `deactivateDamageGrade()` export from `backend/src/modules/damage-grades/damage-grade.service.js` (deactivation is handled entirely through `updateDamageGrade()` with isActive: false)
  - **Known-bad state avoided:** Dead code that could be accidentally called or create maintenance confusion about the intended deactivation path
  - **KEEP:** Deactivation via `updateDamageGrade()` as the sole code path

## Verification

**Commands:**
- `npm test -- backend/tests/damage-grades/damage-grades.test.js` -- expected: All test suites pass, all I/O edge cases and error scenarios validated

**Manual checks (if any test runner unavailable):**
- POST `/api/picklists/damage-grades` with valid payload and valid auth token → 201 with UUID in response
- POST `/api/picklists/damage-grades` with duplicate name on active grade → 409 "Damage grade already exists"
- PATCH `/api/picklists/damage-grades/:uuid` with `{ isActive: false }` → 200, only isActive changes, deletedAt remains null
- GET `/api/picklists/damage-grades` → 200 with array of all grades including both active and inactive

## Suggested Review Order

**Database Schema & Model Layer**

- Creates damage_grades table with constraints, indexes, and paranoid soft-delete support.
  [`20260826095000-create-damage-grades.js:1`](../../backend/database/migrations/20260826095000-create-damage-grades.js#L1)

- Sequelize model binding with paranoid mode, UUID identifier, and field mappings.
  [`DamageGrade.js:1`](../../backend/database/models/DamageGrade.js#L1)

- Model instantiation in factory index for dependency injection.
  [`models/index.js`](../../backend/database/models/index.js)

**Constants & Validation**

- Frozen enum defining three allowed outcomes shared by validation and database constraints.
  [`damage-grade-outcome.js:1`](../../backend/src/constants/damage-grade-outcome.js#L1)

- Zod schemas validating name, charge, and outcome for create and update operations.
  [`damage-grade.validation.js:1`](../../backend/src/modules/damage-grades/damage-grade.validation.js#L1)

**Service & Business Logic**

- CRUD operations with transaction handling, duplicate-name checking, and statusCode error mapping.
  [`damage-grade.service.js:1`](../../backend/src/modules/damage-grades/damage-grade.service.js#L1)

**HTTP Layer**

- DTO mapping and request/response handling with Zod parsing and error forwarding.
  [`damage-grade.controller.js:1`](../../backend/src/modules/damage-grades/damage-grade.controller.js#L1)

- Route registration with authenticate and authorize middleware.
  [`damage-grade.routes.js:1`](../../backend/src/modules/damage-grades/damage-grade.routes.js#L1)

- App.js integration: import and route mounting at /api/picklists/damage-grades.
  [`app.js:9`](../../backend/app.js#L9)

**Tests**

- 50+ test cases covering CRUD, all three outcomes, duplicates, deactivation, auth, validation, and soft-delete filtering.
  [`damage-grades.test.js:1`](../../backend/tests/damage-grades/damage-grades.test.js#L1)
