---
title: 'Story 1.1: Enable the btree_gist Postgres extension'
type: 'feature'
created: '2026-08-24'
status: 'done'
review_loop_iteration: 1
baseline_commit: 'NO_VCS'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/backend/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Rental availability (AD-7) needs Postgres itself to refuse two overlapping bookings on the same unit, via `EXCLUDE USING gist (unit_id WITH =, period WITH &&)`. That constraint cannot exist without the `btree_gist` extension, and a free-tier host that forbids `CREATE EXTENSION` must fail on step one, not fifteen tables in (AD-19, AD-20).

**Approach:** One standalone Sequelize migration running `CREATE EXTENSION IF NOT EXISTS btree_gist` and nothing else, first in the new spine migration block. Its `down()` drops the extension and is for local development only.

## Boundaries & Constraints

**Always:**
- `up()` issues exactly one SQL statement; `down()` issues exactly one. No table, index, seed, or second statement in this file.
- Raw DDL via `queryInterface.sequelize.query()` — Sequelize 6 has no extension API.
- ESM `export async function up/down`, matching the six existing migrations (`backend/package.json` sets `"type": "module"`).
- Filename `20260824000001-enable-btree-gist.js`. Human decision, 2026-08-24: keep the repo's timestamp convention rather than the spine's literal `01-` prefix; the trailing `000001` mirrors spine step 01, and steps 02–04 become `...000002`–`...000004`.
- Let the database's own error surface unchanged. No `try`/`catch`, no logging wrapper, no fallback.

**Ask First:**
- The local Postgres role cannot `CREATE EXTENSION`. That is the signal this story exists to produce — report it, do not work around it.
- Any need to touch a file other than the one new migration.

**Never:**
- Never rename, renumber, re-order, or edit the six existing `20260807*` migrations.
- Never put `CREATE EXTENSION` in any other migration file.
- Never use `DROP EXTENSION ... CASCADE`.
- Never add a model, seeder, service, or app-code reference — an extension has none.
- Never run `down()` against a deployed database; production mistakes are corrected by a forward migration (AD-20).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior | Error Handling |
|----------|--------------|-------------------|----------------|
| Fresh apply | Extension absent, migration pending | `db:migrate` applies it; `pg_extension` gains a `btree_gist` row | N/A |
| Already installed | Extension present already | `IF NOT EXISTS` makes `up()` a no-op; still records as applied | N/A |
| Host forbids extensions | Role lacks the privilege | Migration aborts; no later migration runs | Postgres error propagates verbatim |
| Local rollback | Applied, nothing depends on it | `db:migrate:undo` drops it | N/A |
| Rollback with dependant | A later object uses `btree_gist` | Postgres refuses the drop | Let it refuse — no `CASCADE` |

</frozen-after-approval>

## Code Map

- `backend/database/migrations/20260824000001-enable-btree-gist.js` -- NEW. The only file this story creates.
- `backend/database/migrations/20260807174949-create-roles.js` -- style reference: `'use strict';` then `export async function up(queryInterface, Sequelize)` / `export async function down(queryInterface)`. Named ESM exports, four-space indent.
- `backend/.sequelizerc` -- non-default paths: migrations/seeders/models under `database/`, config at `config/config.js`.
- `backend/package.json` -- scripts `db:migrate`, `db:migrate:undo`, `db:migrate:status`. Read-only.
- `backend/scripts/db-reset.sh` -- undo-all → migrate → seed, interactive prompt. Do not invoke unattended.
- Applied set verified 2026-08-24 via `db:migrate:status`: all six `20260807*` files are `up`. The new file must sort after them so story 1.4's `users` FK resolves.
- `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md` -- AD-7, AD-19, AD-20. Read-only rationale.

## Tasks & Acceptance

**Execution:**
- [x] `backend/database/migrations/20260824000001-enable-btree-gist.js` -- create it: `up()` runs `CREATE EXTENSION IF NOT EXISTS btree_gist`, `down()` runs `DROP EXTENSION IF EXISTS btree_gist` -- the standalone first step AD-20 requires
- [x] Walk the I/O matrix against the local database (apply, re-apply, undo, re-apply) -- this repo has no migration test harness; `tests/` covers auth/users/roles/permissions only

**Acceptance Criteria:**
- Given `backend/database/migrations/`, when grepped, then exactly one file contains `btree_gist`, and it contains no `createTable`, `addColumn`, `addIndex`, `addConstraint`, or `bulkInsert`.
- Given the new file, when compared with `20260807174949-create-roles.js`, then it uses the same ESM named-export shape and four-space indent.
- Given `npx sequelize-cli db:migrate:status`, when run, then the new file is listed after all six `20260807*` entries.
- Given the migration is applied, when `npm test` runs, then the suite's result is unchanged — no test file added, changed, or removed. Note: this criterion carries no evidence about the migration itself. `tests/utils/test-setup.js` builds its schema with `sequelize.sync({ force: true })` and never invokes the migration runner, so the suite cannot observe this file. It is a no-collateral-damage check only; the migration's real evidence is the Verification section below.

## Spec Change Log

