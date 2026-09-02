---
title: 'Story 1.3: Create the app_settings table and typed accessor'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
story_key: '1-3-create-the-app_settings-table-and-typed-accessor'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/backend/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Later stories (e.g., Story 1.5) need to make barcode label geometry values tunable at runtime without code deploys — page size, margins, text sizes, clear space, and the grid derived from them. These values today are hard-coded literals in `barcode.constants.js` (AD-28).

**Approach:** Create a generic `app_settings` key-value table, standalone of any one epic, with a typed accessor service (`app-settings.service.js`) that parses values by type on retrieval. This story creates the empty table and accessor only; Story 1.5 seeds the first set of geometry keys.

## Boundaries & Constraints

**Always:**
- Table name is `app_settings`, with columns `key`, `value_text`, `value_int`, `value_type`, `created_at`, `updated_at` per the acceptance criteria.
- `key` is VARCHAR PRIMARY KEY — no separate `id` column.
- `value_type` is VARCHAR with a CHECK constraint restricting it to exactly `'TEXT'` and `'INT'` — the only two types this story defines. Later epics may extend this set (documented in code comment).
- Timestamps use Sequelize.DATE with `CURRENT_TIMESTAMP` as default, matching the brownfield pattern.
- Migration follows ESM named-export shape: `export async function up(queryInterface, Sequelize)` / `export async function down(queryInterface)`, matching `20260807174936-create-users.js` and `20260824000001-enable-btree-gist.js`.
- Filename: `20260824000003-create-app-settings.js` (sequencing after barcode_seq in `000002`).
- No seed rows — this story creates the empty table and its accessor only. The specific geometry keys are seeded by Story 1.5, which is the first story that needs them.
- Accessor module `app-settings.service.js` lives in a new `backend/src/modules/app-settings/` directory, exporting a single `get(key)` function (no other accessors added).
- No `Sequelize.Model` for this table — the accessor reads and parses rows directly via raw queries or Sequelize.findOne on no-op model.

**Ask First:**
- Whether to extend `value_type` to include other types (e.g., `BOOL`, `JSON`) in this story. Decision: No — only `TEXT` and `INT` in the CHECK constraint. Later stories add new types if needed.
- Any need to add CRUD (create/update/delete) methods to the accessor. Decision: No — only `get()` is needed now. Write/delete paths belong to admin/settings stories later.
- Whether the accessor should cache values or always hit the database. Decision: Always hit the database (AD-28 expects runtime changes to be reflected on the next read without a restart).

**Never:**
- Never add a `deleted_at` column or soft-delete marker — `app_settings` is not an audited master table and will not be soft-deleted (no row mutation tracking needed, no deactivation support).
- Never add a default or fallback value in the accessor — the AC specifies it throws an error if the key does not exist.
- Never use `null` or `undefined` as a return value — an error is the only "key missing" signal.
- Never add a Sequelize model definition for `app_settings` — the accessor will read the table directly without a model.
- Never modify or reference `barcode.constants.js` in this story — Story 1.5 handles the migration of barcode values from literals to settings.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Get existing TEXT | key='some_text_setting', value_type='TEXT', value_text='hello' | `get('some_text_setting')` returns `'hello'` (string) | N/A |
| Get existing INT | key='some_int_setting', value_type='INT', value_int=5000000 | `get('some_int_setting')` returns `5000000` (number) | N/A |
| Get non-existent key | key not in table | Throws error with message naming the missing key | Error message: "App setting '[key]' not found" or similar, error.statusCode = 404 |
| value_text populated, value_int NULL | TEXT type with value_int absent | Parsed as TEXT, returns value_text; ignores NULL in value_int | N/A |
| value_int populated, value_text NULL | INT type with value_text absent | Parsed as INT, returns value_int; ignores NULL in value_text | N/A |
| Both value_text and value_int populated | type='TEXT' but both columns filled | Uses value_type to determine which to parse and return; the other column is ignored | N/A |
| Invalid value_type in DB | type='BOOL' (violates CHECK) | Migration/insert fails at database constraint; accessor never encounters this | Database error: CHECK constraint violation |

