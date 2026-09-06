---
name: unit-testing
version: 1.0.0
description: |
  Write good unit tests — choosing the unit, test doubles and when each is
  appropriate, isolation, naming, and what not to unit test. Discipline-level
  guidance independent of framework. Use when writing unit tests, when tests
  break on every refactor, or when asked "should this be a unit test". For tool
  specifics see backend-testing and frontend-testing.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Unit Testing

A unit test verifies one behaviour, fast and in isolation. Its value is that it
localises failure: when it fails, you know where to look.

**The unit is a behaviour, not a class or a file.** Testing every function
individually produces tests coupled to structure that break on every refactor
while catching nothing.

### Test through the public surface

```js
// ❌ tests a private helper — breaks when it is renamed or inlined
expect(calculateLineSubtotal__internal(3, 1999)).toBe(5997);

// ✅ tests the behaviour anyone actually depends on
expect(calculateSaleTotals({ lines: [{ quantity: 3, unitPrice: 1999 }], taxRate: 0.18 }))
  .toEqual({ subtotal: 5997, tax: 1079, total: 7076 });
```

If a private function is complex enough to need direct tests, that is a signal it
wants to be its own module with its own public surface — not a signal to reach
inside.

### Ideal for unit tests

Pure logic with many cases — exactly where retail defects live:

- Price, discount, and tax calculation
- Rounding rules
- Stock availability rules
- Validation logic
- State transition rules (which statuses may follow which)
- Date and period arithmetic
- Formatting and parsing

These are cheap to test exhaustively. **Spend your edge-case budget here** — a
hundred rounding cases at unit level cost less than one E2E test.

### Test doubles — know which you need

Using the wrong double is the main cause of tests that pass while the system is
broken.

| Double | What it does | Use when |
|---|---|---|
| **Stub** | Returns canned values | You need an input to the unit |
| **Fake** | Working lightweight implementation | An in-memory repository |
| **Mock** | Asserts it was called | The *call itself* is the behaviour |
| **Spy** | Records calls, keeps real behaviour | Verifying without replacing |

**Prefer stubs and fakes.** Mocks assert *how* something was done, which couples
the test to implementation. Reserve them for cases where the interaction is the
requirement — "an audit record is written", "the payment provider is called
exactly once".

**Do not mock what you do not own.** Wrapping a third-party client and mocking
your wrapper tests your understanding of the library, not the library. Test
integration with real dependencies at integration level.

### Isolation

Each test must pass alone, in any order, repeatedly.

- No shared mutable state between tests
- No dependence on execution order
- No real time — inject a clock or freeze it
- No randomness — seed it or inject it
- No network, no filesystem, no real database

```js
// ❌ fails at midnight, and on the last day of the month
expect(getReportPeriod().label).toBe('September 2026');

// ✅ deterministic
expect(getReportPeriod(new Date('2026-09-15T10:00:00Z')).label).toBe('September 2026');
```

Tests that fail intermittently get ignored, and an ignored test suite is worse
than none — it provides false confidence.

### Naming

The name is the specification. It should read as a sentence about behaviour.

```js
// ❌
it('works')
it('test discount')

// ✅
it('applies the higher of two competing discounts, never both')
it('rejects a discount that would price the item below cost')
it('rounds half up at the line level, not on the order total')
```

A failing test's name should tell you what broke without opening the file.

### Arrange–Act–Assert

One action per test. Multiple assertions are fine when they describe one outcome.

```js
it('restores stock when a sale is voided', () => {
  const sale = completedSale({ lines: [{ productId: 'p1', quantity: 3 }] });   // arrange
  const result = voidSale(sale, { actorId: 'u1', reason: 'error' });           // act
  expect(result.status).toBe('void');                                          // assert
  expect(result.stockAdjustments).toEqual([{ productId: 'p1', delta: 3 }]);
});
```

Two actions in one test means you cannot tell which failed.

### Fixtures via factories

```js
const saleLine = (overrides = {}) =>
  ({ productId: 'p1', quantity: 1, unitPrice: 1000, discount: 0, ...overrides });
```

Each test states only what matters to it and defaults the rest. Shared mutable
fixture objects couple tests and produce order dependence.

### What not to unit test

- **Framework behaviour** — React, Express, and Sequelize are already tested
- **Trivial code** — getters, pass-throughs, constants
- **Integration** — that queries work, that middleware chains correctly; those
  need real dependencies
- **Anything requiring so much mocking that the test is mostly setup** — that is
  a signal the code needs decoupling, or the test belongs at integration level

### Coverage

Coverage finds untested branches. It does not measure quality — a suite can hit
every line and assert nothing meaningful.

Use it to **find gaps**, particularly uncovered error and edge branches. Do not
set a percentage target; it produces tests written to satisfy the number.

The metric that matters: when a defect escapes, would a reasonable test have
caught it? If yes, add that test.

### Checklist

- [ ] Unit is a behaviour, not a file
- [ ] Tested through the public surface
- [ ] Calculation and rule logic covered exhaustively, including boundaries
- [ ] Stubs and fakes preferred over mocks
- [ ] Mocks used only where the interaction is the requirement
- [ ] Nothing mocked that the project does not own
- [ ] Tests independent, order-agnostic, repeatable
- [ ] Time and randomness injected, never real
- [ ] Names state the behaviour
- [ ] One action per test
- [ ] Fixtures built by factories with overrides
- [ ] Framework and trivial code not tested
- [ ] Coverage used to find gaps, not as a target

## References

- **Martin Fowler — Test Double / Mocks Aren't Stubs / UnitTest**
  <https://martinfowler.com/bliki/TestDouble.html>
- **Kent Beck, _Test-Driven Development: By Example_** — arrange/act/assert and
  test independence
- **Michael Feathers, _Working Effectively with Legacy Code_** — the definition
  of a unit test and why isolation matters
- **ISTQB Foundation Level syllabus** — test levels and coverage as a diagnostic
- **Kent C. Dodds — Testing Implementation Details**
  <https://kentcdodds.com/blog/testing-implementation-details>

**Not sourced — written for this framework:** the retail examples, the
"don't mock what you don't own" application, the naming examples, and the
checklist.
