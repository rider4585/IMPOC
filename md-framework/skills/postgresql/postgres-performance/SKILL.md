---
name: postgres-performance
version: 1.0.0
description: |
  Diagnose and improve PostgreSQL performance at the system level — finding the
  expensive queries, cache behaviour, bloat, vacuum health, connection pooling,
  and the configuration that matters. Use when the database is slow generally
  rather than one query, during a performance baseline, or when asked "why is the
  database slow". For a single query use explain-analyze.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## PostgreSQL Performance

Work top-down: find *which* queries cost the most, then fix those. Optimising a
query nobody runs is the most common wasted effort in database work.

### Find the expensive queries

`pg_stat_statements` is the single most valuable diagnostic. Enable it first.

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;   -- also needs shared_preload_libraries

-- Highest total time — the real cost, not the slowest single run
SELECT substr(query, 1, 100) AS query, calls,
       round(total_exec_time::numeric, 1)  AS total_ms,
       round(mean_exec_time::numeric, 2)   AS mean_ms,
       rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 20;
```

Sort by **total** time, not mean. A 5 ms query called 200,000 times costs more
than a 2-second report run twice a day — and is usually an N+1.

```sql
-- Cache hit ratio per table; below ~0.99 on hot tables means disk pressure
SELECT relname,
       heap_blks_hit, heap_blks_read,
       round(heap_blks_hit::numeric / nullif(heap_blks_hit + heap_blks_read, 0), 4) AS hit_ratio
FROM pg_statio_user_tables
WHERE heap_blks_read > 0 ORDER BY heap_blks_read DESC LIMIT 20;
```

### Vacuum and bloat

MVCC leaves dead tuples behind. If autovacuum falls behind, tables and indexes
bloat, scans read more pages, and index-only scans stop working.

```sql
SELECT relname, n_live_tup, n_dead_tup,
       round(n_dead_tup::numeric / nullif(n_live_tup, 0), 3) AS dead_ratio,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_ratio DESC NULLS LAST LIMIT 20;
```

A dead ratio persistently above ~0.2 means autovacuum is not keeping up. Tune it
**per table** for hot tables rather than globally:

```sql
ALTER TABLE stock SET (autovacuum_vacuum_scale_factor = 0.02,
                       autovacuum_analyze_scale_factor = 0.01);
```

The default scale factor of 0.2 means a 50-million-row table waits for 10 million
dead rows before vacuuming — far too late.

**The most common cause of vacuum failure is a long-running or idle-in-transaction
session**, which holds back the xmin horizon so nothing can be cleaned:

```sql
SELECT pid, state, now() - xact_start AS xact_age, left(query, 80)
FROM pg_stat_activity
WHERE state <> 'idle' OR state = 'idle in transaction'
ORDER BY xact_age DESC NULLS LAST LIMIT 10;
```

Fix the leak; do not just run `VACUUM` harder.

### Connections and pooling

PostgreSQL uses a process per connection. Hundreds of connections cost memory and
context switching, and typically *reduce* throughput.

- Size the pool near `(cores × 2) + effective_spindles` — often 10–30, not 200.
- Use a pooler (PgBouncer) in transaction mode for many short-lived clients.
- Watch for pool exhaustion in the application; it presents as latency, not
  errors.

```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
SHOW max_connections;
```

### Configuration that actually matters

| Setting | Guidance |
|---|---|
| `shared_buffers` | ~25% of RAM |
| `effective_cache_size` | ~50–75% of RAM — planner hint only |
| `work_mem` | Per sort/hash **per node**; raise carefully. Set per-session for heavy reports rather than globally |
| `maintenance_work_mem` | 512 MB–2 GB; speeds index builds and vacuum |
| `random_page_cost` | 1.1 on SSD (default 4.0 assumes spinning disks) |
| `effective_io_concurrency` | 200 on SSD |
| `max_connections` | Keep low; use a pooler |

`random_page_cost` is the one most often left wrong — on SSD the default makes
the planner avoid index scans it should choose.

### Table and index size

```sql
SELECT relname,
       pg_size_pretty(pg_total_relation_size(relid))  AS total,
       pg_size_pretty(pg_relation_size(relid))        AS table_only,
       pg_size_pretty(pg_indexes_size(relid))         AS indexes
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 15;
```

Indexes larger than the table usually means over-indexing — check for unused and
redundant indexes (see `indexing`).

### Method

1. Enable `pg_stat_statements`; get the top queries by total time.
2. Take the worst and run `EXPLAIN (ANALYZE, BUFFERS)` — see `explain-analyze`.
3. Fix the query or the index; measure the same plan again.
4. Check vacuum health and long transactions.
5. Only then touch configuration.
6. Re-measure. Record before/after numbers.

Never tune configuration first. It is the least targeted lever and hides the real
problem.

### Checklist

- [ ] `pg_stat_statements` enabled; top queries ranked by total time
- [ ] Worst queries analysed with `EXPLAIN (ANALYZE, BUFFERS)`
- [ ] Cache hit ratio checked on hot tables
- [ ] Dead tuple ratio checked; autovacuum tuned per hot table
- [ ] No long-running or idle-in-transaction sessions blocking vacuum
- [ ] Connection count bounded; pooler in use
- [ ] `random_page_cost` appropriate for the storage
- [ ] Unused and redundant indexes removed
- [ ] Before/after measurements recorded

## References

- **PostgreSQL 16 documentation — `pg_stat_statements`**
  <https://www.postgresql.org/docs/16/pgstatstatements.html>
- **PostgreSQL 16 documentation — Monitoring Statistics** — `pg_stat_user_tables`,
  `pg_statio_user_tables`, `pg_stat_activity`
  <https://www.postgresql.org/docs/16/monitoring-stats.html>
- **PostgreSQL 16 documentation — Routine Vacuuming** — autovacuum behaviour and
  the xmin horizon <https://www.postgresql.org/docs/16/routine-vacuuming.html>
- **PostgreSQL 16 documentation — Resource Consumption** — `shared_buffers`,
  `work_mem`, `maintenance_work_mem`
  <https://www.postgresql.org/docs/16/runtime-config-resource.html>
- **PostgreSQL 16 documentation — Query Planning** — `random_page_cost`,
  `effective_cache_size`
  <https://www.postgresql.org/docs/16/runtime-config-query.html>
- **PgBouncer documentation** — transaction-mode pooling
  <https://www.pgbouncer.org/features.html>

**Not sourced — written for this framework:** the total-time-over-mean-time rule,
the diagnostic query set, the per-table autovacuum guidance, and the
top-down method ordering.
