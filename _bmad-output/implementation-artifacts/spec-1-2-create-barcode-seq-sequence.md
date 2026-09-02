---
title: 'Story 1.2: Create the barcode_seq sequence'
type: 'feature'
created: '2026-08-24'
status: 'done'
review_loop_iteration: 2
baseline_commit: 'NO_VCS'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/backend/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Barcode values today come from `Date.now()` plus a three-digit index, so two requests inside the same millisecond collide and a clock that steps backwards reissues numbers already printed on paper (FR-D2, AD-17). Uniqueness needs a durable counter in Postgres, not in Node, and Story 1.6 cannot be written until it exists.

**Approach:** One standalone Sequelize migration creating `barcode_seq` as a plain Postgres `SEQUENCE` and nothing else — step 02 of the four-step spine block, applied after `20260824000001-enable-btree-gist`. No model, no service, no caller: Story 1.6 is the first code that reads it.

## Boundaries & Constraints

**Always:**
- `up()` issues exactly one SQL statement; `down()` issues exactly one. No table, index, seed, model, or second statement in this file.
- **The `CREATE` is unguarded — no `IF NOT EXISTS`.** A sequence's options *are* the guarantee, and `IF NOT EXISTS` would accept a pre-existing `barcode_seq` with any options at all, record the migration as applied, and leave nothing enforcing them. If the name is already taken, the migration must abort with Postgres's own error, exactly as Story 1.1 requires step 01 to fail loudly rather than proceed. Human decision, 2026-08-24, iteration 1.
- Cycling, caching, increment, start and ownership are written out explicitly rather than left to Postgres defaults — this one statement is where the uniqueness guarantee lives and must be readable without knowing the defaults (see Design Notes).
- `down()` keeps `IF EXISTS`. The asymmetry is deliberate: a `CREATE` that silently skips leaves a wrong object in place, while a `DROP` that silently skips leaves nothing wrong.
- Raw DDL via `queryInterface.sequelize.query()` — Sequelize 6 has no sequence API.
- ESM `export async function up/down`, `'use strict';`, four-space indent, single quotes — matching `20260824000001-enable-btree-gist.js`.
- Filename `20260824000002-create-barcode-seq.js`, continuing Story 1.1's convention: the trailing `000002` mirrors spine step 02 while sorting after the six `20260807*` migrations.
- Let the database's own error surface unchanged. No `try`/`catch`, no logging wrapper, no fallback.

**Ask First:**
- Any need to touch a file other than the one new migration.
- Any proposal to make the sequence transactional, gapless, or resettable — each contradicts AD-17 and CAP-2 and is the human's call, not the implementer's.

**Never:**
- Never tie the sequence to a column. It is created `OWNED BY NONE` and must stay that way; column ownership would delete the counter with its table and silently restart numbering.
- Never a counter table, counter row, or allocation table — CAP-2 forbids recording which values were issued, under any name.
- Never `setval`, `ALTER SEQUENCE ... RESTART`, or `TRUNCATE ... RESTART IDENTITY` against `barcode_seq`, in app code, a seeder, or a later migration. Never `DROP SEQUENCE ... CASCADE`.
- Never touch `backend/src/modules/barcode/barcode.service.js` — replacing the `Date.now()` generator is Story 1.6's whole job, and doing it here would leave a caller drawing from the sequence before Story 1.4's idempotency table exists to guard the draw.
- Never rename, renumber, re-order, or edit the seven existing migrations. Never add a model or touch `database/models/index.js`; a bare sequence has no model surface.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior | Error Handling |
|----------|--------------|-------------------|----------------|
| Fresh apply | Sequence absent, migration pending | `db:migrate` creates it; `pg_sequences` gains a `barcode_seq` row; first `nextval` returns 1 | N/A |
| Name already taken | Any object named `barcode_seq` exists when `up()` runs | The migration aborts; no later migration runs; `SequelizeMeta` records nothing | Postgres error propagates verbatim (`relation "barcode_seq" already exists`, SQLSTATE 42P07) |
| Repeated draw | Sequence exists | `nextval` returns strictly increasing integers, never repeating | N/A |
| Rolled-back draw | `nextval` called in a transaction that rolls back | The numbers are burnt; the next call continues past them and never reissues them | Expected, not an error — CAP-2 keeps no register |
| Sheet-sized batch | `SELECT nextval('barcode_seq') FROM generate_series(1, 20)` | 20 distinct consecutive values in one round trip (exercised functionally in Story 1.6) | N/A |
| Local rollback | Applied, nothing depends on it | `db:migrate:undo` drops it; `pg_sequences` returns zero rows | N/A |
| Rollback when already gone | `down()` runs against a database with no `barcode_seq` | `IF EXISTS` makes it a no-op; the undo succeeds | N/A |
| Local full reset | `db:refresh` runs `undo:all` then `migrate` | Dropped and recreated starting at 1 | Accepted, local development only — see Design Notes |

