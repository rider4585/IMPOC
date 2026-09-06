---
name: e2e-testing
version: 1.0.0
description: |
  Decide what deserves an end-to-end test and how to keep the suite fast and
  reliable — journey selection, test data strategy, and flakiness control. Use
  when planning E2E coverage, when the suite is slow or flaky, or when asked
  "should this be an E2E test". For tool mechanics see playwright.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## End-to-End Testing

E2E tests exercise the real system through a real browser. They catch what no
other level can — and they are the slowest, most fragile, most expensive tests
you will write.

**Therefore: as few as possible, covering the journeys that must never break.**

### The selection rule

An E2E test is justified only when **the integration itself is the risk**.

| Justified | Not justified |
|---|---|
| Complete a sale end to end | Discount calculation (unit) |
| Log in and reach the till | Validation rejects a negative quantity (integration) |
| Void a sale and see stock restored | Every filter combination (integration) |
| Scan → cart → pay → receipt | Every empty state (component test) |
| Cross-role permission on a real screen | Button styling (visual) |

**Push everything down that can go down.** A rule tested at unit level costs
milliseconds; the same rule at E2E costs seconds, breaks on unrelated UI changes,
and fails intermittently.

A useful target for a system this size: **5–15 E2E tests**, not hundreds.

### The journeys that earn a test

For a POS, the ones where failure stops the business:

1. **Login → till → scan → pay → receipt** — the core loop; if this breaks,
   nothing else matters
2. **Void a completed sale** — money and stock both move backwards
3. **Refund with stock restoration**
4. **Shift open → sales → shift close with reconciliation**
5. **Add product → appears on till → sells → stock decrements**
6. **A cashier cannot reach manager-only screens** — permissions, on real screens
7. **Offline → queued sale → reconnect → reconciled** — if offline is supported

Everything else belongs at a lower level.

### Test data

E2E tests need real, isolated data. In order of preference:

1. **Seed via API before the test** — fast, explicit, and exercises the API
2. **Seed via database fixture** — faster, but bypasses validation
3. **Create through the UI** — slowest and most brittle; use only when the
   creation flow *is* what is under test

**Each test owns its data.** Shared seed data creates order dependence, and a
test that mutates it breaks the next one. Use unique identifiers per run.

Never run E2E tests against production, and never against a database another
suite is mutating.

### Flakiness is a defect

A flaky test is worse than no test: it trains everyone to re-run rather than
investigate, and eventually a real failure is dismissed.

The causes, in order of frequency:

| Cause | Fix |
|---|---|
| Fixed waits (`sleep(500)`) | Wait for a condition, never a duration |
| Racing the app's async work | Wait for the resulting state, not the click |
| Shared or leftover data | Per-test data with unique ids |
| Test order dependence | Full isolation; run in random order to prove it |
| Animations | Disable them in the test environment |
| Real external services | Stub at the network boundary |
| Time-dependent assertions | Freeze or inject the clock |

**Quarantine, then fix or delete.** A test that fails intermittently is removed
from the gate immediately and fixed within a defined window — or deleted. Leaving
it in the suite is the worst option.

### Keep the suite fast

- Run E2E on merge and before deploy, not on every commit
- Parallelise across workers; keep tests independent so this is safe
- Reuse authentication state rather than logging in through the UI each time
- Stub slow third parties
- Cap the suite at a few minutes

If the suite takes longer than the deploy it gates, it will be skipped.

### What E2E should assert

Assert **user-visible outcomes and resulting state**, not intermediate steps.

```
✅ After payment: the receipt shows the correct total, the sale appears in
   history, and the stock level has decreased.
❌ That a particular API call was made, or that a spinner appeared.
```

Include the state assertion — a test that only checks the success message passes
even when the stock never moved.

### Environment

- A dedicated environment matching production configuration
- Real PostgreSQL, migrated to the same schema
- External services stubbed
- Test accounts per role, created by seed
- Deterministic clock where dates affect the outcome

### Checklist

- [ ] Only journeys where integration is the risk
- [ ] Suite kept small — single-digit to low-double-digit
- [ ] Everything testable at a lower level pushed down
- [ ] Core checkout loop covered
- [ ] Void and refund covered, with state assertions
- [ ] Permission journeys covered on real screens
- [ ] Each test seeds and owns its data
- [ ] No fixed waits anywhere
- [ ] Animations disabled; external services stubbed
- [ ] Tests independent; suite passes in random order
- [ ] Auth state reused rather than re-logging in
- [ ] Flaky tests quarantined immediately, then fixed or deleted
- [ ] Assertions cover resulting state, not just messages
- [ ] Never run against production data

## References

- **Martin Fowler — Test Pyramid / Broad Stack Tests** — why E2E should be few
  <https://martinfowler.com/bliki/TestPyramid.html>
- **Playwright documentation — Best Practices** — test isolation, data strategy,
  and avoiding flakiness <https://playwright.dev/docs/best-practices>
- **Google Testing Blog — Just Say No to More End-to-End Tests** — the cost and
  flakiness argument
- **ISTQB Foundation Level syllabus** — system and acceptance level testing

**Not sourced — written for this framework:** the justified/not-justified table,
the seven POS journeys, the flakiness cause table, the quarantine policy, and the
state-assertion requirement.
