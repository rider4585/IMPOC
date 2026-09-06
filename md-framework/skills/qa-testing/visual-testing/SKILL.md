---
name: visual-testing
version: 1.0.0
description: |
  Catch unintended visual changes — screenshot comparison, controlling
  non-determinism, choosing what to snapshot, and reviewing diffs. Use when UI
  regressions slip through, when changing shared components or design tokens, or
  when asked "did that change break anything visually".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Visual Testing

Functional tests confirm the button works. Visual tests confirm it is still
visible, correctly sized, and not overlapping the total. These are different
failures, and the second kind ships surprisingly often.

Visual testing earns its place mainly when **shared components or design tokens
change** — the blast radius is wide and invisible to functional tests.

### Snapshot deliberately, not everything

Every snapshot is a maintenance cost: it must be reviewed and re-approved on
every intentional change. Snapshot too much and the diffs get rubber-stamped,
which defeats the purpose.

| Worth snapshotting | Not worth it |
|---|---|
| Shared primitives — button, input, modal, table | Every page |
| The till screen at its real resolution | Content-heavy pages that change constantly |
| Receipt and invoice layouts | Anything with live data in it |
| Empty, loading, and error states | Trivially simple components |
| Both themes, if theming exists | States nobody sees |

**Component-level snapshots beat page-level ones** — they are stable, and a
failure points directly at the cause instead of at a page containing forty
components.

### Non-determinism is the whole problem

A visual suite that fails randomly is abandoned within a week. Everything
variable must be controlled before the first snapshot is taken.

| Source | Control |
|---|---|
| Dates and times | Freeze the clock; use fixed fixture dates |
| Random or generated ids | Seed, or mask the element |
| Live data | Fixed fixtures, never a shared database |
| Animations and transitions | Disable in the test environment |
| Font loading | Wait for `document.fonts.ready` |
| Images | Local fixtures, never remote URLs |
| Scrollbars | Consistent viewport and platform |
| Cursor and focus rings | Blur before capture, or capture deliberately |
| OS font rendering | **Run in a container** — the largest source of noise |

```css
/* Disable motion for the whole suite */
*, *::before, *::after {
  animation-duration: 0s !important;
  transition-duration: 0s !important;
}
```

```js
await page.clock.setFixedTime(new Date('2026-09-06T10:00:00Z'));
await page.evaluate(() => document.fonts.ready);
await expect(page.getByTestId('till-panel')).toHaveScreenshot('till-panel.png');
```

**Generate baselines in the same environment as CI.** Screenshots taken on macOS
will not match Linux CI — different font rasterisation. Use a container for both.

### Thresholds

```js
await expect(locator).toHaveScreenshot('button.png', {
  maxDiffPixelRatio: 0.01,     // tolerate sub-pixel antialiasing noise
  animations: 'disabled',
});
```

Set the threshold as low as the environment allows. A generous threshold hides
the small regressions — a two-pixel shift that clips a total — which are exactly
what this catches.

Mask genuinely variable regions rather than raising the threshold globally:

```js
await expect(page).toHaveScreenshot({ mask: [page.getByTestId('timestamp')] });
```

### Reviewing diffs

A visual failure is a **question**, not a defect: *did you mean to change this?*

1. Look at the diff image before anything else
2. If intended — update the baseline in the same commit as the change
3. If not — it is a regression; investigate before approving
4. **Never bulk-approve.** Approving twenty baselines without looking is how a
   real regression is accepted permanently

Baselines belong in version control and are reviewed like code. A pull request
that updates a baseline should say why.

### Retail-specific

- **Till screen at its real resolution** — a layout that works on a laptop may
  clip on the actual terminal
- **Receipts** — the printed artifact is what the customer receives; snapshot the
  rendered layout with realistic values, including long product names
- **Money alignment** — totals must line up; a broken tabular-numeral setting
  shows here and nowhere else
- **Long product names** — the most common real-world layout breaker
- **Low-stock and error badges** — colour plus icon, verifiable visually

### What visual testing does not cover

It is not accessibility testing. A screenshot cannot detect insufficient contrast
ratios, missing labels, or an unreachable control. Check those separately — see
`component-review`.

It also cannot judge whether a design is *good*, only whether it changed.

### Checklist

- [ ] Snapshots limited to shared components and critical layouts
- [ ] Component-level preferred over page-level
- [ ] Clock frozen; fixture data fixed
- [ ] Animations and transitions disabled
- [ ] Fonts loaded before capture
- [ ] Images local, not remote
- [ ] Baselines generated in the same container as CI
- [ ] Threshold as tight as the environment allows
- [ ] Variable regions masked rather than tolerated globally
- [ ] Till screen captured at real resolution
- [ ] Receipt layout captured with realistic and long values
- [ ] Diffs reviewed individually; never bulk-approved
- [ ] Baseline updates committed alongside the change that caused them

## References

- **Playwright documentation — Visual comparisons (`toHaveScreenshot`)**
  <https://playwright.dev/docs/test-snapshots>
- **Playwright documentation — Clock API** — freezing time
  <https://playwright.dev/docs/clock>
- **MDN — `document.fonts.ready`** — font loading determinism
  <https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready>
- **web.dev — Cumulative Layout Shift** — the class of defect this catches
  <https://web.dev/articles/cls>

**Not sourced — written for this framework:** the worth/not-worth snapshot table,
the non-determinism control table, the retail captures (till resolution,
receipts, money alignment), and the never-bulk-approve rule.
