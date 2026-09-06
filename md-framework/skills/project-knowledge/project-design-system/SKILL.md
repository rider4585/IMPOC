---
name: project-design-system
version: 1.0.0
description: |
  Inventory the visual and component conventions of an existing frontend: design
  tokens, colour, typography, spacing, component library, and the inconsistencies
  between them. Produces docs/project-knowledge/design-system.md. Use when asked
  "document the design system", "what components exist", "what are our tokens",
  "audit UI consistency", or when starting Phase 0 discovery on a project with a
  frontend.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Project Design System Discovery

Most projects have a design system whether or not anyone decided to build one.
It is expressed in whatever token layer the stack provides, a handful of shared
components, and a long tail of one-off values. Document the intended system and measure the drift.

### Confidence marking (mandatory)

`[verified]` (read in config or component source, cited) · `[inferred]`
(a convention you observed repeatedly) · `[assumed]` (Open Questions).

### Method

1. **Find the token source.** Every project has one, even if nobody called it
   that. Look in this order and record which layer is authoritative — projects
   commonly acquire a second source without retiring the first, and that overlap
   is itself a finding:

   | Layer | Where it lives |
   |---|---|
   | CSS custom properties | `:root` in a global stylesheet — works in any project |
   | Utility framework config | `tailwind.config.*`, or `@theme` in Tailwind v4 CSS |
   | Component library theme | shadcn/ui `components.json` + its CSS variables, MUI/Chakra theme object |
   | Standalone tokens package | `tokens.json`, Style Dictionary output |
   | Font and icon sources | `@fontsource*` imports, icon library imports |

   ```bash
   grep -rn "^\s*--[a-z-]*:" src/ --include=*.css | head -40
   ls tailwind.config.* components.json 2>/dev/null
   grep -rn "@fontsource\|@theme\|createTheme\|extendTheme" src/ package.json | head -20
   ```

   A project with no config file still has a system — it is expressed in the CSS
   variables and in whatever values repeat across components. Document that;
   "there is no design system" is almost never true, and is never a useful finding.

2. **Extract the scales.** Colour, typography, spacing, radius, shadow,
   breakpoints, z-index. For each, record the declared scale and its semantic
   names. A scale with names like `gray-1..9` is a primitive scale; one with
   `surface`, `border`, `danger` is semantic. Note which you have — it determines
   how theming works.

3. **Measure the drift.** Count values that bypass whatever the token source is.
   This number is the most useful thing in the document, because it says whether
   the system is real or aspirational.

   ```bash
   # Raw colour literals anywhere — applies to every stack
   grep -rnE "#[0-9a-fA-F]{3,8}\b|\brgba?\(" src/ --include=*.css --include=*.jsx --include=*.js | wc -l
   # Inline styles bypassing the stylesheet entirely
   grep -rnE "style=\{\{" src/ --include=*.jsx --include=*.js | wc -l
   # Magic pixel values not derived from a scale
   grep -rnE ":\s*[0-9]+px" src/ --include=*.css | wc -l
   # Utility-framework arbitrary values — only if such a framework is present
   grep -rnE "\b(p|m|gap|w|h|text|bg)-\[" src/ --include=*.jsx | wc -l
   ```

   Run only the checks that apply to the stack in front of you, and say which you
   ran. Reporting zero arbitrary-value hits in a project with no utility framework
   is noise, not a clean bill of health.

   Report counts alongside the worst offending files, and re-measure on a cadence —
   the trend matters more than the absolute number.

4. **Inventory the components.** List shared/primitive components, their props,
   and their variants. Then find duplicates — two Button implementations, three
   Modals, a Card that exists in four slightly different forms. Duplicates are the
   main finding of this exercise.

5. **Record the interaction states.** For each primitive: default, hover, focus,
   active, disabled, loading, error. Missing focus states are an accessibility
   defect, not a cosmetic gap — note them explicitly.

6. **Check dark mode and theming.** Whether it exists, how it is switched, and
   whether tokens are defined for both. A colour defined only inside a dark-mode
   block is a bug waiting to happen.

7. **Determine the responsive strategy.** Breakpoints, mobile-first or not, and
   whether layouts actually adapt. For a point-of-sale or admin system, record
   the real target devices — a till screen and a phone are different constraints.

8. **Check accessibility basics.** Colour contrast on the declared palette
   against WCAG 2.2 AA (4.5:1 body text, 3:1 large text and UI boundaries),
   focus visibility, and whether interactive elements are real buttons and links.

### Output

Write `docs/project-knowledge/design-system.md`:

```markdown
# Design System

## 1. Token Source    — where tokens live, primitive vs semantic
## 2. Scales          — colour, type, spacing, radius, shadow, breakpoints
## 3. Drift Metrics   — hard-coded values, worst files    ⚠️ the headline number
## 4. Components      — inventory with variants and props
## 5. Duplicates      — components implemented more than once
## 6. States          — coverage table; missing focus states flagged
## 7. Theming         — dark mode, switching mechanism, token coverage
## 8. Responsive      — breakpoints and real target devices
## 9. Accessibility   — contrast failures, focus, semantic elements
## Open Questions
```

### Finishing

- Append durable facts to `$AGENT_DIR/memory.md`.
- `propose` Open Questions to `god`.
- Report duplicates and contrast failures as findings, but do not fix them here —
  consolidation is a separate, reviewed work item.

## References

- **W3C Design Tokens Community Group format specification** — primitive vs
  semantic token distinction in step 2
  <https://tr.designtokens.org/format/>
- **WCAG 2.2, Success Criteria 1.4.3 / 1.4.11 / 2.4.7** — the contrast ratios and
  focus visibility requirements in steps 5 and 8
  <https://www.w3.org/TR/WCAG22/>
- **Tailwind CSS documentation — Theme** — one possible token source in step 1
  <https://tailwindcss.com/docs/theme>
- **shadcn/ui — Theming** — CSS-variable token convention, for projects that adopt it
  <https://ui.shadcn.com/docs/theming>
- **MDN — Using CSS custom properties** — the stack-independent token layer
  <https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties>
- **Brad Frost, _Atomic Design_** — the primitive/component inventory approach in
  step 4
- **Munder Difflin `PROTOCOL.md`** — memory write-back and `propose` handoff

**Not sourced — added deliberately:** the confidence marking, the token-source
layer table, and the drift-metric counting in step 3, which is a measurement
convention rather than a standard.

**Stack neutrality:** the method is written to hold as the stack changes. The
token-source table and drift checks cover plain CSS custom properties today and
utility-framework or component-library tokens when they are adopted; run the
checks that apply and record which ones you ran.
