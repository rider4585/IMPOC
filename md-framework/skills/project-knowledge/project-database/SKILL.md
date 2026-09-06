---
name: project-database
version: 1.0.0
description: |
  Recover and document a PostgreSQL schema from an existing project: tables,
  relationships, constraints, indexes, and the migration history that produced
  them. Produces docs/project-knowledge/database.md with an ERD and every claim
  cited. Use when asked to "document the schema", "what does the database look
  like", "map the data model", "find the relationships", or when starting Phase 0
  discovery on a project without schema documentation.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Project Database Discovery

The schema is the most durable part of any system and the most expensive to get
wrong. Document what exists before anyone proposes changing it.

### Confidence marking (mandatory)

`[verified]` (read in a migration or introspected from a live database, with a
citation) · `[inferred]` (deduced from naming or usage) · `[assumed]` (goes to
Open Questions). Never state an `[assumed]` constraint as fact — a wrong claim
about a foreign key or a unique index will produce broken code downstream.

### Method

1. **Prefer introspection over reading migrations.** Migrations tell you the
   intended history; the live database tells you the truth. If a development
   database is reachable, introspect it. Otherwise reconstruct from migrations in
   order and mark the result `[inferred]`.

2. **Enumerate tables and columns.**
   ```sql
   SELECT table_name, column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_schema = 'public'
   ORDER BY table_name, ordinal_position;
   ```

3. **Recover the relationships.** Foreign keys are the real data model.
   ```sql
   SELECT tc.table_name, kcu.column_name,
          ccu.table_name AS references_table, ccu.column_name AS references_column,
          rc.delete_rule, rc.update_rule
   FROM information_schema.table_constraints tc
   JOIN information_schema.key_column_usage kcu   ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
   JOIN information_schema.referential_constraints rc  ON tc.constraint_name = rc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY';
   ```
   Record `ON DELETE` behaviour explicitly — cascade rules are business rules in
   disguise.

4. **Capture every constraint.** Unique, check, not-null, and exclusion
   constraints encode invariants the application relies on. A `CHECK (quantity >= 0)`
   is a business rule; record it as one.

5. **Inventory the indexes.**
   ```sql
   SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public';
   ```
   Note which foreign keys have **no** covering index — a common and material
   performance defect.

6. **Find the implicit relationships.** Columns named `*_id` with no foreign key
   constraint are relationships the database does not enforce. Every one is a data
   integrity risk. List them.

7. **Read the migration history.** Locate the migration directory and read it
   chronologically. You are looking for: destructive operations, columns added
   then abandoned, and renames that left stale references.

8. **Identify the tenancy model.** If rows are scoped to a shop, tenant, or
   organisation, find the scoping column and confirm whether every query filters
   on it. Record this precisely — it is the foundation of the access control model.

### Output

Write `docs/project-knowledge/database.md`:

```markdown
# Database

## 1. Overview          — engine version, schema count, migration tool
## 2. ERD               — Mermaid erDiagram of tables and relationships
## 3. Tables            — per table: purpose, key columns, owning module
## 4. Relationships     — FK list with delete/update rules
## 5. Constraints       — invariants the schema enforces
## 6. Indexes           — existing, plus unindexed foreign keys
## 7. Implicit Links    — *_id columns without constraints  ⚠️ integrity risk
## 8. Tenancy           — how rows are scoped, and whether it is enforced
## 9. Migration Notes   — destructive history, abandoned columns
## Open Questions
```

Render the ERD as a Mermaid `erDiagram` block so it displays without tooling.

### Finishing

- Append durable facts to `$AGENT_DIR/memory.md`.
- `propose` Open Questions to `god` in one batch.
- Never propose a schema change from this skill. Documenting and changing are
  separate work items with separate approvals.

## References

- **PostgreSQL 16 documentation — `information_schema`** — the introspection
  queries in steps 2–3 <https://www.postgresql.org/docs/16/information-schema.html>
- **PostgreSQL 16 documentation — `pg_indexes`** — step 5
  <https://www.postgresql.org/docs/16/view-pg-indexes.html>
- **Markus Winand, _Use The Index, Luke_** — unindexed foreign keys as a
  performance defect (step 5) <https://use-the-index-luke.com>
- **arc42** — section ordering convention shared across the project-knowledge set
- **Munder Difflin `PROTOCOL.md`** — memory write-back and `propose` handoff

**Not sourced — added deliberately:** the confidence marking, and the rule that
this skill may document but never propose schema changes.
