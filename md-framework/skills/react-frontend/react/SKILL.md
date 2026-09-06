---
name: react
version: 1.0.0
description: |
  Write correct React — hook rules, effect discipline, state derivation, keys,
  and the React 19 features that replace older patterns. Use when writing or
  changing any component, when a component re-renders unexpectedly or shows stale
  data, or when asked "is this the React way to do it".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## React

Documents **React 19** with plain JavaScript. Most React defects come from one
mistake: reaching for `useEffect` to do something that is not synchronisation
with an external system.

### You probably do not need an effect

This is the highest-value rule in the skill.

| Situation | Wrong | Right |
|---|---|---|
| Value computable from props/state | `useEffect` + `setState` | Compute during render |
| Resetting state when a prop changes | `useEffect` | `key` prop on the component |
| Responding to a user action | `useEffect` watching state | Do it in the event handler |
| Fetching on mount | Bare `useEffect` | A data-fetching layer — see `server-state` |
| Syncing two state variables | `useEffect` | Derive one from the other |

```jsx
// ❌ extra render, and a window where total is stale
const [total, setTotal] = useState(0);
useEffect(() => { setTotal(lines.reduce((s, l) => s + l.qty * l.price, 0)); }, [lines]);

// ✅ derived during render — always correct, never stale
const total = lines.reduce((sum, l) => sum + l.qty * l.price, 0);
```

Effects are for **synchronising with something outside React**: subscriptions,
timers, DOM measurement, a barcode scanner listener, a websocket. If nothing
external is involved, it is not an effect.

### Effect discipline

When you do need one:

```jsx
useEffect(() => {
  const scanner = new BrowserMultiFormatReader();
  scanner.decodeFromVideoDevice(deviceId, videoRef.current, onScan);
  return () => scanner.reset();          // cleanup is mandatory, not optional
}, [deviceId, onScan]);
```

- **Always clean up** — listeners, timers, subscriptions, in-flight requests.
  Without it you leak, and in StrictMode you get doubled behaviour.
- **Never suppress the dependency lint.** A missing dependency is a stale closure
  — the effect captures old values and silently uses them. Fix the cause: move
  the value inside, wrap the function in `useCallback`, or use a ref.
- **StrictMode double-invokes effects in development on purpose.** If that breaks
  something, the effect is not idempotent, and that is a real bug — not a
  StrictMode problem.

### State

**Keep state minimal and derive the rest.** Every additional piece of state is
another thing that can disagree with the others.

```jsx
// ❌ three sources of truth that can drift
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);
const [isEmpty, setIsEmpty] = useState(true);

// ✅ one
const [items, setItems] = useState([]);
const count = items.length;
const isEmpty = items.length === 0;
```

**Never mutate state.** React compares by reference; a mutated object is the same
reference and will not re-render.

```jsx
setLines((prev) => [...prev, line]);
setLines((prev) => prev.map((l) => (l.id === id ? { ...l, qty } : l)));
```

**Use the updater form** whenever the next value depends on the previous — two
updates in one tick otherwise read the same stale value.

**Reset state with `key`, not an effect:**

```jsx
<SaleForm key={saleId} saleId={saleId} />   // remounts fresh when saleId changes
```

**`useReducer` when transitions are related.** A checkout with cart, payment,
and status fields that must move together is a reducer, not five `useState`s.

### Keys

```jsx
{lines.map((line) => <SaleLine key={line.id} {...line} />)}   // ✅ stable identity
{lines.map((line, i) => <SaleLine key={i} … />)}              // ❌ breaks on reorder
```

Index keys corrupt state when the list reorders or an item is removed — input
values and focus attach to the wrong row. Use a stable id.

### React 19 specifics

- **`use(promise)`** reads a promise during render, with Suspense handling the
  pending state.
- **Actions and `useActionState`** handle form submission with pending and error
  state built in — see `forms`.
- **`useOptimistic`** shows an expected result while a request is in flight.
- **`ref` is a normal prop** on function components; `forwardRef` is no longer
  required.
- **The compiler** can remove most manual `useMemo`/`useCallback`. Without it,
  memoise only when profiling shows a real problem — premature memoisation costs
  readability and often performs worse.

### Context

Good for genuinely global, rarely changing values: current user, theme, locale.
**Every consumer re-renders when the value changes**, so do not put fast-changing
state in it, and memoise the provider value:

```jsx
const value = useMemo(() => ({ user, logout }), [user, logout]);
```

For anything larger, see `state-management`.

### Detection

```bash
grep -rn "useEffect" src/ --include=*.jsx | wc -l
grep -rnB2 -A8 "useEffect" src/ --include=*.jsx | grep -E "setState|set[A-Z]"   # effect→setState
grep -rn "eslint-disable.*react-hooks" src/ --include=*.jsx
grep -rnE "key=\{(i|idx|index)\}" src/ --include=*.jsx
grep -rnE "\.(push|splice|sort|reverse)\(" src/ --include=*.jsx
```

The first two together are the health check: a high effect count with many
`setState` calls inside means derived state is being managed manually.

### Checklist

- [ ] No effect that only derives a value from props or state
- [ ] Effects synchronise with something external, and all clean up
- [ ] No suppressed `react-hooks` lint rules
- [ ] Effects are idempotent (StrictMode-safe)
- [ ] State minimal; everything derivable is derived
- [ ] State never mutated; updater form used for dependent updates
- [ ] State reset via `key`, not effects
- [ ] Related transitions use `useReducer`
- [ ] List keys are stable ids, never indices
- [ ] Context values memoised; no fast-changing state in context
- [ ] Memoisation added only in response to profiling

## References

- **React documentation — You Might Not Need an Effect**
  <https://react.dev/learn/you-might-not-need-an-effect>
- **React documentation — Synchronizing with Effects / Removing Effect
  Dependencies** <https://react.dev/learn/synchronizing-with-effects>
- **React documentation — Rules of Hooks**
  <https://react.dev/reference/rules/rules-of-hooks>
- **React documentation — Rendering Lists (keys)**
  <https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key>
- **React 19 release notes** — Actions, `use`, `useOptimistic`, `ref` as a prop
  <https://react.dev/blog/2024/12/05/react-19>
- **React documentation — StrictMode**
  <https://react.dev/reference/react/StrictMode>

**Not sourced — written for this framework:** the barcode-scanner effect example,
the detection commands, and the checklist.