- **Iteration 1 — verification-gap review, 2026-08-24.**
  **Finding:** the `npm test` acceptance criterion and verification command were vacuous. `tests/utils/test-setup.js:9` builds the
  test schema with `sequelize.sync({ force: true })`, so no test loads `database/migrations/`; deleting this migration entirely
  would leave the suite's 102 failed / 17 passed / 119 total result identical. The criterion could not fail.
  **Amended:** the acceptance criterion now states what `npm test` does and does not prove, and the Verification section records the
  executed database evidence in place of implying the suite covers this file.
  **Known-bad state avoided:** shipping a migration whose only named automated check is incapable of detecting a broken migration,
  and carrying that same false assurance forward into stories 1.2, 1.3 and 1.4, which reuse this spec's shape.
  **Code re-derivation:** deliberately skipped. The root cause is in the Verification/Acceptance sections only; the Design Notes pin
  the implementation byte-for-byte and the file on disk already matches it exactly, so a revert-and-re-derive cycle would reproduce
  identical code. This is a documented deviation from the step-04 bad_spec loopback procedure.
  **KEEP:** the one-statement `up()`/`down()` shape, the raw `queryInterface.sequelize.query()` call, the absence of any `try`/`catch`
  or conditional logic, and the `20260824000001-` filename. All five behaviour-matrix rows were exercised against a live PostgreSQL 18
  database, including the dependant-object rollback refusal and a restricted-role privilege denial — do not discard that evidence.

## Design Notes

Sequelize orders migrations alphabetically by filename, and the brownfield auth migrations already start with `2026`. The spine's `01`–`23` numbering assumed an empty database; a literal `01-` prefix would sort ahead of `create-users`, and story 1.4's `request_keys` FK to `users(id)` would fail on a fresh database. Encoding the step number in the timestamp's trailing digits preserves the spine's order.

```js
'use strict';

export async function up(queryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist;');
}

export async function down(queryInterface) {
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS btree_gist;');
}
```

## Verification

This repository has no harness that can execute a migration — `jest.config.js` matches `**/tests/**/*.test.js` only, and every
suite builds its schema from Sequelize models. Verification is therefore by command against a live database, and its results are
recorded here because nothing repeatable protects this file.

**Commands** (from `backend/`):
- `npx sequelize-cli db:migrate:status` -- the new file is listed seventh, after all six `20260807*` entries
- `npm run db:migrate` -- applies with no error; status then shows it `up`
- `npm run db:migrate:undo` then `npm run db:migrate` -- drops and re-applies cleanly
- `SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist';` -- one row after migrate, zero rows after undo

**Recorded results, 2026-08-24, against PostgreSQL 18.0:**
- Fresh apply -- applied; `pg_extension` returned `btree_gist` 1.8.
- Already installed -- the `SequelizeMeta` row was removed with the extension left in place; the re-run was a no-op and re-recorded as applied.
- Local rollback -- `db:migrate:undo` dropped it; `pg_extension` returned zero rows; the re-apply was clean.
- Rollback with a dependant -- inside a rolled-back transaction, AD-7's `EXCLUDE USING gist (unit_id WITH =, period WITH &&)` was
  created and the drop attempted. Postgres refused: `cannot drop extension btree_gist because other objects depend on it`. This
  doubles as proof that `btree_gist` genuinely unlocks the Epic 7 constraint.
- Host forbids extensions -- not reproducible directly, since `btree_gist` is already installed locally and `IF NOT EXISTS`
  short-circuits before any privilege check. Exercised by proxy: a temporary non-superuser role without `CREATE` on the database
  attempted `CREATE EXTENSION IF NOT EXISTS pg_trgm` and was refused with SQLSTATE `42501`, `permission denied to create extension`.
  The role was dropped and its removal confirmed; `btree_gist` was untouched and `pg_trgm` was never installed. The true
  end-to-end case is only observable on the chosen host and remains unproven until first deploy.

**Caution:** `npm test` connects to the development database (`config/config.js` falls back to `DB_NAME` because `DB_NAME_TEST` is
set nowhere) and runs `sync({ force: true })`, dropping and reseeding every table. Run migration verification *after* the suite, not
before, or the state you inspect will not be the state the migration built. Logged in `deferred-work.md`.

## Suggested Review Order

- The whole story: one idempotent statement, no wrapper, so a forbidding host fails raw.
  [`20260824000001-enable-btree-gist.js:4`](../../backend/database/migrations/20260824000001-enable-btree-gist.js#L4)

- Local-development rollback only; no `CASCADE`, so a dependant object blocks the drop.
  [`20260824000001-enable-btree-gist.js:8`](../../backend/database/migrations/20260824000001-enable-btree-gist.js#L8)

- ESM named exports matching the six existing migrations; the package is `"type": "module"`.
  [`20260824000001-enable-btree-gist.js:3`](../../backend/database/migrations/20260824000001-enable-btree-gist.js#L3)

- Filename: `000001` mirrors spine step 01 while sorting after `create-users` for story 1.4.
  [`20260824000001-enable-btree-gist.js:1`](../../backend/database/migrations/20260824000001-enable-btree-gist.js#L1)
