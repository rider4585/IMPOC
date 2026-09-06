---
name: spacing-system
version: 1.0.0
description: |
  Define a spacing scale and apply it consistently — rhythm, grouping by
  proximity, density modes, and touch target spacing. Use when spacing looks
  inconsistent, when a screen feels cramped or loose, or when asked "how much
  space should go here".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Spacing System

Spacing is how an interface communicates structure. Inconsistent spacing reads as
carelessness even when nothing else is wrong, and it is the most common source of
visual drift as an application grows.

### One scale, used everywhere

```css
:root {
  --space-0:  0;
  --space-1:  0.25rem;   /*  4px */
  --space-2:  0.5rem;    /*  8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-5:  1.5rem;    /* 24px */
  --space-6:  2rem;      /* 32px */
  --space-7:  3rem;      /* 48px */
  --space-8:  4rem;      /* 64px */
}
```

A 4px base with roughly geometric growth gives enough options without inviting
arbitrary values. **Every padding, margin, and gap comes from this scale** — no
exceptions, because one `13px` becomes twenty.

Use `rem` so spacing scales with the user's font size.

### Proximity communicates grouping

Related elements sit close; unrelated elements sit apart. This is read before any
border or background.

```
Label            ← space-1 to its input: they are one thing
Input
                 ← space-5 to the next field group: separate things
Label
Input
```

The most common spacing bug is **equal space above and below a label**, which
makes it ambiguous which input it belongs to. Space below a label should be
noticeably smaller than the space above it.

Group with whitespace first; add a border only where a boundary genuinely needs
asserting — see `visual-hierarchy`.

### Consistent application

| Relationship | Spacing |
|---|---|
| Label → its control | `--space-1` |
| Between form fields | `--space-5` |
| Inside a card or panel | `--space-4` or `--space-5` |
| Between cards | `--space-4` |
| Between page sections | `--space-6` / `--space-7` |
| Table cell padding | `--space-3` horizontal, density-dependent vertical |
| Between icon and its label | `--space-2` |
| Between adjacent buttons | `--space-3` minimum, more when one is destructive |

Same relationship, same value, everywhere. If cards are `--space-4` apart on one
screen they are `--space-4` apart on all of them.

### Density modes

Retail screens need different densities for different work. Offer them rather
than compromising on one.

```css
[data-density='compact']  { --row-padding-y: var(--space-2); }  /* ~40px rows */
[data-density='default']  { --row-padding-y: var(--space-3); }  /* ~48px rows */
[data-density='relaxed']  { --row-padding-y: var(--space-4); }  /* ~56px rows */
```

Roughly 40 / 48 / 56 px row heights are the conventional three. Let the user
choose and remember the choice — a stock manager scanning hundreds of rows wants
compact; a cashier on a touch terminal does not.

**Density affects spacing, never touch targets.** A compact table on a touch
device still needs 44 px hit areas — grow the tap target beyond the visual row if
necessary.

### Touch spacing

Adjacent targets need space between them, not just adequate size. Two 44 px
buttons touching are still easy to mis-tap at speed.

- **Minimum `--space-3` between adjacent touch targets**
- **More around destructive actions** — separate "remove line" from "pay" by
  enough that a fast mis-tap cannot reach it
- Edge padding so targets are not flush against a bezel

### Vertical rhythm

Keep vertical spacing on the scale so elements align across columns. Where two
panels sit side by side, their internal spacing should match or their content
will not line up — a subtle but persistent source of "something looks off".

### Layout spacing

Use `gap` rather than margins for flex and grid layouts. Gaps do not collapse, do
not need last-child overrides, and keep spacing owned by the container rather
than scattered across children.

```css
.toolbar { display: flex; gap: var(--space-3); align-items: center; }
```

### Detection

```bash
grep -rnE "(margin|padding|gap):[^;]*[0-9]+px" src/ --include=*.css | grep -v "var(--" | wc -l
grep -rnE "(margin|padding|gap):[^;]*var\(--space" src/ --include=*.css | wc -l
grep -rnE "style=\{\{[^}]*(margin|padding)" src/ --include=*.jsx
grep -rn "margin-bottom" src/ --include=*.css | wc -l     # candidates for gap
```

The ratio of the first two counts is the adoption metric — see
`design-system-audit`.

### Checklist

- [ ] Single spacing scale defined in `rem`
- [ ] Every padding, margin, and gap drawn from the scale
- [ ] No arbitrary pixel values
- [ ] No inline spacing styles in components
- [ ] Proximity used to group; label spacing unambiguous
- [ ] Same relationship spaced identically across screens
- [ ] Density modes offered where tables are dense
- [ ] User density preference remembered
- [ ] Touch targets ≥ 44 px regardless of density
- [ ] Minimum spacing between adjacent touch targets
- [ ] Extra separation around destructive actions
- [ ] `gap` used instead of child margins in flex and grid
- [ ] Adoption measured

## References

- **MDN — CSS box model, `gap`, and logical properties**
  <https://developer.mozilla.org/en-US/docs/Web/CSS/gap>
- **W3C Design Tokens — dimension tokens**
  <https://tr.designtokens.org/format/>
- **Nielsen Norman Group — Gestalt principle of proximity**
  <https://www.nngroup.com/articles/gestalt-proximity/>
- **Pencil & Paper — enterprise data tables** — the 40 / 48 / 56 px density
  options and user-controlled density
  <https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables>
- **WCAG 2.2 — SC 2.5.8 Target Size (Minimum)**
  <https://www.w3.org/TR/WCAG22/#target-size-minimum>

**Not sourced — written for this framework:** the relationship-to-spacing table,
the label-proximity rule, the density-never-shrinks-touch-targets rule, the
destructive-action separation, and the detection commands.