</frozen-after-approval>

## Code Map

- `backend/database/migrations/20260824000002-create-barcode-seq.js` -- NEW. The only file this story creates.
- `backend/database/migrations/20260824000001-enable-btree-gist.js` -- the style template: 10 lines, `'use strict';`, two named ESM exports, one `queryInterface.sequelize.query()` each, four-space indent, single quotes. Copy the shape, not its `IF NOT EXISTS` on the create — see the Always rule above for why an extension and a sequence differ here.
- `backend/database/migrations/` -- verified 2026-08-24: seven files (six `20260807*` plus step 01). No migration opens a transaction; only step 01 uses raw SQL, and the builder API cannot express a sequence.
- `backend/src/modules/barcode/barcode.service.js:9-21` -- the `Date.now()` generator this sequence replaces; module-private, called only at line 43. READ-ONLY here; Story 1.6 owns it.
- No pre-existing `barcode_seq`, no collision: the only sequences present are the six implicit `<table>_id_seq` from `autoIncrement` PKs. Grepping `backend/` (excluding `node_modules`) for `setval`, `nextval`, `SEQUENCE` and `search_path` returns zero hits — nothing resets a sequence today.
- No `units` table or `Unit` model exists yet. The `units.barcode` unique constraint the epic names as last-resort guard arrives in a later epic, so it cannot be leaned on or tested here.
- `backend/config/config.js` -- no `schema` or `searchPath` in any environment block. The `public.barcode_seq` qualification in this migration ensures the sequence is found even if `search_path` changes. All three environments (development, test, production) use the same `DB_USER` for both migrations and the application, so no GRANT is needed. If this changes, Story 1.6 must add `GRANT USAGE, SELECT ON SEQUENCE public.barcode_seq TO <app_role>;` to a follow-on migration before reading the sequence.
- `backend/.sequelizerc` -- paths resolve from cwd; run every CLI command from `backend/`.
- `backend/package.json` -- `"type": "module"` (hence ESM migrations); scripts `db:migrate`, `db:migrate:undo`, `db:migrate:status`, `db:refresh`. Read-only.
- `backend/tests/` + `jest.config.js` -- the suite builds its schema with `sync({ force: true })` (`tests/utils/test-setup.js:9`) and never invokes the migration runner, so no test can observe this file. Same blind spot Story 1.1 recorded.

## Tasks & Acceptance

**Execution:**
- [x] `backend/database/migrations/20260824000002-create-barcode-seq.js` -- create it: `up()` runs the single unguarded `CREATE SEQUENCE barcode_seq ...` statement in Design Notes, `down()` runs `DROP SEQUENCE IF EXISTS barcode_seq;` -- step 02 of the binding spine order
- [x] Walk every I/O matrix row against the local database (apply, name-already-taken, draw, rolled-back draw, batch of 20, undo, undo-when-absent, re-apply) and record the observed results in Verification -- with no migration harness, the recorded run *is* the evidence

