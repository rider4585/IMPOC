---
name: ui-design
version: 1.0.0
description: |
  Compose screens for retail software — POS/till layouts, inventory data tables,
  and dashboards — covering layout zones, density, touch sizing, and error
  prevention. Use when designing or reviewing any screen, when a screen feels
  cluttered or slow to use, or when asked "how should this screen be laid out".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## UI Design

Composing a screen: what goes where, at what density, with what affordances.
`visual-hierarchy` covers directing attention within that composition;
`design-review` covers evaluating the result.

The three screen archetypes in this system have genuinely different rules. Design
each as what it is.

---

## 1. The till / POS screen

The hot path. It is used hundreds of times a shift by someone who has stopped
reading the interface.

### Consistency outranks improvement

After two to three weeks of daily use, operators run on **conditioned muscle
memory**; undoing an automated gesture requires conscious override, which is slow
and error-prone under pressure. Moving a button to a better position is a
regression for existing staff even when it is objectively better placed.

Keep controls in the same position across every screen. Change them only with a
deliberate decision and a retraining plan.

### Zones

A stable three-zone layout, in the same place every time:

```
┌──────────────────────────────┬──────────────────┐
│  PRODUCT ENTRY               │  CURRENT SALE    │
│  scan field (always focused) │  line items      │
│  category / quick-pick grid  │  (scrollable)    │
│                              │                  │
│                              ├──────────────────┤
│                              │  TOTALS          │
│                              │  subtotal/tax    │
│                              │  TOTAL (largest) │
│                              ├──────────────────┤
│                              │  PAY  (primary)  │
└──────────────────────────────┴──────────────────┘
```

- **The scan field holds focus by default** and returns to it after every action.
  A scanner firing into an unfocused field loses the input.
- **The total is the largest element on the screen** — it is what both staff and
  customer look at.
- **Pay is the single visually dominant action.** Everything else is secondary.

### Touch sizing under real conditions

- Minimum 44×44 px; **larger for Pay, and for anything used at speed**
- **Generous spacing between adjacent targets**, especially where a mis-tap is
  destructive — "remove line" next to "change quantity" is a design defect
- **Visible press feedback** on every button; on a resistive or laggy terminal,
  the operator must know the tap registered or they will tap again
- Design for imprecise input — gloves, wet hands, speed

### Environment

Shop lighting is uncontrolled and often harsh. Contrast that passes at a desk may
fail under glare, so treat WCAG AA as a floor rather than a target. Around 5% of
users have a visual impairment affecting colour perception — never let colour
alone carry meaning.

### Error prevention over confirmation

Confirm only what is destructive or financial: void, refund, discount override,
delete. Confirming routine actions trains operators to dismiss dialogs without
reading, which destroys the value of the confirmations that matter.

Prefer designs where the error cannot occur: disable Pay until a payment method
is chosen, cap discount input at its allowed range, make quantity require an
explicit change rather than being editable by accident.

### Multiple paths to the same product

Scanning is primary, but not always possible — a damaged barcode, a loose item, a
weighted good. Provide search by name and SKU, a quick-pick grid for
fast-movers, and recent items. The fallback path must be fast, not merely
present.

---

## 2. Inventory tables

Dense, functional, scanned rather than read.

### Density and alignment

| Aspect | Rule |
|---|---|
| Row height | Offer density options — roughly 40 / 48 / 56 px, user-selectable |
| Text columns | Left-aligned |
| Numeric columns | **Right-aligned, tabular numerals** so digits line up for comparison |
| Dates, phone, SKU | Left-aligned — read as labels, not quantities |
| Headers | Aligned to their column's content |
| Separators | Minimal; 1px light rule, or none |

Right-aligned tabular numerals on stock and money columns is the single highest
-value table decision — it makes scanning a column for an outlier possible.

### Structure

- **Sticky header** so column meaning survives scrolling
- **Freeze the identifying column** (product name) during horizontal scroll
- **Sort by what needs attention**, not alphabetically: low stock first, recent
  movements first
- **Do not repeat a unit in every cell** — put "₹" or "units" in the header

### Actions

- **Row actions revealed on hover** (or always visible on touch) rather than a
  button in every row — dense tables become unreadable when every row carries a
  toolbar
- **Bulk selection via checkboxes**, with a toolbar appearing once rows are
  selected: adjust, export, tag, deactivate
- **Inline editing** for low-stakes fields; a modal or side panel for
  high-stakes ones (price, cost) where a confirmation step is warranted
- **Barcode scanning and bulk import** as first-class entry paths — typing SKUs is
  the slow path

### Status

