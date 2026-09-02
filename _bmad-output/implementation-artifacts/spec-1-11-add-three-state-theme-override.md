---
title: 'Add data-theme attribute support for three-state theme overrides (Story 1.11 enhancement)'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 1
baseline_commit: 'NO_VCS'
context:
  - _bmad-output/implementation-artifacts/spec-1-11-establish-design-token-theme.md
  - _bmad-output/planning-artifacts/ux-designs/ux-IMPOC-2026-08-20/DESIGN.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.11 implemented theme tokens with light palette defaults and dark overrides via `prefers-color-scheme: dark`, but explicitly forbade the `data-theme` attribute. This blocks the three-state theming rule: explicit light, explicit dark, and device preference. AD-37 stores per-user theme override in `user_preferences`, but there is no CSS hook (`data-theme` attribute) to apply that stored preference at runtime, making the architecture assumption unreachable.

**Approach:** Add explicit `data-theme="light"` and `data-theme="dark"` selectors to index.css alongside the existing `prefers-color-scheme` media query. The three states resolve with correct cascade precedence: (1) no attribute + light preference = light, (2) no attribute + dark preference = dark, (3) `data-theme="light"` overrides device preference to force light, (4) `data-theme="dark"` overrides device preference to force dark. Update theme.test.js to assert all three states resolve correctly, including that explicit choice beats device setting in both directions.

## Boundaries & Constraints

**Always:**
- Define all color tokens with base definitions at bare `:root` — never a color whose only definition sits inside a media query or theme block.
- Guard the `@media (prefers-color-scheme: dark)` block with `:root:not([data-theme="light"])` so an explicit light choice overrides device preference.
- Define dark-palette tokens again under `:root[data-theme="dark"]` so an explicit dark choice overrides device preference in both directions.
- Test all three states: (a) no data-theme with device preference light, (b) no data-theme with device preference dark, (c) data-theme="light" beats dark device preference, (d) data-theme="dark" beats light device preference.
- Do not modify any component files or runtime theme-toggle logic — this story only adds the CSS infrastructure that AD-37 will apply via the stored preference.

**Ask First:**
- If any component-level changes are needed to apply the stored theme preference at app startup, clarify scope before proceeding — that belongs to AD-37, not this story.

**Never:**
- Use JavaScript to toggle `data-theme` — the attribute must be applied by the host app at render time (AD-37 handles this).
- Define a color token twice at the same specificity level (cascade ties cause unpredictability).
- Include component CSS changes or runtime initialization — this story is CSS and tests only.
- Add any new token definitions; reuse all existing tokens from Story 1.11's light palette.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| **No data-theme + light preference** | `:root` with no `data-theme` attribute, `prefers-color-scheme: light` | `--primary` = `#7B2D4E`, `--surface-base` = `#FBF7F3` | N/A |
| **No data-theme + dark preference** | `:root` with no `data-theme` attribute, `prefers-color-scheme: dark` | `--primary` = `#E48BAB`, `--surface-base` = `#191411` | N/A |
| **data-theme="light" + dark device preference** | `data-theme="light"` set on `:root`, OS in dark mode | `--primary` = `#7B2D4E` (light palette wins), `--surface-base` = `#FBF7F3` | N/A |
| **data-theme="dark" + light device preference** | `data-theme="dark"` set on `:root`, OS in light mode | `--primary` = `#E48BAB` (dark palette wins), `--surface-base` = `#191411` | N/A |
| **Explicit light CSS selector specificity** | `:root[data-theme="light"]` and `@media (prefers-color-scheme: dark)` both apply | Light palette wins (explicit selector > guarded media query) | N/A |
| **Explicit dark CSS selector specificity** | `:root[data-theme="dark"]` and `@media (prefers-color-scheme: light)` both apply | Dark palette wins (explicit selector takes precedence) | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/index.css` -- Add guarded dark media query (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }`) and explicit dark selector (`:root[data-theme="dark"] { ... }` with all dark-palette tokens); reuse all existing light-palette token definitions at bare `:root`. Lines 93–139 contain the existing dark overrides; these will be refactored into the guarded query and dark selector.
- `frontend/src/__tests__/theme.test.js` -- Remove assertions that forbid data-theme (lines 212–216 and 224–226). Add new test suite asserting all three theme states resolve correctly: (a) light device preference resolves to light palette, (b) dark device preference resolves to dark palette, (c) `data-theme="light"` overrides dark preference, (d) `data-theme="dark"` overrides light preference.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/index.css` -- Refactor dark-palette overrides from line 93–139 into two blocks: (1) guarded media query `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` and (2) explicit dark selector `:root[data-theme="dark"] { ... }` with all dark-palette tokens. Ensure bare `:root` still holds complete light palette. All color tokens must have a base definition at `:root`; never a color whose only definition appears inside a media query or data-theme block. -- Enables cascade to correctly resolve explicit theme choices over device preference.
- [x] `frontend/src/__tests__/theme.test.js` -- Remove lines 212–216 (test asserting data-theme is not present) and 224–226 (test asserting only prefers-color-scheme is used). Add new test suite "Three-state Theme Override" with runtime DOM tests (not source-text assertions): Create tests that (1) set no `data-theme`, mock device prefers light, then assert `getComputedStyle(document.documentElement).getPropertyValue('--primary')` equals `#7B2D4E`; (2) set no `data-theme`, mock device prefers dark, assert equals `#E48BAB`; (3) set `data-theme="light"` on root, mock device prefers dark, assert equals `#7B2D4E` (explicit light wins); (4) set `data-theme="dark"` on root, mock device prefers light, assert equals `#E48BAB` (explicit dark wins). Use Vitest `matchMedia` mocking or similar to simulate device preference in test environment. Each test must verify computed CSS values with `getComputedStyle`, not just verify CSS source-text presence. -- Verifies cascade actually resolves tokens at runtime in all three states, preventing regressions where cascade logic breaks.

