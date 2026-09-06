---
name: migrations
version: 1.0.0
description: |
  Write and review PostgreSQL schema migrations that deploy without downtime or
  data loss — safe operation ordering, expand/contract for breaking changes, and
  lock-aware DDL. Use when adding or altering tables and columns, before any
  production migration, or when asked "is this migration safe".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Migrations

A migration runs once against real data while the application is serving traffic.
Two things go wrong: it destroys data, or it takes a lock that stops the site.

**The rule:** a migration that cannot be rolled back must be reviewed by a human
before it runs. Anything dropping or rewriting existing data is in that category.

### Lock awareness

Most `ALTER TABLE` forms take `ACCESS EXCLUSIVE`, which blocks reads as well as
writes. Worse, a blocked DDL statement queues ahead of subsequent queries, so one
`ALTER` waiting behind one long transaction stalls the entire table.

**Always bound the wait:**

```sql
SET lock_timeout = '3s';
SET statement_timeout = '30s';
ALTER TABLE product ADD COLUMN barcode text;
```

Failing fast and retrying is far better than an outage.

### Safe vs unsafe operations

| Operation | Safe? | Notes |
|---|---|---|
| `ADD COLUMN` (nullable, no default) | ✅ | Metadata only |
| `ADD COLUMN ... DEFAULT` | ✅ (PG 11+) | No rewrite for non-volatile defaults |
| `ADD COLUMN NOT NULL DEFAULT` | ✅ (PG 11+) | Was a full rewrite before 11 |
| `DROP COLUMN` | ⚠️ | Instant, but breaks any deployed code still selecting it |
| `RENAME COLUMN` / `RENAME TABLE` | ❌ | Breaks running code instantly — use expand/contract |
| Change column type | ❌ | Usually a full rewrite under `ACCESS EXCLUSIVE` |
| `SET NOT NULL` | ⚠️ | Full scan; use the `CHECK ... NOT VALID` route |
| `ADD CHECK` / `ADD FOREIGN KEY` | ⚠️ | Full scan; use `NOT VALID` then `VALIDATE` |
| `CREATE INDEX` | ❌ | Blocks writes — use `CONCURRENTLY` |
| `CREATE INDEX CONCURRENTLY` | ✅ | Cannot run inside a transaction |
| `VACUUM FULL` | ❌ | `ACCESS EXCLUSIVE` for the duration |

### The two-step constraint pattern

Add the rule immediately, validate existing rows without blocking:

```sql
-- Step 1: enforced for new/changed rows, no scan, brief lock
ALTER TABLE sale ADD CONSTRAINT chk_total_nonneg CHECK (total >= 0) NOT VALID;
-- Step 2: scans existing rows under a weaker lock
ALTER TABLE sale VALIDATE CONSTRAINT chk_total_nonneg;
```

For `NOT NULL` on a large table, the same idea via a validated `CHECK (col IS NOT
NULL)`, then `SET NOT NULL` (PG 12+ uses the constraint to skip the scan).

### Concurrent indexes

```sql
CREATE INDEX CONCURRENTLY idx_sale_shop_soldat ON sale (shop_id, sold_at);
```

- Cannot run inside a transaction — most migration tools need this flagged
  explicitly.
- On failure it leaves an `INVALID` index that must be dropped and retried:
  ```sql
  SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
  ```

### Expand / contract for breaking changes

Never rename or retype in place. Split across deploys so old and new code both
work at every point:

1. **Expand** — add the new column; deploy.
2. **Backfill** — copy data in batches (see below); deploy code that writes both
   and reads the new one.
3. **Verify** — confirm the columns agree.
4. **Contract** — stop writing the old column; deploy. Then drop it in a later
   migration.

Each step is independently deployable and reversible. The old column is dropped
only once no running code references it.

### Backfilling large tables

A single `UPDATE` over millions of rows holds locks, bloats the table, and can
run for hours. Batch it, outside the migration:

```sql
DO $$
DECLARE n integer;
BEGIN
  LOOP
    UPDATE product SET barcode = sku
     WHERE id IN (SELECT id FROM product WHERE barcode IS NULL LIMIT 1000);
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
    COMMIT;
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;
```

### Reversibility

Every migration needs a `down` — or an explicit note that it is irreversible and
why. Test the down path; an untested rollback is not a rollback.

Data-destroying migrations require human approval. Take a verified backup first,
and prefer a soft phase (rename to `_deprecated`, drop weeks later) over an
immediate drop.

### Review checklist

- [ ] `lock_timeout` and `statement_timeout` set
- [ ] No operation requiring a full table rewrite on a large table
- [ ] Indexes created `CONCURRENTLY`, outside a transaction
- [ ] Constraints added `NOT VALID` then validated
- [ ] No in-place rename or retype — expand/contract instead
- [ ] Backfills batched with commits between
- [ ] Migration is compatible with the currently deployed application version
- [ ] `down` migration exists and has been tested
- [ ] Destructive changes have human approval and a verified backup
- [ ] Tested against a production-sized dataset, not an empty schema

## References

- **PostgreSQL 16 documentation — ALTER TABLE** — lock levels, `NOT VALID`,
  `VALIDATE CONSTRAINT` <https://www.postgresql.org/docs/16/sql-altertable.html>
- **PostgreSQL 16 documentation — CREATE INDEX** — `CONCURRENTLY` semantics and
  invalid-index recovery
  <https://www.postgresql.org/docs/16/sql-createindex.html>
- **PostgreSQL 16 documentation — Explicit Locking** — the lock queue behaviour
  <https://www.postgresql.org/docs/16/explicit-locking.html>
- **PostgreSQL 16 release notes (11)** — non-rewriting `ADD COLUMN ... DEFAULT`
  <https://www.postgresql.org/docs/release/11.0/>
- **Martin Fowler / ThoughtWorks — Parallel Change (expand/contract)** — the
  multi-deploy pattern <https://martinfowler.com/bliki/ParallelChange.html>

**Not sourced — written for this framework:** the safe/unsafe operation table,
the batched backfill block, the human-approval rule for destructive migrations,
and the review checklist.