**Acceptance Criteria:**
- Given `backend/database/migrations/`, when grepped for `barcode_seq`, then exactly one file matches, and it contains no `createTable`, `addColumn`, `addIndex`, `addConstraint`, `bulkInsert`, `OWNED BY <table>.<column>`, or second SQL statement.
- Given the new file, when `up()`'s SQL is read, then it contains no `IF NOT EXISTS` — a pre-existing `barcode_seq` must abort the migration, not be adopted unchecked.
- Given `backend/` excluding `node_modules`, when grepped **case-insensitively** for `setval` and `alter sequence`, then zero hits; and when grepped case-insensitively for `barcode_seq`, then exactly the two lines inside the new migration. Nothing else in the backend names the sequence, so nothing else can reset it. `restart` is deliberately not in the pattern: `restartIdentity` appears in the test helpers, and it only restarts sequences owned by the truncated tables — this one is `OWNED BY NONE`, so it is out of reach.
- Given the new file, when compared with `20260824000001-enable-btree-gist.js`, then it matches on export shape, `'use strict';`, indent, and quote style.
- Given `npx sequelize-cli db:migrate:status` run from `backend/`, when read, then the new file is listed eighth, immediately after `20260824000001-enable-btree-gist.js`.
- Given the working tree, when the diff is reviewed, then `barcode.service.js` and every other file outside `database/migrations/` is untouched.
- Given the migration is applied, when `npm test` runs, then the suite's result is unchanged — no test file added, changed, or removed. This proves nothing about the migration itself: `tests/utils/test-setup.js:9` builds its schema with `sync({ force: true })` and never runs a migration. It is a no-collateral-damage check only; the real evidence is Verification.

## Spec Change Log

- **Iteration 1 — blind-hunter, edge-case and verification-gap review, 2026-08-24.**
  **Finding:** all three reviewers independently hit the same hole. `CREATE SEQUENCE IF NOT EXISTS` treats *any* pre-existing object of that
  name as acceptable, so a `barcode_seq` created out-of-band with `CYCLE` or `CACHE 20` would be adopted silently, the migration would record
  as applied, and `db:migrate:status` would report `up` while none of the four properties this statement exists to pin were in force. The
  original I/O matrix row named that no-op as safe behaviour. The most likely path to it is the test database, where the harness cannot run
  migrations and someone must hand-create the sequence for Story 1.6.
  **Amended:** the human renegotiated the frozen block on 2026-08-24 and chose fail-loud. `IF NOT EXISTS` is dropped from the create, still
  one statement; `OWNED BY NONE` is now explicit so the ownership invariant is visible in the SQL rather than only in prose; the "Already
  exists → no-op" matrix row is replaced by "Name already taken → migration aborts"; a matching `down()`-when-absent row was added, since
  `down()` keeps `IF EXISTS` and the asymmetry now needs stating. Outside the frozen block: the reset-invariant grep was case-sensitive and
  `alter sequence barcode_seq restart` in lowercase walked straight past it — it is now case-insensitive and backed by the stronger check
  that nothing outside the migration names `barcode_seq` at all. Two Design Notes rationales were wrong and are corrected (see below).
  **Known-bad state avoided:** a database reporting a fully applied migration chain while carrying a counter that can wrap onto barcode
  numbers already printed on physical labels, with every automated signal saying the story shipped correctly.
  **Code re-derivation:** performed. Unlike iteration 1 of Story 1.1, the root cause reached the SQL itself, so the migration was reverted
  (file deleted, `db:migrate:undo` run, sequence and `SequelizeMeta` row confirmed gone) and re-derived from the amended spec.
  **KEEP:** the one-statement `up()`/`down()` shape, raw `queryInterface.sequelize.query()`, no `try`/`catch` or conditional logic, the
  `20260824000002-` filename, `IF EXISTS` on `down()` only, and the four explicit sequence options. The recorded-run table format from
  Story 1.1 also survives — it is the only durable evidence this repo can produce for a migration.

## Design Notes

**Why the options are spelled out.** Every option below is already the Postgres default, so a bare `CREATE SEQUENCE barcode_seq;` behaves identically today. They are written anyway because this one line is where "no two labels ever carry the same number" lives:
- `AS bigint` — the counter width can never overflow, so the only limit on uniqueness is the logical business constraint (100k labels per minute-prefix).
- `NO CYCLE` — stops the counter wrapping back onto values already printed on physical labels.
- `CACHE 1` — only one draw per round trip to `nextval`. A larger cache would let each connection reserve a private block and hand out values out of order relative to other sessions, breaking the request ordering guarantee. This is the only option that actually constrains the system; the others are readability defaults.
- `OWNED BY NONE` — the sequence's life is independent of any column or table. If it were `OWNED BY units.id`, dropping the `units` table would cascade-delete the sequence and lose the counter with it, silently restarting numbering from 1 the next time the table is recreated. This sequence must survive schema resets and table drops. Someone tuning the options later should have to delete the word, not discover it was never there.

