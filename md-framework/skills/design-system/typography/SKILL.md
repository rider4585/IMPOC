---
name: typography
version: 1.0.0
description: |
  Define a type system — scale, weights, line height, measure, and the numeric
  settings that matter for money and data. Use when setting up typography, when
  text is hard to read or hierarchy is flat, or when asked "what size should this
  text be".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Typography

Most of an interface is text. In a retail system, most of that text is **numbers
being compared** — which changes the priorities from a content site.

### A scale with visible steps

Adjacent sizes must be distinguishable, or hierarchy collapses. A ratio of about
1.2–1.25 works for dense interfaces; larger ratios suit editorial content.

```css
:root {
  --font-size-xs:   0.75rem;   /* 12px — dense table metadata */
  --font-size-sm:   0.8125rem; /* 13px — labels, captions */
  --font-size-base: 1rem;      /* 16px — body, table cells */
  --font-size-lg:   1.125rem;  /* 18px — emphasised values */
  --font-size-xl:   1.25rem;   /* 20px — section headings */
  --font-size-2xl:  1.5rem;    /* 24px — page titles */
  --font-size-3xl:  2rem;      /* 32px — the till total */
}
```

**Use `rem`, never `px`.** Pixel sizing ignores the user's browser font setting,
which is an accessibility failure (WCAG 1.4.4).

**16px minimum for body text.** Below that, reading degrades quickly — and on
mobile Safari, inputs under 16px trigger an automatic zoom on focus, which is
disruptive on a scanning workflow.

### Weights — three, not seven

```css
--font-weight-regular: 400;
--font-weight-medium:  500;   /* labels, table headers, emphasis */
--font-weight-bold:    700;   /* the total, primary headings */
```

Variable fonts make every weight available, which is a trap: more weights make
hierarchy muddier, not richer. Three is enough for any interface.

Avoid weights below 400 for body text — thin weights fail under glare and at low
contrast.

### Line height and measure

| Content | Line height |
|---|---|
| Large headings | 1.1–1.2 |
| Body text | 1.5 |
| Dense table rows | 1.3–1.4 |
| Single-line labels | 1 |

**Measure (line length): 45–75 characters.** Longer and the eye loses its place
returning to the next line. Constrain long-form text with `max-width: 65ch`;
tables are exempt.

### Numeric settings — the part that matters most here

```css
.money, .quantity, td.numeric {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

**Tabular numerals give every digit the same width.** Without them, columns of
figures do not align and a changing total jitters as digits change — which on a
till is both distracting and a mis-tap risk.

Combined with right alignment, this is what makes a column of quantities
scannable for outliers. See `ui-design`.

For a variable font, also consider `font-feature-settings: 'ss01'` or similar if
the family provides a clearer zero or a slashed zero — distinguishing `0` from
`O` matters in SKUs.

### Font loading

The project self-hosts variable fonts via `@fontsource`. Keep it that way — no
third-party request on every load, and no privacy exposure.

```css
:root {
  --font-sans:    'Instrument Sans Variable', system-ui, -apple-system, sans-serif;
  --font-display: 'Bricolage Grotesque Variable', var(--font-sans);
  --font-mono:    ui-monospace, 'SF Mono', Menlo, monospace;
}
```

- **Always provide a fallback stack.** A font that fails to load should degrade,
  not disappear.
- `font-display: swap` so text renders before the font arrives.
- Load only the weights and subsets actually used — shipping every weight of a
  variable font is avoidable bytes on shop wifi.
- Preload the primary face if it is above the fold.

### Applying it

| Element | Size | Weight | Notes |
|---|---|---|---|
| Till total | 3xl | bold | Largest thing on the screen |
| Page title | 2xl | bold | |
| Section heading | xl | medium | |
| Table header | sm | medium | Uppercase optional, letter-spaced if so |
| Table cell | base | regular | Numerics tabular, right-aligned |
| Body | base | regular | 1.5 line height, ≤ 75ch |
| Label | sm | medium | |
| Caption / metadata | xs | regular | Muted colour, still ≥ 4.5:1 |

### Readability under real conditions

- **Never rely on letter case alone** for meaning; all-caps hurts readability in
  running text, so reserve it for short labels.
- **Avoid italics** for anything important — they render poorly at small sizes on
  low-DPI terminals.
- **Do not centre body text**; centre only short headings.
- **Truncate with care.** A truncated product name is a usability problem in a
  picking workflow; wrap where the space allows, and always provide the full
  value on hover and to assistive technology.

Long product names are the most common cause of broken retail layouts — design
for them explicitly.

### Detection

```bash
grep -rnE "font-size:\s*[0-9]+px" src/ --include=*.css        # px instead of rem
grep -rn "tabular-nums" src/ --include=*.css                   # should exist
grep -rnE "font-weight:\s*[0-9]{3}" src/ --include=*.css | grep -v "var(--"
grep -rn "text-transform: *uppercase" src/ --include=*.css
```

### Checklist

- [ ] Scale defined with visibly distinct steps
- [ ] Sizes in `rem`, never `px`
- [ ] Body text ≥ 16px; inputs ≥ 16px to avoid mobile zoom
- [ ] Three weights, not more; nothing below 400 for body
- [ ] Line heights set per content type
- [ ] Measure constrained to ~45–75 characters for prose
- [ ] Tabular numerals on all money and quantity values
- [ ] Numeric columns right-aligned
- [ ] Fonts self-hosted with full fallback stacks
- [ ] `font-display: swap`; only needed weights loaded
- [ ] No italics or all-caps carrying meaning
- [ ] Long product names wrap or truncate with the full value available
- [ ] Muted text still meets 4.5:1

## References

- **MDN — `font-variant-numeric`, `font-display`, CSS values and units**
  <https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric>
- **WCAG 2.2 — SC 1.4.4 Resize Text, 1.4.12 Text Spacing, 1.4.8 Visual
  Presentation** <https://www.w3.org/TR/WCAG22/>
- **Butterick's Practical Typography** — measure, line height, and restraint in
  weights <https://practicaltypography.com/>
- **Material Design 3 — Type scale**
  <https://m3.material.io/styles/typography/type-scale-tokens>
- **Pencil & Paper — enterprise data tables** — monospace/tabular figures for
  numeric columns
  <https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables>

**Not sourced — written for this framework:** the retail application table, the
tabular-numerals-on-money requirement, the long-product-name guidance, and the
detection commands.
