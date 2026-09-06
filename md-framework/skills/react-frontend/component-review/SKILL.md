---
name: component-review
version: 1.0.0
description: |
  Review React components for design quality — props API, composition,
  responsibility boundaries, reusability, and accessibility. Use as the component
  design lane of a review gate, when a component is hard to reuse or keeps
  growing props, or when asked "is this component well designed". For correctness
  bugs see react-review.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Component Review (design quality)

This lane asks whether the component is **well built**, not whether it works.
`react-review` finds bugs; this finds the design that will generate bugs later.

Report findings; do not fix them. Design findings are usually `LOW` or `MEDIUM` —
escalate only when the pattern is spreading, because that is when it becomes
expensive.

### 1. Props API

**Boolean explosion.** Three or more booleans means composition is missing — four
booleans is sixteen notional variants, most untested.

```bash
grep -rnE "(is|has|show|hide|enable|disable|with)[A-Z][a-zA-Z]*\s*[,=}]" src/ --include=*.jsx \
  | awk -F: '{print $1}' | uniq -c | sort -rn | head -10
```

```jsx
// ❌ configuration
<Card showHeader showFooter isCollapsible hasBorder title="Sales" />
// ✅ composition
<Card><Card.Header>Sales</Card.Header><Card.Body>…</Card.Body></Card>
```

Also check:

- **Named for meaning, not appearance** — `variant="danger"`, not `isRed`.
  Appearance names outlive their accuracy and block theming.
- **Mutually exclusive booleans** should be one enum prop. `isPrimary` +
  `isSecondary` permits an invalid state; `variant` does not.
- **Whole entities passed where two fields are used** — widens coupling and
  re-renders unnecessarily.
- **Missing defaults** for optional props, pushing the burden to every caller.

**Finding:** `LOW`, `MEDIUM` if the component is widely used.

### 2. Single responsibility

Signals that a component is doing too much:

- More than one reason to change
- More than ~5 pieces of state
- Fetching, transforming, *and* rendering
- A name containing "And", or a generic name like `Manager`/`Handler`
- You cannot describe it in one sentence

```bash
find src -name '*.jsx' | xargs wc -l | sort -rn | head -15
grep -rc "useState" src/ --include=*.jsx | sort -t: -k2 -rn | head -10
```

Length alone is not a finding — a long, simple form component is fine. Split by
**responsibility**; three files that must always change together is worse than
one.

**Finding:** `LOW`–`MEDIUM`.

### 3. Fetching mixed into presentation

A component that both fetches and renders cannot be reused with different data
and cannot be tested without mocking the network.

```bash
grep -rn "axios\|fetch(\|useEffect" src/ --include=*.jsx | grep -iE "table|row|card|item|badge|list"
```

Presentational components should take props only. See `component-architecture`.

**Finding:** `MEDIUM` when it blocks reuse that is actually wanted.

### 4. Duplication

The most valuable finding this lane produces: the same component implemented
twice.

```bash
find src -name '*.jsx' -exec basename {} \; | sort | uniq -c | sort -rn | head
grep -rn "<button" src/ --include=*.jsx | wc -l      # vs uses of a shared Button
```

Two `Button` implementations, three `Modal`s, a `Card` in four slightly different
forms — each divergence becomes a visual inconsistency and a place a fix must be
applied twice. Cross-check against `project-design-system`.

Apply the **rule of three**: two uses is a coincidence, three is a pattern worth
extracting. Do not report a premature-abstraction opportunity as a finding.

**Finding:** `MEDIUM`.

### 5. Accessibility

Not optional, and cheapest to fix at review time.

```bash
grep -rnE "<div[^>]*onClick" src/ --include=*.jsx                 # non-interactive element
grep -rn "<input" src/ --include=*.jsx | grep -v "id=\|aria-label"
grep -rn "<img" src/ --include=*.jsx | grep -v "alt="
grep -rn "outline: *none" src/ --include=*.css
grep -rnE "<h[1-6]" src/ --include=*.jsx | head -20               # heading order
```

Check: real semantic elements (`button`, `a`, `label`), every input labelled,
images with `alt` (empty for decorative), focus never removed without
replacement, headings in order, and no meaning conveyed by colour alone.

**Finding:** `MEDIUM`; `HIGH` for a keyboard trap or an unlabelled control on a
checkout path.

### 6. Boundaries and leakage

- **Deep imports across features** — `../../features/sales/components/Row` makes
  another feature's internals public API. Import through its `index.js`.
- **Business rules in components.** A tax calculation or discount rule in a
  component cannot be reused by a job or tested without rendering. It belongs in
  a hook or a module — and a rule duplicated between client and server will
  eventually disagree.

```bash
grep -rn "from '\.\./\.\./\.\./" src/ --include=*.jsx
grep -rnE "(tax|discount|margin|total)\s*=" src/ --include=*.jsx | grep -vE "props|\.total"
```

**Finding:** `MEDIUM` for deep imports; `HIGH` for a money rule embedded in a
component, because divergence from the server is a financial defect.

### 7. Consistency

Does it match its neighbours — file layout, prop naming, error and empty
handling, styling approach? A component that is individually good but
inconsistent still raises the cost of every future change.

**Finding:** `LOW`.

### Reporting

```
SEVERITY   MEDIUM
LOCATION   src/features/products/ProductCard.jsx:12
ISSUE      Fourth boolean prop added (showBadge, isCompact, hasBorder, showActions)
IMPACT     16 notional variants; new cases require editing this component
FIX        Accept children/slots for badge and actions; keep variant as an enum
```

### Checklist

- [ ] No component with three or more boolean props
- [ ] Props named for meaning; mutually exclusive booleans replaced by an enum
- [ ] Each component has one reason to change
- [ ] Fetching separated from presentation
- [ ] No duplicate implementations of a shared primitive
- [ ] Semantic elements used; all controls labelled and focusable
- [ ] Focus indicators intact; headings ordered
- [ ] No deep imports into another feature's internals
- [ ] No money or business rules embedded in components
- [ ] Consistent with neighbouring components
- [ ] Findings carry severity, location, impact, and a specific fix

## References

- **React documentation — Thinking in React; Passing Props**
  <https://react.dev/learn/thinking-in-react>
- **React documentation — Passing JSX as children (composition)**
  <https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children>
- **WAI-ARIA Authoring Practices Guide** — semantics and labelling
  <https://www.w3.org/WAI/ARIA/apg/>
- **WCAG 2.2 — SC 1.1.1, 2.1.1, 2.4.6, 2.4.7, 4.1.2**
  <https://www.w3.org/TR/WCAG22/>
- **Brad Frost, _Atomic Design_** — shared primitives and duplication

**Not sourced — written for this framework:** the seven-lane structure, the
three-boolean threshold, the rule-of-three extraction guidance, the severity
mapping, and the detection commands.