Colour-code stock status, **always paired with an icon or text**: out of stock,
low, expiring, inactive. This is what makes a table scannable at a glance, and
the pairing is what keeps it usable for colour-blind staff.

### State

Remember the user's density, column, sort, and filter choices between sessions,
and offer a reset. Filters belong in the URL so a view can be shared — see
`state-management`.

---

## 3. Dashboards

Read briefly, repeatedly, to decide whether anything needs attention.

### Limit the metric count

Working memory holds roughly **five to nine** items. Dashboards past about twelve
KPIs show a marked drop in engagement, and information overload is the most
prevalent dashboard problem reported in the research literature.

**Five to nine metrics per screen.** More than that, and split into separate
views or use progressive disclosure.

### Place by scanning pattern

Users scan in an **F-pattern**: top-left, across, then down the left side.

- **Primary KPI top-left**, largest and highest contrast
- Secondary metrics top-right, medium emphasis
- Detail and supporting charts below
- Filters and controls above the content they affect

### Match the chart to the question

| Question | Chart |
|---|---|
| How has this changed over time? | Line |
| How do these compare? | Bar |
| What is the composition? | Stacked bar; pie only for very few slices |
| Where is intensity concentrated? | Heatmap |
| What is the single current value? | Big number, with trend and comparison |

A number without a comparison is not information. "Sales today ₹42,310" means
nothing; "₹42,310, +12% vs last Tuesday" is a decision input.

### Progressive disclosure

Show the summary; make the detail available on demand. A dashboard is a
launching point, not a report — link each metric to the view that explains it.

---

## Checklist

- [ ] Screen archetype identified — till, table, or dashboard
- [ ] Till: control positions stable across screens; changes deliberate
- [ ] Till: scan field focused by default and refocused after actions
- [ ] Till: total is the largest element; Pay visually dominant
- [ ] Touch targets ≥ 44 px, larger for primary actions, well separated
- [ ] Destructive actions not adjacent to frequent ones
- [ ] Visible press feedback on all controls
- [ ] Contrast tested for shop lighting; colour never the sole signal
- [ ] Confirmations only for destructive or financial actions
- [ ] Errors designed out where possible, not just caught
- [ ] Alternative product lookup paths provided and fast
- [ ] Tables: numeric columns right-aligned with tabular numerals
- [ ] Tables: sticky header, frozen identity column, meaningful default sort
- [ ] Tables: row actions on demand; bulk selection with a contextual toolbar
- [ ] Tables: status colour paired with icon or text
- [ ] Tables: user preferences persisted; filters in the URL
- [ ] Dashboards: 5–9 metrics; primary KPI top-left
- [ ] Dashboards: every number carries a comparison
- [ ] Dashboards: chart type matches the question
- [ ] Progressive disclosure rather than showing everything

## References

- **Agente Studio — "POS Interface Design Principles"** — simplicity, consistent
  control positions, fat-finger targets with press feedback, variable store
  lighting, the ~5% visual impairment figure, and confirming only where critical
  <https://agentestudio.com/blog/design-principles-pos-interface>
- **Creative Navy — "The Design Principles of the POS System"** — operator
  conditioning after 2–3 weeks of daily use, and why changing control positions
  requires conscious override
  <https://medium.com/uxjournal/the-design-principles-in-the-pos-system-pos-design-guide-part-2-57d1bcb30ac0>
- **Shopify — "POS System Design: Principles for Retailers"** — touch target
  spacing and reducing steps per transaction
  <https://www.shopify.com/blog/pos-system-design>
- **Pencil & Paper — "Data Table Design UX Patterns & Best Practices"** — density
  options (40/48/56 px), alignment rules, sticky headers, column freezing,
  hover-revealed actions, multi-select, inline vs modal editing, state
  preservation
  <https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables>
- **Justinmind — "Designing effective data table UI"** — bulk action toolbars and
  selection patterns <https://www.justinmind.com/ui-design/data-table>
- **Improvado / UX Pilot / Cluster — dashboard design guides** — the 5–9 metric
  limit, F-pattern scanning, primary KPI placement, progressive disclosure, and
  the information-overload prevalence finding
  <https://improvado.io/blog/dashboard-design-guide> ·
  <https://clusterdesign.io/information-hierarchy-in-dashboards/>
- **WCAG 2.2 — SC 1.4.3 Contrast, 1.4.1 Use of Colour, 2.5.8 Target Size**
  <https://www.w3.org/TR/WCAG22/>

**Not sourced — written for this framework:** the three-archetype split, the till
zone diagram, the scan-field focus rule, the destructive-adjacency rule, and the
requirement that every dashboard number carry a comparison.
