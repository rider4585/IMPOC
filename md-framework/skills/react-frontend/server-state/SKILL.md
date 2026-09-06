---
name: server-state
version: 1.0.0
description: |
  Fetch and manage data from the API — request modules, cancellation, loading and
  error states, caching, deduplication, and refetch after mutation. Use when
  adding a data fetch, when components show stale data after an update, when
  requests race, or when asked "how should this component get its data".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Server State

Server data is **not** application state — it is a cache of something owned
elsewhere. Treating it as state is what produces stale screens, duplicate
requests, and race conditions.

> Written for **axios** with custom hooks, which is the current setup. If a data
> library (TanStack Query, SWR) is adopted later, the principles are unchanged —
> it supplies caching, deduplication, and invalidation rather than you doing so.

### One API module per feature

Components should never construct URLs.

```js
// features/sales/api/sales.api.js
import { api } from '@/lib/api';

export const listSales  = (params, signal) => api.get('/sales', { params, signal });
export const getSale    = (id, signal)     => api.get(`/sales/${id}`, { signal });
export const createSale = (payload)        => api.post('/sales', payload);
export const voidSale   = (id, reason)     => api.post(`/sales/${id}/void`, { reason });
```

One configured client, with credentials and error normalisation in one place:

```js
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,          // httpOnly auth cookies — see `authentication`
  timeout: 15_000,
});

api.interceptors.response.use(null, (error) => {
  if (error.response?.status === 401) redirectToLogin();
  return Promise.reject(normalizeError(error));
});
```

### Cancellation is not optional

Without it, a user typing in a search box gets responses out of order and the
screen settles on the wrong one.

```js
export function useSales(params) {
  const [state, setState] = useState({ data: null, isLoading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, isLoading: true, error: null }));

    listSales(params, controller.signal)
      .then(({ data }) => setState({ data, isLoading: false, error: null }))
      .catch((error) => {
        if (axios.isCancel(error) || error.name === 'CanceledError') return;  // expected
        setState({ data: null, isLoading: false, error });
      });

    return () => controller.abort();      // cancels on unmount and on param change
  }, [JSON.stringify(params)]);

  return state;
}
```

Two details that matter:

- **Aborting on cleanup** fixes both the unmount warning and the out-of-order
  race — the stale request never resolves into state.
- **Cancellation is not an error.** Swallow it; do not render an error state for
  a request you cancelled deliberately.

### Always return three states

Every fetch has loading, error, and empty outcomes. A hook that returns only data
forces every caller to invent its own handling — see `loading-states`.

```jsx
const { data, isLoading, error, refetch } = useSales({ shopId, status });

if (isLoading) return <SalesSkeleton />;
if (error)     return <ErrorState error={error} onRetry={refetch} />;
if (!data.length) return <EmptyState message="No sales in this period" />;
return <SalesTable sales={data} />;
```

### After a mutation, refetch

The cache is now wrong. Decide explicitly what becomes invalid:

```js
async function handleVoid(saleId, reason) {
  await voidSale(saleId, reason);
  await Promise.all([refetchSales(), refetchStock()]);   // both changed
}
```

Voiding a sale changes the sale list **and** stock levels. Refetching only the
list leaves a stale stock figure on screen — in a POS that means selling
something that is not there.

Optimistic updates (or `useOptimistic` in React 19) improve perceived speed, but
**must roll back on failure**. Without rollback you show a success that did not
happen.

### Deduplicate

Three components mounting at once with the same query issue three identical
requests. Fetch once at a common parent and pass down, or share an in-flight
promise map keyed by request. This is the main thing a data library gives you for
free.

### Do not copy server data into other state

```jsx
// ❌ a second copy that immediately begins to drift
const { data: products } = useProducts();
const [localProducts, setLocalProducts] = useState([]);
useEffect(() => setLocalProducts(products), [products]);
```

Read from the fetch result. If you need a modified view, derive it during render.
See `state-management`.

### Retail specifics

- **Stock is volatile.** A quantity fetched five minutes ago is a guess. Refetch
  before checkout and let the server be the authority — the atomic decrement is
  what actually prevents overselling, not the UI (see `concurrency`).
- **Never trust a client-held price.** Send product ids and quantities; let the
  server resolve prices. A price in the payload is a mass-assignment vector.
- **Poll sparingly.** Polling every till every few seconds is real database load.
  Refetch on window focus and after mutations instead.

### Detection

```bash
grep -rn "axios\." src/ --include=*.jsx                       # calls outside api modules
grep -rn "fetch(" src/ --include=*.jsx
grep -rnA5 "useEffect" src/ --include=*.jsx | grep -c "AbortController"
grep -rnA6 "useEffect" src/ --include=*.jsx | grep -E "\.then\(" | wc -l
grep -rnE "(price|unitPrice|total)" src/ --include=*.jsx | grep -iE "post\(|put\(|payload|body"
```

The last one finds prices being sent from the client.

### Checklist

- [ ] One configured API client; credentials and error normalisation centralised
- [ ] No URLs constructed inside components
- [ ] Every fetch is abortable and aborts on cleanup
- [ ] Cancellations not surfaced as errors
- [ ] Hooks return loading, error, and data; empty handled by callers
- [ ] Mutations trigger explicit refetch of everything they invalidated
- [ ] Optimistic updates roll back on failure
- [ ] Identical concurrent requests deduplicated
- [ ] Server data not copied into `useState` or a store
- [ ] Stock refetched before checkout
- [ ] Prices never sent from the client

## References

- **axios documentation — instances, interceptors, `AbortController` support**
  <https://axios-http.com/docs/cancellation>
- **MDN — `AbortController` / `AbortSignal`**
  <https://developer.mozilla.org/en-US/docs/Web/API/AbortController>
- **React documentation — Fetching data in Effects and its caveats (race
  conditions, cleanup)**
  <https://react.dev/reference/react/useEffect#fetching-data-with-effects>
- **React documentation — `useOptimistic`**
  <https://react.dev/reference/react/useOptimistic>
- **TanStack Query documentation — Important Defaults** — the caching and
  invalidation model, if adopted later
  <https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults>

**Not sourced — written for this framework:** the retail rules (volatile stock,
never trust client price, polling cost), the abort-on-cleanup race explanation,
and the detection commands.
