---
name: backend-testing
version: 1.0.0
description: |
  Test an Express and Sequelize backend — unit tests for business rules,
  integration tests against a real database with supertest, fixtures, and the
  concurrency and money tests that ordinary unit tests never catch. Use when
  adding tests, when a bug escaped to production, or when asked "how should this
  be tested".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Backend Testing

Test behaviour, not implementation. A test that breaks when you rename a private
function but passes when the total is wrong is worse than no test — it costs
maintenance and buys no confidence.

### What to test at which level

| Level | Scope | Database | Use for |
|---|---|---|---|
| **Unit** | One function or service, dependencies faked | No | Business rules, pricing, calculations, edge cases |
| **Integration** | Route → service → database | **Yes, real** | Contracts, auth, validation, transactions |
| **Concurrency** | Parallel operations against real data | **Yes, real** | Races that unit tests structurally cannot find |

Do **not** mock the database in integration tests. A mocked ORM tests your
understanding of Sequelize, not Sequelize — and constraint violations,
transaction rollbacks, and lock behaviour are precisely what you need to verify.

### Structure

Arrange–Act–Assert, with names that state the rule:

```js
describe('voidSale', () => {
  it('restores stock for every line when a completed sale is voided', async () => {
    const { sale, product } = await seedCompletedSale({ quantity: 3 });   // arrange
    await saleService.void(sale.id, { actorId: manager.id, reason: 'error' });  // act
    const stock = await Stock.findOne({ where: { productId: product.id } });    // assert
    expect(stock.quantity).toBe(13);
  });

  it('rejects voiding a sale that is already voided', async () => {
    const sale = await seedVoidedSale();
    await expect(saleService.void(sale.id, { actorId: manager.id }))
      .rejects.toThrow(AlreadyVoidedError);
  });
});
```

`it('works')` tells a future reader nothing. The name should be the specification.

### Integration tests with supertest

```js
import request from 'supertest';

describe('POST /api/v1/sales', () => {
  it('creates a sale and decrements stock', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', await authCookie(cashier))
      .send({ lines: [{ productId: product.id, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(4000);          // minor units — exact
    await expect(stockOf(product.id)).resolves.toBe(8);
  });

  it('returns 409 when stock is insufficient', async () => {
    const res = await request(app).post('/api/v1/sales')
      .set('Cookie', await authCookie(cashier))
      .send({ lines: [{ productId: product.id, quantity: 999 }] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('insufficient_stock');
    await expect(stockOf(product.id)).resolves.toBe(10);   // unchanged — rollback held
  });
});
```

The last assertion is the valuable one: it proves the transaction rolled back.
Testing only the status code would pass even if the sale had partially committed.

### Security tests are not optional

Every protected endpoint needs the negative cases, or authorisation is untested:

```js
it('rejects an unauthenticated request', async () => {
  await request(app).get(`/api/v1/sales/${sale.id}`).expect(401);
});

it('rejects a role without permission', async () => {
  await request(app).post(`/api/v1/sales/${sale.id}/void`)
    .set('Cookie', await authCookie(cashier)).expect(403);
});

it('does not expose another shop\'s sale', async () => {
  const other = await seedSale({ shopId: otherShop.id });
  await request(app).get(`/api/v1/sales/${other.id}`)
    .set('Cookie', await authCookie(cashier))
    .expect(404);                       // 404, not 403 — existence not confirmed
});

it('ignores a privileged field in the request body', async () => {
  const res = await request(app).patch('/api/v1/users/me')
    .set('Cookie', await authCookie(cashier))
    .send({ name: 'X', role: 'owner' });
  expect((await User.findByPk(cashier.id)).role).toBe('cashier');
});
```

The cross-tenant test is the single highest-value test in a multi-tenant
system — see `broken-object-level-authorization`.

### Concurrency tests

These find the bugs that only appear in production. Nothing else does.

```js
it('never oversells the last units under concurrent sales', async () => {
  const product = await seedProduct({ stock: 10 });

  const results = await Promise.allSettled(
    Array.from({ length: 25 }, () => sellUnits(product.id, 1))
  );

  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
  await expect(stockOf(product.id)).resolves.toBe(0);      // never negative
});

it('charges once for a duplicated request', async () => {
  const key = crypto.randomUUID();
  const [a, b] = await Promise.all([pay(key), pay(key)]);
  expect(a.paymentId).toBe(b.paymentId);
  await expect(paymentCount()).resolves.toBe(1);
});
```

Write one for every path that moves stock or money — see `concurrency`.

### Money assertions

Assert exact integers in minor units. If a test needs `toBeCloseTo` for a
currency amount, the production code is using floats and that is the finding —
see `javascript`.

### Fixtures and isolation

- Build fixtures with **factories that take overrides**, not shared mutable
  objects. Each test states the data that matters to it and defaults the rest.
- **Isolate by transaction-per-test with rollback**, or truncate between tests.
  Order-dependent tests are a slow-burning maintenance problem.
- Seed the minimum. A fixture creating twenty related rows for a test that reads
  one makes failures hard to interpret.
- Use a **real PostgreSQL** for tests — Testcontainers, or a dedicated local
  database. SQLite does not have the same constraints, locking, or types, so it
  will pass tests that production fails.

### What not to test

Framework behaviour, ORM behaviour, third-party libraries, and getters. Test
*your* rules. Coverage is a diagnostic for finding untested branches, not a
target — 100% coverage with no negative-path tests is worse than 60% with them.

### Detection

```bash
grep -rn "describe(\|it(" test/ --include=*.test.js | wc -l
grep -rn "it('works'\|it('should work" test/ --include=*.test.js
grep -rn "toBeCloseTo" test/ --include=*.test.js | grep -iE "total|price|amount"
grep -rln "expect(4[0-9][0-9])\|expect(.status).toBe(40" test/ | wc -l
grep -rn "jest.mock" test/ --include=*.test.js | grep -iE "sequelize|models"
```

### Checklist

- [ ] Test names state the rule, not "works"
- [ ] Business rules covered by unit tests, including edge cases
- [ ] Integration tests run against real PostgreSQL, not mocks or SQLite
- [ ] Rollback verified by asserting state is unchanged after a failure
- [ ] Every protected endpoint has 401 and 403 negative tests
- [ ] Cross-tenant access test returns 404
- [ ] Mass-assignment test asserts the privileged field was ignored
- [ ] Concurrency tests exist for every stock and money path
- [ ] Money asserted as exact integers, never `toBeCloseTo`
- [ ] Fixtures built by factories with overrides
- [ ] Tests isolated; order does not matter
- [ ] Framework and ORM behaviour not re-tested

## References

- **Jest documentation** — structure, `expect`, async assertions
  <https://jestjs.io/docs/getting-started>
- **SuperTest** — HTTP assertions against an Express app
  <https://github.com/ladjs/supertest>
- **Testcontainers for Node.js** — disposable real PostgreSQL for integration
  tests <https://node.testcontainers.org/>
- **Martin Fowler — Test Pyramid / "Unit Test"** — level selection and the cost
  of over-mocking <https://martinfowler.com/bliki/TestPyramid.html>
- **OWASP Web Security Testing Guide (WSTG) v4.2** — authorisation test cases
  <https://owasp.org/www-project-web-security-testing-guide/>

**Not sourced — written for this framework:** the three-level table, the retail
worked examples, the concurrency and money test patterns, the rollback assertion
technique, and the detection commands.
