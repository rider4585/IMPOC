---
name: indexing
version: 1.0.0
description: |
  Design PostgreSQL indexes — column order, index types, partial and covering
  indexes — and find the ones that are missing or redundant. Use when a query is
  slow, when adding a table or access path, when reviewing a migration, or when
  asked "should this be indexed". Pair with explain-analyze to confirm the
  planner actually uses them.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Indexing

An index is a trade: faster reads, slower writes, more storage. Add them for
access paths that exist, never speculatively.

### Column order is the whole game

For a composite B-tree index, only a **leftmost prefix** of the columns can be
used. `(a, b, c)` serves predicates on `a`, `(a,b)`, and `(a,b,c)` — but not `b`
alone.

Order the columns:

1. **Equality predicates first** — the columns compared with `=`
2. **Range predicate next** — at most one, and it must come after all equalities
3. **Sort columns last** — to let the index satisfy `ORDER BY` without a sort

```sql
-- SELECT … WHERE shop_id = $1 AND status = $2 AND sold_at >= $3 ORDER BY sold_at DESC
CREATE INDEX idx_sale_shop_status_soldat ON sale (shop_id, status, sold_at DESC);
```

A range column placed before an equality column stops the equality being used for
seeking — a very common and invisible mistake.

### Index the foreign keys

PostgreSQL indexes the primary key automatically; it does **not** index the
referencing side of a foreign key. Missing FK indexes cause slow joins and, worse,
slow cascading deletes that hold locks.

```sql
SELECT c.conrelid::regclass AS table_name, a.attname AS column_name
FROM pg_constraint c
JOIN unnest(c.conkey) k(attnum) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND i.indkey[0] = k.attnum
  );
```

Run this on any unfamiliar database — it usually finds something.

### Index types

| Type | Use for |
|---|---|
| **B-tree** (default) | Equality, ranges, sorting — nearly everything |
| **GIN** | `jsonb` containment, array membership, full-text search |
| **GiST** | Ranges, geometric, exclusion constraints |
| **BRIN** | Very large, naturally ordered tables (append-only time series) — tiny and cheap |
| **Hash** | Equality only; rarely worth it over B-tree |

### Partial indexes

Index only the rows you query. Smaller, faster, cheaper to maintain — and often
the highest-value index in an OLTP schema.

```sql
-- Only active products are ever listed
CREATE INDEX idx_product_active ON product (shop_id, name) WHERE is_active;

-- Only open transactions are polled
CREATE INDEX idx_sale_open ON sale (shop_id, created_at) WHERE status = 'open';
```

The planner uses a partial index only when it can prove the predicate is
satisfied, so the `WHERE` clause must match the query's.

### Covering indexes

`INCLUDE` adds payload columns so an index-only scan can answer the query without
touching the heap.

```sql
CREATE INDEX idx_sale_lookup ON sale (shop_id, sold_at) INCLUDE (total_amount);
```

Index-only scans additionally require the visibility map to be current — they
degrade on heavily updated tables until `VACUUM` runs.

### Expression indexes

If you query an expression, index the expression — otherwise the index is unused.

```sql
CREATE INDEX idx_customer_email_lower ON customer (lower(email));
-- matches: WHERE lower(email) = lower($1)
```

Text search with `LIKE 'foo%'` needs `text_pattern_ops` unless the database is in
the C collation.

### Finding problems

```sql
-- Never-used indexes: write cost with no read benefit
SELECT relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY pg_relation_size(indexrelid) DESC;

-- Tables taking sequential scans
SELECT relname, seq_scan, idx_scan, n_live_tup
FROM pg_stat_user_tables WHERE seq_scan > idx_scan AND n_live_tup > 10000;
```

**Redundant indexes:** `(a)` is redundant when `(a, b)` exists — drop the shorter
one. Duplicate indexes cost write throughput for nothing.

### Costs to weigh

- Every index slows `INSERT`, `UPDATE`, and `DELETE`.
- Indexes on frequently updated columns cause index bloat.
- An update that changes no indexed column can use the cheaper HOT path — another
  reason not to over-index.
- On a live table, always `CREATE INDEX CONCURRENTLY` (see `migrations`).

### Checklist

- [ ] Every foreign key on the referencing side is indexed
- [ ] Composite column order: equality → range → sort
- [ ] Only one range column, positioned last among predicates
- [ ] Partial indexes used where queries are consistently filtered
- [ ] Expression indexes match the queried expression
- [ ] No redundant leftmost-prefix duplicates
- [ ] Unused indexes identified and dropped
- [ ] Write cost considered on hot tables
- [ ] `CONCURRENTLY` used for indexes on live tables
- [ ] Planner confirmed to use the index via `EXPLAIN`

## References

- **PostgreSQL 16 documentation — Indexes** — types, multicolumn ordering,
  partial, expression, and index-only scans
  <https://www.postgresql.org/docs/16/indexes.html>
- **PostgreSQL 16 documentation — Monitoring Statistics** —
  `pg_stat_user_indexes`, `pg_stat_user_tables`
  <https://www.postgresql.org/docs/16/monitoring-stats.html>
- **Markus Winand, _Use The Index, Luke_** — leftmost-prefix rule and the
  equality-before-range ordering principle <https://use-the-index-luke.com>
- **PostgreSQL 16 documentation — CREATE INDEX** — `CONCURRENTLY`, `INCLUDE`,
  operator classes <https://www.postgresql.org/docs/16/sql-createindex.html>

**Not sourced — written for this framework:** the unindexed-FK detection query,
the retail partial-index examples, and the checklist.
