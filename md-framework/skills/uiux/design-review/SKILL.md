---
name: design-review
version: 1.0.0
description: |
  Evaluate a design or an implemented screen against usability, accessibility,
  hierarchy, and retail-context criteria, and issue findings with a verdict. Use
  as the design lane of a review gate, when reviewing a mockup or a built screen,
  or when asked "is this design any good".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Design Review

Evaluate against criteria, not taste. "I don't like it" is not a finding; "the
destructive action sits 6 px from the most-used control" is.

Report findings and a verdict. Do not redesign — that is the designer's job, and
mixing the two makes the review unreviewable.

### Before reviewing

Establish what the screen is **for** and who uses it, in what conditions. A
review without that context defaults to aesthetics.

- What task does this screen serve?
- Who uses it — role, expertise, frequency?
- On what device, in what environment?
- What is the one thing that must be obvious?

### The lanes

**1. Purpose and hierarchy**
- Is the primary element identifiable in the squint test?
- Exactly one primary action?
- Do the emphasis levels match actual importance?
- Does the layout match the expected scanning pattern?

**2. Task efficiency**
- How many interactions does the primary task take? Count them.
- Can steps be removed or defaulted?
- Are frequent actions reachable without navigation?
- Is there a fast path *and* a fallback path (scan, and search when it fails)?

*Counting taps for the primary task is the highest-value measurement in this
review.* On a till, one extra tap is thousands per month.

**3. Consistency**
- Do controls sit where they sit on other screens?
- Same patterns for the same concepts across the app?
- Does it match the design system, or introduce a variant? — see
  `component-consistency`
- **Would this change break existing operators' muscle memory?** Conditioned
  users need a deliberate decision and a retraining plan, not a silent
  improvement.

**4. Touch and input**
- Targets ≥ 44 px, larger for primary actions?
- Adequate spacing, especially around destructive actions?
- Visible press feedback?
- Keyboard and scanner paths work; focus lands where expected?

**5. Accessibility**
- Contrast meets WCAG AA (4.5:1 text, 3:1 UI boundaries)?
- Does anything rely on colour alone?
- Real semantic elements — buttons, labels, headings in order?
- Visible focus indicators?
- Usable at 200% zoom?

**6. States**
- Loading, empty, error, and partial-failure states designed?
- Do empty states distinguish "none yet" from "none match the filter"?
- Are errors actionable, saying what to do next?

*Missing states are the most common design review finding, and the cheapest to
fix at design time.*

**7. Error prevention**
- Are destructive actions confirmed — and only those?
- Can the error be designed out rather than caught?
- Are dangerous actions placed away from frequent ones?
- Is anything irreversible without an undo or a confirmation?

**8. Retail context**
- Readable under shop lighting, at a glance?
- Money right-aligned with tabular numerals?
- Does the till stay usable while background data loads?
- Does it work one-handed on a phone for stock-take?
- Does it degrade honestly when offline?

**9. Data density**
- Dashboards: 5–9 metrics, or is it overloaded?
- Does every number carry a comparison?
- Tables: is density adjustable; are actions revealed rather than always present?
- Is progressive disclosure used instead of showing everything?

### Severity

| Level | Meaning | Examples |
|---|---|---|
| `CRITICAL` | Causes financial error or blocks the task | Destructive action adjacent to Pay; total not visible |
| `HIGH` | Serious usability or accessibility failure | Contrast below AA on the till; no keyboard path; colour-only status |
| `MEDIUM` | Real friction | Extra steps in a frequent task; missing empty state |
| `LOW` | Polish | Inconsistent spacing, minor alignment |

**Accessibility failures are never `LOW`.** A control that cannot be reached is
broken, not unpolished.

### Reporting

```
SEVERITY   CRITICAL
AREA       Error prevention
ISSUE      "Remove line" sits 8px from "Pay", both 44px targets
IMPACT     A mis-tap during a fast checkout removes an item instead of taking
           payment; the operator may not notice before the customer leaves
FIX        Move Remove into the line row itself, or separate by ≥ 24px and
           require a swipe or confirmation
```

Name the area, the consequence in use, and a specific alternative. A finding
without a suggested direction is an opinion.

### Verdict

- **APPROVED** — proceed
- **APPROVED WITH CONDITIONS** — listed items addressed during implementation
- **NEEDS REVISION** — specific changes, then re-review
- **REJECTED** — the approach does not serve the task; state what would

`CRITICAL` or `HIGH` blocks approval.

### Reviewing built screens

Same lanes, plus what only exists in the implementation:

```bash
grep -rnE "<div[^>]*onClick" src/ --include=*.jsx        # not focusable
grep -rn "<input" src/ --include=*.jsx | grep -v "id=\|aria-label"
grep -rn "outline: *none" src/ --include=*.css
grep -rnE "#[0-9a-fA-F]{3,8}" src/ --include=*.jsx | wc -l   # token drift
```

Check it on the **real device**, at the real resolution, under realistic
lighting. A screen that reviews well on a laptop can fail on the terminal.

### Checklist

- [ ] Purpose, users, device, and environment established first
- [ ] All nine lanes applied
- [ ] Taps counted for the primary task
- [ ] Muscle-memory impact considered for changed controls
- [ ] Contrast measured, not eyeballed
- [ ] Colour-only signalling checked
- [ ] All four async states verified
- [ ] Destructive-action adjacency checked
- [ ] Dashboard metric count and comparisons checked
- [ ] Table density, alignment, and action patterns checked
- [ ] Verified on the real device under real conditions
- [ ] Findings carry area, impact in use, and a specific alternative
- [ ] Accessibility findings never rated `LOW`
- [ ] One verdict issued

## References

- **Nielsen Norman Group — 10 Usability Heuristics for User Interface Design** —
  the evaluation frame behind these lanes
  <https://www.nngroup.com/articles/ten-usability-heuristics/>
- **WCAG 2.2 — SC 1.4.1, 1.4.3, 1.4.10, 2.1.1, 2.4.7, 2.5.8**
  <https://www.w3.org/TR/WCAG22/>
- **Agente Studio — POS interface design principles** — confirm only where
  critical; store lighting and touch accuracy
  <https://agentestudio.com/blog/design-principles-pos-interface>
- **Creative Navy — POS design guide** — operator conditioning and the cost of
  moving familiar controls
  <https://medium.com/uxjournal/the-design-principles-in-the-pos-system-pos-design-guide-part-2-57d1bcb30ac0>
- **Pencil & Paper — enterprise data tables** — density, alignment, and
  on-demand row actions
  <https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables>
- **Improvado — dashboard design guide** — metric limits and overload
  <https://improvado.io/blog/dashboard-design-guide>

**Not sourced — written for this framework:** the nine-lane structure, the
tap-counting measurement, the muscle-memory check, the severity mapping with
accessibility never rated `LOW`, and the finding format.
