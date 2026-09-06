---
name: caching
version: 1.0.0
description: |
  Decide what to cache, where, and how to invalidate it — cache layers, keys,
  TTLs, stampede protection, and the data that must never be cached. Use when
  considering a cache, when stale data appears, or when asked "should we cache
  this".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Caching

Caching trades correctness for speed. It introduces a second source of truth, and
staleness bugs are far harder to diagnose than slowness — they produce plausible
wrong answers rather than obvious failures.

**Before caching anything:** confirm the operation is measurably slow, that a
simpler fix (an index, a better query, fewer round trips) will not do, and that
the data tolerates being stale.

### What may be cached — and what may not

| Data | Volatility | Cache | TTL |
|---|---|---|---|
| Tax rates, categories, shop settings | Rarely | ✅ | Hours |
| Product catalogue (name, SKU) | Daily | ✅ | Minutes, invalidate on write |
| Permission model | Rarely | ✅ | Minutes |
| Report aggregates for closed periods | Never changes | ✅ | Long |
| Prices and promotions | Time-bounded | ⚠️ | Must expire at the boundary |
| **Stock levels** | Constantly | ❌ | Never |
| **Sales, payments, balances** | Financial truth | ❌ | Never |
| Anything gating a money or stock decision | — | ❌ | Never |

**The rule that matters most: never cache anything a financial or stock decision
depends on.** Displaying an approximate stock figure is acceptable *if labelled
with its age*; deciding whether a sale can proceed from a cached figure is not.
The authoritative check is the atomic guarded update — see `concurrency`.

Prices are the subtle case: a promotion that expired two minutes ago must not
still apply. Either do not cache prices, or key the cache by the validity window
so expiry is structural rather than a race.

### Layers

| Layer | Good for | Watch |
|---|---|---|
| HTTP (`Cache-Control`, `ETag`) | Static assets, rarely-changing GETs | Never on authenticated, tenant-scoped data without `private` |
| Client memory | Data within one screen session | Cleared on reload |
| Shared store (Redis) | Cross-instance, cross-user | Needs invalidation discipline |
| In-process memory | Tiny, stable reference data | **Multiplies by instance count** — inconsistent across instances |
| Database materialised view | Expensive aggregates | Explicit refresh |
| Query plan / OS page cache | Automatic | Not yours to manage |

In-process caches are the usual mistake in a multi-instance deployment: two
instances hold different values and users see different answers depending on
which they hit. Use a shared store, or accept the divergence deliberately.

### Keys must include everything that varies

The most dangerous cache bug is a key missing the tenant.

```js
// ❌ every shop sees the first shop's products
const key = `products:list:${page}`;

// ✅ tenant, filters, and version all in the key
const key = `products:v2:shop:${shopId}:status:${status}:page:${page}`;
```

Include: tenant, **role** where the response varies by role (cost price!),
filters, pagination, locale, and a schema version prefix so a deploy can
invalidate everything by bumping it.

A cache key without the tenant is a cross-tenant data leak, not merely a bug —
escalate it as a security finding.

### Invalidation

Choose deliberately, and write it down:

| Strategy | Use when | Cost |
|---|---|---|
| **TTL only** | Staleness is tolerable and bounded | Simple; always somewhat stale |
| **Write-through / delete on write** | Data changes through known paths | Must catch every write path |
| **Event-driven** | Multiple writers | More moving parts |
| **Version prefix** | Bulk invalidation on deploy | Blunt but reliable |

Delete-on-write only works if **every** write path invalidates — including
imports, admin screens, jobs, and direct SQL. Enumerate them (see
`project-inventory-rules` for the same problem with stock).

Prefer short TTLs plus invalidation over long TTLs alone: the TTL is the
backstop for the invalidation you forgot.

### Stampede protection

When a hot key expires under load, every request misses simultaneously and hits
the database at once — often taking it down at the worst moment.

Mitigate with: a lock so one request recomputes while others serve stale, jittered
TTLs so keys do not expire together, or refresh-ahead before expiry.

### Observe it

A cache nobody measures is a liability. Track hit rate, miss rate, eviction rate,
and the latency difference. A cache with a 20% hit rate is adding complexity and
a staleness risk for almost no benefit — remove it.

```bash
grep -rn "cache\|redis\|memoize" src/ --include=*.js | head -20
```

### Retail specifics

- **Never cache stock for a sale decision.** Display-only, labelled with age, is
  acceptable.
- **Report caches must be keyed by period**, and only closed periods should have
  long TTLs — today's figures change all day.
- **Cost price varies by role**; a cache key without the role leaks it.
- **Cache warming after deploy** matters when the first scan of the morning is
  otherwise slow.

### Checklist

- [ ] Slowness measured before caching considered
- [ ] Simpler fixes ruled out first
- [ ] Nothing gating a money or stock decision is cached
- [ ] Displayed stale data labelled with its age
- [ ] Layer chosen deliberately; no in-process cache in a multi-instance deploy
- [ ] Keys include tenant, role, filters, and a version prefix
- [ ] Invalidation strategy stated and documented
- [ ] Every write path invalidates, including imports and jobs
- [ ] TTL present as a backstop even with invalidation
- [ ] Stampede protection on hot keys
- [ ] Hit rate and latency benefit measured
- [ ] Caches with poor hit rates removed

## References

- **MDN — HTTP caching (`Cache-Control`, `ETag`, `private`)**
  <https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching>
- **Martin Fowler — Two Hard Things (cache invalidation)**
  <https://martinfowler.com/bliki/TwoHardThings.html>
- **Redis documentation — key eviction and TTL**
  <https://redis.io/docs/latest/develop/reference/eviction/>
- **PostgreSQL 16 documentation — Materialized Views**
  <https://www.postgresql.org/docs/16/rules-materializedviews.html>
- **Google SRE Book — Addressing Cascading Failures** — stampede and thundering
  herd <https://sre.google/sre-book/addressing-cascading-failures/>

**Not sourced — written for this framework:** the cache-by-volatility table with
the never-cache-stock rule, the tenant-in-key security framing, the invalidation
strategy table, and the retail specifics.