**Acceptance Criteria:**
- Given `data-theme="light"` is set on `:root` and `prefers-color-scheme: dark` is active in the browser, when `--primary` is inspected via `getComputedStyle`, then it returns the light-palette value `#7B2D4E`.
- Given `data-theme="dark"` is set on `:root` and `prefers-color-scheme: light` is active in the browser, when `--primary` is inspected via `getComputedStyle`, then it returns the dark-palette value `#E48BAB`.
- Given no `data-theme` attribute is set and `prefers-color-scheme: dark` is active, when `--primary` is inspected, then it returns the dark-palette value `#E48BAB`.
- Given no `data-theme` attribute is set and `prefers-color-scheme: light` is active, when `--primary` is inspected, then it returns the light-palette value `#7B2D4E`.
- Given the theme test suite runs, when all four three-state scenarios are tested, then every test passes (no assertion failures for cascade or specificity).
- Given index.css is loaded, when every color token is inspected in both light and dark modes with and without `data-theme`, then no token is left undefined or has conflicting definitions.

## Spec Change Log

**Loop 1:** Verification gap found tests were source-text assertions only, not runtime DOM tests checking actual cascade behavior. Spec's Tasks section and Acceptance Criteria explicitly required `getComputedStyle` calls to verify computed values, but implementation only verified CSS source-text presence. Updated Tasks to explicitly require runtime DOM tests with `getComputedStyle` assertions and `matchMedia` mocking for device preference simulation. KEEP: CSS implementation (index.css changes) are correct and complete; only tests need runtime verification approach.

## Design Notes

**CSS Cascade Specificity:** The three states are resolved via CSS cascade, not JavaScript:
1. **Bare `:root` (lowest specificity)** — light palette applies when no attribute and no media query matches.
2. **`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }`** — dark palette applies only if device prefers dark AND no explicit light choice is set. The `:not([data-theme="light"])` guard ensures an explicit light attribute wins.
3. **`:root[data-theme="dark"]`** (higher specificity than media query) — dark palette applies and overrides device preference.
4. **`:root[data-theme="light"]` (if needed)** — explicitly sets light palette to the same values as bare `:root`, ensuring it always wins over media query.

**Why both overrides exist:** Because `@media` queries have lower specificity than attribute selectors, the explicit dark selector `:root[data-theme="dark"]` automatically wins over any media query. The explicit light override is redundant at the root level (bare `:root` already defines light), but it clarifies intent and ensures consistent precedence in edge cases.

**Token definitions must be complete at `:root`.** Never define a token only inside a media query or data-theme block. This ensures every token is always defined, and the media query and attribute selectors only override values, not define them. Example:
```css
:root {
  --primary: #7B2D4E;  /* always defined */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --primary: #E48BAB;  /* override only */
  }
}

:root[data-theme="dark"] {
  --primary: #E48BAB;  /* override only */
}
```

## Verification

**Commands:**
- `npm run test -- --run` -- Runs the theme test suite, including the new three-state tests. All tests should pass, confirming that light palette, dark palette, and explicit overrides resolve correctly.
- `npm run build` -- Verifies the CSS builds without errors and no tokens are accidentally undefined.

**Manual checks (if no CLI):**
- Open DevTools on the running app, set `data-theme="light"` on `<html>`, switch DevTools to dark-mode emulation (Rendering → Emulate CSS media feature prefers-color-scheme → dark), and search for `--primary` — confirm it shows light-palette value `#7B2D4E`.
- Set `data-theme="dark"` on `<html>`, switch DevTools to light-mode emulation, and search for `--primary` — confirm it shows dark-palette value `#E48BAB`.
- Inspect element styles for `--surface-base`, `--ink`, and other color tokens in all three states to ensure no token is undefined.

## Suggested Review Order

**CSS Cascade Structure — Three-State Theme System**

- Guarded dark media query enables explicit light override to beat device preference
  [`index.css:104`](../../../frontend/src/index.css#L104)

- Explicit dark selector with attribute selector specificity always wins cascade
  [`index.css:154`](../../../frontend/src/index.css#L154)

- Light palette at bare :root ensures no token is ever undefined
  [`index.css:18`](../../../frontend/src/index.css#L18)

**Runtime Test Verification — Cascade Behavior**

- DOM attribute operations and cascade precedence test suite
  [`theme.test.js:264`](../../../frontend/src/__tests__/theme.test.js#L264)
