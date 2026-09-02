---
title: 'Establish the DESIGN.md token theme — typography, colour, and the three surface treatments'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 1
baseline_commit: 'NO_VCS'
context:
  - _bmad-output/planning-artifacts/ux-designs/ux-IMPOC-2026-08-20/DESIGN.md
  - _bmad-output/planning-artifacts/epics/epic-01-foundation-barcode.md
---

<!-- Target: 900–1300 tokens. Above 1600 = high risk of context rot.
     Never over-specify "how" — use boundaries + examples instead.
     Cohesive cross-layer stories (DB+BE+UI) stay in ONE file.
     IMPORTANT: Remove all HTML comments when filling this template. -->

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The frontend has no design tokens. Generic hard-coded CSS in App.css and BarcodeScanner.css means every component must replicate colours, font sizes, spacing, and surface treatments. Later frontend epics reimplements them repeatedly, causing inconsistency and maintenance burden.

**Approach:** Declare all DESIGN.md tokens (colors, typography, spacing, rounded corners, surface treatments) as CSS custom properties at `:root`, with light palette as defaults and dark palette via `prefers-color-scheme: dark` media query. Import self-hosted font packages (`@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/instrument-sans`, already declared in `package.json`) and define a reusable `.typography-*` class system so every later screen uses consistent typography. Never use an in-app theme toggle or `data-theme` attribute; let `prefers-color-scheme` drive the theme entirely.

## Boundaries & Constraints

**Always:**
- CSS custom properties declared on `:root` with light-palette values as defaults.
- Dark-palette overrides via `@media (prefers-color-scheme: dark)` media query only — never an in-app toggle or `data-theme` attribute.
- Font-face rules import `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/instrument-sans` at the stylesheet entry point.
- Typography classes for every role: `.typography-display`, `.typography-heading`, `.typography-subheading`, `.typography-body`, `.typography-body-sm`, `.typography-label`, `.typography-money`, `.typography-money-lg`, `.typography-money-sm`, `.typography-counter`, `.typography-barcode`. Each applies the font family, size, weight, line height, letter spacing, and `font-variant-numeric` (tabular-nums for money/counter/barcode roles only).
- Color tokens follow the semantic split: brand (`--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`), neutral surfaces (`--surface-base`, `--surface-raised`, `--surface-sunken`, `--surface-scan`, `--ink`, `--ink-muted`, `--ink-faint`, `--border`, `--border-strong`), unit status (six `--status-*` tokens), money semantics (four `--money-*` tokens), system feedback (`--waking`, `--success`, `--danger`, `--focus-ring`).
- Surface treatment classes for the three named treatments: `.surface-flat`, `.surface-soft`, `.surface-glass`, each applying background, border, radius, and shadow (where applicable) according to DESIGN.md's component spec.
- Body receives an explicit `--surface-base` background and `--ink` foreground so the page respects user theme choice at render time.
- No breaking changes to existing App.jsx, BarcodeScanner.jsx, or their CSS files — those are retired by Story 1.16; this story only adds theme infrastructure.

**Ask First:**
- If Vite build configuration changes are needed beyond importing CSS, clarify scope before proceeding.
- If existing component CSS needs immediate replacement to adopt tokens, ask before proceeding — Story 1.16 retires the scaffolding anyway.

**Never:**
- CDN fonts or Google Fonts links — use self-hosted @fontsource packages only.
- A data-theme attribute or JavaScript theme toggle; `prefers-color-scheme` is the sole source of truth.
- In-app colour overrides or hardcoded hex values in component files — all colours come from CSS custom properties.
- Tailwind CSS, styled-components, or any CSS-in-JS framework — vanilla CSS custom properties only.
- A `_variables.css` or other utilities directory; theme tokens live in one entry point.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| **Light theme default** | `prefers-color-scheme` not set or `light` | `--primary: #7B2D4E`, `--surface-raised: #FFFFFF`, `--ink: #2A211C` | N/A |
| **Dark theme** | `prefers-color-scheme: dark` | `--primary-dark: #E48BAB`, `--surface-raised-dark: #231C18`, `--ink-dark: #F4EDE5` | N/A |
| **Typography class** | Class `typography-money` applied | Font size 17px, weight 600, `font-variant-numeric: tabular-nums` | N/A |
| **Surface class** | Class `surface-soft` applied to an element | Border, rounded corners, and soft shadow applied; no background — inherits from parent | N/A |
| **System mono (barcode)** | Barcode value rendered with `.typography-barcode` | System mono stack (ui-monospace…), 14px, tabular-nums lining-nums | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/index.css` -- Global theme tokens entry point; imports fonts and defines all CSS custom properties, typography classes, and surface treatments
- `frontend/package.json` -- Already declares `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/instrument-sans`; no changes needed
- `frontend/src/main.jsx` -- Entry point; confirms `index.css` is imported (or imported from App.jsx if structure differs)
- `frontend/src/App.css`, `frontend/src/BarcodeScanner.css` -- Existing scaffolding CSS; not modified this story (Story 1.16 retires them)
- `_bmad-output/planning-artifacts/ux-designs/ux-IMPOC-2026-08-20/DESIGN.md` -- Source of truth for all token values and rules

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/index.css` -- Define CSS custom properties at `:root` for all DESIGN.md tokens (colors, spacing, rounded corners); import both @fontsource fonts; define `.typography-*` classes for all roles; define `.surface-flat`, `.surface-soft`, `.surface-glass` classes; add `@media (prefers-color-scheme: dark)` block with all dark-palette overrides -- Ensures every later component can reach the theme, enables dark-mode responders, and pins the design system as the single source of truth
- [x] `frontend/src/main.jsx` or `frontend/src/App.jsx` -- Confirm `index.css` is imported at the app entry point before any component renders -- Ensures theme tokens are available globally at first paint
- [x] Unit test for CSS custom properties -- Write a test that checks the computed `getComputedStyle(document.documentElement)` for a sample of light-mode tokens, then sets `prefers-color-scheme: dark` and confirms dark-mode overrides are applied -- Verifies theme toggle works and both palettes are present

