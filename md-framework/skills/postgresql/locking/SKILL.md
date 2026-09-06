---
name: locking
version: 1.0.0
description: |
  Understand and apply PostgreSQL locking — row-level FOR UPDATE, table lock
  modes, advisory locks, deadlock avoidance, and diagnosing blocked queries. Use
  when a query hangs, when serialising access to a row, when a migration blocks
  writes, or when asked "why is this query waiting". For isolation see
  transactions; for race patterns see concurrency.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Locking

PostgreSQL uses MVCC, so **readers never block writers and writers never block
readers**. Almost all blocking you will see is writer-versus-writer, or DDL
versus everything.

### Row-level locks

```sql
SELECT quantity FROM stock
 WHERE product_id = $1 AND shop_id = $2
   FOR UPDATE;                      -- blocks other writers to this row
```

| Clause | Effect |
|---|---|
| `FOR UPDATE` | Exclusive; other `FOR UPDATE`/`FOR SHARE` and writes wait |
| `FOR NO KEY UPDATE` | Weaker; permits concurrent FK reference checks |
| `FOR SHARE` | Shared; blocks writers, permits other readers to also share-lock |
| `FOR KEY SHARE` | Weakest; what FK checks take |

Modifiers, both important in a POS:

- **`NOWAIT`** — fail immediately instead of queueing. Right for a till operation
  where a spinner is worse than a clear "try again".
- **`SKIP LOCKED`** — ignore locked rows. The correct way to build a work queue;
  each worker claims different rows without contention.

```sql
-- Job queue: each worker takes distinct rows, no contention
SELECT id FROM job WHERE status = 'pending'
ORDER BY created_at LIMIT 10
FOR UPDATE SKIP LOCKED;
```

**`FOR UPDATE` only locks rows the query returns.** It cannot prevent a row that
does not yet exist from being inserted — that is a phantom, and needs
`SERIALIZABLE`, a unique constraint, or an advisory lock.

### Table-level locks

Mostly acquired implicitly. The one to know is `ACCESS EXCLUSIVE` — it conflicts
with everything, including plain `SELECT`.

| Operation | Lock | Blocks reads? |
|---|---|---|
| `SELECT` | `ACCESS SHARE` | no |
| `INSERT`/`UPDATE`/`DELETE` | `ROW EXCLUSIVE` | no |
| `CREATE INDEX` | `SHARE` | no (blocks writes) |
| `CREATE INDEX CONCURRENTLY` | `SHARE UPDATE EXCLUSIVE` | no (allows writes) |
| `ALTER TABLE` (most forms) | `ACCESS EXCLUSIVE` | **yes** |
| `VACUUM FULL` | `ACCESS EXCLUSIVE` | **yes** |

**The lock queue is the real hazard.** A blocked `ACCESS EXCLUSIVE` request
queues *ahead* of subsequent readers, so one waiting `ALTER TABLE` behind one
long transaction stalls every query on that table. Always set a short
`lock_timeout` before DDL:

```sql
SET lock_timeout = '3s';
ALTER TABLE product ADD COLUMN barcode text;
```

Better to fail fast and retry than to take the site down. See `migrations`.

### Advisory locks

Application-defined locks that do not correspond to a row — useful for
serialising a *process* rather than data.

```sql
SELECT pg_advisory_xact_lock(hashtext('receipt_seq:' || $1));   -- released at commit
```

Use for: allocating a receipt sequence per shop, ensuring one scheduled job runs
at a time, guarding an import. Prefer the `_xact_` variants so the lock is
released automatically on commit or rollback — session-level advisory locks leak
when a connection is returned to a pool.

### Deadlocks

Two transactions each holding what the other needs. PostgreSQL detects this and
aborts one with `40P01`.

**Prevention — acquire locks in a consistent order.** Most deadlocks come from
two code paths touching the same rows in different sequence. Sorting identifiers
before locking removes an entire class:

```sql
SELECT * FROM stock WHERE product_id = ANY($1) ORDER BY product_id FOR UPDATE;
```

Also: keep transactions short, and lock the minimum set of rows.

Deadlocks are normal at low rates — retry them (see `transactions`). A rising
rate is a design problem, not a tuning problem.

### Diagnosing blocked queries

```sql
-- Who is blocking whom
SELECT a.pid, a.wait_event_type, a.state,
       cardinality(pg_blocking_pids(a.pid)) AS blockers,
       pg_blocking_pids(a.pid) AS blocked_by,
       now() - a.xact_start AS xact_age,
       left(a.query, 120) AS query
FROM pg_stat_activity a
WHERE a.state <> 'idle'
ORDER BY xact_age DESC NULLS LAST;

-- Long idle-in-transaction sessions: the usual root cause
SELECT pid, now() - state_change AS idle_for, left(query, 120)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
ORDER BY idle_for DESC;
```

`idle in transaction` sessions are the most common cause of mysterious blocking
and of vacuum falling behind. Usually a connection-pool or error-handling bug.

### Checklist

- [ ] `FOR UPDATE` used where a read informs a dependent write
- [ ] `NOWAIT` or `SKIP LOCKED` chosen deliberately where queueing is wrong
- [ ] Understood that `FOR UPDATE` does not prevent inserts
- [ ] Locks acquired in a consistent order; identifier lists sorted
- [ ] Transactions short; no external I/O while holding locks
- [ ] `lock_timeout` set before any DDL on a live table
- [ ] Advisory locks are transaction-scoped, not session-scoped
- [ ] Deadlock retry implemented
- [ ] No long-lived `idle in transaction` sessions

## References

- **PostgreSQL 16 documentation — Explicit Locking** — row and table lock modes,
  conflict matrix, advisory locks, deadlock detection
  <https://www.postgresql.org/docs/16/explicit-locking.html>
- **PostgreSQL 16 documentation — SELECT ... FOR UPDATE / SKIP LOCKED**
  <https://www.postgresql.org/docs/16/sql-select.html#SQL-FOR-UPDATE-SHARE>
- **PostgreSQL 16 documentation — Monitoring** — `pg_stat_activity`,
  `pg_blocking_pids()` <https://www.postgresql.org/docs/16/monitoring-stats.html>
- **PostgreSQL 16 documentation — ALTER TABLE** — lock levels per operation
  <https://www.postgresql.org/docs/16/sql-altertable.html>
- **PostgreSQL 16 documentation — Client Connection Defaults** — `lock_timeout`
  <https://www.postgresql.org/docs/16/runtime-config-client.html>

**Not sourced — written for this framework:** the till/receipt-sequence advisory
lock examples, the sorted-identifier deadlock prevention pattern, the diagnostic
queries, and the lock-queue warning framing.
