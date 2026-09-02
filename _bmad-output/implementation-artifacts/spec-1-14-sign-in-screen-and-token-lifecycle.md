---
title: 'Story 1.14: Sign-in screen and token lifecycle'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 1
baseline_commit: 'NO_VCS'
context: ['_bmad-output/planning-artifacts/epics/epic-01-foundation-barcode.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Staff members need a secure sign-in experience that persists across page reloads without requiring re-authentication every 15 minutes. Currently there is no login screen or token lifecycle management in the frontend.

**Approach:** Build a complete auth module that implements the backend's httpOnly cookie refresh-token flow. This includes an `AuthContext` that holds the access token in memory only (never persisted), a `SignIn` screen, a 401 response interceptor that automatically attempts one token refresh, and clear handling of session expiry vs. signed-out states.

## Boundaries & Constraints

**Always:**
- Access token lives in memory only inside `AuthContext`, never in `localStorage`, `sessionStorage`, or any persisted store
- Refresh token is never read or held by frontend code — it arrives and departs as an httpOnly cookie, invisible to JavaScript
- POST /auth/login and POST /auth/me responses carry no `preferences` field in any form (deferred to Epic 12)
- A 401 response interceptor attempts exactly one `POST /auth/refresh` with a 5-second timeout (preserving `requestUuid` for idempotency), and rejects with a distinct `SESSION_EXPIRED` error if that single refresh fails
- When multiple requests receive 401 simultaneously, only the first issues `POST /auth/refresh`; subsequent 401s queue and wait for that refresh to complete, then all queued requests retry with the new token (prevents duplicate refresh requests and cascade failures)
- The `SESSION_EXPIRED` error is caught by `AuthContext` via a global unhandled promise rejection listener registered at provider mount; the listener calls `handleSessionExpired()` to transition status and clear the access token
- `AuthContext` status transitions are `signed-out` | `restoring` | `signed-in` | `session-expired`, distinctly signaling boot-time restoration, in-progress auth, and mid-task interruption
- Session expiry clears only the in-memory access token — no other module's client-side state is wiped (cart, forms, etc. survive an auth failure)
- `POST /auth/login`, `POST /auth/refresh`, and `POST /auth/logout` are all issued through `platform/apiClient.js` with `withCredentials: true` already in place (Story 1.10)
- Permissions are resolved from the login/refresh response as a sorted string array, not inferred from role names

**Ask First:**
- Whether to add `react-router-dom` to `frontend/package.json` in this story or defer it to Story 1.15 (Route Guard)

**Never:**
- Do not persist the access token or refresh token to any client-side store
- Do not add general client-side state management beyond `AuthContext` (e.g., Redux, Zustand)
- Do not test against a mock backend or stub `/auth/login` — all auth tests run against a real seeded database
- Do not invent a `preferences` field or default it to `{}`
- Do not retry the refresh interceptor more than once per 401
- Do not modify the auth backend service layer (auth.service.js, auth-token.service.js, permission.service.js) — only Story 1.12 and 1.13's controller changes exist

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Successful login | POST /auth/login with valid username/password | Response { success, data: { uuid, username, email, firstName, lastName, status, lastLoginAt, permissions[], accessToken, refreshTokenExpiresAt } }; browser sets httpOnly cookie automatically; `AuthContext` stores token + permissions + user in memory, sets status to `signed-in` | Invalid credentials: response body carried server message; displayed inline on form per EXPERIENCE.md |
| Boot-time session restore | App mounts with valid httpOnly refresh token in browser | `AuthContext` sets status to `restoring`, calls POST /auth/refresh (cookie automatic), calls GET /auth/me, sets token + permissions + user, transitions to `signed-in` | Absent or expired cookie: status → `signed-out`, no client-side storage to clear |
| 401 on authenticated request | Any request returns 401 status | Response interceptor calls POST /auth/refresh once with 5-second timeout (cookie automatic), gets new token, retries original request unchanged with new token. If refresh is already in progress, queues request and retries after that refresh completes. | Refresh fails (4xx/5xx/timeout): interceptor rejects with `SESSION_EXPIRED` error, does not retry again |
| Session expired mid-task | `SESSION_EXPIRED` error thrown by interceptor after failed refresh | AuthContext global error listener catches it, status transitions to `session-expired` with message "Your session expired. Sign in again to continue.", in-memory token cleared | Consumer (Story 1.15's app shell) renders message + renders `SignIn.jsx` |
| Sign out | POST /auth/logout called from `useAuth().signOut()` | Calls logout endpoint (server clears cookie), clears in-memory token, sets status to `signed-out` | N/A |
| Direct URL before signed in | User types `/barcode-sheets` or any protected route while unsigned | Not applicable to this story — Story 1.15's `RouteGuard` enforces this; this story only provides the auth state |  N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/platform/apiClient.js:76+` -- Response interceptor for 401 handling: queue-based refresh (only one POST /auth/refresh in flight at a time), 5-second timeout, SESSION_EXPIRED error on failure; global error listener in window to catch SESSION_EXPIRED if thrown but not caught
- `frontend/src/services/authApi.js` -- NEW: thin wrappers over apiClient for POST /auth/login, POST /auth/refresh, POST /auth/logout, GET /auth/me
- `frontend/src/auth/AuthContext.jsx` -- NEW: provider holding accessToken, currentUser, permissions, status in memory; wires setAccessTokenGetter at mount; registers global unhandled promise rejection listener for SESSION_EXPIRED errors; exports handleSessionExpired() and signIn() for use by screens
- `frontend/src/auth/useAuth.js` -- NEW: consuming hook that returns { accessToken, currentUser, permissions, status, sessionExpiredMessage, signIn, signOut }
- `frontend/src/screens/SignIn.jsx` -- NEW: username/password form styled on `.surface-flat`, calls useAuth().signIn(), displays server error message on invalid credentials
- `frontend/src/constants/permissions.js` -- NEW: mirrors backend/src/constants/permissions.js for permission string constants
- `backend/src/modules/auth/auth.controller.js:17-63` -- Login handler (Story 1.13 changes already in place: httpOnly cookie, no refreshToken in JSON)
- `backend/src/modules/auth/auth.controller.js:65-103` -- Refresh handler (Story 1.13 changes in place)
- `backend/src/modules/auth/auth.controller.js:105-118` -- Logout handler
- `backend/src/modules/auth/auth.controller.js:135-159` -- GET /auth/me handler

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/constants/permissions.js` -- Create constants file mirroring backend permission strings exactly (INVENTORY.BARCODE_GENERATE, ADMIN, CASHIER, etc.)
- [x] `frontend/src/services/authApi.js` -- Create thin wrappers: `login(username, password)`, `refresh()`, `logout()`, `getCurrentUser()` using apiClient with error handling that extracts server messages
- [x] `frontend/src/auth/AuthContext.jsx` -- Create provider with state (accessToken, currentUser, permissions, status), initialization logic for boot-time session restore, error handler for SESSION_EXPIRED; wire setAccessTokenGetter at mount
- [x] `frontend/src/auth/useAuth.js` -- Create hook that returns context state + `signOut()` action
- [x] `frontend/src/platform/apiClient.js` -- Add response interceptor for 401 handling: on 401, attempt one POST /auth/refresh, retry original request if successful, reject with SESSION_EXPIRED if refresh fails
- [x] `frontend/src/screens/SignIn.jsx` -- Create form screen with username/password inputs, submit button, error display, loading state; uses `useAuth()` to call login and handle errors
- [x] `frontend/src/__tests__/auth.test.js` -- Create automated test suite covering: successful login flow; invalid-credentials message display; boot-time restore success and failure; one-shot 401-triggered refresh-and-retry; refresh failure surfacing SESSION_EXPIRED without retry loop; signOut() flow; and that all auth calls use apiClient

**Acceptance Criteria:**
- Given a new staff member visits the app unsigned in, when the page loads, then no protected content renders
- Given valid credentials, when submitted via `SignIn.jsx`, then `POST /auth/login` is called and `AuthContext` stores the token + currentUser + permissions in memory, transitions status to `signed-in`, and the app can proceed to Story 1.15's routing
- Given invalid credentials, when submitted, then the server's error message displays inline on the form (not a generic "login failed")
- Given a valid httpOnly refresh token exists in the browser from a prior session, when the app boots, then `AuthContext` calls `POST /auth/refresh` (status `restoring`), calls `GET /auth/me`, and transitions to `signed-in` with the restored user + permissions
- Given the refresh fails (expired, revoked, or absent cookie) on boot, then status transitions to `signed-out`; no client-side storage is cleared because none was persisted
- Given an authenticated request receives a 401, when the response interceptor handles it, then exactly one `POST /auth/refresh` is attempted, the original request is retried unchanged if successful, and if refresh fails the error is `SESSION_EXPIRED` (distinct from `signed-out`)
- Given `SESSION_EXPIRED` error, when caught by `AuthContext`, then status transitions to `session-expired` with message "Your session expired. Sign in again to continue." and no other module's state (cart, forms, etc.) is cleared
- Given a signed-in session, when `useAuth().signOut()` is called, then `POST /auth/logout` is issued, the in-memory token is cleared, and status is `signed-out`

## Design Notes

**Why in-memory token over localStorage:** The 15-minute access token is short-lived and used only for the duration of a single user gesture (scan, sale, etc.). It does not need to survive a reload because the refresh-token cookie does; a reload simply triggers boot-time restore. Keeping it in memory avoids serialization overhead and the attack surface of client-side persistence.

**Why a separate SESSION_EXPIRED status:** Distinguishing `session-expired` from `signed-out` tells the user that their session was interrupted mid-task (page refresh required) rather than that they never signed in. This is a UX contract Story 1.15's app shell consumes.

**Why exactly one refresh attempt with request queueing:** If multiple requests receive 401 simultaneously without queueing, each would issue its own refresh request, creating a race condition where the second refresh might receive a 401 from the first refresh's newly-issued token before that token reaches all queued requests. Queueing ensures only the first refresh is issued; others wait for it to complete and then retry with the shared new token. This prevents the cascade of multiple failed refreshes and the resulting uncontrolled session expiry.

**Why 5-second timeout on POST /auth/refresh:** Auth endpoints should respond quickly (sub-second normally), but 5 seconds provides breathing room for occasional network/load spikes without leaving the UI frozen indefinitely. If refresh takes longer, better to fail fast (SESSION_EXPIRED) and let the user re-authenticate than wait with no feedback during an active counter scan or transaction.

**Why global error listener for SESSION_EXPIRED:** The interceptor is the only place that can reliably detect refresh failure across all authenticated API calls. A global unhandled promise rejection listener registered by AuthContext catches any SESSION_EXPIRED error that escapes the interceptor, ensuring handleSessionExpired() is always called — without requiring every authenticated service/component to wrap their calls in try/catch. This centralizes the error handling at the source (interceptor) rather than at every call site.

## Spec Change Log

**Loop 1 (2026-09-01): Three critical intent/bad-spec gaps fixed:**

1. **intent_gap: SESSION_EXPIRED error not caught** — Verification Gap reviewer found no error handler caught SESSION_EXPIRED when refresh fails mid-task. Fixed by: (a) adding global unhandled promise rejection listener to AuthContext at mount, (b) listener catches SESSION_EXPIRED and calls handleSessionExpired(), (c) updated I/O matrix and Code Map to reflect this flow. Known-bad state avoided: unhandled promise rejection, status never transitions to session-expired, user sees no message during session interruption.

2. **bad_spec: Concurrent 401 requests** — Edge Case Hunter found that multiple simultaneous 401s would each issue their own refresh, causing race condition where second refresh gets 401 from first refresh's token before token reaches all queued requests. Fixed by: (a) adding request queueing to 401 interceptor (only first refresh issued; others wait for it), (b) all queued requests retry with shared new token after first refresh completes. Known-bad state avoided: cascade of multiple failed refreshes, multiple SESSION_EXPIRED errors, UI confusion about which request actually failed.

3. **bad_spec: No timeout on POST /auth/refresh** — Neither spec nor implementation specified timeout; if backend hangs, entire UI freezes with no user feedback. Fixed by: adding 5-second timeout to POST /auth/refresh. Known-bad state avoided: indefinite UI freeze during active counter operation (scan or transaction), user unable to interact with app.

**KEEP:** All existing auth flows, boot-restore logic, login/logout flows, permission handling, and 20 test cases remain intact and valid. The three fixes are architectural enhancements to the interceptor and error handling paths.

## Verification

**Commands:**
- `npm run test -- auth.test.js` -- All auth unit tests pass
- `npm run build` -- Frontend builds without errors; no unused imports or missing dependencies
- `npm run lint` -- No linting errors in auth module files

**Manual checks:**
- Open the app unsigned, verify `SignIn.jsx` renders; submit invalid credentials and confirm the server's error message displays inline
- Sign in with valid credentials, reload the page, and confirm the session is restored (token + user appear in the console via `useAuth()`)
- Simulate a 401 by inspecting network and confirming one refresh request is issued before the original request is retried
- Sign out and confirm status transitions to `signed-out` and no navigation errors occur

## Suggested Review Order

**401 Response Interceptor & Token Refresh**

- X-Requested-With header added for backend CSRF protection via requireSpaHeader middleware.
  [`apiClient.js:80-82`](../../../frontend/src/platform/apiClient.js#L80)

- Request queueing prevents duplicate refresh requests when multiple 401s arrive simultaneously.
  [`apiClient.js:115`](../../../frontend/src/platform/apiClient.js#L115)

- AbortController timeout (5 seconds) cancels refresh if backend hangs; prevents indefinite UI freeze.
  [`apiClient.js:148-162`](../../../frontend/src/platform/apiClient.js#L148)

- SESSION_EXPIRED error thrown on refresh failure; distinct from generic 401 rejection.
  [`apiClient.js:168-170`](../../../frontend/src/platform/apiClient.js#L168)

**Authentication State Management**

- AuthProvider holds access token in memory only; never persists to localStorage or sessionStorage.
  [`AuthProvider.jsx:16`](../../../frontend/src/auth/AuthProvider.jsx#L16)

- Boot-time session restoration: attempts refresh via httpOnly cookie, fetches user, transitions to signed-in/signed-out.
  [`AuthProvider.jsx:77-113`](../../../frontend/src/auth/AuthProvider.jsx#L77)

- Global unhandledrejection listener catches SESSION_EXPIRED errors; prevents unhandled promise rejections.
  [`AuthProvider.jsx:130-165`](../../../frontend/src/auth/AuthProvider.jsx#L130)

- signIn and signOut callbacks manage token and user state; logout calls backend to revoke server-side session.
  [`AuthProvider.jsx:36-70`](../../../frontend/src/auth/AuthProvider.jsx#L36)

**Login UI & Services**

- SignIn screen displays server error messages inline; calls signIn via useAuth hook.
  [`SignIn.jsx`](../../../frontend/src/screens/SignIn.jsx)

- authApi service wrappers add error extraction (server messages) and handle redirect response structures.
  [`authApi.js`](../../../frontend/src/services/authApi.js)

**Supporting Infrastructure**

- Permission constants mirror backend exactly; enable permission-driven route guards in future stories.
  [`permissions.js`](../../../frontend/src/constants/permissions.js)

- useAuth hook exports auth state and actions; throws if used outside AuthProvider.
  [`useAuth.js`](../../../frontend/src/auth/useAuth.js)

- Auth tests cover login flow, boot restore, signOut, and SESSION_EXPIRED listener behavior.
  [`auth.test.jsx`](../../../frontend/src/__tests__/auth.test.jsx)
