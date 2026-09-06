---
name: api-latency
version: 1.0.0
description: |
  Measure and reduce end-to-end request latency — budgets, percentiles, breaking
  down where time goes, round trips, and payload size. Use when an endpoint is
  slow from the client's perspective, when setting performance targets, or when
  asked "how fast should this be".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## API Latency

Latency is what the user experiences. It is not the same as server processing
time — a 20 ms endpoint called five times over shop wifi is a slow screen.

### Measure percentiles, never averages

An average hides the tail. If p50 is 80 ms and p99 is 4 s, one in a hundred scans
stalls the queue — and the average says 100 ms and looks fine.

| Percentile | What it tells you |
|---|---|
| p50 | The typical experience |
| p95 | The experience users complain about |
| p99 | Where timeouts and abandonment happen |
| max | Usually a lock, a cold cache, or a missing index |

Track p95 and p99 per route. Alert on those, not on the average.

### Budgets

From `performance-architecture`, carried into measurement:

| Interaction | Budget (p95) |
|---|---|
| Barcode scan → line added | < 100 ms |
| Product lookup | < 200 ms |
| Complete sale | < 1 s |
| Load sales list | < 500 ms |
| Report | < 3 s |
| Export | Async |

A budget makes the question decidable: this endpoint is not "slow", it is 340 ms
against a 200 ms budget.

### Break the number down

"The endpoint takes 800 ms" is not actionable. Decompose it:

```
Total 800 ms
  ├─ Network (client → server)     60 ms
  ├─ Auth middleware                5 ms
  ├─ Validation                     2 ms
  ├─ Query 1 (product lookup)      15 ms
  ├─ Query 2..26 (N+1 on lines)   620 ms   ← the finding
  ├─ Serialisation                 12 ms
  └─ Network (server → client)     86 ms   ← payload too large
```

Instrument spans around each phase, or use timing logs. The breakdown almost
always names the fix without further investigation.

```js
res.setHeader('Server-Timing', `db;dur=${dbMs}, total;dur=${totalMs}`);
```

`Server-Timing` surfaces server-side breakdown in browser DevTools, which makes
client-side diagnosis far easier.

### Round trips usually dominate

On a shop network with 60 ms round-trip time, five sequential requests cost 300 ms
before any server work. Reducing round trips beats micro-optimising handlers.

```bash
# How many requests does the till screen make?
grep -rn "api\.\(get\|post\|put\|delete\)" src/features/sales/ --include=*.js
```

Fixes, in order:
1. **Design the endpoint around the screen's need** — see `api-design`
2. Fetch in parallel rather than sequentially (`Promise.all`)
3. Cache what is stable (see `caching`)
4. Prefetch predictable next steps

### Payload size matters on slow networks

```bash
curl -s -o /dev/null -w 'size: %{size_download} bytes  total: %{time_total}s\n' \
  -H "Cookie: $AUTH" http://localhost:3000/api/v1/products
```

- Select only needed fields — `attributes` in Sequelize (see
  `excessive-data-exposure`, which this reinforces)
- Cap page sizes server-side
- Enable compression (`compression` middleware) — large JSON compresses well
- Do not return large `jsonb` blobs in list endpoints

A 2 MB product list is slow on shop wifi no matter how fast the query was.

### Tail latency causes

The p99 usually has a different cause from the p50:

| Symptom | Likely cause |
|---|---|
| Occasional multi-second spikes | Lock contention, or connection pool exhaustion |
| First request slow, then fast | Cold cache or cold plan |
| Slow under concurrency only | Contention — see `concurrency` |
| Periodic spikes | Vacuum, a scheduled job, or GC |
| One tenant slow | Data volume skew; missing index for that shape |

Chasing the p99 with the p50's fix wastes time — diagnose them separately.

### Timeouts

Every layer needs one, and they must be ordered sensibly:

```
client timeout  >  server request timeout  >  database statement_timeout
```

Inverted ordering means the client gives up while the server keeps working —
holding a connection for a response nobody will read.

### Method

1. Set the budget
2. Measure p50/p95/p99 for the route
3. Break the number down by phase
4. Fix the dominant phase
5. Re-measure and record
6. Add an alert so regression is caught, not rediscovered

### Checklist

- [ ] Budget defined per interaction
- [ ] p95 and p99 tracked per route, not averages
- [ ] Latency broken down by phase before optimising
- [ ] `Server-Timing` exposed for client-side diagnosis
- [ ] Round trips per screen counted and minimised
- [ ] Independent calls parallelised
- [ ] Payload fields limited; page size capped
- [ ] Compression enabled
- [ ] Tail latency diagnosed separately from median
- [ ] Timeouts set and correctly ordered across layers
- [ ] Alerting on p95 regression
- [ ] Before/after numbers recorded

## References

- **Google SRE Book — Monitoring Distributed Systems** — percentiles, golden
  signals, and why averages mislead
  <https://sre.google/sre-book/monitoring-distributed-systems/>
- **MDN — `Server-Timing` header**
  <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing>
- **web.dev — TTFB and network cost**
  <https://web.dev/articles/ttfb>
- **Michael Nygard, _Release It!_** — timeout ordering and tail latency under
  contention
- **PostgreSQL 16 documentation — `statement_timeout`**
  <https://www.postgresql.org/docs/16/runtime-config-client.html>

**Not sourced — written for this framework:** the retail budget table, the
phase-breakdown example, the tail-latency cause table, the timeout ordering rule,
and the round-trip counting commands.
