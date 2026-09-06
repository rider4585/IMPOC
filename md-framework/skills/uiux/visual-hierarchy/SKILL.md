---
name: visual-hierarchy
version: 1.0.0
description: |
  Direct attention deliberately — size, weight, colour, contrast, position, and
  spacing — so the most important element on a screen is seen first. Use when a
  screen feels flat or cluttered, when users miss something important, or when
  asked "what should stand out here".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Visual Hierarchy

Every screen teaches the eye where to go. If you do not decide the order, the
design decides it for you — usually badly.

**Start by naming the one thing** that must be seen first on this screen. If you
cannot, the screen is doing too much and hierarchy will not save it.

### The tools, ranked by strength

| Tool | Strength | Notes |
|---|---|---|
| **Size** | Strongest | Largest element wins, almost regardless of everything else |
| **Position** | Very strong | Top-left is read first in LTR scanning |
| **Contrast** | Strong | Against the background, not just "bold colour" |
| **Colour** | Strong | Never the *only* signal — see accessibility |
| **Weight** | Moderate | Effective for text emphasis within a block |
| **Whitespace** | Moderate, underused | Isolation draws the eye |
| **Motion** | Overpowering | Reserve for genuinely urgent state only |

**Use one or two, not all.** An element that is bigger, bolder, red, boxed, and
animated is shouting — and when everything shouts, nothing is heard.

### The scanning pattern

Users scan content-heavy screens in an **F-pattern**: across the top, across
again slightly lower, then down the left edge. This is why the primary KPI on a
dashboard belongs top-left, and why a critical alert on the lower right is
frequently missed.

For focused, task-oriented screens (a till, a form), the pattern is closer to a
Z or a straight path down the primary column — place the flow accordingly.

### Levels, not extremes

A usable hierarchy has three or four levels, not two:

```
1  Primary     The one thing        Sale total; Pay button
2  Secondary   Supporting decisions Line items; subtotal
3  Tertiary    Context on demand    Tax breakdown; timestamps
4  Ambient     Present, not read    Labels, metadata, footer
```

Two levels reads as flat; six is noise. Give each level a distinct, consistent
treatment — a hierarchy that varies between screens is not a hierarchy.

### Size in practice

Relative difference is what registers. A type scale with insufficient contrast
between steps produces a flat screen even when the sizes technically differ.

```
Display   32px   the total on a till
Heading   20px   section titles
Body      16px   line items, table cells
Caption   13px   labels, metadata
```

Steps should be visibly distinct — see `typography`.

### Whitespace groups more reliably than borders

Proximity is read as relationship before any line is. Elements close together are
one group; a border between close elements fights that reading.

Group content into visually distinct sections with **whitespace first**, subtle
borders only where a boundary genuinely needs asserting. Dense enterprise tables
are the exception where a light rule earns its place.

### Emphasis costs are cumulative

Every emphasised element reduces the emphasis available to the rest. Screens
degrade over time because each new feature arrives wanting attention.

Practical rule: **one primary action per screen.** Two "primary" buttons means no
primary button. Everything else is secondary or tertiary.

### Retail applications

**Till screen**
- The **total** is the largest text on screen — both staff and customer read it
- **Pay** is the only primary action; void, discount, and hold are secondary
- The current line being added is briefly emphasised so scanning feedback is
  visible without being read
- Errors interrupt; routine confirmations do not

**Inventory table**
- The **identifying column** (product name) carries the most weight
- Quantities right-aligned with tabular numerals — alignment itself creates a
  scannable vertical rhythm
- **Status is emphasis, not decoration**: out-of-stock rows should be findable
  without reading, via colour *and* an icon
- Row actions stay low-emphasis until hovered or selected, or the table becomes a
  wall of buttons

**Dashboard**
- Primary KPI top-left, largest, highest contrast
- Comparisons and trends attached to their number, not in a separate block
- Alerts placed **in the scan path**, not in a corner
- Charts are secondary to the numbers they explain

### Testing it

- **Squint test** — blur your eyes; what remains legible should be the primary
  element. If everything blurs to the same grey, the hierarchy is flat.
- **Five-second test** — show the screen briefly, ask what it was about. If the
  answer is not the primary element, the hierarchy is wrong.
- **Greyscale test** — remove colour. Hierarchy should survive, because for some
  users it already has to.
- **Real device, real lighting** — a subtle contrast difference disappears under
  shop glare.

### Checklist

- [ ] The one primary element on each screen is named
- [ ] Three or four hierarchy levels, applied consistently
- [ ] One or two emphasis tools per element, not five
- [ ] Layout matches the expected scanning pattern
- [ ] Type scale steps visibly distinct
- [ ] Grouping done with whitespace before borders
- [ ] Exactly one primary action per screen
- [ ] Total is the dominant element on the till
- [ ] Table identity column weighted; numerics right-aligned and tabular
- [ ] Status conveyed by colour **and** icon or text
- [ ] Dashboard primary KPI top-left with a comparison attached
- [ ] Alerts placed in the scan path
- [ ] Squint, five-second, and greyscale tests pass
- [ ] Verified on the real device under real lighting

## References

- **Nielsen Norman Group — F-Shaped Pattern For Reading Web Content** — the
  scanning pattern behind placement rules
  <https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/>
- **Nielsen Norman Group — Visual Hierarchy / Gestalt principles of proximity
  and similarity** <https://www.nngroup.com/articles/gestalt-proximity/>
- **Refactoring UI (Adam Wathan & Steve Schoger)** — emphasis by size, weight,
  and contrast; de-emphasising secondary content
  <https://www.refactoringui.com/>
- **Cluster — "Information Hierarchy in Dashboards"** — KPI placement and
  hierarchy in dense data screens
  <https://clusterdesign.io/information-hierarchy-in-dashboards/>
- **Pencil & Paper — enterprise data tables** — alignment as a scanning aid and
  restraint with row-level actions
  <https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables>
- **WCAG 2.2 — SC 1.4.1 Use of Colour, 1.4.3 Contrast**
  <https://www.w3.org/TR/WCAG22/>

**Not sourced — written for this framework:** the tool-strength ranking, the
four-level model, the one-primary-action rule, the retail applications, and the
four tests.
