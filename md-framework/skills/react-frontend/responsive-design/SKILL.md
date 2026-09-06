---
name: responsive-design
version: 1.0.0
description: |
  Build layouts that adapt across phones, tablets, till screens, and desktops —
  fluid layout, breakpoints, container queries, touch targets, and testing across
  viewports. Shared by frontend and UI/UX agents. Use when building any layout,
  when something breaks at a viewport size, or when asked "how should this behave
  on mobile".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Responsive Design

Responsive means the layout responds to the space available — not that there are
two hand-built designs. Aim for one layout that adapts, with breakpoints only
where content genuinely demands a different arrangement.

### Know the real devices

Generic breakpoints are a starting point, not a specification. For a retail
system the devices are specific and unusual:

| Context | Typical | Constraints |
|---|---|---|
| Till / POS terminal | 1024–1920, often landscape, **touch** | Large targets, glare, gloved or fast use |
| Handheld scanner / phone | 360–430 | One-handed, portrait, often the stock-take device |
| Tablet | 768–1024, either orientation | Doubles as a mobile till |
| Back-office desktop | 1440+ | Dense tables, keyboard-driven |

A till is a *large touch screen* — wide viewport, but with mobile interaction
rules. Sizing targets by viewport width gets this exactly wrong. Confirm the
actual hardware rather than assuming; record it in
`project-design-system`.

### Fluid first, breakpoints second

Most layouts should adapt without any media query.

```css
/* Adapts continuously; wraps when it must. No breakpoints needed. */
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: var(--space-4);
}

/* Fluid type between a floor and a ceiling */
.page-title { font-size: clamp(1.25rem, 1rem + 1.5vw, 2rem); }
```

`minmax`, `auto-fit`/`auto-fill`, `clamp()`, and `min()`/`max()` remove most
breakpoints. Add a media query only when the **arrangement** must change — a
sidebar becoming a drawer — not merely because something is a bit narrow.

### Mobile-first breakpoints

```css
.layout { display: block; }                        /* base = smallest */
@media (min-width: 48rem) { .layout { display: grid; grid-template-columns: 16rem 1fr; } }
@media (min-width: 80rem) { .layout { grid-template-columns: 18rem 1fr 20rem; } }
```

Use `min-width` and build up. Starting desktop-first means every small screen
carries overrides, and the smallest devices get the most CSS.

Use `rem`, not `px`, so layout respects the user's font size setting.

### Container queries for components

A component reused in a sidebar and a full-width page should respond to **its
own** space, not the viewport.

```css
.card-list { container-type: inline-size; }

@container (min-width: 30rem) {
  .card { display: grid; grid-template-columns: auto 1fr; }
}
```

This is the correct tool for a design system — the component becomes genuinely
portable instead of assuming where it sits.

### Touch and pointer

Do not infer input type from width. A till is wide *and* touch.

```css
@media (pointer: coarse) {
  .button { min-height: 2.75rem; min-width: 2.75rem; }   /* 44px */
}
@media (hover: hover) {
  .row:hover { background: var(--color-surface-hover); }
}
```

- **44×44 px minimum** touch targets, with spacing between them; larger for
  primary checkout actions.
- **Hover-only affordances fail on touch.** If information appears only on hover,
  touch users never see it. Provide a tap path.
- Guard `:hover` styles behind `@media (hover: hover)` so they do not stick after
  a tap.

### Tables on small screens

Dense tables are the hardest responsive problem in an admin app. Options, in
order of preference:

1. **Show fewer columns** at small sizes — keep the ones that identify and decide
2. **Card per row** below a breakpoint
3. **Horizontally scroll the table only**, never the page, with the key column
   sticky

Never shrink text until a table fits. Never let the page itself scroll
horizontally.

### The layout traps

- **Viewport units and mobile browser chrome.** `100vh` overflows on mobile as
  the toolbar hides. Use `100dvh`.
- **Images without dimensions** cause layout shift — always set `width`/`height`
  or an `aspect-ratio`.
- **Long unbroken strings** (SKUs, barcodes, emails) overflow. Use
  `overflow-wrap: anywhere` on data cells.
- **Fixed-position bars and the on-screen keyboard** — a sticky checkout bar can
  cover the field being typed into.
- **Safe areas** on notched devices: `padding: env(safe-area-inset-bottom)`.
- **Orientation.** A tablet till gets rotated; test both.

### Test at real sizes

```bash
# In the browser: check no horizontal overflow at the narrowest target
document.querySelectorAll('*').forEach(el => {
  if (el.scrollWidth > document.documentElement.clientWidth)
    console.warn('overflows:', el);
});
```

Test at 320 px (narrowest realistic), the actual till resolution, and with
browser zoom at 200% — WCAG requires content to remain usable at that zoom, and
it catches fixed-width layouts that pixel testing misses.

### Detection

```bash
grep -rnE "@media" src/ --include=*.css | wc -l
grep -rnE "max-width:" src/ --include=*.css | wc -l        # desktop-first residue
grep -rnE "[0-9]+px" src/ --include=*.css | wc -l          # fixed sizing
grep -rn "100vh" src/ --include=*.css                      # should be 100dvh
grep -rn "container-type\|@container" src/ --include=*.css
grep -rn ":hover" src/ --include=*.css | wc -l
```

### Checklist

- [ ] Real target devices identified and recorded, not assumed
- [ ] Layout fluid by default; breakpoints only where arrangement changes
- [ ] Mobile-first `min-width` queries
- [ ] `rem` units so user font settings are respected
- [ ] Container queries used for reusable components
- [ ] Touch targets ≥ 44 px where pointer is coarse
- [ ] No information available only on hover
- [ ] Hover styles guarded by `@media (hover: hover)`
- [ ] Tables degrade by dropping columns or becoming cards; page never scrolls sideways
- [ ] `100dvh` instead of `100vh`
- [ ] Images have dimensions or `aspect-ratio`
- [ ] Long identifiers wrap
- [ ] Safe-area insets handled
- [ ] Tested at 320 px, real till resolution, both orientations, and 200% zoom

## References

- **MDN — Responsive design, media queries, container queries**
  <https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design>
- **MDN — `clamp()`, `minmax()`, `dvh` units**
  <https://developer.mozilla.org/en-US/docs/Web/CSS/clamp>
- **MDN — `@media (pointer)` and `(hover)` interaction media features**
  <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer>
- **WCAG 2.2 — SC 1.4.10 Reflow, 1.4.4 Resize Text, 2.5.8 Target Size**
  <https://www.w3.org/TR/WCAG22/#reflow>
- **web.dev — Cumulative Layout Shift** <https://web.dev/articles/cls>

**Not sourced — written for this framework:** the retail device table and the
"a till is a large touch screen" rule, the table-degradation ordering, the layout
traps list, and the detection commands.
