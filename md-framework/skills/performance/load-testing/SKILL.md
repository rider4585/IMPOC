---
name: load-testing
version: 1.0.0
description: |
  Verify the system holds up under realistic and peak load — modelling load
  profiles, running tests, reading results, and finding the breaking point. Use
  before a rollout to more shops, after architectural change, when capacity is
  uncertain, or when asked "how much can this take".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Load Testing

Load testing answers two questions: **does it hold at expected load**, and
**where does it break**. The second matters more — knowing the ceiling tells you
how much headroom you actually have.

### Establish the target first

From `scalability`, use real numbers rather than a made-up "1000 users":

```
50 shops × 3 tills          = 150 concurrent clients
200 transactions/shop/day   = 10,000/day
Peak: 30% within 2 hours    ≈ 1,500/hour ≈ 0.4 sales/second
Each sale ≈ 6 requests      ≈ 2.5 req/s sustained, ~10 req/s at peak
```

Then test at **1×, 2×, and 5×** the peak. A system fine at 10 req/s and failing
at 20 is a very different situation from one that holds to 200.

### Model realistic behaviour

The most common load-testing mistake is hammering one endpoint. Real load is a
**mix**, with think time.

```js
// k6 — a realistic checkout journey
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    checkout: { executor: 'ramping-vus', startVUs: 0,
      stages: [ { duration: '2m', target: 50 },    // ramp
                { duration: '5m', target: 50 },    // sustain
                { duration: '2m', target: 150 },   // peak
                { duration: '3m', target: 0 } ] },
  },
  thresholds: {
    'http_req_duration{name:scan}':     ['p(95)<100'],
    'http_req_duration{name:complete}': ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  http.get(`${BASE}/api/v1/products/lookup?barcode=${sku()}`, { tags: { name: 'scan' } });
  sleep(2);                                        // staff scanning pace
  const res = http.post(`${BASE}/api/v1/sales`, payload(), { tags: { name: 'complete' } });
  check(res, { 'sale created': (r) => r.status === 201 });
  sleep(20);                                       // between customers
}
```

**Think time is essential.** Without it, 50 virtual users generate load no 50
humans could, and you test a scenario that will never occur.

### Retail load profiles worth testing

| Profile | Shape | Reveals |
|---|---|---|
| **Opening rush** | Cold start → sudden concurrency | Cold caches, connection pool ramp |
| **Steady trading** | Sustained moderate load | Leaks, connection exhaustion over time |
| **Closing peak** | Highest concurrency, all tills | Contention, lock waits |
| **Month-end reporting** | Heavy reads alongside trading | Whether reports degrade checkout |
| **Bulk import during trading** | One tenant's heavy job | Noisy-neighbour isolation |
| **Reconnect storm** | Many tills returning after an outage | Retry storms, duplicate submission |

The last two are the ones that cause real incidents and are almost never tested.

### Test types

| Type | Question |
|---|---|
| **Load** | Does it meet targets at expected peak? |
| **Stress** | Where does it break, and how? |
| **Soak** | Does it survive 8 hours? (Leaks, pool exhaustion, disk) |
| **Spike** | Does it survive sudden load and recover? |

**Soak tests find what load tests miss.** A memory leak or a connection leak
looks fine for ten minutes and takes the system down after six hours — which is
exactly the length of a trading day.

### Read the results properly

Look at these together, not in isolation:

- **p95 and p99 latency**, not the average
- **Error rate** — and *which* errors: timeouts, 500s, and deadlocks mean
  different things
- **Throughput** — does it plateau, or fall as load rises? Falling throughput
  under rising load means contention or thrashing
- **Resource use** — CPU, memory, connection pool, event loop lag

Instrument the **server** during the test, not just the client. The client tells
you it was slow; the server tells you why.

### Interpreting the breaking point

| Symptom | Likely cause |
|---|---|
| Latency rises, throughput plateaus | Saturated resource — usually the database |
| Throughput *falls* as load rises | Lock contention or thrashing |
| Errors before saturation | Pool exhaustion, or a hard limit |
| One endpoint degrades, others fine | That query or that lock |
| Degrades over time at constant load | Leak — run a soak test |
| Recovers slowly after the spike | Retry storm or queue backlog |

### Test correctness under load, not just speed

The retail-specific point, and the reason load testing matters here beyond
capacity:

- **Stock never goes negative** under concurrent selling
- **Receipt numbers stay unique and gapless**
- **No duplicate payments** under retries
- **Totals still reconcile** after the run

```sql
SELECT count(*) FROM stock WHERE quantity < 0;                    -- must be 0
SELECT receipt_no, count(*) FROM sale GROUP BY 1 HAVING count(*) > 1;  -- must be empty
```

A load test that meets its latency targets while corrupting stock has failed. Run
the `data-integrity` reconciliation queries afterwards, every time.

### Practical rules

- Test against a **production-like** environment and dataset — an empty database
  has no realistic query plans
- **Never load test production**
- Change one variable at a time
- Record configuration alongside results, or they are not comparable
- Re-run after significant change; keep the numbers as a baseline

### Checklist

- [ ] Target load derived from real numbers
- [ ] Tested at 1×, 2×, and 5× peak
- [ ] Realistic journey mix with think time
- [ ] Opening, closing, month-end, and reconnect profiles covered
- [ ] Soak test run for a full trading day's duration
- [ ] Server-side metrics captured during the run
- [ ] p95/p99, error types, throughput, and resources read together
- [ ] Breaking point identified and its cause diagnosed
- [ ] Stock, receipt sequence, and payment integrity verified afterwards
- [ ] Reconciliation queries run post-test
- [ ] Production-like data volume used
- [ ] Never run against production
- [ ] Configuration and results recorded as a baseline

## References

- **k6 documentation — scenarios, executors, thresholds, think time**
  <https://grafana.com/docs/k6/latest/>
- **Artillery documentation** — an alternative load generator
  <https://www.artillery.io/docs>
- **Google SRE Book — Load testing and capacity planning**
  <https://sre.google/sre-book/table-of-contents/>
- **Michael Nygard, _Release It!_** — stability under load, retry storms, and
  cascading failure
- **PostgreSQL 16 documentation — Monitoring Statistics**
  <https://www.postgresql.org/docs/16/monitoring-stats.html>

**Not sourced — written for this framework:** the retail load profiles, the
worked target derivation, the breaking-point interpretation table, and the
requirement to verify data integrity after every run.
