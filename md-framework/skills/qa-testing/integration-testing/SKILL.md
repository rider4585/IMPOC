---
name: integration-testing
version: 1.0.0
description: |
  Test components working together against real dependencies — endpoints,
  database transactions, authorisation, and external service boundaries.
  Discipline-level guidance independent of framework. Use when testing an
  endpoint or a cross-component flow, or when asked "what should be an
  integration test". For tool specifics see backend-testing.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Integration Testing

Integration tests verify that pieces work **together** — the layer where unit
tests are blind. Most production defects that reach users live here: a query that
does not do what the developer thought, a transaction that does not roll back,
middleware that does not run on a route.

### Use real dependencies

This is the defining rule. A mocked database tests your beliefs about the
database.

| Dependency | In integration tests |
|---|---|
| **Database** | **Real PostgreSQL** — same major version as production |
| ORM / query layer | Real |
| Middleware chain | Real, in the same order as production |
| Auth | Real token issuance and verification |
| External APIs | Stubbed at the **HTTP boundary**, not by mocking your client |
| Email, SMS, payments | Stubbed at the network layer |

**Never substitute SQLite for PostgreSQL.** Different constraint behaviour,
different types, different locking, different transaction semantics — it will
pass tests that production fails.

Stub external services at the network layer (MSW, nock, a local fake) so your own
HTTP client, retry logic, and error normalisation are exercised.

### What belongs here

- **Endpoint contracts** — status codes, response shapes, headers
- **Validation at the boundary** — rejected input, correct error format
- **Authentication and authorisation** — including every negative case
- **Transactional behaviour** — commit and, critically, rollback
- **Database constraints** — that the schema actually rejects bad data
- **Concurrency** — races against real locking
- **Query correctness** — that the query returns what you think

### Verify rollback, not just the error

The single most valuable integration assertion, and the one most often missed:

```js
it('does not partially write when stock is insufficient', async () => {
  const res = await request(app).post('/api/v1/sales')
    .set('Cookie', await authCookie(cashier))
    .send({ lines: [{ productId: product.id, quantity: 999 }] });

  expect(res.status).toBe(409);
  await expect(stockOf(product.id)).resolves.toBe(10);   // unchanged
  await expect(saleCount()).resolves.toBe(0);            // nothing written
});
```

Asserting only the `409` passes even if a partial sale was committed. Assert the
**state**, not just the response.

### Security negatives are mandatory

Every protected endpoint, every time:

```js
it('rejects unauthenticated requests', …);              // 401
it('rejects a role without permission', …);             // 403
it('returns 404 for another shop\'s record', …);        // not 403 — no existence leak
it('ignores privileged fields in the body', …);         // mass assignment
```

The cross-tenant test is the highest-value integration test in a multi-tenant
system. Without it, authorisation is unverified — see
`broken-object-level-authorization`.

### Concurrency belongs here

Unit tests cannot find races; only real parallel execution against real locking
can.

```js
it('never oversells under concurrent checkout', async () => {
  const product = await seedProduct({ stock: 10 });
  const results = await Promise.allSettled(
    Array.from({ length: 25 }, () => sellUnits(product.id, 1)));

  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(10);
  await expect(stockOf(product.id)).resolves.toBe(0);
});
```

Write one for every path that moves stock or money — see `concurrency`.

### Isolation between tests

Options, in order of preference:

1. **Transaction per test, rolled back** — fastest, perfectly isolated. Cannot be
   used for tests that themselves need transaction control (concurrency tests).
2. **Truncate between tests** — reliable, slower. Truncate in FK-safe order.
3. **Unique data per test** — no cleanup, but state accumulates.

Concurrency tests need real committed transactions, so they use option 2 or 3.

Seed the **minimum**. A fixture creating twenty related rows for a test that
touches two makes failures hard to read.

### Test the contract, not the implementation

```js
// ❌ couples to internals
expect(saleService.create).toHaveBeenCalledWith(…);

// ✅ the observable contract
expect(res.body).toMatchObject({ id: expect.any(Number), total: 4000, status: 'completed' });
```

Assert what a client depends on: status, shape, and the resulting state.

### Speed

Integration tests are slower than unit tests and that is acceptable — but a suite
too slow to run is a suite nobody runs.

- Run against a single containerised database, reused across the suite
- Parallelise by schema or database where possible
- Migrate once per run, not per test
- Keep E2E scarce; put coverage here instead — it is far cheaper

If the suite exceeds a few minutes, look for per-test setup that could be shared.

### Checklist

- [ ] Real PostgreSQL, matching the production major version
- [ ] Never SQLite as a substitute
- [ ] External services stubbed at the HTTP boundary
- [ ] Middleware chain exercised as in production
- [ ] Endpoint contracts asserted: status, shape, headers
- [ ] Rollback verified by asserting unchanged state
- [ ] 401, 403, cross-tenant 404, and mass-assignment negatives present
- [ ] Concurrency tests for every money and stock path
- [ ] Database constraints exercised
- [ ] Tests isolated and order-independent
- [ ] Minimal seeding via factories
- [ ] Assertions on the contract, not internal calls
- [ ] Suite fast enough to run routinely

## References

- **Martin Fowler — Integration Test / Test Pyramid**
  <https://martinfowler.com/bliki/IntegrationTest.html>
- **ISTQB Foundation Level syllabus** — integration testing level and objectives
- **Testcontainers** — disposable real dependencies for tests
  <https://node.testcontainers.org/>
- **Mock Service Worker (MSW)** — stubbing at the network boundary
  <https://mswjs.io/docs/>
- **PostgreSQL 16 documentation — Transaction Isolation and Explicit Locking**
  <https://www.postgresql.org/docs/16/transaction-iso.html>

**Not sourced — written for this framework:** the dependency table, the
assert-state-not-just-status rollback rule, the mandatory security negatives,
the retail concurrency example, and the isolation trade-offs.
