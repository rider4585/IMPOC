---
name: playwright
version: 1.0.0
description: |
  Write and debug Playwright tests — locators, auto-waiting, fixtures,
  authentication state, network interception, traces, and configuration. Use when
  writing browser tests, debugging a failing or flaky one, or when asked "how do
  I test this in the browser". For what to test see e2e-testing.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Playwright

The tool. `e2e-testing` decides *what* deserves a browser test; this covers how
to write one that is reliable.

> **Not currently installed.** Add with `npm init playwright@latest` in the
> frontend workspace before using this skill. Flagged rather than assumed.

### Locators, in priority order

Playwright locators are strict and auto-waiting. Choose by how a user identifies
the element.

| Priority | Locator | Example |
|---|---|---|
| 1 | `getByRole` | `getByRole('button', { name: 'Complete sale' })` |
| 2 | `getByLabel` | `getByLabel('Quantity')` |
| 3 | `getByText` | `getByText('No sales yet')` |
| 4 | `getByTestId` | `getByTestId('sale-row')` — last resort |
| ✗ | CSS / XPath | Breaks on any markup change |

```js
// ❌ couples to markup and styling
page.locator('.btn.btn-primary > span');

// ✅ survives refactoring, and fails if the control becomes unreachable
page.getByRole('button', { name: /complete sale/i });
```

As with Testing Library, an element you cannot address by role is usually an
accessibility defect — the locator choice surfaces it.

### Never wait for time

Playwright auto-waits for elements to be actionable. Explicit sleeps are the
primary cause of flakiness.

```js
// ❌ flaky and slow
await page.waitForTimeout(2000);

// ✅ wait for the condition that actually matters
await expect(page.getByText('Sale completed')).toBeVisible();
await expect(page.getByTestId('stock-level')).toHaveText('7');
await page.waitForURL(/\/sales\/\d+/);
```

`expect(...)` assertions retry until timeout — use them as the wait. If you need
`waitForTimeout`, the app has a state you have not identified; find it.

### Authentication state — set up once

Logging in through the UI in every test is slow and adds a failure point.

```js
// auth.setup.js
setup('authenticate as cashier', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('cashier@test.local');
  await page.getByLabel('Password').fill(process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/sales');
  await page.context().storageState({ path: '.auth/cashier.json' });
});
```

```js
// playwright.config.js
projects: [
  { name: 'setup', testMatch: /auth\.setup\.js/ },
  { name: 'cashier', use: { storageState: '.auth/cashier.json' }, dependencies: ['setup'] },
  { name: 'manager', use: { storageState: '.auth/manager.json' }, dependencies: ['setup'] },
]
```

One project per role makes permission testing straightforward — run the same spec
under a different role and assert the negative.

### Fixtures for test data

```js
export const test = base.extend({
  product: async ({ request }, use) => {
    const res = await request.post('/api/v1/products', {
      data: { sku: `TEST-${Date.now()}`, name: 'Test Pen', unitPrice: 1999, stock: 10 },
    });
    const product = await res.json();
    await use(product);
    await request.delete(`/api/v1/products/${product.id}`);   // teardown
  },
});
```

Seeding via `request` (the API) is faster than the UI and exercises the real API.
Unique identifiers per run keep parallel tests from colliding.

### Network interception

```js
// Force an error state
await page.route('**/api/v1/sales', (route) => route.fulfill({ status: 500 }));

// Simulate offline
await page.context().setOffline(true);

// Assert what was actually sent — e.g. that no price came from the client
const [req] = await Promise.all([
  page.waitForRequest('**/api/v1/sales'),
  page.getByRole('button', { name: 'Complete sale' }).click(),
]);
expect(req.postDataJSON().lines[0]).not.toHaveProperty('unitPrice');
```

The last pattern is worth using: it verifies a security property from the
browser side.

### Debugging

```bash
npx playwright test --ui              # interactive runner — start here
npx playwright test --debug           # step through with inspector
npx playwright test --headed          # watch it run
npx playwright show-trace trace.zip   # post-mortem of a CI failure
npx playwright codegen localhost:5173 # generate a starting point
```

Enable traces on failure — they are the difference between diagnosing a CI-only
failure and guessing:

```js
use: { trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'retain-on-failure' }
```

### Configuration essentials

```js
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,           // no accidental .only in CI
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Retries hide flakiness.** They are acceptable in CI to reduce noise, but a test
that only passes on retry is a defect — investigate it rather than accepting the
green build.

### Disable animations

```js
use: { launchOptions: { args: ['--force-prefers-reduced-motion'] } }
```

Animations cause elements to be intercepted or moved mid-click — a common and
confusing flake source.

### Retail-specific

- **Barcode scanning** — simulate with `page.keyboard.type(sku)` followed by
  `Enter`, at speed. Real scanners type extremely fast; test that the input
  handler copes.
- **Camera-based scanning** — grant permissions in the context and use a fake
  device: `--use-fake-device-for-media-stream`.
- **Till viewport** — set `viewport` to the real terminal resolution, not a
  laptop default.
- **Offline** — `context.setOffline(true)` to verify queueing and reconnection.
- **Receipt PDFs** — assert the download event and inspect the file, rather than
  rendering it.

### Checklist

- [ ] Playwright installed and configured
- [ ] Locators follow the priority order; no CSS or XPath
- [ ] No `waitForTimeout` anywhere
- [ ] Waits expressed as `expect` assertions on state
- [ ] Auth state reused via storage state, one project per role
- [ ] Test data seeded via API fixtures with unique ids and teardown
- [ ] External services intercepted, not called
- [ ] Traces, screenshots, and video enabled on failure
- [ ] `forbidOnly` set in CI
- [ ] Animations disabled
- [ ] Real till viewport used for POS screens
- [ ] Retry-only passes investigated, not accepted

## References

- **Playwright documentation — Locators, Auto-waiting, Assertions**
  <https://playwright.dev/docs/locators>
- **Playwright documentation — Best Practices**
  <https://playwright.dev/docs/best-practices>
- **Playwright documentation — Authentication and storage state**
  <https://playwright.dev/docs/auth>
- **Playwright documentation — Fixtures, Network, Trace Viewer**
  <https://playwright.dev/docs/test-fixtures>
- **Playwright documentation — Test configuration**
  <https://playwright.dev/docs/test-configuration>

**Not sourced — written for this framework:** the retail patterns (scanner
simulation, till viewport, offline queueing, receipt downloads), the
request-assertion for client-sent prices, and the retry-hides-flakiness rule.
