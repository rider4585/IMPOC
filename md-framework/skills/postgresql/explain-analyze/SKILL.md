---
name: explain-analyze
version: 1.0.0
description: |
  Read PostgreSQL execution plans to find why a query is slow — node types, cost
  vs actual rows, buffer counts, and the misestimates that cause bad plans. Use
  when diagnosing a slow query, before and after any optimisation, or when asked
  "why is this query slow" or "what does this plan mean".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## EXPLAIN ANALYZE

Never optimise from intuition. The plan tells you what the database actually did;
everything else is guessing.

### Run it properly

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT ...;
```

- `ANALYZE` **executes the query** — never run it on an `UPDATE`/`DELETE` outside
  a transaction you intend to roll back:
  ```sql
  BEGIN; EXPLAIN (ANALYZE, BUFFERS) UPDATE ...; ROLLBACK;
  ```
- `BUFFERS` is essential — it separates "slow because it read a lot" from "slow
  because it computed a lot".
- Run it more than once. The first run may be cold cache.
- Use real parameter values; plans differ by selectivity.

### Read it inside out

Execution starts at the innermost, most-indented node. Each node reports:

```
Seq Scan on sale  (cost=0.00..18334.00 rows=1000 width=64)
                  (actual time=0.015..142.331 rows=980123 loops=1)
  Buffers: shared hit=2451 read=15883
```

| Field | Meaning |
|---|---|
| `cost=start..total` | Planner's estimate in arbitrary units — for comparison only |
| `rows=` (in cost) | **Estimated** rows |
| `actual time=first..last` | Milliseconds, **per loop** |
| `rows=` (in actual) | **Actual** rows, per loop |
| `loops=` | Times the node ran — multiply time and rows by this |
| `Buffers: hit/read` | Pages from cache / from disk |

**Total time for a node = `actual time` × `loops`.** A node showing 0.8 ms with
`loops=50000` is 40 seconds. This is the single most misread part of a plan.

### The first thing to check: estimate vs actual

```
rows=1000 … actual rows=980123
```

A large divergence means the planner chose the plan for the wrong reason.
Everything downstream is likely wrong too. Causes:

- Stale statistics → `ANALYZE tablename;`
- Correlated columns the planner treats as independent →
  `CREATE STATISTICS ... (dependencies) ON col_a, col_b FROM t;`
- Low sampling on a skewed column →
  `ALTER TABLE t ALTER COLUMN c SET STATISTICS 1000; ANALYZE t;`
- An expression or function the planner cannot estimate

Fix the estimate before adding indexes. A good index will not be used if the
planner believes the scan is cheap.

### Node types worth recognising

| Node | Good when | Suspicious when |
|---|---|---|
| `Seq Scan` | Small table, or reading most rows | Large table with a selective filter → missing index |
| `Index Scan` | Selective predicate | Returning most of the table |
| `Index Only Scan` | Covering index, visibility map current | High `Heap Fetches` → needs `VACUUM` |
| `Bitmap Heap Scan` | Medium selectivity | `Recheck Cond` with many `lossy` blocks → `work_mem` too small |
| `Nested Loop` | Few outer rows | High `loops` with an expensive inner side |
| `Hash Join` | Large joins, hash fits memory | `Batches > 1` → spilling to disk |
| `Merge Join` | Both inputs sorted | Requires an explicit sort of a large input |
| `Sort` | Small, or index-satisfied | `Sort Method: external merge Disk: …` → raise `work_mem` |

### The signals that point straight at a fix

| Signal | Meaning | Fix |
|---|---|---|
| `Rows Removed by Filter: <large>` | Read and discarded | Index the filter column |
| `Sort Method: external merge Disk` | Spilled to disk | Raise `work_mem`, or index to avoid the sort |
| `Batches: 8` on a Hash node | Hash spilled | Raise `work_mem`, reduce the hashed side |
| `Heap Fetches: <large>` | Index-only scan degraded | `VACUUM` the table |
| High `read` vs `hit` in Buffers | Cold cache or too much data | Reduce rows touched; check cache size |
| `loops=` in the thousands | Nested loop over many rows | Index the inner side, or force a hash join |
| `SubPlan` executed per row | Correlated subquery | Rewrite as a join or lateral |

### Worked reading

```
Nested Loop  (actual time=0.05..3402.11 rows=48210 loops=1)
  ->  Seq Scan on sale  (actual time=0.01..91.2 rows=48210 loops=1)
        Filter: (shop_id = 3)
        Rows Removed by Filter: 951790
  ->  Index Scan using product_pkey on product  (actual time=0.06..0.06 rows=1 loops=48210)
```

Two findings: the `Seq Scan` discarded 951,790 rows (index `sale.shop_id`), and
the inner index scan ran 48,210 times at 0.06 ms — about 2.9 s of the 3.4 s
total. Fixing the outer selectivity reduces both.

### Tooling

Paste plans into <https://explain.dalibo.com> or <https://explain.depesz.com> —
they highlight the misestimates and the dominant node immediately. Use
`FORMAT JSON` for programmatic analysis.

For finding *which* queries to examine, use `pg_stat_statements` — see
`postgres-performance`.

### Checklist

- [ ] `ANALYZE` and `BUFFERS` both used
- [ ] Real parameter values; query run more than once
- [ ] Write statements wrapped in a rolled-back transaction
- [ ] Estimate vs actual compared at every node
- [ ] `loops` multiplied out before judging node cost
- [ ] Dominant node identified before changing anything
- [ ] `Rows Removed by Filter` checked for missing indexes
- [ ] Disk spills checked on sorts and hashes
- [ ] Plan re-measured after the change

## References

- **PostgreSQL 16 documentation — Using EXPLAIN** — plan structure, node types,
  cost model, and reading `actual` values
  <https://www.postgresql.org/docs/16/using-explain.html>
- **PostgreSQL 16 documentation — EXPLAIN** — option reference
  <https://www.postgresql.org/docs/16/sql-explain.html>
- **PostgreSQL 16 documentation — Extended Statistics** — `CREATE STATISTICS`
  for correlated columns
  <https://www.postgresql.org/docs/16/planner-stats.html#PLANNER-STATS-EXTENDED>
- **PostgreSQL 16 documentation — Planner Statistics / `default_statistics_target`**
  <https://www.postgresql.org/docs/16/planner-stats.html>
- **Dalibo / depesz plan visualisers** <https://explain.dalibo.com>

**Not sourced — written for this framework:** the signal→fix table, the
loops-multiplication emphasis, the worked reading example, and the
fix-estimates-before-indexes ordering.
