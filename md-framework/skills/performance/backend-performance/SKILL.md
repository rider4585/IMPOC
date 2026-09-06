---
name: backend-performance
version: 1.0.0
description: |
  Diagnose and improve server-side performance — profiling, event loop health,
  memory, connection pooling, and the N+1 and blocking patterns that dominate
  Node.js slowness. Use when the API is slow, when the server degrades under
  load, or when asked "why is the backend slow". For database internals see
  postgres-performance.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Backend Performance

In a Node.js application over PostgreSQL, slowness is almost always one of four
things, in this order:

1. **Too many queries** (N+1)
2. **Slow queries** (missing index, bad plan)
3. **Blocking the event loop**
4. **Waiting on something external**

Diagnose which before optimising anything.

### Find the slow endpoints first

You cannot fix what you have not located. Instrument request duration by route
and look at **percentiles**, not averages — an average hides the tail that users
actually complain about.

```js
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (ms > 500) req.log.warn({ route: req.route?.path, ms }, 'slow request');
  });
  next();
});
```

Then take the worst route and find where its time goes. Usually it is queries —
check `pg_stat_statements` (see `postgres-performance`) before profiling
JavaScript.

### N+1 is the most common cause

```bash
grep -rnB4 -A8 -E "for \(|\.map\(|forEach\(" src/ --include=*.js | grep -E "await .*(findAll|findOne|findByPk)"
```

Log the query count per request in development — a request issuing 200 queries is
immediately obvious and invisible otherwise.

```js
sequelize.options.logging = () => { queryCount += 1; };
```

Fix with eager loading or a single joined query — see `sequelize` and
`query-optimization`. Reducing round trips beats optimising individual queries.

### Blocking the event loop

Node runs your code on one thread; anything synchronous stalls **every**
concurrent request.

```bash
grep -rnE "\b(readFileSync|writeFileSync|existsSync|execSync|pbkdf2Sync)\(" src/ --include=*.js
```

Watch for: `*Sync` calls, large `JSON.parse`, big in-memory loops over rows, PDF
and barcode generation, and regex backtracking. Move CPU-bound work to a worker
or a queue — see `nodejs`.

**Expose event loop lag as a metric.** Rising lag is the clearest signal that
something is blocking:

```js
import { monitorEventLoopDelay } from 'node:perf_hooks';
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => logger.info({ p99: h.percentile(99) / 1e6 }, 'loop lag ms'), 30_000);
```

### Do work in the right place

| Doing this in the app | Should be |
|---|---|
| Filtering rows after fetching | `WHERE` in the query |
| Summing or grouping in JavaScript | `SUM`/`GROUP BY` |
| Sorting a large array | `ORDER BY` with an index |
| Paginating in memory | `LIMIT`/`OFFSET` or keyset |
| Joining two result sets | A join |

Fetching 50,000 rows to aggregate five numbers is a design defect, not a tuning
opportunity — see `performance-architecture`.

### Connection pool

An exhausted pool presents as latency, not errors, which makes it easy to
misdiagnose.

```js
pool: { max: 10, min: 2, acquire: 30_000, idle: 10_000 }
```

- Size for the database's capacity, not the app's optimism — instances × pool
  size must stay well below `max_connections`
- Long transactions hold connections; keep them short
- Never do external I/O inside a transaction — it holds a connection for the
  duration of someone else's outage

### Memory

```bash
node --inspect server.js          # heap snapshots in DevTools
node --max-old-space-size=2048 server.js
```

Growth across requests means a leak: an unbounded cache, an array that only
grows, listeners added per request, or a closure retaining a large object. Take
two snapshots under load and compare retained objects.

Streaming large exports instead of buffering them avoids the most common memory
spike — see `nodejs`.

### External calls

Every outbound call needs a **timeout**, a retry policy for transient failures
only, and a decision about what happens when it fails. A payment provider with no
timeout can hold a request — and a connection — indefinitely.

Never make an external call inside a database transaction.

### Method

1. Instrument and find the slow routes by p95
2. Check query count and `pg_stat_statements` for that route
3. Fix N+1 or the slow query
4. Check event loop lag for blocking work
5. Check pool saturation and external call timing
6. Re-measure and record before/after

Only after all of this is configuration or hardware worth touching.

### Checklist

- [ ] Request duration instrumented; p95/p99 tracked per route
- [ ] Query count per request logged in development
- [ ] N+1 patterns eliminated
- [ ] Slow queries identified via `pg_stat_statements`
- [ ] No `*Sync` calls in request paths
- [ ] CPU-bound work moved off the event loop
- [ ] Event loop lag exposed as a metric
- [ ] Filtering, aggregation, and sorting done in the database
- [ ] Connection pool bounded and sized against `max_connections`
- [ ] Transactions short; no external I/O inside them
- [ ] Memory growth checked under sustained load
- [ ] All external calls have timeouts
- [ ] Before/after numbers recorded

## References

- **Node.js documentation — Don't Block the Event Loop**
  <https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop>
- **Node.js documentation — `perf_hooks.monitorEventLoopDelay`, diagnostics and
  profiling** <https://nodejs.org/api/perf_hooks.html>
- **PostgreSQL 16 documentation — `pg_stat_statements`**
  <https://www.postgresql.org/docs/16/pgstatstatements.html>
- **Google SRE Book — Monitoring Distributed Systems** — percentiles and the
  golden signals <https://sre.google/sre-book/monitoring-distributed-systems/>
- **Michael Nygard, _Release It!_** — timeouts and resource pool exhaustion

**Not sourced — written for this framework:** the four-cause ordering, the
work-placement table, the query-count instrumentation, and the diagnostic method.
