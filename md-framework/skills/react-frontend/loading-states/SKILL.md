---
name: loading-states
version: 1.0.0
description: |
  Handle every asynchronous UI state — loading, empty, error, partial, offline,
  and optimistic — so no screen ever renders blank or misleading. Use when
  building any component that fetches or submits, when a screen flashes or jumps,
  or when asked "what should this show while it loads".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Loading & Async States

Every async surface has more than a success path. Shipping only the success path
is the most common cause of a screen that appears broken while working correctly.

### The six states

Design all six before writing the component. Most are cheap; skipping them is
what costs.

| State | Shows | Common failure |
|---|---|---|
| **Loading** | Skeleton or spinner | Blank screen |
| **Empty** | Explanation + next action | "No data" with no way forward |
| **Error** | What failed + retry | Raw error object, or silence |
| **Partial** | What loaded, plus a note | One failed widget blanks the page |
| **Success** | The data | — |
| **Offline / stale** | Cached data, clearly marked | Stale figures shown as current |

```jsx
if (isLoading) return <SalesSkeleton />;
if (error)     return <ErrorState error={error} onRetry={refetch} />;
if (!sales.length) return <EmptyState … />;
return <SalesTable sales={sales} />;
```

### Loading: skeleton over spinner

A skeleton that matches the eventual layout prevents the content jump that makes
an app feel unstable, and communicates what is coming.

- **Skeleton** for known-shape content — tables, cards, lists
- **Spinner** for unknown-shape or short waits
- **Inline indicator** for a refresh of already-visible data — never replace
  loaded content with a full-page loader

**Avoid the flash.** A skeleton shown for 80 ms is worse than none. Delay the
indicator ~200 ms, and once shown keep it ~300 ms minimum:

```js
const showSpinner = useDelayedFlag(isLoading, { delay: 200, minVisible: 300 });
```

**Reserve the space.** The skeleton should occupy the same dimensions as the
content, or the page jumps on arrival — the layout-shift problem in
`frontend-performance`.

### Empty states do work

An empty state is an opportunity, not an apology. Distinguish the causes — they
need different responses:

| Cause | Message | Action |
|---|---|---|
| Nothing created yet | "No products yet" | "Add your first product" |
| Filter excludes everything | "No sales match these filters" | "Clear filters" |
| Search found nothing | "No results for 'xyz'" | Suggest broader terms |
| No permission | "You don't have access to reports" | Who to ask |

Showing "No sales" when a filter is hiding them sends people hunting for a bug
that does not exist.

### Errors: say what to do

```jsx
<ErrorState
  title="Couldn't load sales"
  message="Check your connection and try again."
  onRetry={refetch}
  reference={error.requestId}      /* so support can find the log */
/>
```

- Never render a raw error object or stack.
- Always offer a retry for transient failures.
- Show the correlation id for unexpected errors — see `error-handling`.
- Distinguish network failure ("you're offline") from server failure ("something
  went wrong on our side") — the user's action differs.

### Partial failure

A page composed of several data sources should not fail wholesale because one
widget did.

```jsx
<ErrorBoundary fallback={<WidgetError onRetry={…} />}>
  <SalesChart />
</ErrorBoundary>
```

On a till screen this matters: a failed sales-summary panel must never prevent
scanning and taking payment.

### Optimistic updates

Show the expected result immediately, then reconcile.

```jsx
const [optimisticLines, addOptimistic] = useOptimistic(lines, (state, line) => [...state, line]);
```

Rules:

- **Only for actions that almost always succeed** and are cheap to reverse —
  adding a line to a cart, toggling a flag.
- **Never for payment or stock commitment.** Showing a completed sale that then
  fails is worse than a short wait.
- **Always roll back visibly on failure**, with a message. A silent revert makes
  users think they mis-clicked.

### Submission states

A button that gives no feedback gets pressed again.

```jsx
<button disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Complete sale'}</button>
```

Disable during submission, change the label, and re-enable in `finally` — see
`forms`.

### Retail specifics

- **Never block the whole till on a background fetch.** Scanning must stay
  responsive while a summary loads.
- **Mark stale data explicitly.** A stock figure from a failed refresh must say
  "as of 14:32", not appear current — see `server-state`.
- **Offline degradation must be honest.** Say what still works and what does not,
  rather than failing silently or pretending to succeed.

### Detection

```bash
grep -rn "isLoading\|isPending" src/ --include=*.jsx | wc -l
grep -rn "EmptyState\|ErrorState\|Skeleton" src/ --include=*.jsx | wc -l
grep -rnA6 "isLoading" src/ --include=*.jsx | grep -c "error"
grep -rn "\.length === 0\|\.length ? " src/ --include=*.jsx | wc -l
```

Far more `isLoading` occurrences than `ErrorState`/`EmptyState` means the other
paths are unhandled.

### Checklist

- [ ] All six states designed before implementation
- [ ] Skeletons match final layout dimensions
- [ ] Loading indicators delayed ~200 ms with a minimum visible duration
- [ ] Refreshes show inline indicators, not full-page loaders
- [ ] Empty states distinguish no-data from filtered-out from no-permission
- [ ] Empty states offer a next action
- [ ] Errors are actionable, with retry and a correlation id
- [ ] Network and server failures distinguished
- [ ] No raw error objects rendered
- [ ] Widget-level error boundaries prevent whole-page failure
- [ ] Optimistic updates only where safe, and roll back visibly
- [ ] No optimistic UI on payment or stock commitment
- [ ] Submission disables the control and changes its label
- [ ] Stale data labelled with its age

## References

- **React documentation — `Suspense` and `useOptimistic`**
  <https://react.dev/reference/react/Suspense>
- **React documentation — Error boundaries**
  <https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary>
- **Nielsen Norman Group — Response times and progress indicators**
  <https://www.nngroup.com/articles/response-times-3-important-limits/>
- **web.dev — Cumulative Layout Shift** — why skeletons must reserve space
  <https://web.dev/articles/cls>
- **WCAG 2.2 — SC 4.1.3 Status Messages** — announcing state changes
  <https://www.w3.org/TR/WCAG22/#status-messages>

**Not sourced — written for this framework:** the six-state table, the empty-state
cause table, the delay/min-visible timing guidance, and the retail rules on till
responsiveness and stale-data labelling.
