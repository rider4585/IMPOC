---
name: routing
version: 1.0.0
description: |
  Structure client-side routing with React Router — route organisation, protected
  routes and role guards, URL as state, lazy loading, and not-found handling. Use
  when adding a page, protecting a route by role, implementing navigation, or
  when asked "how should this route be set up".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Routing

Documents **react-router-dom v6**. Routes are the application's public surface:
they should be readable in one place, guarded consistently, and reflect state
that deserves to be shareable.

### Declare routes in one place

```jsx
// app/routes.jsx — the whole surface, readable at a glance
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,                    // guard wraps everything below
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/sales" replace /> },
          { path: 'sales',            element: <SalesPage /> },
          { path: 'sales/:saleId',    element: <SaleDetailPage /> },
          { path: 'products',         element: <ProductsPage /> },
          {
            element: <RequireRole permission="report:read" />,
            children: [{ path: 'reports', element: <ReportsPage /> }],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
```

Guards as **layout routes** rather than per-page wrappers means a new page under
a guarded branch is protected by default. Wrapping each page individually means
the next page added is unprotected by omission — the same argument as
router-level middleware in `express`.

### Guards

```jsx
export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;          // don't redirect while unknown
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

export function RequireRole({ permission }) {
  const { user } = useAuth();
  if (!can(user.role, permission)) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
```

- **Wait for the auth check.** Redirecting while loading bounces an authenticated
  user to login on every refresh.
- **`replace`** so the guard does not pollute history.
- **Preserve the attempted location** so login can return the user there.

**A route guard is not security.** It hides UI; it does not protect data. Every
protected route must be backed by server-side authorisation — see
`authorization`. An attacker does not use your router.

### URL as state

Filters, pagination, sort, and selected tab belong in the URL — see
`state-management`.

```jsx
const [params, setParams] = useSearchParams();
const status = params.get('status') ?? 'all';
const page   = Number(params.get('page')) || 1;

const update = (patch) =>
  setParams((p) => {
    Object.entries(patch).forEach(([k, v]) =>
      v == null || v === 'all' ? p.delete(k) : p.set(k, String(v)));
    if (!('page' in patch)) p.delete('page');     // filter change resets paging
    return p;
  }, { replace: true });
```

Use `replace: true` for filter changes so the back button steps between *pages*,
not every keystroke of a search box.

**Never put sensitive data in the URL** — it lands in history, logs, and
`Referer` headers. Ids are fine; tokens and personal data are not.

### Navigation

```jsx
<Link to={`/sales/${sale.id}`}>{sale.receiptNo}</Link>       // ✅ real anchor
<div onClick={() => navigate(`/sales/${sale.id}`)}>…</div>   // ❌ not focusable
```

Use `<Link>`/`<NavLink>` for navigation. A clickable `div` cannot be focused,
opened in a new tab, middle-clicked, or used with a keyboard. Reserve
`useNavigate` for navigation after an action — a completed sale, a successful
login.

### Lazy loading

Split at the route boundary — the natural seam.

```jsx
const ReportsPage = lazy(() => import('../features/reports/ReportsPage'));

<Suspense fallback={<PageSkeleton />}>
  <Outlet />
</Suspense>
```

Split heavy, infrequently used routes first: reports, charts, PDF and barcode
generation. Do not split the till screen — it is the hot path and should be in
the initial bundle. See `vite`.

### Not found and errors

- A `path: '*'` route at every level that needs one, so an unknown URL shows a
  page rather than a blank screen.
- A route-level error element so one page's crash does not blank the app — pair
  with error boundaries from `error-handling`.
- Distinguish "does not exist" from "not permitted" in the UI, while the API
  returns `404` for both (see `broken-object-level-authorization`).

### Retail specifics

- **Deep-link the till screen** so a device can be configured to open straight to
  it.
- **Warn on navigation away from an in-progress sale.** Losing a half-scanned
  basket is a real cost — use a blocker or an `unload` guard.
- **Keep report filters in the URL** so "send me that view" works.

### Detection

```bash
grep -rn "createBrowserRouter\|<Routes>\|<Route " src/ --include=*.jsx
grep -rn "useNavigate" src/ --include=*.jsx | wc -l
grep -rnE "onClick=\{.*navigate\(" src/ --include=*.jsx          # div-as-link
grep -rn "path: '\*'\|path=\"\*\"" src/ --include=*.jsx
grep -rn "lazy(" src/ --include=*.jsx
grep -rn "useSearchParams" src/ --include=*.jsx | wc -l
```

### Checklist

- [ ] Routes declared in one readable place
- [ ] Guards implemented as layout routes, not per-page wrappers
- [ ] Guards wait for the auth check before redirecting
- [ ] Redirects use `replace`; attempted location preserved
- [ ] Every protected route backed by server-side authorisation
- [ ] Filters, pagination, and sort in the URL
- [ ] Filter changes use `replace` and reset the page parameter
- [ ] No sensitive data in URLs
- [ ] Navigation uses `<Link>`, not click handlers on non-interactive elements
- [ ] Heavy routes lazy-loaded; the till screen is not
- [ ] Catch-all not-found route present
- [ ] Route-level error element configured
- [ ] Warning before leaving an in-progress sale

## References

- **React Router v6 documentation — `createBrowserRouter`, nested routes,
  `<Outlet>`, `<Navigate>`** <https://reactrouter.com/en/main/routers/create-browser-router>
- **React Router v6 — `useSearchParams`**
  <https://reactrouter.com/en/main/hooks/use-search-params>
- **React Router v6 — `errorElement` and error handling**
  <https://reactrouter.com/en/main/route/error-element>
- **React documentation — `lazy` and `Suspense`**
  <https://react.dev/reference/react/lazy>
- **WCAG 2.2 — SC 2.1.1 Keyboard** — why links must be real anchors
  <https://www.w3.org/TR/WCAG22/#keyboard>

**Not sourced — written for this framework:** the guard-as-layout-route argument,
the filter-reset-paging pattern, the retail rules (till deep link, in-progress
sale warning, what not to code-split), and the detection commands.
