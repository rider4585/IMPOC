---
name: scalability
version: 1.0.0
description: |
  Design for growth in load, data, and users — capacity estimation, statelessness,
  bottleneck identification, and knowing which growth dimension actually applies.
  Use when planning capacity, before adding infrastructure, when growth is
  expected, or when asked "will this scale". For latency decisions see
  performance-architecture.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Scalability

Scalability is the ability to handle **more** — more load, more data, more
tenants — by adding resources. It is not the same as being fast, and the two are
sometimes in tension.

### First, establish the actual numbers

Most scalability work is wasted because nobody stated the target. Estimate before
designing:

```
Shops: 50            Tills per shop: 3          → 150 concurrent clients
Transactions: 200/shop/day × 50 = 10,000/day
Peak: 30% in 2 hours → ~1,500/hour → ~0.4 writes/second
Sale lines: ~5 per sale → 50,000 rows/day → ~18M rows/year
```

**0.4 writes per second is not a scaling problem.** A single modest PostgreSQL
instance handles thousands. Recognising this saves months of unnecessary
architecture.

Write the numbers down, then design for roughly **10× current** — enough headroom
to grow without rearchitecting, not so much that you build for an imaginary
system. Revisit as the real numbers change.

### Which dimension is growing?

They have different answers, and conflating them wastes effort.

| Dimension | Symptom | Usually fixed by |
|---|---|---|
| **Request volume** | CPU saturation, queueing | More app instances (stateless) |
| **Data volume** | Queries slow as tables grow | Indexes, partitioning, archival |
| **Concurrency** | Lock contention, deadlocks | Shorter transactions, atomic updates |
| **Tenants** | Noisy-neighbour effects | Tenant-aware limits, isolation |
| **Read load** | Reporting harms transactions | Caching, read replicas |

For a retail system, **data volume and concurrency arrive long before request
volume.** Sales history grows forever; the checkout row contention is real from
day one. Optimising for request throughput first is usually solving the wrong
problem.

### Statelessness is what makes scaling out possible

An application instance must hold no state that another instance needs.

- **Sessions** in a shared store (Redis) or a signed token — never in process
  memory, or a user's requests break as soon as there are two instances
- **Caches** in a shared store, or accept per-instance duplication knowingly
- **Uploads** to object storage, not local disk
- **Scheduled jobs** guarded by a lock so they run once, not once per instance
- **Rate limit counters** in shared state, or the effective limit multiplies by
  instance count (see `rate-limiting`)

```bash
grep -rn "global\.\|module-level cache\|new Map()" src/ --include=*.js | head
grep -rn "setInterval\|cron" src/ --include=*.js
```

Any module-level mutable state is a scale-out blocker; any unguarded scheduled
job runs N times.

### The database is the bottleneck

In almost every system of this shape, the application scales out easily and the
database does not. Design accordingly:

- **Connection pooling is mandatory.** PostgreSQL uses a process per connection;
  100 app instances × 10 connections each will exhaust it. Bound the pool per
  instance, and use PgBouncer in transaction mode when instance count grows.
- **Keep transactions short.** Long transactions hold locks and block vacuum —
  they cap concurrency more than hardware does.
- **Never do external I/O inside a transaction** — see `transactions`.
- **Index for the queries you actually run**; unindexed growth is what turns a
  fine system into a slow one.

### Contention scales worse than load

The retail-specific trap: a popular product's stock row is a serialisation point.
Fifty tills selling the same item contend on one row regardless of how many
application instances you run.

Mitigations, in order:

1. **Atomic guarded updates** rather than read-modify-write — see `concurrency`
2. Short transactions so the lock is held briefly
3. Only if genuinely necessary, structural changes (per-location stock rows)

Adding servers does not help here. Recognising a contention problem as distinct
from a capacity problem is most of the work.

### Asynchronous work absorbs spikes

Move out of the request path anything not needed for the response: PDF and
barcode generation, bulk imports, report building, email, external syncs.

A queue turns a spike into a longer queue rather than a timeout. Each job needs
idempotency, retry with backoff, a dead-letter path, and bounded concurrency so
the workers cannot themselves exhaust the database pool.

### Multi-tenant fairness

One shop's bulk import must not degrade every other shop's checkout.

- Per-tenant rate limits, not only global ones
- Bounded work per request — no unbounded exports
- Heavy operations queued, with per-tenant concurrency caps

### Scale up before scaling out

Vertical scaling is unfashionable and frequently correct. Doubling the database
instance is an afternoon; sharding is a project. Modern hardware handles far more
than most systems need.

**Order of preference:** fix the query → add the index → cache → scale up →
scale out → shard. Most systems never need the last two.

### Checklist

- [ ] Current and projected numbers written down
- [ ] Designed for ~10× current, not an imaginary scale
- [ ] The growing dimension identified specifically
- [ ] No mutable state in application instance memory
- [ ] Sessions, caches, uploads, and counters in shared stores
- [ ] Scheduled jobs guarded to run once
- [ ] Connection pool bounded per instance
- [ ] Transactions short; no external I/O inside them
- [ ] Contention points identified and handled atomically
- [ ] Spiky and slow work moved to queues with idempotency and retry
- [ ] Per-tenant limits prevent noisy neighbours
- [ ] Cheaper options exhausted before adding infrastructure

## References

- **Google SRE Book — Capacity planning and load management**
  <https://sre.google/sre-book/table-of-contents/>
- **AWS Well-Architected Framework — Performance Efficiency Pillar**
  <https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/welcome.html>
- **Twelve-Factor App — VI. Processes, VIII. Concurrency** — statelessness as the
  precondition for scaling out <https://12factor.net/processes>
- **PostgreSQL 16 documentation — Connections and Authentication / Routine
  Vacuuming** <https://www.postgresql.org/docs/16/runtime-config-connection.html>
- **PgBouncer documentation** — transaction pooling
  <https://www.pgbouncer.org/features.html>
- **Neil Gunther — Universal Scalability Law** — why contention limits scaling
  independently of capacity

**Not sourced — written for this framework:** the worked retail capacity
estimate, the growth-dimension table, the stock-row contention treatment, the
order-of-preference list, and the detection commands.