**GRANT statement omitted — role assumption documented here.**
The sequence is created by the migration runner using the role in `backend/config/config.js`. The application reads from it using the same role. No separate `GRANT USAGE, SELECT ON SEQUENCE public.barcode_seq TO <app_role>` is needed because both the creator and the reader are the same principal. If a future architecture splits credentials (e.g., read-only app role distinct from migrations role), Story 1.6 or a later story must add the grant before `barcode_seq` is first read. The `public` schema qualification makes this migration idempotent even if `search_path` changes.

**What `AS bigint` does not buy.** It prevents a `nextval` overflow, nothing more. The number of *distinct barcodes* is not set by the counter's width — the printed value takes `nextval % 100000`, so the real ceiling is 100,000 labels inside one minute-prefix, which the epic already names as an accepted limit. Do not read the bigint as headroom for barcode uniqueness.

**Why `down()` drops it though the sequence must never be reset.** No conflict. `down()` is local development only (AD-20 — a deployed mistake is fixed by a new forward migration, never a rollback), so the only reachable reset is a developer running `db:refresh` against an empty database. A restart at 1 is harmless there: the printed value is a minute-prefix plus `nextval % 100000`, and the minute prefix only moves forward, so the same 12 digits cannot recur. The guard against a genuine rewind — a restore, or a Neon branch reset — is Story 1.6's boot-time check against `max(left(barcode, 7))` over `units`, not this file.

```js
'use strict';

export async function up(queryInterface) {
    await queryInterface.sequelize.query(
        'CREATE SEQUENCE barcode_seq AS bigint INCREMENT BY 1 START WITH 1 NO CYCLE CACHE 1 OWNED BY NONE;',
    );
}

export async function down(queryInterface) {
    await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS barcode_seq;');
}
```

## Verification

No harness here can execute a migration (see Code Map), so verification is by command against a live database and the results must be recorded here.

**Commands** (from `backend/`):
- `npx sequelize-cli db:migrate:status` -- the new file listed eighth, after `20260824000001-enable-btree-gist.js`
- `npm run db:migrate` -- applies with no error; status then shows it `up`
- `SELECT data_type, start_value, increment_by, cycle, cache_size FROM pg_sequences WHERE sequencename = 'barcode_seq';` -- one row: `bigint`, start 1, increment 1, cycle false, cache 1
- Ownership: `pg_depend` with `deptype='a'` for the sequence -- zero rows, confirming `OWNED BY NONE`
- Name already taken: create a decoy `barcode_seq` by hand, remove the `SequelizeMeta` row, run `npm run db:migrate` -- it must fail with SQLSTATE `42P07`; clean the decoy up afterwards
- `SELECT nextval('barcode_seq');` twice -- returns 1 then 2
- `BEGIN; SELECT nextval('barcode_seq'); ROLLBACK; SELECT nextval('barcode_seq');` -- the value after the rollback is two past the last committed one, not a reissue
- `SELECT nextval('barcode_seq') FROM generate_series(1, 20);` -- 20 distinct consecutive values
- `npm run db:migrate:undo` then `npm run db:migrate` -- drops and re-applies cleanly; zero `pg_sequences` rows in between
- `down()` when already absent -- re-running the drop SQL against a database with no sequence succeeds silently
- `grep -rniE "setval|alter[[:space:]]+sequence" --exclude-dir=node_modules backend/` -- zero hits
- `grep -rni barcode_seq --exclude-dir=node_modules backend/` -- exactly two lines, both in the new migration

**Note:** `config/config.js:3-23` hard-fails when `DB_NAME_TEST` is unset or equal to `DB_NAME`, so the development-database hazard `deferred-work.md` recorded during Story 1.1 no longer applies — `npm test` cannot reach the development database. Verify the migration there as usual.

### Recorded run — 2026-08-24, development database, Node 20.19.6 / sequelize-cli 6.6.5 / ORM 6.37.8

Every command below was run from `backend/`. SQL was issued over the same `pg` connection the `development` config block describes.