</frozen-after-approval>

## Code Map

- `backend/database/migrations/20260824000003-create-app-settings.js` -- NEW. Migration creating the `app_settings` table with a CHECK constraint on `value_type`.
- `backend/database/migrations/20260824000002-create-barcode-seq.js` -- style reference: ESM async function shape, uses raw `queryInterface.sequelize.query()` for DDL.
- `backend/database/migrations/20260807174936-create-users.js` -- reference for table creation via `queryInterface.createTable()`, CHECK constraint pattern via `queryInterface.addConstraint()`.
- `backend/src/modules/app-settings/app-settings.service.js` -- NEW. Accessor module exporting `get(key)` function. No Sequelize model.
- `backend/src/modules/permissions/permission.service.js` -- style reference: named exports, error-throwing pattern (set `error.statusCode`), uses Sequelize models.
- `backend/package.json` -- scripts `db:migrate`, `db:migrate:undo`. Read-only.
- `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md` -- AD-28 (runtime-tunable values in `app_settings`), AD-4/AD-5 (mutable-master-data tier, no soft delete). Read-only rationale.

## Tasks & Acceptance

**Execution:**
- [ ] `backend/database/migrations/20260824000003-create-app-settings.js` -- create it: table with key (VARCHAR PK), value_text (TEXT), value_int (BIGINT), value_type (VARCHAR CHECK), created_at/updated_at (DATE defaults CURRENT_TIMESTAMP). No seed rows. CHECK constraint names the restricted values: `app_settings_value_type_check`.
- [ ] `backend/src/modules/app-settings/app-settings.service.js` -- create it: export `get(key)` async function. Queries the table by key, parses by value_type (INT → parseInt or cast, TEXT → return as-is), throws error if key missing. Include JSDoc comment documenting `value_int` column as for money-typed settings (storing paise per AD-2).
- [ ] Walk the I/O matrix: insert rows for each scenario, call `get()`, verify returned types and error cases.
- [ ] `npx sequelize-cli db:migrate:status` -- verify migration file is listed after `20260824000002-create-barcode-seq`.

**Acceptance Criteria:**

- Given the migration is applied, when `SELECT * FROM app_settings WHERE key='test';` is queried and key does not exist, then the result is empty — the table exists and is empty after this story.
- Given the migration is applied, when `INSERT INTO app_settings (key, value_type, value_text) VALUES ('text_key', 'TEXT', 'hello');` is executed, then it succeeds.
- Given the migration is applied, when `INSERT INTO app_settings (key, value_type, value_int) VALUES ('int_key', 'INT', 5000000);` is executed, then it succeeds.
- Given the migration is applied, when `INSERT INTO app_settings (key, value_type, value_text) VALUES ('bad_key', 'BOOL', '...');` is attempted, then the database rejects it with a CHECK constraint violation (constraint name `app_settings_value_type_check`).
- Given the accessor module exists, when `get('text_key')` is called and `value_type='TEXT'` and `value_text='hello'`, then it returns `'hello'` (type: string).
- Given the accessor module exists, when `get('int_key')` is called and `value_type='INT'` and `value_int=5000000`, then it returns `5000000` (type: number).
- Given the accessor module exists, when `get('nonexistent')` is called, then it throws an Error with a 404 statusCode (or similar) and a message naming the key.
- Given a row with both `value_text` and `value_int` populated, when `get(key)` is called and `value_type='INT'`, then it returns the parsed `value_int` and ignores `value_text`.
- Given the migration file, when inspected, then it contains no Sequelize model, no seeder, no seed rows, and no reference to barcode geometry values.
- Given the accessor module, when inspected, then it exports only the `get` function and contains a code comment documenting that `value_int` is for money-typed settings storing paise.

## Spec Change Log

<!-- Append-only. Empty until first review. -->

## Design Notes

