---
title: 'Story 1.15: Route guard, app shell, and permission-driven navigation'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['_bmad-output/planning-artifacts/epics/epic-01-foundation-barcode.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every screen is currently unprotected (MVP scaffolding has no routing layer), and there is no way to gate screens based on user permissions — a CASHIER should never see a "Print labels" button, but today there's no navigation at all.

**Approach:** Build routing layer with `react-router-dom`, add `RouteGuard` that blocks all access before sign-in, add `AppShell` with permission-driven navigation registry that shows only screens the user holds permissions for (absent, never disabled), and rewrite `App.jsx` to render the router/auth/shell stack.

## Boundaries & Constraints

**Always:**
- Route guard blocks every screen except sign-in until `useAuth().status === 'signed-in'`
- Permission registry: read each entry's `permission` field only — no code path compares role names or string literals
- Missing permission → screen absent from nav (never disabled/greyed)
- Empty permissions → nav renders with zero items (no error, no placeholder)
- Tab bar caps at 4 items regardless of registry size; bottom on mobile, left rail on tablet+
- No general state-management library (auth state only via `AuthContext`)

**Ask First:**
- If responsive breakpoint (600px) differs from DESIGN.md/EXPERIENCE.md specs

**Never:**
- Role-name strings in AppShell or RouteGuard
- Storing theme preference (light/dark driven by `prefers-color-scheme` only)
- Making permissions configurable in the registry (list is owned by code/epic stories, not admin UI)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unauthenticated direct URL | Typed `/barcode-sheets` with no token | Renders `SignIn.jsx`, not redirect loop | N/A |
| Boot with valid cookie | Fresh page load, httpOnly refresh cookie valid | Status `restoring` → `signed-in`, call GET `/auth/me`, restore permissions | N/A |
| Boot with expired cookie | Fresh page load, cookie absent/expired | Status `restoring` → `signed-out`, renders `SignIn.jsx` | N/A |
| Session expiry mid-screen | 401 response on any call, refresh fails | Status → `session-expired`, renders `SignIn.jsx` with expiry message (not cleared) | N/A |
| User lacks permission | CASHIER tries to reach `/barcode-sheets` directly | RouteGuard redirects to first path they hold permission for (or "nothing here" if none) | N/A |
| Permission array empty | User has no matching nav entries | Nav chrome renders with zero items, user sees empty state | N/A |
| Resize viewport | Shrink from desktop (1024px) to mobile (375px) | Nav transitions from left rail → bottom tab bar, no items hidden | N/A |

</frozen-after-approval>

## Code Map

**Current state:**
- `frontend/src/App.jsx` -- MVP scaffolding, renders `<h1>Barcode Scanner MVP</h1>` and `<BarcodeScanner />`
- `frontend/src/auth/AuthProvider.jsx` -- Holds auth state (accessToken, currentUser, permissions, status, sessionExpiredMessage, signIn, signOut)
- `frontend/src/auth/useAuth.js` -- Hook to consume AuthContext
- `frontend/src/screens/SignIn.jsx` -- Sign-in form (already built by Story 1.14)
- `frontend/src/constants/permissions.js` -- Permission constants (already mirrored from backend)
- `frontend/package.json` -- Missing `react-router-dom` dependency

**To be built:**
- `frontend/src/app/navigation.js` -- Registry: `[{ permission, label, path, element }]`, one entry this story (barcode-sheets)
- `frontend/src/app/RouteGuard.jsx` -- Blocks all routes until signed-in; renders `SignIn.jsx` for unsigned-out/restoring/session-expired
- `frontend/src/app/AppShell.jsx` -- Nav chrome (tab bar / left rail), checks permissions, renders matching entries only, exposes sign-out
- `frontend/src/App.jsx` (rewrite) -- Renders `BrowserRouter` → `AuthProvider` → `RouteGuard` → routing logic

**Dependencies:**
- `react-router-dom` library (new)
- Story 1.14's `AuthProvider`, `AuthContext`, `useAuth()`, `signOut()` (already exist)
- Story 1.10's `platform/apiClient.js` (already exists)

## Tasks & Acceptance

**Execution:**
- [ ] `frontend/package.json` -- Add `react-router-dom` to dependencies, run `npm install` -- Enables routing
- [ ] `frontend/src/app/navigation.js` -- Create permission registry with one barcode-generate entry and Future-Epic template comment -- Future stories add their own entries here
- [ ] `frontend/src/app/RouteGuard.jsx` -- Guard that renders children only when `status === 'signed-in'`; render `SignIn.jsx` otherwise -- Blocks unauthenticated access to all routes
- [ ] `frontend/src/app/AppShell.jsx` -- Nav chrome on `.surface-soft`, checks user permissions against registry, renders only matching entries, exposes sign-out button, responsive (tab/rail) -- Navigation reflects user permissions, nothing forbidden-but-visible
- [ ] `frontend/src/App.jsx` -- Rewrite to render `BrowserRouter` → `AuthProvider` → `RouteGuard` → `Routes` with permission-gated nav -- Completes routing stack
- [ ] `frontend/src/__tests__/routing.test.jsx` -- Test suite covering auth flows, permission gating, responsive nav -- Covers I/O matrix scenarios

**Acceptance Criteria:**
- Given unauthenticated user visits `/barcode-sheets`, when RouteGuard checks status, then `SignIn.jsx` renders (not the page)
- Given INVENTORY_MANAGER logs in, when AppShell renders, then "Print labels" nav item is visible and clickable to `/barcode-sheets`
- Given CASHIER logs in (no `inventory.barcode_generate`), when AppShell renders, then "Print labels" is absent (not disabled)
- Given user navigates directly to `/barcode-sheets` without permission, when RouteGuard resolves, then redirect to first path they can reach (or "nothing here yet" if none)
- Given `session-expired` status, when user views app, then `SignIn.jsx` renders with expiry message
- Given viewport < 600px, when AppShell renders, then nav is a fixed bottom tab bar with no hidden items
- Given viewport ≥ 600px, when AppShell renders, then nav is a left rail

## Design Notes

**Permission registry pattern:** The registry mirrors Story 1.4's `gesture-type.js` precedent — enumerate shape and placeholders now; each future epic's first story adds its own entries. This keeps routing concerns in one file and prevents parallel navigation systems.

**Route redirection for missing permission:** When a user lacks permission for a path and visits it directly, redirect to the first path they hold permission for. This is safer than a "Forbidden" page (itself visible-but-forbidden, violating AD-29). If they hold no permissions (edge case: ACCOUNTANT at this point in build), redirect to a bare "nothing here yet" screen.

**Empty navigation state:** At this story's close, only one entry exists (barcode-sheets for INVENTORY_MANAGER+). Roles like CASHIER and ACCOUNTANT will have zero visible nav items. This is legitimate; do not error or show a placeholder. Treat it as "you're signed in but this version of the app has nothing for you yet."

**Responsive chrome:** Tab bar below 600px, left rail above. Tab bar caps at 4 items because EXPERIENCE.md's Responsive & Platform table specifies "max 4 items" for phone, and we enforce it now rather than each future screen re-deciding.

## Verification

**Commands:**
- `npm install` in `frontend/` -- Installs `react-router-dom` and updates lockfile
- `npm run build` -- Verifies no TypeScript/compilation errors
- `npm test` -- Runs test suite including routing tests

**Manual checks:**
- Open dev tools, navigate to unsigned app → renders `SignIn.jsx`, not blank page
- Sign in as INVENTORY_MANAGER → "Print labels" visible in nav
- Sign in as CASHIER → "Print labels" absent; try direct URL `/barcode-sheets` → redirected to "nothing here yet"
- Test resize from 375px (mobile) to 1024px (desktop) → nav transitions bottom tab → left rail
- Trigger session expiry (mock in network inspector or close browser, expire cookie, reload) → renders `SignIn.jsx` with expiry message

## Suggested Review Order

**Entry Point & Routing Architecture**

- Renders `BrowserRouter` → `AuthProvider` → `RouteGuard` → `AppShell` → `Routes` stack
  [`App.jsx:1`](../../../frontend/src/App.jsx#L1)

- Blocks all unauthenticated access; renders `SignIn` for unsigned-out, restoring, session-expired states
  [`RouteGuard.jsx:1`](../../../frontend/src/app/RouteGuard.jsx#L1)

**Permission-Driven Navigation**

- Filters navigation registry by user permissions; renders only accessible entries (absent, never disabled)
  [`AppShell.jsx:35`](../../../frontend/src/app/AppShell.jsx#L35)

- Single source of truth for routing and permissions; one barcode-sheets entry this story
  [`navigation.js:1`](../../../frontend/src/app/navigation.js#L1)

**Responsive Layout & ResizeObserver**

- Switches between left rail (desktop ≥600px) and bottom tab bar (mobile <600px) with ResizeObserver fallback
  [`AppShell.jsx:20`](../../../frontend/src/app/AppShell.jsx#L20)

- Renders appropriate navigation chrome based on viewport; tabs capped at 4 items on mobile
  [`AppShell.jsx:54`](../../../frontend/src/app/AppShell.jsx#L54)

**Error Handling & Edge Cases**

- Null/undefined guards on auth context, permissions, and navigation registry to prevent crashes
  [`AppShell.jsx:15`](../../../frontend/src/app/AppShell.jsx#L15)

- Error boundary wraps authenticated routes; try-catch on sign-out with error feedback
  [`RouteGuard.jsx:40`](../../../frontend/src/app/RouteGuard.jsx#L40)

**Accessibility & UX**

- ARIA labels, semantic HTML, keyboard navigation (arrow keys on mobile tabs)
  [`AppShell.jsx:80`](../../../frontend/src/app/AppShell.jsx#L80)

- Loading state during sign-out; visual feedback when no permissions ("You don't have access yet")
  [`AppShell.jsx:100`](../../../frontend/src/app/AppShell.jsx#L100)

**Testing**

- Comprehensive test suite covering unauthenticated access, permission gating, responsive transitions, session expiry
  [`routing.test.jsx:1`](../../../frontend/src/__tests__/routing.test.jsx#L1)
