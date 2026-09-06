---
name: design-system-audit
version: 1.0.0
description: |
  Measure the health of a design system — token adoption, component duplication,
  accessibility conformance, and drift over time — and produce a prioritised
  remediation plan. Use when auditing UI consistency, on a periodic health check,
  or when asked "how healthy is our design system".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Design System Audit

A design system is only as good as its adoption. This audit produces **numbers**,
because "the UI is a bit inconsistent" never gets prioritised and "38% of colour
values bypass tokens, up from 22%" does.

Run it on a cadence — quarterly, or before any significant UI work. The **trend**
matters more than any single figure.

### 1. Token adoption

```bash
TOKENS=$(grep -rn "var(--" src/ --include=*.css | wc -l | tr -d ' ')
HEX=$(grep -rnE "#[0-9a-fA-F]{3,8}\b|\brgba?\(" src/ --include=*.css --include=*.jsx | wc -l | tr -d ' ')
PX=$(grep -rnE "(margin|padding|gap|font-size):[^;]*[0-9]+px" src/ --include=*.css | grep -vc "var(--")
INLINE=$(grep -rn "style={{" src/ --include=*.jsx | wc -l | tr -d ' ')

echo "token refs: $TOKENS | raw colours: $HEX | raw spacing/size: $PX | inline styles: $INLINE"
echo "adoption: $(( TOKENS * 100 / (TOKENS + HEX + PX) ))%"
```

Report adoption as a percentage and list the **worst offending files** — those
are where remediation pays.

```bash
grep -rlnE "#[0-9a-fA-F]{3,8}" src/ --include=*.jsx --include=*.css \
  | xargs grep -cE "#[0-9a-fA-F]{3,8}" | sort -t: -k2 -rn | head -10
```

### 2. Component duplication

```bash
find src -name '*.jsx' -exec basename {} \; | sort | uniq -c | sort -rn | head -15
for c in Button Modal Table Input Card Spinner EmptyState; do
  printf "%-12s implementations: %s   usages: %s\n" "$c" \
    "$(grep -rln "export .*function $c\|export const $c" src/ --include=*.jsx | wc -l | tr -d ' ')" \
    "$(grep -rn "<$c[ />]" src/ --include=*.jsx | wc -l | tr -d ' ')"
done
grep -rn "<button" src/ --include=*.jsx | grep -vc "components/"    # bypassing the library
```

More than one implementation of a primitive is a finding. A high raw-element
count against low library usage means the library is being bypassed — investigate
why rather than policing it (see `component-consistency`).

### 3. Accessibility conformance

```bash
npx @axe-core/cli http://localhost:5173 --exit
grep -rnE "<div[^>]*onClick" src/ --include=*.jsx | wc -l          # non-interactive elements
grep -rn "<input" src/ --include=*.jsx | grep -vc "id=\|aria-label" # unlabelled
grep -rn "<img" src/ --include=*.jsx | grep -vc "alt="
grep -rn "outline: *none\|outline: *0" src/ --include=*.css
```

Then the manual checks automation cannot do — contrast on the real device,
keyboard-only completion of checkout, and greyscale legibility. See
`accessibility`.

**Accessibility findings are never rated below `MEDIUM`.**

### 4. Coverage and states

For each shared primitive, check every state exists: default, hover,
focus-visible, active, disabled, loading, error. Missing focus states are the
most common gap and the most consequential.

Also check the async trio across screens: loading, empty, and error. Missing
states are the most frequent design-review finding — see `loading-states`.

### 5. Consistency spot checks

Take one concept and check it across every screen:

- Do primary buttons look and sit the same everywhere?
- Is money formatted identically, with tabular numerals and right alignment?
- Are dates formatted identically?
- Does amber mean the same thing on every screen?
- Do tables reveal row actions the same way?

### The report

```markdown
# Design System Audit — 2026-09-06

## Health
| Metric | Now | Last | Target |
|---|---|---|---|
| Token adoption | 62% | 71% ↓ | > 90% |
| Raw colour values | 148 | 96 ↑ | < 20 |
| Inline styles | 71 | 44 ↑ | < 10 |
| Duplicate primitives | 4 | 2 ↑ | 0 |
| axe violations | 23 | 31 ↓ | 0 |
| Primitives missing focus state | 3 | 5 ↓ | 0 |

## Findings          — ranked, with location and cause
## Worst files       — where remediation pays most
## Trend             — what is getting better and worse
## Remediation plan  — sequenced, sized
```

**Show the trend.** A single snapshot invites arguing about the number; a
worsening trend is a decision.

### Prioritise remediation

| Priority | Criterion |
|---|---|
| 1 | Accessibility violations — a control nobody can reach is broken |
| 2 | Duplicate primitives — every divergence compounds |
| 3 | Missing states — visible failures for users |
| 4 | Token drift in high-churn files — where the cost is actually paid |
| 5 | Token drift in stable files — low value, do opportunistically |

**Cross-reference drift with churn.** A messy file nobody touches costs nothing;
a moderately messy file changed weekly is where the interest accrues — the same
logic as `technical-debt`.

```bash
git log --format= --name-only -n 300 | grep -E '\.(jsx|css)$' | sort | uniq -c | sort -rn | head -10
```

### Remediate incrementally

- Fix accessibility violations first, and directly
- Consolidate duplicates one primitive at a time
- Adopt tokens opportunistically as files are touched
- **Never a big-bang UI rewrite** — it stalls, and reproduces the same drift
- Add visual tests as consolidation lands, so the result is pinned

Route findings to `design-system-guardian`; route systemic causes (a primitive
that keeps being bypassed) to `architect` — three instances of the same
divergence is a design problem, not three mistakes.

### Checklist

- [ ] Token adoption measured as a percentage
- [ ] Worst-offending files listed
- [ ] Duplicate primitive implementations counted
- [ ] Library bypass rate measured
- [ ] Automated accessibility scan run
- [ ] Manual accessibility checks done — contrast, keyboard, greyscale
- [ ] Every primitive checked for all interaction states
- [ ] Loading, empty, and error states checked across screens
- [ ] Consistency spot checks on money, dates, status colours, actions
- [ ] Metrics compared against the previous audit
- [ ] Findings prioritised with accessibility first
- [ ] Drift cross-referenced with file churn
- [ ] Remediation sequenced incrementally, not as a rewrite
- [ ] Systemic causes escalated

## References

- **WCAG 2.2 (Level AA)** — the conformance target
  <https://www.w3.org/TR/WCAG22/>
- **Deque axe-core** — automated scanning and its coverage limits
  <https://github.com/dequelabs/axe-core>
- **Nathan Curtis — Measuring Design System Adoption**
  <https://medium.com/eightshapes-llc>
- **W3C Design Tokens — format specification**
  <https://tr.designtokens.org/format/>
- **Adam Tornhill, _Your Code as a Crime Scene_** — churn × complexity as a
  prioritisation signal, applied here to UI files

**Not sourced — written for this framework:** the metric set and shell
measurements, the report template with trend columns, the prioritisation table
with accessibility first, and the churn cross-reference for UI drift.
