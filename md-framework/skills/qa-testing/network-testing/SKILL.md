---
name: network-testing
version: 1.0.0
description: |
  Test behaviour under real network conditions — slowness, failure, timeouts,
  offline, reconnection, and retry safety. Use when testing anything that makes a
  request, before releasing changes to checkout or payment, or when asked "what
  happens if the network drops".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Network Testing

Applications are developed on fast, reliable networks and run on shop wifi behind
a fridge. Nearly every serious retail defect involving lost or duplicated
transactions is a network-condition defect that was never tested.

**The question that matters most:** what happens when the request succeeded on
the server but the response never arrived?

### The conditions to test

| Condition | Simulate with | What it reveals |
|---|---|---|
| Slow network | Throttling profile | Missing loading states, timeouts too short |
| High latency | Added delay per request | Double submissions, race conditions |
| Request fails | Route abort | Missing error handling |
| Server 500 | Route fulfil | Error states, retry behaviour |
| Timeout | Delay beyond the client timeout | Whether a timeout is even set |
| Offline | `context.setOffline(true)` | Queueing, or an honest failure |
| Reconnect | Offline → online | Reconciliation, duplicate submission |
| **Response lost after commit** | Abort *after* the server responds | **Duplicate charges** |

```js
// Slow everything down
await page.route('**/api/**', async (route) => {
  await new Promise((r) => setTimeout(r, 3000));
  await route.continue();
});

// Fail one endpoint
await page.route('**/api/v1/sales', (route) => route.abort('failed'));

// Server error
await page.route('**/api/v1/sales', (route) =>
  route.fulfill({ status: 500, body: JSON.stringify({ title: 'Server error' }) }));

// Offline, then back
await page.context().setOffline(true);
await page.context().setOffline(false);
```

### The critical test: response lost after the server committed

This is the scenario that produces duplicate charges, and it is almost never
tested because it requires deliberate setup.

```js
it('does not double-charge when the response is lost and the user retries', async () => {
  let seen = 0;
  await page.route('**/api/v1/sales', async (route) => {
    seen += 1;
    if (seen === 1) {
      await route.fetch();          // server DOES process it
      await route.abort('failed');  // …but the client never sees the response
      return;
    }
    await route.continue();         // the retry goes through normally
  });

  await completeSale(page);         // appears to fail
  await completeSale(page);         // user tries again

  expect(await saleCount()).toBe(1);      // exactly one sale
  expect(await paymentTotal()).toBe(6368); // charged once
});
```

If this test fails, the endpoint lacks idempotency — see `concurrency` and
`rest-api`. It is worth writing for every money- and stock-moving operation.

### Slow network behaviour

- Loading indicators appear (after a sensible delay) and do not flicker
- The submit control disables so it cannot be pressed twice
- Timeouts are set and are appropriate — no request hanging indefinitely
- The interface stays responsive; a till must keep scanning while something loads
- Nothing is rendered as though loaded when it is not

### Failure behaviour

- A clear error message stating what to do
- Retry offered for transient failures
- Network failure distinguished from server failure — the user's action differs
- No raw error objects rendered
- Partial page failure does not blank the whole screen
- Application state remains consistent — a failed sale leaves no half-created
  record

### Offline and reconnection

If offline operation is supported:

- Sales queue locally with clear indication they are pending
- Queued items survive a page reload
- On reconnect, they submit **once**, in order
- Conflicts (stock sold elsewhere meanwhile) are surfaced, not silently resolved
- Receipt numbers allocated offline do not collide on reconnect

If offline is **not** supported, that must be explicit: a clear message that the
till cannot take sales, rather than a form that appears to work and loses the
transaction. An ambiguous failure is worse than a stated limitation.

### Retry safety

- Only transient failures retried — never `4xx`
- Exponential backoff with jitter, and a cap on attempts
- Non-idempotent operations retried only with an idempotency key
- Retry storms avoided — many tills failing simultaneously must not overwhelm the
  server on recovery

### Concurrent network conditions

Combine with concurrency: two tills on a degraded network, both selling the last
unit, one timing out. The interaction between slow responses and contention is
where the subtle defects live — see `concurrency`.

### Backend-side network testing

Not only the browser:

- Database connection lost mid-transaction — does it roll back cleanly?
- Connection pool exhausted under load
- External payment provider timing out — does the sale complete or fail safely?
- Slow third-party call blocking the request path

The payment case deserves explicit design and testing: if the provider times out
after charging, the system must reconcile rather than assume failure.

### Checklist

- [ ] Slow, failing, and timing-out requests tested per critical flow
- [ ] Response-lost-after-commit tested on every money and stock operation
- [ ] Duplicate submission produces exactly one effect
- [ ] Loading indicators appear without flicker; submit controls disable
- [ ] Client timeouts set and verified
- [ ] Errors distinguish network from server failure
- [ ] No raw errors rendered; no half-created records after failure
- [ ] Offline behaviour explicit — queued, or clearly refused
- [ ] Queued items survive reload and submit once on reconnect
- [ ] Reconnect conflicts surfaced rather than silently resolved
- [ ] Retries limited to transient failures, with backoff and a cap
- [ ] Backend tested for lost connections and pool exhaustion
- [ ] Payment provider timeout path tested and reconcilable

## References

- **Playwright documentation — Network interception and `setOffline`**
  <https://playwright.dev/docs/network>
- **MDN — Online and offline events, `navigator.onLine`**
  <https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine>
- **Michael Nygard, _Release It!_** — timeouts, circuit breakers, and failure
  under network partition
- **AWS Architecture Blog — Exponential backoff and jitter**
  <https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/>
- **Stripe API documentation — Idempotent Requests** — the guarantee this tests
  <https://docs.stripe.com/api/idempotent_requests>

**Not sourced — written for this framework:** the response-lost-after-commit test
and its Playwright implementation, the offline/reconnect requirements, the
retail retry-storm concern, and the backend network cases.
