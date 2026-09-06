---
name: component-library
version: 1.0.0
description: |
  Build and maintain a shared component library — what belongs in it, API design,
  variants, documentation, and adoption. Use when creating a shared component,
  when deciding whether something belongs in the library, or when adopting a
  third-party component library.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Component Library

A shared set of primitives that make consistency the path of least resistance. If
using the library is harder than writing a one-off, the library will lose — that
is the design constraint.

### What belongs in it

| Belongs | Does not |
|---|---|
| Button, Input, Select, Checkbox | `SaleLineRow` — feature-specific |
| Modal, Drawer, Tooltip, Toast | `ProductSearchPanel` |
| Table, Pagination, EmptyState | Anything knowing about sales or stock |
| Badge, Tag, StatusIndicator | Anything fetching data |
| Card, Panel, Divider | Anything with business rules |
| Skeleton, Spinner, ErrorState | Anything used in exactly one place |

**The test: does it know about the domain?** A component that knows what a sale
is belongs to the sales feature. A component that renders a table does not.

Apply the **rule of three** — promote on the third use, not the second. Premature
sharing creates coupling that is harder to remove than duplication.

### API design

**Composition over configuration.** Three or more boolean props means the
component is doing several jobs — see `component-review`.

```jsx
// ❌ every new case adds a prop and a branch
<Card title="Sales" showHeader showFooter isCollapsible hasBorder />

// ✅ the caller composes
<Card>
  <Card.Header>Sales</Card.Header>
  <Card.Body>…</Card.Body>
  <Card.Footer><Button>Export</Button></Card.Footer>
</Card>
```

Rules for a good primitive API:

- **Variants as enums**, not booleans: `variant="danger"`, not `isDanger`
- **Named for meaning, not appearance** — appearance names block theming
- **Sensible defaults** so the common case needs no props
- **Pass through the rest** (`...rest`) so callers can add `aria-*`, `data-*`,
  and event handlers without a new prop
- **Forward the ref** — in React 19, `ref` is a normal prop
- **Never bake in spacing.** A component that carries its own outer margin cannot
  be composed; spacing belongs to the parent layout

```jsx
export function Button({ variant = 'secondary', size = 'md', ...rest }) {
  return <button className={`btn btn--${variant} btn--${size}`} {...rest} />;
}
```

### Every primitive covers all its states

A component is not finished until it handles: default, hover, **focus-visible**,
active, disabled, loading, and error where applicable.

Missing focus states are an accessibility defect, not a cosmetic gap. Disabled
states must explain why — see `interaction-design`.

Accessibility belongs **in the primitive**: correct semantic element, label
association, ARIA where genuinely needed, keyboard behaviour. Building it once
here means every consumer gets it, which is the strongest argument for a library.

### Document by use, not by prop table

A generated prop table alone does not tell anyone when to use the component.
Document:

- **When to use it**, and when to use something else
- The common example, copy-pasteable
- Every variant, rendered
- All states
- Accessibility notes and keyboard behaviour
- Known limitations

Colocate the documentation with the component so it drifts less.

### Adopting a third-party library

When adopting one — shadcn/ui, or another:

1. **Map its tokens to yours on day one**, before components accumulate against
   a second scale. Two sources of truth for colour is worse than either alone —
   see `design-tokens`.
2. **Understand the ownership model.** shadcn copies components into your
   repository: you get full control, and you inherit maintenance and upstream
   fixes are manual. That is a real trade, not a free win.
3. **Wrap what you customise.** Import through your own module so a future
   swap touches one file, not two hundred.
4. **Do not adopt piecemeal.** A library used for half the buttons is worse than
   not using it — you now have two Buttons.
5. **Audit accessibility** rather than assuming it. Popular does not mean
   conformant.

### Versioning and change

- Treat the library API as a **published interface** — see `api-design`
- Additive changes are safe; renames and removals are breaking
- Deprecate before removing, with the replacement named
- A visual change to a shared primitive affects every screen — pair it with
  visual tests (see `visual-testing`)

### Adoption is the measure

A library nobody uses has failed, regardless of quality.

```bash
grep -rn "<button" src/ --include=*.jsx | grep -v "components/" | wc -l   # raw buttons
grep -rn "<Button" src/ --include=*.jsx | wc -l                          # library buttons
find src -name '*.jsx' -exec basename {} \; | sort | uniq -c | sort -rn | head
```

A high raw-element count against low library usage means the library is not
serving real needs. Ask what the one-offs needed that the primitive did not
provide — the answer is usually a missing variant or a spacing constraint baked
into the component.

### Checklist

- [ ] Only domain-agnostic primitives in the library
- [ ] Rule of three applied before promoting
- [ ] Composition preferred over boolean configuration
- [ ] Variants as enums, named by meaning
- [ ] Sensible defaults; extra props passed through; ref forwarded
- [ ] No outer spacing baked into components
- [ ] All interaction states covered, including focus-visible
- [ ] Accessibility built into the primitive
- [ ] Documented by use, with examples and states
- [ ] Third-party library tokens mapped to ours
- [ ] Customised third-party components wrapped
- [ ] API treated as published; deprecations before removals
- [ ] Shared-primitive changes covered by visual tests
- [ ] Adoption measured; gaps investigated rather than policed

## References

- **Brad Frost, _Atomic Design_** — primitives, composition, and library scope
  <https://atomicdesign.bradfrost.com/>
- **WAI-ARIA Authoring Practices Guide** — the accessible behaviour each
  primitive must implement <https://www.w3.org/WAI/ARIA/apg/>
- **React documentation — Passing props, composition with children, `ref` as a
  prop in React 19** <https://react.dev/learn/passing-props-to-a-component>
- **shadcn/ui — documentation** — the copy-into-your-repo ownership model
  <https://ui.shadcn.com/docs>
- **Nathan Curtis — Component APIs / Design System Documentation**
  <https://medium.com/eightshapes-llc>

**Not sourced — written for this framework:** the belongs/does-not table and the
domain test, the no-baked-in-spacing rule, the third-party adoption steps, and
the adoption measurement approach.