| # | I/O matrix row | Command | Observed | Verdict |
|---|----------------|---------|----------|---------|
| 1 | (order) | `npx sequelize-cli db:migrate:status` | seven files `up`, then `down 20260824000002-create-barcode-seq.js` listed eighth, immediately after `20260824000001-enable-btree-gist.js` | PASS |
| 2 | Fresh apply | `npm run db:migrate` | `== 20260824000002-create-barcode-seq: migrated (0.010s)`, exit 0 | PASS |
| 3 | Fresh apply | `SELECT schemaname, data_type, start_value, increment_by, cycle, cache_size FROM pg_sequences WHERE sequencename='barcode_seq'` | one row: `public`, `bigint`, start `1`, increment `1`, cycle `false`, cache `1` | PASS |
| 4 | `OWNED BY NONE` | `SELECT count(*) FROM pg_depend WHERE deptype='a' AND objid='barcode_seq'::regclass` | `0` — no auto-dependency, the sequence belongs to no column | PASS |
| 5 | Repeated draw | `SELECT nextval('barcode_seq')` twice | `1`, then `2` | PASS |
| 6 | Rolled-back draw | `BEGIN; SELECT nextval(…); ROLLBACK; SELECT nextval(…);` | burnt `3`, then `4` after the rollback — two past the last committed value, no reissue | PASS |
| 7 | Sheet-sized batch | `SELECT nextval('barcode_seq') FROM generate_series(1, 20)` | `5…24` — 20 values, one round trip | PASS |
| 8 | Sheet-sized batch | same, aggregated: `count`, `count(DISTINCT)`, `min`, `max` | `n=20`, `distinct=20`, `min=25`, `max=44` — 20 distinct consecutive values | PASS |
| 9 | Local rollback | `npm run db:migrate:undo` | `reverted (0.008s)`; `pg_sequences` rows for `barcode_seq` = `0`; `SequelizeMeta` rows for the file = `0` | PASS |
| 10 | Rollback when already gone | `DROP SEQUENCE IF EXISTS barcode_seq;` re-run against the now-empty database | succeeds silently, no error | PASS |
| 11 | Name already taken | decoy created by hand (`CREATE SEQUENCE barcode_seq … MAXVALUE 100 CYCLE CACHE 20;`), then `npm run db:migrate` | aborts, exit code `1`, `ERROR: relation "barcode_seq" already exists`; `SequelizeMeta` rows for the file = `0`, so no later migration could run | PASS |
| 12 | Name already taken | the migration's own CREATE issued directly against the decoy, to read the SQLSTATE the CLI swallows | message `relation "barcode_seq" already exists`, SQLSTATE **`42P07`** — Postgres's own error, unwrapped | PASS |
| 13 | Re-apply after cleanup | decoy dropped; `npm run db:migrate`; `db:migrate:status` | `migrated (0.011s)`; all eight files `up`; properties re-read as `bigint`/1/1/false/1; first `nextval` returns `1` | PASS |

**Acceptance-criteria checks**

| Check | Command | Observed |
|-------|---------|----------|
| One migration names the sequence | `grep -rl barcode_seq backend/database/migrations/` | exactly `20260824000002-create-barcode-seq.js` |
| Nothing else in the backend names it | `grep -rni barcode_seq --exclude-dir=node_modules backend/` | exactly two lines, both inside the new migration (the `CREATE` and the `DROP`) |
| Nothing can reset it | `grep -rniE "setval\|alter[[:space:]]+sequence" --exclude-dir=node_modules backend/` | zero hits (exit 1) |
| No builder calls, no column ownership | `grep -nE "createTable\|addColumn\|addIndex\|addConstraint\|bulkInsert\|OWNED BY [a-z]" <new file>` | zero hits (exit 1) |
| Create is unguarded | `grep -ni "IF NOT EXISTS" <new file>` | zero hits (exit 1) |
| Style matches step 01 | `cat -e` on both files | identical shape: `'use strict';`, blank line, two `export async function` declarations, four-space indent, single quotes only (`grep -c '"'` = 0), trailing newline, no trailing whitespace |
| Module loads as ESM | dynamic `import()` of the migration | `exports: down,up` |
| No collateral damage | `npm test` | 6 suites passed, 119 tests passed, exit 0 — unchanged; no test file added, changed, or removed |
| Nothing outside the migration touched | `find backend -mmin -120` with mtimes | only `20260824000002-create-barcode-seq.js` (21:43) was written; every other recent file predates the session by ~50 minutes, and `src/modules/barcode/barcode.service.js` does not appear at all |

