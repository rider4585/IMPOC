---
name: component-architecture
version: 1.0.0
description: |
  Structure React components and the folder layout around them — composition
  over configuration, container/presentational separation, custom hooks, and
  where a component should live. Use when creating a component, when one has
  grown unmanageable, when props keep multiplying, or when asked "how should I
  break this up".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Component Architecture

Structure exists to make change cheap. The measure of a good component boundary
is that a typical change touches one file.

### Organise by feature, not by type

```
src/
  features/
    sales/
      components/     SaleForm.jsx, SaleLineRow.jsx
      hooks/          useSaleTotals.js
      api/            sales.api.js
      index.js        the feature's public surface
    inventory/
    products/
  components/         shared primitives: Button, Modal, Table, Field
  hooks/              genuinely shared hooks
  lib/                formatting, money, dates
```

Grouping by type (`components/`, `hooks/`, `utils/` at the top) means a single
feature change touches four directories, and nothing tells you what may safely be
deleted. Group by feature; promote to shared only on the **third** use, not the
second.

**Feature folders export through `index.js`.** Importing deep into another
feature's internals turns every internal file into public API.

### Composition over configuration

When a component grows boolean props, it is doing several jobs.

```jsx
// ❌ every new case adds a prop and a branch
<Card title="Sales" showHeader showFooter footerAlign="right" isCollapsible … />

// ✅ the caller composes what it needs
<Card>
  <Card.Header>Sales</Card.Header>
  <Card.Body><SalesTable /></Card.Body>
  <Card.Footer align="right"><Button>Export</Button></Card.Footer>
</Card>
```

**The rule of thumb: three or more boolean props means composition is missing.**
Each boolean doubles the notional variants; four booleans is sixteen states
nobody has tested.

Pass `children` — or a slot prop — instead of describing content through
configuration.

### Separate what fetches from what renders

```jsx
// Container: data and orchestration, no markup decisions
function SalesPage() {
  const { data, isLoading, error } = useSales({ shopId });
  if (isLoading) return <SalesSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return <SalesTable sales={data} />;
}

// Presentational: props in, markup out. Trivial to test and reuse.
function SalesTable({ sales }) { … }
```

Presentational components take props and render. They do not fetch, do not read
global state, and do not know about routing. That makes them testable without
mocking anything — which is the actual payoff, not the aesthetic.

### Custom hooks for reusable behaviour

Extract a hook when the same stateful logic appears twice, or when a component's
logic obscures its markup.

```js
export function useSaleTotals(lines, taxRate) {
  return useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const tax = Math.round(subtotal * taxRate);
    return { subtotal, tax, total: subtotal + tax };   // minor units
  }, [lines, taxRate]);
}
```

A hook should do **one** thing. `useSalePageEverything` is a component's body
moved to another file, not an abstraction.

### Sizing

There is no line limit worth enforcing, but these signal a split:

- More than one reason to change
- More than ~5 pieces of state
- Deep conditional nesting in the markup
- A name containing "And"
- You cannot describe it in one sentence

Split by **responsibility**, not by length. Cutting a 300-line component into
three 100-line ones that must change together makes things worse.

### Props

- Name for meaning, not appearance: `variant="danger"`, not `isRed`.
- Keep the list short. Many props usually means missing composition or a missing
  object parameter.
- Pass primitives, not whole entities, when the child needs two fields — it
  narrows the coupling and makes re-renders cheaper.
- Avoid prop drilling past two levels: compose differently, or use context for
  genuinely global values.

### File conventions

- One component per file; filename matches the component.
- `PascalCase.jsx` for components, `camelCase.js` for hooks and utilities.
- Co-locate the test and any component-specific styles with the component.

### Detection

```bash
find src -name '*.jsx' | xargs wc -l | sort -rn | head -15          # largest files
grep -rnE "(is|has|show|enable)[A-Z][a-zA-Z]*\s*[,=}]" src/ --include=*.jsx | \
  awk -F: '{print $1}' | uniq -c | sort -rn | head -10              # boolean-prop density
grep -rn "from '\.\./\.\./\.\./" src/ --include=*.jsx                # deep cross-imports
grep -rn "features/[a-z]*/" src/ --include=*.jsx | grep -v "index"   # reaching past index.js
```

### Checklist

- [ ] Folders organised by feature; shared only after a third use
- [ ] Features export through `index.js`; no deep cross-feature imports
- [ ] No component with three or more boolean props
- [ ] Content passed via children/slots rather than configuration
- [ ] Data-fetching separated from presentation
- [ ] Presentational components take props only
- [ ] Reusable stateful logic extracted into single-purpose hooks
- [ ] Each component has one reason to change
- [ ] Props named for meaning; no drilling past two levels
- [ ] One component per file, test co-located

## References

- **React documentation — Thinking in React** — decomposition method
  <https://react.dev/learn/thinking-in-react>
- **React documentation — Passing Props / Passing JSX as children**
  <https://react.dev/learn/passing-props-to-a-component>
- **React documentation — Reusing Logic with Custom Hooks**
  <https://react.dev/learn/reusing-logic-with-custom-hooks>
- **Kent C. Dodds — Colocation** — keep related files together
  <https://kentcdodds.com/blog/colocation>
- **Brad Frost, _Atomic Design_** — shared primitive vocabulary

**Not sourced — written for this framework:** the feature-folder layout, the
three-boolean-props rule, the rule-of-three promotion threshold, the split
signals, and the detection commands.
