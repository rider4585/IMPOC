---
name: component-consistency
version: 1.0.0
description: |
  Keep the interface coherent — detecting duplicate components, divergent
  patterns, and token drift, then consolidating them. Use when the UI looks
  inconsistent, when a new component duplicates an existing one, or when asked
  "why does this look different from that".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Component Consistency

Inconsistency is rarely a decision. It accumulates: a deadline, an unfamiliar
codebase, a component that was almost right. Each instance is small; the sum is
an interface that feels unreliable and costs more to change.

Consistency also has a functional value in a POS — operators run on conditioned
muscle memory, so a control that behaves differently on one screen is a source of
real errors, not just untidiness.

### Find the duplicates

The highest-value audit, and the easiest to run.

```bash
# Same component name in several places
find src -name '*.jsx' -exec basename {} \; | sort | uniq -c | sort -rn | head -20

# Raw elements bypassing shared primitives
grep -rn "<button" src/ --include=*.jsx | grep -v "components/ui" | wc -l
grep -rn "<Button"  src/ --include=*.jsx | wc -l

# Multiple implementations of the same concept
grep -rln "Modal\|Dialog"  src/ --include=*.jsx
grep -rln "Table\|DataGrid" src/ --include=*.jsx
grep -rln "Spinner\|Loader\|Loading" src/ --include=*.jsx
```

Three files defining a Modal is a finding. So is a raw-`<button>` count far
exceeding `<Button>` usage — the library is being bypassed, and the question is
why.

### Find the drift

```bash
# Hard-coded values bypassing tokens
grep -rnE "#[0-9a-fA-F]{3,8}\b|\brgba?\(" src/ --include=*.jsx --include=*.css | wc -l
grep -rnE "(margin|padding|gap):[^;]*[0-9]+px" src/ --include=*.css | grep -v "var(--" | wc -l
grep -rnE "font-size:\s*[0-9]+px" src/ --include=*.css | wc -l
grep -rn "style={{" src/ --include=*.jsx | wc -l

# Against token usage
grep -rn "var(--" src/ --include=*.css | wc -l
```

Track the **ratio** over time. The absolute number matters less than whether it
is rising — see `design-system-audit`.

### Patterns that must be consistent

Same concept, same treatment, everywhere:

| Concept | Must be identical |
|---|---|
| Primary action | Same style, same position on the screen |
| Destructive action | Same colour, same confirmation behaviour |
| Loading | Same skeleton/spinner approach for the same content shape |
| Empty state | Same layout, same distinction between no-data and filtered-out |
| Error | Same placement, same tone, same retry affordance |
| Form validation | Same timing, same error placement and phrasing |
| Table row actions | Same trigger (hover / menu) across every table |
| Status colours | Same colour and icon for the same state everywhere |
| Date and money format | Identical formatting on every screen |
| Modal behaviour | Same close affordances, same focus handling |

**Money and date formatting inconsistency is the one users notice fastest**, and
it undermines trust in the numbers themselves. Format through one shared helper,
never ad hoc.

### Why divergence happens — and the fix

| Cause | Fix |
|---|---|
| Primitive lacked a needed variant | Add the variant; do not fork |
| Component baked in spacing, so it was copied | Remove outer spacing from the primitive |
| Library component hard to compose | Improve its API — see `component-library` |
| Developer did not know it existed | Discoverability and documentation |
| Deadline pressure | Log as debt at the time, with a trigger |
| Two people built the same thing | Earlier design review |

**Most divergence is a library failure, not a discipline failure.** When you find
a one-off, ask what the primitive did not provide. Policing without fixing the
cause produces the same divergence next month.

### Consolidating

Do it incrementally, never as a big-bang rewrite:

1. **Pick the best existing implementation** as the canonical one — or write a
   new primitive if none is right
2. **Cover the real variants** the duplicates needed
3. **Migrate call sites gradually**, ideally as those areas are touched
4. **Delete the duplicates** once nothing references them
5. **Add a visual test** so the consolidated component's appearance is pinned —
   see `visual-testing`

Consolidation changes shared UI, so it needs review and visual verification: a
single primitive change affects every screen.

Do not mix consolidation with feature work in one change — it makes both hard to
review and hard to revert.

### Prevent it recurring

- **Design review before build** catches duplicate intent early
- **Make the library discoverable** — documentation people actually open
- **Make the right path easiest**; if it is not, fix the primitive
- **Track drift metrics** so regression is visible rather than gradual
- **Review shared-component changes** as the wide-blast-radius changes they are

### Checklist

- [ ] Duplicate component implementations identified
- [ ] Raw-element vs library-component usage measured
- [ ] Token drift measured and trending tracked
- [ ] Primary and destructive actions consistent in style and position
- [ ] Loading, empty, and error patterns consistent
- [ ] Table row action triggers consistent
- [ ] Status colours and icons consistent across screens
- [ ] Money and dates formatted through one shared helper
- [ ] Cause of each divergence identified, not just the instance
- [ ] Missing variants added to primitives rather than forked
- [ ] Consolidation done incrementally, separate from feature work
- [ ] Consolidated components covered by visual tests
- [ ] Divergence found during review, not after release

## References

- **Brad Frost, _Atomic Design_** — shared primitives and the cost of divergence
  <https://atomicdesign.bradfrost.com/>
- **Nathan Curtis — Design System Governance / Adoption**
  <https://medium.com/eightshapes-llc>
- **Nielsen Norman Group — Consistency and Standards (Heuristic 4)**
  <https://www.nngroup.com/articles/ten-usability-heuristics/>
- **Creative Navy — POS design guide** — operator conditioning, and why
  inconsistent controls cause real errors
  <https://medium.com/uxjournal/the-design-principles-in-the-pos-system-pos-design-guide-part-2-57d1bcb30ac0>

**Not sourced — written for this framework:** the must-be-consistent table, the
cause-and-fix table with the "most divergence is a library failure" framing, the
consolidation procedure, and the detection commands.
