---
name: react-review
version: 1.0.0
description: |
  Review React code for correctness defects — hook rule violations, stale
  closures, missing effect cleanup, index keys, state mutation, and unnecessary
  re-renders. Use as the frontend correctness lane of a review gate, when
  reviewing any component change, or when a component behaves unpredictably. For
  component design quality see component-review.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## React Review (correctness)

This lane finds **bugs**. Design quality — props APIs, composition, reuse — is
`component-review`. Report findings; do not fix them.

The defects below are ranked by how often they reach production and how hard
they are to diagnose once there.

### 1. Effects that should not exist

The most common defect class in React codebases.

```bash
grep -rnB2 -A10 "useEffect" src/ --include=*.jsx | grep -E "set[A-Z][a-zA-Z]*\("
```

An effect whose only job is to `setState` from props or other state is derived
state managed manually. It causes an extra render, and there is a window where
the derived value is stale.

**Finding:** `MEDIUM` — or `HIGH` when the stale window is user-visible on a
money or stock figure. See `react`.

### 2. Stale closures / suppressed dependency lint

```bash
grep -rn "eslint-disable.*react-hooks/exhaustive-deps" src/ --include=*.jsx
```

Every suppression is a finding until justified in a comment. The effect captured
values from the render where it was created and will keep using them — the bug
appears as "it works the first time".

**Finding:** `HIGH`. The failure is silent and intermittent.

### 3. Missing cleanup

```bash
grep -rnA12 "useEffect" src/ --include=*.jsx | grep -E "addEventListener|setInterval|setTimeout|subscribe|new [A-Z]"
```

Check each has a matching cleanup in the returned function. Missing cleanup leaks
listeners, keeps timers running after unmount, and — for an aborted fetch —
produces the out-of-order-response race in `server-state`.

**Finding:** `MEDIUM`, `HIGH` for anything holding a device (camera, scanner) or
a socket.

### 4. Index keys

```bash
grep -rnE "key=\{(i|idx|index|[a-z]+Index)\}" src/ --include=*.jsx
```

Correct only for a list that is static, never reordered, filtered, or inserted
into. Otherwise component state attaches to the wrong row — an edited quantity
jumps to a different line when a row above is removed.

**Finding:** `MEDIUM`, `HIGH` in an editable list such as sale lines.

### 5. State mutation

```bash
grep -rnE "\.(push|pop|splice|sort|reverse|shift|unshift)\(" src/ --include=*.jsx
grep -rnE "^\s*[a-z][a-zA-Z]*\.[a-zA-Z]+ = " src/ --include=*.jsx
```

Mutating state does not change the reference, so React does not re-render. The
symptom is "the data is right but the screen is wrong". Note `sort` and `reverse`
mutate in place — `[...items].sort()` is the fix.

**Finding:** `HIGH`.

### 6. Non-updater state updates

```jsx
setCount(count + 1);            // ❌ two in one tick both read the same value
setCount((c) => c + 1);         // ✅
```

**Finding:** `MEDIUM`, `HIGH` where it affects a quantity or total.

### 7. Conditional or nested hooks

```bash
grep -rnB3 "use[A-Z][a-zA-Z]*(" src/ --include=*.jsx | grep -E "if \(|for \(|&&|\?\?|return"
```

Hooks must run in the same order on every render. A hook after an early return,
or inside a condition or loop, breaks that.

**Finding:** `HIGH` — this corrupts hook state, not merely a render.

### 8. Unmemoised context values

```bash
grep -rnA3 "Provider value=\{\{" src/ --include=*.jsx
```

An object literal is a new reference each render, so every consumer re-renders on
every provider render.

**Finding:** `MEDIUM`, raised if the provider is high in the tree.

### 9. Unstable props to memoised children

An inline function or object passed to a `React.memo` child defeats the
memoisation entirely — the child re-renders every time. Either the memo is
pointless, or the prop needs `useCallback`/`useMemo`. Both are findings; the
first is more common.

**Finding:** `LOW`–`MEDIUM`. Only report with a plausible performance impact —
premature memoisation is its own problem.

### 10. Missing async and error states

```bash
grep -rnA6 "isLoading" src/ --include=*.jsx | grep -c "error"
```

A component rendering only the success path shows a blank screen on failure. See
`loading-states`.

**Finding:** `MEDIUM`.

### 11. Security-adjacent

```bash
grep -rn "dangerouslySetInnerHTML" src/ --include=*.jsx
grep -rnE "href=\{[^}]*(props|data|user)" src/ --include=*.jsx
grep -rn "localStorage" src/ --include=*.jsx | grep -iE "token|secret|password"
grep -rnE "(price|unitPrice|total)" src/ --include=*.jsx | grep -iE "post\(|put\(|payload"
```

Raise these to `code-security-reviewer` rather than adjudicating them here — see
`xss` and `server-state`. A client-sent price is `HIGH`.

### Reporting

```
SEVERITY   HIGH
LOCATION   src/features/sales/SaleLines.jsx:48
ISSUE      Index used as key in an editable list
IMPACT     Removing a line moves the edited quantity to the wrong row
FIX        Key by line.id
```

### Checklist

- [ ] No effect exists solely to derive state
- [ ] No suppressed `exhaustive-deps` without written justification
- [ ] Every subscription, timer, listener, and device handle is cleaned up
- [ ] List keys are stable ids, not indices
- [ ] No state mutation; `sort`/`reverse` applied to copies
- [ ] Updater form used for dependent state updates
- [ ] Hooks unconditional and top-level
- [ ] Context values memoised
- [ ] Memoised children not passed unstable props
- [ ] Loading and error paths present on async components
- [ ] Security-adjacent findings routed to the security lane
- [ ] Findings carry severity, location, impact, and a specific fix

## References

- **React documentation — Rules of Hooks**
  <https://react.dev/reference/rules/rules-of-hooks>
- **React documentation — You Might Not Need an Effect**
  <https://react.dev/learn/you-might-not-need-an-effect>
- **React documentation — Removing Effect Dependencies** — stale closures
  <https://react.dev/learn/removing-effect-dependencies>
- **React documentation — Rendering Lists (keys)**
  <https://react.dev/learn/rendering-lists>
- **React documentation — Updating Objects and Arrays in State**
  <https://react.dev/learn/updating-objects-in-state>
- **`eslint-plugin-react-hooks`** — the rules these checks encode
  <https://www.npmjs.com/package/eslint-plugin-react-hooks>

**Not sourced — written for this framework:** the ranked defect list with
detection commands and severity mapping, the retail impact examples, and the
report-never-fix separation.