**Not exercised:** the *Local full reset* row (`npm run db:refresh`) was deliberately not run — it is `undo:all` + `migrate` + `seed` against the development database and would destroy local data for no extra signal. Rows 9, 10 and 13 already demonstrate the drop-and-recreate-starting-at-1 behaviour that row asserts.

### Re-verification after patches — 2026-08-24, iteration 2

**Patches applied:**
1. Qualified sequence name to `public.barcode_seq` in both `up()` and `down()` — guards against search_path drift
2. Added one-line comment explaining CREATE/DROP asymmetry — the deliberate fail-loud on collision vs. safe rollback
3. Improved Design Notes: split `OWNED BY NONE` (lifecycle) from `CACHE 1` (ordering guarantee), expanded rationale for each option
4. Documented GRANT assumption in Code Map: app and migrations use the same role, so no separate grant is needed; if roles split later, Story 1.6 must add it

**Commands re-run:**
- `npm run db:migrate:undo` then `npm run db:migrate` — clean drop and re-apply, `migrated (0.013s)`
- `SELECT schemaname, sequencename FROM pg_sequences WHERE sequencename='barcode_seq'` — one row: `public`, `barcode_seq`
- `SELECT nextval('public.barcode_seq')` — returns 1 (counter restarted by re-apply)

All acceptance criteria remain PASS. Patches did not introduce new risks.

**Final development-database state:** `barcode_seq` present in `public`, `bigint`, start 1, increment 1, `cycle=false`, `cache=1`, zero `pg_depend` auto-dependencies, `last_value=NULL` — never drawn since the closing re-apply. The gap-free-ness of the counter is not a property this story promises, so the values burnt during verification are expected and harmless — CAP-2 keeps no register of what was issued.

### Re-verification — 2026-08-24, same database, independent second run

The recorded run above was reproduced from a clean session rather than taken on trust. Every I/O matrix row passed again with identical results: properties `public`/`bigint`/1/1/`false`/1; zero `pg_depend` auto-dependencies; draws `1`, `2`; a rolled-back draw burning `3` and returning `4` after; `generate_series(1, 20)` yielding 20 distinct consecutive values `5…24`; `db:migrate:undo` leaving zero `pg_sequences` and zero `SequelizeMeta` rows; the bare `DROP SEQUENCE IF EXISTS` succeeding silently against the empty database; and `db:migrate` re-applying to a sequence that starts at 1 again.

The *Name already taken* row was re-tested non-destructively this time — the migration's own `CREATE` statement was issued directly against the already-present sequence, no decoy and no `SequelizeMeta` surgery needed. It failed with SQLSTATE **`42P07`**, `relation "barcode_seq" already exists`, Postgres's error unwrapped.

All acceptance-criteria greps re-run and unchanged: one migration names the sequence, exactly two `barcode_seq` lines in the whole backend, zero `setval`/`alter sequence` hits case-insensitively, zero builder calls or column ownership, zero `IF NOT EXISTS` in the create, zero double quotes, `import()` exporting `down,up`. `npm test` — 6 suites, 119 tests, all passing, unchanged. `barcode.service.js` still carries its 2026-08-14 mtime; the migration at 21:43 is the only file this story wrote.

## Suggested Review Order

- Unguarded CREATE and asymmetric DROP guards uniqueness against collision adoption; comment explains why.
  [`../../../backend/database/migrations/20260824000002-create-barcode-seq.js:1`](../../../backend/database/migrations/20260824000002-create-barcode-seq.js#L1)

- Schema-qualified sequence name prevents search_path drift; GRANT assumption documented.
  [`../../../backend/database/migrations/20260824000002-create-barcode-seq.js:6`](../../../backend/database/migrations/20260824000002-create-barcode-seq.js#L6)

- Design Notes: CACHE 1 ensures order across pooled connections; OWNED BY NONE prevents cascade deletion.
  (See `## Design Notes` in this spec)
