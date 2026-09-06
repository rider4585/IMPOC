---
name: browser-automation
version: 1.0.0
description: |
  Drive a browser for purposes other than test assertions — reproducing defects,
  capturing screenshots and traces, verifying generated PDFs and receipts,
  seeding data through the UI, and scripted diagnostics. Use when automating a
  repeatable browser task, or when asked to "capture" or "reproduce" something in
  the browser. For test suites see playwright and e2e-testing.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Browser Automation

The same tooling as E2E testing, used for jobs that are not tests: reproducing a
reported defect, capturing evidence, verifying artifacts the application
generates, and diagnostics that need a real browser.

Keep these **separate from the test suite** — in `scripts/` or `tools/`, not
`e2e/`. Automation that is not an assertion should never be able to fail a build.

### Reproducing a reported defect

The fastest way to turn a vague report into a minimal reproduction is to script
it, then delete steps until it stops failing.

```js
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const page = await browser.newPage({ storageState: '.auth/manager.json' });

await page.goto('/sales/1041');
await page.getByRole('button', { name: 'Void sale' }).click();
await page.getByLabel('Reason').fill('reproducing BUG-042');
await page.getByRole('button', { name: 'Confirm' }).click();

console.log(await page.getByTestId('stock-level').textContent());
await page.screenshot({ path: 'repro-042.png', fullPage: true });
await browser.close();
```

`slowMo` and `headless: false` let you watch it, which is the point during
investigation. Once the reproduction is minimal, it becomes a regression test —
see `bug-analysis`.

### Capturing evidence

```js
// Full-page screenshot for a bug report
await page.screenshot({ path: 'evidence.png', fullPage: true });

// A single element
await page.getByTestId('receipt').screenshot({ path: 'receipt.png' });

// Console errors and failed requests — often the actual finding
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()?.errorText));

// A trace to attach to the report
await context.tracing.start({ screenshots: true, snapshots: true });
// … actions …
await context.tracing.stop({ path: 'trace.zip' });
```

Attaching a trace to a defect report saves the engineer the reproduction step
entirely.

### Verifying generated artifacts

The project generates PDFs (`pdfkit`) and barcodes (`bwip-js`). Verify the real
output rather than the code path that produces it.

```js
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Print receipt' }).click(),
]);
const path = await download.path();

// Check it is a real PDF and inspect its text
const buf = await fs.readFile(path);
assert(buf.subarray(0, 4).toString() === '%PDF');
const text = await extractPdfText(buf);
assert(text.includes('₹63.68'));       // the total actually printed
assert(/Receipt No: \d{6}/.test(text));
```

Asserting the **printed total** catches formatting and rounding defects that
never surface in the API response — the receipt is what the customer receives, so
it is what must be right.

For barcodes, capture the rendered element and decode it to confirm it encodes
the SKU it should.

### Seeding through the UI

Prefer the API for test data — it is faster and less brittle. Drive the UI only
when the creation flow itself is what you need exercised, or when no API exists.

If you must, make it resumable and idempotent: check whether the record exists
before creating it, so a failed run can be re-run safely.

### Diagnostics that need a real browser

```js
// Layout overflow at a given viewport
await page.setViewportSize({ width: 320, height: 800 });
const overflowing = await page.evaluate(() =>
  [...document.querySelectorAll('*')]
    .filter((el) => el.scrollWidth > document.documentElement.clientWidth)
    .map((el) => el.tagName + '.' + el.className)
);

// What the client actually sent — e.g. confirming no price leaves the browser
page.on('request', (r) => {
  if (r.url().includes('/api/v1/sales') && r.method() === 'POST')
    console.log(JSON.stringify(r.postDataJSON(), null, 2));
});
```

### Rules

- **Never against production.** Automation that clicks buttons can complete
  sales, void transactions, and send emails. Point it at a test environment, and
  make the base URL explicit rather than defaulted.
- **Never with real credentials** in the script. Use environment variables and
  test accounts — see `secrets-detection`.
- **Never automate against a third party** without checking their terms.
- **Clean up.** Data created by automation must be removed or clearly marked, or
  it pollutes the environment for everyone.
- **Keep scripts out of the test suite** so they cannot fail CI.

### Checklist

- [ ] Script lives outside the test suite
- [ ] Base URL explicit; never production
- [ ] Credentials from environment variables, test accounts only
- [ ] Console errors and failed requests captured during reproduction
- [ ] Traces attached to defect reports where useful
- [ ] Generated PDFs and barcodes verified by content, not just existence
- [ ] Receipt totals asserted as printed
- [ ] UI seeding used only when the flow is the point; otherwise API
- [ ] Scripts idempotent and resumable
- [ ] Created data cleaned up
- [ ] Minimal reproductions promoted to regression tests

## References

- **Playwright documentation — Library API (non-test usage)**
  <https://playwright.dev/docs/library>
- **Playwright documentation — Downloads, Screenshots, Tracing, Network events**
  <https://playwright.dev/docs/downloads>
- **pdfkit documentation** — the PDF generation this verifies
  <https://pdfkit.org/>
- **bwip-js** — barcode generation <https://github.com/metafloor/bwip-js>

**Not sourced — written for this framework:** the separation of automation from
the test suite, the receipt and barcode verification approach, the layout-overflow
and outbound-request diagnostics, and the safety rules.
