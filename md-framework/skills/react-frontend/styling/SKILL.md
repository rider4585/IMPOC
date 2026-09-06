---
name: styling
version: 1.0.0
description: |
  Style React applications with a token-driven approach that survives changes of
  CSS tooling — custom properties, scoping, theming, and where a utility
  framework or component library fits. Use when styling a component, setting up
  or changing the CSS approach, fixing visual inconsistency, or when asked "how
  should this be styled".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Styling

The tooling changes; the discipline does not. Everything here is written so that
adopting a utility framework or component library **adds a row**, rather than
invalidating the approach.

> **Current setup:** plain CSS with custom properties and `@fontsource` variable
> fonts. **Planned:** Tailwind and shadcn/ui, plus additional UI, font, and icon
> libraries. Both are covered below.

### Tokens are the stable layer

Define design decisions once, as CSS custom properties. This layer is the
constant — every tool listed below either reads it or can be configured to.

```css
:root {
  /* primitives — raw values, no meaning */
  --gray-0: #ffffff;  --gray-9: #111318;
  --red-6: #d92d20;   --green-6: #12b76a;

  /* semantic — what the value is FOR. Components use only these. */
  --color-surface: var(--gray-0);
  --color-text: var(--gray-9);
  --color-danger: var(--red-6);
  --color-success: var(--green-6);

  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem; --space-4: 1rem;
  --radius-md: 0.5rem;
  --font-sans: 'Instrument Sans Variable', system-ui, sans-serif;
  --font-display: 'Bricolage Grotesque Variable', var(--font-sans);
}

[data-theme='dark'] {
  --color-surface: var(--gray-9);
  --color-text: var(--gray-0);
}
```

Two rules make this work:

1. **Components reference semantic tokens only**, never primitives and never raw
   values. `var(--color-danger)`, not `var(--red-6)` and never `#d92d20`.
2. **Theming happens by redefining tokens**, not by conditional styles in
   components. Dark mode then costs one block, not a change per component.

A scale is only useful if it is used. One-off values are the drift measured in
`project-design-system`.

### Where each tool fits

| Approach | Best for | Watch for |
|---|---|---|
| **Plain CSS + custom properties** | Any project; the token layer itself | Global scope — needs a naming convention |
| **CSS Modules** | Component-scoped styles without a framework | Composition across files |
| **Utility framework** (Tailwind) | Fast, consistent spacing/colour from a scale | Arbitrary values (`p-[13px]`) reintroduce drift |
| **Component library** (shadcn/ui, MUI) | Accessible primitives, faster delivery | Theme must map to *your* tokens, not fork them |
| **CSS-in-JS runtime** | Highly dynamic styling | Runtime cost; prefer custom properties for dynamism |

**When adopting a utility framework:** point its theme at the existing custom
properties rather than duplicating the scale. Two sources of truth for colour is
worse than either alone.

**When adopting a component library:** shadcn/ui copies components into your
repo, so they become yours to maintain — a real advantage, and a real
responsibility. Map its CSS variables to your semantic tokens on day one, before
components accumulate.

### Scope styles

Global CSS collides as an application grows. Scope by CSS Modules, a utility
framework, or a strict naming convention (BEM) — pick one and apply it
consistently. Reserve genuinely global CSS for resets, tokens, and typography
base.

### Do not style with dynamic values in JS

```jsx
// ❌ recomputed inline, unstyleable by theme, bypasses tokens
<div style={{ color: isLow ? '#d92d20' : '#12b76a' }} />

// ✅ state as data, styling in CSS
<div className="stock-badge" data-state={isLow ? 'low' : 'ok'} />
```
```css
.stock-badge[data-state='low'] { color: var(--color-danger); }
```

Genuinely dynamic values (a progress width, a chart bar) are the exception — pass
them as custom properties: `style={{ '--fill': `${pct}%` }}`.

### Interaction states are part of the component

Every interactive element needs default, hover, **focus-visible**, active,
disabled, and where relevant loading and error. Missing focus styles are an
accessibility defect, not a cosmetic one.

```css
.button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

Never remove focus outlines without an equivalent replacement.

### Fonts and icons

- **Self-host fonts** (as `@fontsource` does) — no third-party request on every
  page load, and no privacy exposure.
- Always give a **fallback stack**; a variable font that fails to load should
  degrade, not disappear.
- Use `font-display: swap` so text renders before the font arrives.
- **Import icons individually**, never a whole icon set — a full pack in the
  bundle is dead weight. Decorative icons need `aria-hidden="true"`; meaningful
  ones need an accessible label.

### Retail specifics

- **Till screens are touch targets.** Minimum 44×44 px hit areas; larger for
  primary checkout actions.
- **High contrast under shop lighting.** Meet WCAG AA (4.5:1) as a floor, not a
  target — a screen readable at a desk may not be readable under fluorescent
  glare.
- **Money must not shift layout.** Use tabular numerals (`font-variant-numeric:
  tabular-nums`) so totals do not jitter as digits change.
- **Never rely on colour alone** to signal low stock or an error — pair it with
  an icon or text.

### Detection

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b|\brgba?\(" src/ --include=*.jsx --include=*.js | wc -l
grep -rn "style={{" src/ --include=*.jsx | wc -l
grep -rnE ":\s*[0-9]+px" src/ --include=*.css | wc -l
grep -rn "outline: *none\|outline: *0" src/ --include=*.css
grep -rn "var(--" src/ --include=*.css | wc -l
```

The ratio of the last count to the first three is the health metric: high token
usage with few raw values means the system is real.

### Checklist

- [ ] Semantic tokens defined over primitives; components use semantic only
- [ ] No raw colour or spacing values in components
- [ ] Theming by token redefinition, not per-component conditionals
- [ ] Styles scoped; global CSS limited to reset, tokens, typography
- [ ] State expressed as data attributes, styled in CSS
- [ ] `:focus-visible` styles present; outlines never removed bare
- [ ] All interaction states covered
- [ ] Fonts self-hosted with fallback stacks and `font-display: swap`
- [ ] Icons imported individually; decorative ones `aria-hidden`
- [ ] Touch targets ≥ 44 px on till screens
- [ ] Contrast meets WCAG AA as a floor
- [ ] Tabular numerals on money
- [ ] Colour never the sole signal
- [ ] Any adopted framework points at existing tokens, not a parallel scale

## References

- **MDN — Using CSS custom properties** — the stack-independent token layer
  <https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties>
- **W3C Design Tokens Community Group format specification** — primitive vs
  semantic distinction <https://tr.designtokens.org/format/>
- **WCAG 2.2 — SC 1.4.3 Contrast, 1.4.1 Use of Colour, 2.4.7 Focus Visible,
  2.5.8 Target Size** <https://www.w3.org/TR/WCAG22/>
- **MDN — `:focus-visible`, `font-display`, `font-variant-numeric`**
  <https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible>
- **Tailwind CSS — Theme** — mapping a utility framework onto existing tokens
  <https://tailwindcss.com/docs/theme>
- **shadcn/ui — Theming** — CSS-variable convention and the copy-in model
  <https://ui.shadcn.com/docs/theming>

**Not sourced — written for this framework:** the tool-fit table, the
adopt-by-pointing-at-existing-tokens rule, the retail requirements (till targets,
tabular numerals, shop lighting), and the detection commands.
