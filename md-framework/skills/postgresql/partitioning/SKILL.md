---
name: partitioning
version: 1.0.0
description: |
  Apply PostgreSQL declarative partitioning — range, list, and hash — to large
  tables, with partition pruning, maintenance, and the constraints partitioning
  imposes. Use when a table grows past tens of millions of rows, when archival or
  retention needs bulk deletion, or when asked "should we partition this".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Partitioning

Splitting one logical table into physical partitions. It is a maintenance and
bulk-operation tool far more than a query-speed tool — a well-indexed
unpartitioned table usually answers point queries just as fast.

### Decide honestly

**Partition when:**
- The table is very large (roughly 100 GB+, or hundreds of millions of rows)
- Queries reliably filter on one column — nearly always a date
- You delete or archive in bulk by that column ("drop everything before 2024")
- Vacuum and index maintenance on the whole table have become unmanageable

**Do not partition when:**
- The table is merely large-ish — index it properly first
- Queries do not filter on a single natural key
- You want faster point lookups — an index already does that
- The main motivation is that partitioning sounds advanced

The genuine win is `DROP TABLE partition` instead of `DELETE FROM ... WHERE
created_at < ...`: instant, no bloat, no long-running vacuum.

### Range partitioning — the usual choice

```sql
CREATE TABLE sale (
  id         bigint GENERATED ALWAYS AS IDENTITY,
  shop_id    bigint NOT NULL,
  sold_at    timestamptz NOT NULL,
  total      numeric(12,2) NOT NULL,
  PRIMARY KEY (id, sold_at)          -- partition key must be in the PK
) PARTITION BY RANGE (sold_at);

CREATE TABLE sale_2026_09 PARTITION OF sale
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE sale_default PARTITION OF sale DEFAULT;
```

A `DEFAULT` partition prevents insert failures when a future partition is
missing — but rows landing there are a warning sign, and it blocks adding an
overlapping partition later. Monitor it.

### The constraints partitioning imposes

These are the ones that surprise people:

1. **The partition key must be part of every primary key and unique
   constraint.** So `UNIQUE (shop_id, receipt_no)` is impossible unless the
   partition key is included — a real problem for receipt numbering. Plan for it.
2. **Foreign keys referencing a partitioned table** are supported from PG 12,
   but check behaviour for your version.
3. More partitions means more planning time. Keep the count in the low hundreds,
   not thousands.
4. Indexes are created per partition; `CREATE INDEX` on the parent cascades but
   locks — use `ON ONLY` plus per-partition `CONCURRENTLY` builds, then attach.

### Partition pruning

The benefit only materialises when the planner can eliminate partitions:

```sql
-- ✅ prunes to one partition
SELECT * FROM sale WHERE sold_at >= '2026-09-01' AND sold_at < '2026-09-15';

-- ❌ scans every partition — function on the key
SELECT * FROM sale WHERE date_trunc('month', sold_at) = '2026-09-01';
```

Verify with `EXPLAIN` that only the expected partitions appear. Runtime pruning
handles parameterised queries; ensure `enable_partition_pruning` is on (default).

### Maintenance is mandatory

Partitions do not create themselves. A missing future partition means failed
inserts — during trading hours.

```sql
-- Automate: create next month's partition well ahead
CREATE TABLE sale_2026_10 PARTITION OF sale
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

-- Retention: instant, no bloat
DROP TABLE sale_2023_09;

-- Or detach first to archive
ALTER TABLE sale DETACH PARTITION sale_2023_09 CONCURRENTLY;
```

Automate creation (a scheduled job, or `pg_partman`) and alert if the newest
partition is less than two periods ahead.

### Converting an existing table

You cannot partition in place. The path:

1. Create a new partitioned table with the same shape
2. Backfill in batches by range
3. Dual-write, or take a brief window
4. Swap names in one transaction
5. Verify counts, then drop the old table

Treat this as a migration with human approval — see `migrations`.

### Checklist

- [ ] Partitioning justified by size and access pattern, not aspiration
- [ ] Partition key present in every primary key and unique constraint
- [ ] Uniqueness requirements re-checked against that limitation
- [ ] Queries filter on the bare partition key so pruning works
- [ ] Pruning verified in `EXPLAIN`
- [ ] Partition count kept modest
- [ ] Future partition creation automated and alerted
- [ ] `DEFAULT` partition monitored for unexpected rows
- [ ] Retention implemented as `DROP`/`DETACH`, not `DELETE`
- [ ] Conversion of an existing table treated as a reviewed migration

## References

- **PostgreSQL 16 documentation — Table Partitioning** — declarative
  partitioning, pruning, limitations, and maintenance
  <https://www.postgresql.org/docs/16/ddl-partitioning.html>
- **PostgreSQL 16 documentation — CREATE TABLE ... PARTITION OF**
  <https://www.postgresql.org/docs/16/sql-createtable.html>
- **PostgreSQL 16 documentation — ALTER TABLE ... DETACH PARTITION
  CONCURRENTLY** <https://www.postgresql.org/docs/16/sql-altertable.html>
- **pg_partman** — partition automation extension
  <https://github.com/pgpartman/pg_partman>

**Not sourced — written for this framework:** the decide-honestly framing, the
receipt-numbering uniqueness warning, the conversion procedure, and the
monitoring guidance.