**Acceptance Criteria:**
- Given `index.css` is loaded and `prefers-color-scheme` is `light` (or unset), when a component inspects `getComputedStyle(document.documentElement).getPropertyValue('--primary')`, then it returns `#7B2D4E`
- Given `prefers-color-scheme` is set to `dark` in browser dev tools, when the page reloads, then `--primary` returns `#E48BAB` and all other dark-palette tokens are similarly active
- Given an element has the class `typography-body`, when it is inspected, then computed styles show font family `Instrument Sans`, font size `16px`, font weight `400`, line height `1.5`
- Given an element has the class `surface-soft`, when it is inspected, then computed styles show a `1px solid` border, `14px` border radius (var(--rounded-lg)), and a shadow matching the soft shadow spec
- Given the app is rendered, when the page is inspected in the Elements panel, then `body` has `background: var(--surface-base)` and `color: var(--ink)` applied
- Given a test runs under `@media (prefers-color-scheme: dark)`, then typography classes and surface treatments remain intact and all token values resolve to dark-palette versions
- Given an element with class `typography-money` is inspected, then `font-variant-numeric: tabular-nums` is set
- Given the barcode typography class is inspected, then the font family is a system monospace stack, never a webfont

## Design Notes

**CSS Custom Properties naming:** Token names follow DESIGN.md exactly — `--primary`, `--primary-foreground`, `--status-in-stock`, `--money-held`, etc. — so the spec is both the design file and the implementation reference. Dark-palette variants are suffixed `-dark` (`--primary-dark`, `--surface-raised-dark`), applied inside the `prefers-color-scheme: dark` block without changing the base token name. This keeps selectors clean: a component that wants the active primary always writes `color: var(--primary)`, and the media query handles the swap.

**Font loading:** `@fontsource-variable` packages ship `.woff2` files bundled in the build. Import them at the stylesheet entry point with `@import` rules:
```css
@import '@fontsource-variable/bricolage-grotesque';
@import '@fontsource-variable/instrument-sans';
```
This removes the render-blocking third-party request and puts fonts on the same path as the built app. All typography classes include system font fallback stacks (e.g., `font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`), so content remains readable even if the webfont fails to load.

**Surface treatments aren't backgrounds, and are mutually exclusive.** `.surface-flat`, `.surface-soft`, `.surface-glass` apply border, radius, and shadow; they do not set `background-color` — the component's own background (from a token or inherited) is the ground. Apply exactly one surface class per element; applying multiple surface classes on the same element results in conflicting styles. This allows reuse: a card can be soft over any background, and glass adapts to whatever backdrop it sits over. Apply these classes on the `.surface` element, not the container.

**Barcode typography uses a system mono stack**, not a bundled font: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`. Every modern browser and every phone has a mono font that disambiguates `0`/`O` and `1`/`l`; adding a third webfont just for code values wastes bandwidth at the counter.

**Spacing token names** follow the DESIGN.md: `--spacing-1` through `--spacing-12` (4px–48px), plus `--spacing-gutter-phone`, `--spacing-gutter-wide`, `--spacing-thumb-bar-height`, `--spacing-thumb-safe-bottom`. These are available for layout but are used sparingly in this story itself; most are imported by later frontend stories that build operating screens.

## Verification

**Commands:**
- `npm run test -- --run` -- Runs the token theme test, confirming light-mode and dark-mode values are applied, typography classes carry their styles, and surface treatments render their borders/shadows
- `npm run build` -- Verifies the build succeeds with font imports and CSS custom properties intact; no warnings or errors

**Manual checks (if no CLI):**
- Open DevTools on the running app, go to Elements, right-click the `<html>` or `<body>` element, choose Inspect, and in the Styles panel search for `--primary` — confirm it shows `#7B2D4E` in light mode
- Switch DevTools to dark mode (Rendering tab → Emulate CSS media feature prefers-color-scheme → dark), then search for `--primary` again — confirm it now shows `#E48BAB`
- Hover over an element with the class `typography-heading` — confirm the Styles panel shows `font-family: 'Instrument Sans'`, `font-size: 20px`, `font-weight: 600`
- Hover over an element with the class `surface-soft` — confirm border, radius, and shadow are applied

