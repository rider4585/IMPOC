---
name: color-system
version: 1.0.0
description: |
  Build an accessible, semantic colour system — scales, contrast, status colours,
  theming, and data visualisation palettes. Use when defining or extending
  colours, when contrast fails, when status colours are inconsistent, or when
  asked "what colour should this be".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Colour System

Colour carries meaning, and in retail it carries it under bad lighting to people
who may not perceive it the way you do. Design for that first; aesthetics second.

### Build scales, not individual colours

A scale gives you consistent options and makes contrast predictable.

```css
:root {
  --gray-0: #ffffff; --gray-1: #f7f8f9; --gray-2: #eceef1; --gray-3: #dfe3e8;
  --gray-5: #9aa1ab; --gray-6: #6b7280; --gray-8: #2b303b; --gray-9: #111318;

  --blue-1: #eff5ff; --blue-6: #2563eb; --blue-7: #1d4ed8;
  --red-1:  #fef3f2; --red-6:  #d92d20; --red-7:  #b42318;
  --green-1:#ecfdf3; --green-6:#12b76a; --green-7:#039855;
  --amber-1:#fffaeb; --amber-6:#f79009; --amber-7:#dc6803;
}
```

A useful convention: **step 6 is the base**, usable as a solid fill against white
with AA text on it; step 1 is a tint for backgrounds; step 7 is the hover state.
Consistent step meaning across hues makes the system predictable.

Prefer a perceptually uniform space (OKLCH) when generating scales — steps then
feel evenly spaced, which sRGB steps often do not.

### Semantic mapping

Components never reference a hue. See `design-tokens`.

```css
--color-action:  var(--blue-6);
--color-danger:  var(--red-6);
--color-success: var(--green-6);
--color-warning: var(--amber-6);
```

### Contrast is a requirement, not a preference

| Use | Minimum |
|---|---|
| Body text | 4.5:1 |
| Large text (≥ 18.66px bold / 24px) | 3:1 |
| UI boundaries, icons, focus rings | 3:1 |

Verify with a tool. Then verify on the **actual terminal under shop lighting** —
glare eats contrast that passes on a desk, so treat AA as a floor rather than a
target.

The common failure is a brand colour that is beautiful and fails on white. Fix
the colour, not the requirement: keep the brand hue for large areas and use a
darker step for text.

### Never let colour carry meaning alone

Around **5% of users** have a colour vision deficiency, and every user is
glancing rather than studying.

```jsx
// ❌ meaningless in greyscale, and to red-green colour-blind staff
<span style={{ color: 'red' }}>Low</span>

// ✅ colour + icon + text
<span className="status status--low"><WarnIcon aria-hidden="true" /> Low stock</span>
```

Red and green as the only distinction between two states is the single most
common accessibility failure in retail dashboards — and red/green is the most
common deficiency. **Always pair colour with an icon, text, or shape.**

### Status colours in a retail context

| State | Colour | Second channel |
|---|---|---|
| In stock | Green | Check icon or plain text |
| Low stock | Amber | Warning icon + count |
| Out of stock | Red | Cross icon + "Out of stock" |
| Expiring | Amber | Clock icon + date |
| Inactive | Grey | "Inactive" label |

Be consistent across every screen. If amber means "low stock" in a table it
cannot mean "pending" in a dashboard.

**Money is not status.** Do not colour all negative numbers red — a refund is not
an error. Reserve red for problems.

### Theming

- Define the full palette on bare `:root`
- Redefine only what changes under `[data-theme='dark']` and, if supporting
  system preference, `@media (prefers-color-scheme: dark)`
- **Never define a colour only inside a theme block**
- Re-check contrast in **both** themes — a colour passing on white often fails on
  dark

Dark mode is not inversion: pure black on pure white causes halation, and shadows
do not read on dark. Use a very dark grey surface and convey elevation with
lighter surfaces rather than shadows.

### Data visualisation palettes

Charts need a different discipline from UI colour.

- **Categorical** — up to about 8 distinguishable hues; beyond that, group into
  "other". Vary lightness as well as hue so the series survive greyscale.
- **Sequential** — single hue, varying lightness, for magnitude.
- **Diverging** — two hues around a neutral midpoint, for above/below a
  reference.
- **Never rely on hue alone** in a chart: label directly, or vary shape and
  pattern.

Avoid the default rainbow palettes — they are not perceptually uniform and
mislead about magnitude.

### Detection

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b|\brgba?\(" src/ --include=*.jsx --include=*.js | wc -l
grep -rniE "color:\s*(red|green|blue|orange)" src/ --include=*.css
grep -rn "var(--color-" src/ --include=*.css | wc -l
```

Named CSS colours in components are always a finding — they bypass both the scale
and any contrast decision.

### Checklist

- [ ] Colour defined as scales with consistent step meaning
- [ ] Semantic tokens map to the scale; components use semantic names only
- [ ] All text meets 4.5:1; large text and UI boundaries 3:1
- [ ] Contrast verified with a tool and on the real device
- [ ] Nothing conveyed by colour alone
- [ ] Status colours paired with icon or text, consistent across screens
- [ ] Negative money not coloured as an error
- [ ] Full palette on bare `:root`; theme blocks redefine only
- [ ] Contrast re-verified in dark mode
- [ ] Dark mode uses dark grey surfaces, not pure black
- [ ] Chart palettes appropriate to data type and legible in greyscale
- [ ] No named CSS colours or raw hex in components

## References

- **WCAG 2.2 — SC 1.4.1 Use of Colour, 1.4.3 Contrast (Minimum), 1.4.11
  Non-text Contrast** <https://www.w3.org/TR/WCAG22/>
- **WebAIM — Contrast Checker and contrast guidance**
  <https://webaim.org/resources/contrastchecker/>
- **W3C Design Tokens — colour token structure**
  <https://tr.designtokens.org/format/>
- **Material Design 3 — Colour roles and dark theme guidance**
  <https://m3.material.io/styles/color/roles>
- **Cynthia Brewer — ColorBrewer** — sequential, diverging, and categorical
  palettes designed for perceptual accuracy <https://colorbrewer2.org/>
- **Agente Studio — POS design principles** — store lighting and the ~5% visual
  impairment figure <https://agentestudio.com/blog/design-principles-pos-interface>

**Not sourced — written for this framework:** the step-6-is-base convention, the
retail status colour table, the money-is-not-status rule, and the detection
commands.
