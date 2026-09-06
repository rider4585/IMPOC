---
name: performance-architecture
version: 1.0.0
description: |
  Make design-time decisions that determine performance — latency budgets, where
  work happens, caching strategy and invalidation, and access patterns that avoid
  N+1 by construction. Use when designing a feature with latency requirements,
  choosing whether to cache, or when asked "will this be fast enough". For
  measuring and fixing what exists see performance skills.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Performance Architecture

Design-time performance: the decisions that determine whether a system *can* be
fast. Measurement and optimisation of what already exists is a different job —
this is about not designing the problem in.

The rule that governs everything below: **the fastest work is work you do not
do**, and the second fastest is work done outside the request.

### Set a latency budget first

A target makes design decisions decidable.

| Interaction | Budget | Why |
|---|---|---|
| Barcode scan → line added | < 100 ms | Must feel instantaneous during scanning |
| Product search | < 300 ms | Perceived as immediate |
| Complete sale | < 1 s | User is waiting, queue behind them |
| Load report | < 3 s | Acceptable with a loading state |
| Export / batch | Async | Never in the request path |

Then decompose the budget across the stack — network, application, database — so
the design has an actual constraint to satisfy rather than "make it fast".

**The till path is the one that matters.** A slow report is an annoyance; a slow
scan makes the queue longer, and staff will work around the system.

### Decide where work happens

| Placement | Use for |
|---|---|
| **Database** | Filtering, aggregation, sorting, joins — always |
| **Request** | Only what the response needs |
| **Background job** | PDFs, barcodes, imports, emails, reports, syncs |
| **Scheduled** | Rollups, reconciliation, archival |
| **Client** | Formatting and display only |

The most common design error is fetching rows into the application to filter or
aggregate them. The database does this vastly better; pulling 50,000 rows to sum
five columns is a design defect, not a tuning opportunity.

The second is doing avoidable work synchronously. Generating a PDF receipt inside
the checkout request adds its full cost to a path with a 1-second budget.

### Design access patterns, not just data

N+1 is an architectural problem before it is a code problem. When designing an
endpoint, count the queries it will need to satisfy its contract.

```
GET /sales?limit=25  with lines and product names
  ❌ 1 + 25 + 125 queries   — lazy associations, per-item lookups
  ✅ 1–3 queries            — joins or batched loads by design
```

If the contract cannot be satisfied in a bounded number of queries, the contract
is wrong — see `api-design`. Round trips are the dominant cost in most slow
endpoints, not the individual queries.

### Cache deliberately, or not at all

Caching is the most over-applied performance tool. It adds a second source of
truth, and staleness bugs are far harder to diagnose than slowness.

**Before caching:** confirm the query is actually slow, that the data tolerates
staleness, and that a simpler fix (an index, a better query) will not do.

Cache by volatility:

| Data | Volatility | Cache? |
|---|---|---|
| Tax rates, categories, shop settings | Rarely changes | Yes — long TTL |
| Product catalogue | Changes daily | Yes — short TTL, invalidate on write |
| Prices and promotions | Time-bounded | Carefully — must expire at the boundary |
| **Stock levels** | Constantly | **No** — a stale figure oversells |
| Sales, payments | Financial truth | **No** |

**Never cache anything that gates a financial or stock decision.** Displaying an
approximate stock figure is acceptable if labelled; deciding a sale on one is
not. The authoritative check is the atomic guarded update — see `concurrency`.

Every cache needs a stated invalidation strategy — TTL, event-driven, or both —
and a way to observe hit rate. A cache nobody measures is a liability.

### Bound everything

Any unbounded operation is a future outage.

- Server-enforced pagination caps — never honour an arbitrary client `limit`
- Query timeouts at database and HTTP layers
- Request body size limits
- Result size limits on reports and exports
- Bounded worker concurrency so jobs cannot exhaust the connection pool

Report generation over "all time" with no bound is the classic retail example: it
works for a year, then takes the system down.

### Design for measurement

You cannot improve what you cannot see. Build in from the start:

- Correlation ids through the whole request (see `logging`)
- Timing on external calls and slow queries
- `pg_stat_statements` enabled
- Percentiles, not averages — p95 and p99 are what users experience
- Event loop lag as a health metric (see `nodejs`)

### Do not optimise speculatively

Complexity added for unmeasured performance is a permanent cost against a
hypothetical benefit. Design so that optimisation is *possible* — clean
boundaries, measurable seams — then optimise what profiling identifies.

The exceptions worth designing in up front are the ones that are expensive to
retrofit: indexing strategy, access patterns, transactional boundaries, and where
work happens.

### Checklist

- [ ] Latency budgets set per interaction
- [ ] Budget decomposed across the stack
- [ ] Till path prioritised over reporting
- [ ] Filtering, aggregation, and sorting done in the database
- [ ] Non-essential work moved out of the request path
- [ ] Query count per endpoint bounded by design
- [ ] Caching justified by measurement, not assumption
- [ ] Nothing gating money or stock is cached
- [ ] Every cache has a stated invalidation strategy
- [ ] Pagination, timeouts, payloads, and exports all bounded
- [ ] Correlation ids, slow-query logging, and percentile metrics in place
- [ ] No speculative optimisation

## References

- **Google SRE Book — Monitoring Distributed Systems** — percentiles over
  averages, and the four golden signals
  <https://sre.google/sre-book/monitoring-distributed-systems/>
- **AWS Well-Architected Framework — Performance Efficiency Pillar**
  <https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/welcome.html>
- **PostgreSQL 16 documentation — Performance Tips**
  <https://www.postgresql.org/docs/16/performance-tips.html>
- **Martin Fowler — Cache invalidation and the two-hard-things problem**
  <https://martinfowler.com/bliki/TwoHardThings.html>
- **Nielsen Norman Group — Response Time Limits** — the perceptual thresholds
  behind the budget table
  <https://www.nngroup.com/articles/response-times-3-important-limits/>

**Not sourced — written for this framework:** the retail latency budget table,
the work-placement table, the cache-by-volatility table and the never-cache rule
for stock, and the checklist.
