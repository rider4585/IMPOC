---
name: postgres-code-review
version: 1.0.0
description: |
  Review database changes — migrations, queries, and data access code — against
  correctness, concurrency, performance, and safety criteria before they merge.
  Use as the database lane of a review gate, when reviewing any migration or
  repository code, or when asked to "review this database change". Reports
  findings; does not implement fixes.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## PostgreSQL Code Review

The review pass that catches what tests do not: plans that degrade at production
scale, migrations that lock, and races that need two simultaneous users to
appear.

**Report findings; do not fix them.** The implementer fixes; the reviewer stays
objective.

### 1. Schema and migration safety

Highest-consequence lane — run it first.

- [ ] No operation rewrites a large table or takes `ACCESS EXCLUSIVE` for long
- [ ] `lock_timeout` and `statement_timeout` set in the migration
- [ ] Indexes created `CONCURRENTLY`, outside a transaction
- [ ] Constraints added `NOT VALID`, then validated separately
- [ ] No in-place rename or retype — expand/contract used instead
- [ ] Backfills batched with commits, not one large `UPDATE`
- [ ] Migration is compatible with the **currently deployed** application version
- [ ] `down` migration exists and has been tested
- [ ] Anything destructive has explicit human approval and a verified backup

→ `migrations`

### 2. Correctness and constraints

- [ ] Money is `numeric` or integer minor units — **never** float
- [ ] Timestamps are `timestamptz`
- [ ] Primary key on every table
- [ ] Foreign key on every reference, with a deliberate `ON DELETE`
- [ ] No `CASCADE` onto financial history
- [ ] `CHECK` constraints on quantity, price, and percentage ranges
- [ ] Unique constraints tenant-scoped where identity is per-shop
- [ ] `NOT NULL` unless nullability has a defined meaning
- [ ] Sale lines snapshot price, name, tax, and cost at transaction time

→ `schema-design`, `constraints`, `normalization`

### 3. Concurrency

The lane that unit tests never cover. Ask of every read-then-write: *what if
another transaction ran in between?*

- [ ] Stock and balance changes are atomic single statements
      (`SET quantity = quantity - $1 WHERE quantity >= $1`), not read-compute-write
- [ ] Threshold guards live in the `WHERE` clause, not an application `if`
- [ ] Uniqueness enforced by constraint with `ON CONFLICT`, not a prior existence check
- [ ] Payment and other side-effecting operations carry an idempotency key
- [ ] Transaction boundaries wrap the full invariant (sale + lines + stock + payment)
- [ ] No external I/O between `BEGIN` and `COMMIT`
- [ ] Retry handling present where isolation is above `READ COMMITTED`
- [ ] Locks acquired in a consistent order

→ `concurrency`, `transactions`, `locking`

### 4. Query quality

- [ ] `EXPLAIN (ANALYZE, BUFFERS)` provided for any non-trivial new query
- [ ] No N+1 — query count per request checked
- [ ] Explicit column lists; no `SELECT *`
- [ ] Deep pagination uses keyset, not `OFFSET`
- [ ] Indexed columns appear bare in predicates (no functions or casts on them)
- [ ] Every new access path has a supporting index
- [ ] Foreign keys on the referencing side are indexed
- [ ] No redundant or unused indexes introduced

→ `query-optimization`, `indexing`, `explain-analyze`

### 5. Security

- [ ] All queries parameterised; no string interpolation into SQL
- [ ] ORM raw/unsafe escape hatches justified and reviewed
- [ ] Dynamic identifiers allow-listed against a fixed set
- [ ] Tenant scoping present in **every** query touching tenant data
- [ ] Object-level authorisation enforced in the query, not after it
- [ ] Application connects as a least-privilege role
- [ ] No credentials in migrations, seeds, or connection strings in source

→ `sql-injection`, `authorization-security`, `secrets-detection`

### 6. Operational

- [ ] Large-table changes considered against production row counts, not dev data
- [ ] New stored aggregates have a reconciliation query
- [ ] Retention/archival implications considered for high-volume tables
- [ ] Indexes' write cost weighed on hot tables

→ `data-integrity`, `postgres-performance`, `partitioning`

### Reporting

```
SEVERITY   HIGH
LOCATION   migrations/20260906_add_barcode.sql:12
ISSUE      CREATE INDEX without CONCURRENTLY on sale (≈40M rows)
IMPACT     Blocks all writes to sale for the duration — checkout unavailable
FIX        CREATE INDEX CONCURRENTLY, outside a transaction
```

Severity guidance for this lane:

| Level | Examples |
|---|---|
| `CRITICAL` | Data loss, destructive migration without approval, float money, missing tenant scope |
| `HIGH` | Locking migration on a large table, lost-update race, SQL injection, missing FK index on a hot join |
| `MEDIUM` | N+1, `OFFSET` pagination, missing `CHECK`, unbounded query |
| `LOW` | Naming inconsistency, redundant index |

### Checklist

- [ ] All six lanes applied
- [ ] Production row counts considered, not development data
- [ ] Concurrency reasoned about explicitly for every read-then-write
- [ ] Findings carry severity, location, impact, and a specific fix
- [ ] No fixes authored by the reviewer
- [ ] Verdict issued: PASS / PASS WITH CONDITIONS / BLOCK

## References

- **PostgreSQL 16 documentation — ALTER TABLE, CREATE INDEX, Explicit Locking,
  Transaction Isolation, Performance Tips** — the behaviours each lane checks
  <https://www.postgresql.org/docs/16/>
- **OWASP Code Review Guide v2.0** — the report-don't-fix separation and finding
  format <https://owasp.org/www-project-code-review-guide/>
- **OWASP SQL Injection Prevention Cheat Sheet** — lane 5
  <https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html>

**Not sourced — written for this framework:** the six-lane structure, the
retail-specific criteria (tenant scoping, sale-line snapshots, stock atomicity),
the severity mapping, and the finding format.