The `app_settings` table is a generic key-value store, not a barcode-specific table, so it lives in its own module (`app-settings/`) rather than under `barcode/`. This keeps the design reusable for other settings (e.g., shop timezone, exchange window, user preferences, future admin configurable values).

The accessor returns a plain value (string or number) rather than a row object: `get('text_key')` returns `'hello'`, not `{ key: 'text_key', value_text: 'hello', value_type: 'TEXT', ... }`. This simple interface keeps callsites clean and the value's type transparent.

No model is needed because the table has no business logic — the accessor is a thin read-through layer. Later stories that need write access (update/delete) can add those methods to the service without building a model.

## Verification

**Commands** (from `backend/`):
- `npx sequelize-cli db:migrate:status` -- the new file is listed as pending before apply, then as `up` after.
- `npm run db:migrate` -- applies with no error; `SequelizeMeta` table records it as applied.
- `npm run db:migrate:undo` -- drops the table cleanly; `SequelizeMeta` removes the entry.
- `npm test` -- no change to suite result (the accessor is not tested in isolation here; unit tests for `get()` behavior belong to a separate frontend test when Story 1.5 uses it).

**Manual checks (if no CLI):**
- After migrate: `SELECT * FROM app_settings;` returns an empty set (0 rows).
- Constraint verification: `INSERT INTO app_settings (key, value_type, value_text) VALUES ('test', 'INVALID', 'x');` is rejected with `constraint "app_settings_value_type_check" violated`.
- Accessor with TEXT: insert a TEXT row, call `get(key)`, confirm returned type is string.
- Accessor with INT: insert an INT row, call `get(key)`, confirm returned type is number.
- Accessor missing key: call `get('nonexistent')`, confirm it throws an error.

## Suggested Review Order

**Accessor Service — Entry Point**

- Single-responsibility `get()` function: queries table by key, parses by value_type, throws 404 if missing.
  [`app-settings.service.js:14`](../../../backend/src/modules/app-settings/app-settings.service.js#L14)

**Input Validation & Error Handling**

- Reject null, undefined, or non-string keys before database query; prevents SQL injection and invalid queries.
  [`app-settings.service.js:16`](../../../backend/src/modules/app-settings/app-settings.service.js#L16)

- Guard against null `value_int` when type='INT': throws 500 error with key name instead of silent NaN.
  [`app-settings.service.js:41`](../../../backend/src/modules/app-settings/app-settings.service.js#L41)

- Guard against null `value_text` when type='TEXT': throws 500 error instead of returning null.
  [`app-settings.service.js:61`](../../../backend/src/modules/app-settings/app-settings.service.js#L61)

- Check safe integer bounds: rejects BIGINT values exceeding JavaScript's safe integer limit (2^53-1).
  [`app-settings.service.js:50`](../../../backend/src/modules/app-settings/app-settings.service.js#L50)

**Database Schema & Migration**

- Table structure: key (VARCHAR PK), value_text (TEXT), value_int (BIGINT), value_type (VARCHAR with CHECK), timestamps.
  [`20260824000003-create-app-settings.js:4`](../../../backend/database/migrations/20260824000003-create-app-settings.js#L4)

- CHECK constraint restricts value_type to 'TEXT' and 'INT' only; database enforces valid type values.
  [`20260824000003-create-app-settings.js:40`](../../../backend/database/migrations/20260824000003-create-app-settings.js#L40)

- Idempotency check in up(): skips table creation if app_settings already exists; safe for re-runs.
  [`20260824000003-create-app-settings.js:4`](../../../backend/database/migrations/20260824000003-create-app-settings.js#L4)

- PostgreSQL trigger `app_settings_update_timestamp`: auto-updates `updated_at` on any row modification.
  [`20260824000003-create-app-settings.js:57`](../../../backend/database/migrations/20260824000003-create-app-settings.js#L57)

- Clean down(): drops trigger, function, then table; idempotency check prevents errors on repeated undo.
  [`20260824000003-create-app-settings.js:84`](../../../backend/database/migrations/20260824000003-create-app-settings.js#L84)

