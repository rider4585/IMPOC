---
name: state-management
version: 1.0.0
description: |
  Decide where state belongs — local, lifted, context, URL, or a store — and
  avoid the duplication that makes state disagree with itself. Use when adding
  state, when two parts of the UI show different values for the same thing, when
  prop drilling gets deep, or when asked "where should this state live".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## State Management

Most state problems are placement problems. Before reaching for a library, ask
what *kind* of state this is — the answer usually names the location.

### Classify first

| Kind | Example | Where it belongs |
|---|---|---|
| **Server state** | Products, sales, stock levels | A fetching layer — **not** a store. See `server-state` |
| **URL state** | Filters, current page, selected tab, search | The URL |
| **Form state** | Field values while editing | The form. See `forms` |
| **Local UI state** | Dropdown open, hovered row | `useState` in the component |
| **Shared UI state** | Current user, theme, cart in progress | Context, or a store |

The single most common architectural mistake in a React app is copying server
data into a global store. That creates a second copy that must be kept in sync,
invalidated, and reasoned about — and it will drift.

### Start local, lift only when needed

```jsx
function ProductRow() {
  const [expanded, setExpanded] = useState(false);   // nobody else needs this
}
```

Lift state to the nearest common ancestor **only when two components genuinely
need it**. Lifting early makes parents re-render for changes they do not care
about, and turns local concerns into shared API.

### URL state is real state

Filters, pagination, sort, and the selected tab belong in the URL. Put them in
component state and you break the back button, sharing a link, refreshing, and
opening in a new tab.

```jsx
const [params, setParams] = useSearchParams();
const status = params.get('status') ?? 'all';

const setStatus = (next) =>
  setParams((p) => { p.set('status', next); p.delete('page'); return p; }, { replace: true });
```

For a retail admin, "send me the link to that filtered report" is a real workflow
— it only works if the filter is in the URL. See `routing`.

### Context: for stable, global values

```jsx
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const value = useMemo(() => ({ user, login, logout }), [user]);   // memoise
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

**Every consumer re-renders when the value changes**, so:

- Use it for values that change rarely — user, theme, locale, permissions.
- **Always memoise the value.** An object literal is a new reference each render
  and re-renders every consumer on every parent render.
- **Split by change frequency.** One context holding user *and* cart re-renders
  the whole tree on every cart keystroke. Separate them.
- Context is not a performance tool; it is a delivery mechanism.

### When a store earns its place

Reach for one (Zustand, Redux Toolkit, Jotai) when **client** state is genuinely
shared across distant parts of the tree *and* changes frequently — an in-progress
sale reachable from the product grid, the cart panel, and the payment screen is a
legitimate case.

Do not adopt one to hold server data, or because the app "feels big". A store
holding fetched entities is `server-state` wearing a disguise.

Whatever the library, the same rules hold: one source of truth per fact, derive
everything else, and select narrowly so a component re-renders only for the slice
it reads.

### Never duplicate

```jsx
// ❌ two sources of truth; edit one and they disagree
const [products, setProducts] = useState([]);
const [selectedProduct, setSelectedProduct] = useState(null);

// ✅ store the id; derive the object
const [selectedId, setSelectedId] = useState(null);
const selected = products.find((p) => p.id === selectedId) ?? null;
```

Store **identifiers**, derive **objects**. A copied object goes stale the moment
the original updates.

### Detection

```bash
grep -rn "createContext" src/ --include=*.jsx
grep -rnA3 "Provider value=\{\{" src/ --include=*.jsx          # unmemoised context value
grep -rnE "useState\(\[\]\)|useState\(null\)" src/ --include=*.jsx | wc -l
grep -rn "useSearchParams\|useParams" src/ --include=*.jsx | wc -l
grep -rn "props\." src/ --include=*.jsx | awk -F: '{print $1}' | uniq -c | sort -rn | head
```

An app with many list-shaped `useState` calls and almost no `useSearchParams`
usually has filter state in the wrong place.

### Checklist

- [ ] Every piece of state classified before placement
- [ ] Server data is not copied into a store or context
- [ ] State starts local; lifted only when genuinely shared
- [ ] Filters, pagination, sort, and tabs live in the URL
- [ ] Context values memoised
- [ ] Contexts split by change frequency
- [ ] A store is used only for frequently changing shared client state
- [ ] Identifiers stored, objects derived
- [ ] One source of truth per fact
- [ ] No `useEffect` syncing one state variable to another

## References

- **React documentation — Choosing the State Structure**
  <https://react.dev/learn/choosing-the-state-structure>
- **React documentation — Sharing State Between Components (lifting)**
  <https://react.dev/learn/sharing-state-between-components>
- **React documentation — Passing Data Deeply with Context / `useContext`**
  <https://react.dev/learn/passing-data-deeply-with-context>
- **React documentation — Scaling Up with Reducer and Context**
  <https://react.dev/learn/scaling-up-with-reducer-and-context>
- **React Router documentation — `useSearchParams`**
  <https://reactrouter.com/en/main/hooks/use-search-params>

**Not sourced — written for this framework:** the state-kind classification
table, the store-identifiers-derive-objects rule, the retail examples, and the
detection commands.
