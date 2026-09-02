---
title: 'Story 1.13: Move refresh-token delivery to an httpOnly cookie, with the CORS policy that makes it deliverable'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Refresh tokens are currently returned in POST /auth/login and POST /auth/refresh response bodies as plain JSON, exposing a 7-day-lived credential to any script running in the page. JavaScript can read and exfiltrate it via `localStorage` or inline scripts, violating the security model that requires long-lived tokens be inaccessible to the page's own code.

**Approach:** Move refresh-token delivery from the JSON response body to an httpOnly, cross-site cookie scoped to `/api/auth`, and add CORS middleware with an explicit origin from a new `FRONTEND_ORIGIN` env var. This makes the token invisible to JavaScript and requires genuine cross-origin `fetch` requests to succeed, both of which are prerequisites for later epics' frontend flows.

## Boundaries & Constraints

**Always:**
- The `cors` package must be added to `backend/package.json` and configured with a single explicit origin read from `FRONTEND_ORIGIN` env var — never a wildcard, since `credentials: true` is incompatible with wildcard origins.
- `FRONTEND_ORIGIN` must be added to `.env.example` alongside existing `JWT_*` variables.
- POST /auth/login's JSON response must no longer include a `refreshToken` field — only `accessToken` and `refreshTokenExpiresAt` remain.
- POST /auth/refresh's JSON response must no longer include a `refreshToken` field.
- POST /auth/logout and POST /auth/logout-all must call `res.clearCookie('refreshToken', { path: '/api/auth' })` to clear the server-side cookie.
- The refresh-token cookie must have attributes: `httpOnly: true, secure: true, sameSite: 'none', path: '/api/auth'`.
- A `requireSpaHeader` middleware must reject with 403 any request to `/auth/refresh`, `/auth/logout`, and `/auth/logout-all` that lacks the `X-Requested-With: IMPOC-SPA` header — this mitigates nuisance requests (spurious cookie rotation, forced logout) from cross-site forms or images.
- Automated tests must confirm: (1) login response body carries no `refreshToken` field and `Set-Cookie` header includes `HttpOnly`, `Secure`, `SameSite=None`, `Path=/api/auth`; (2) refresh succeeds when cookie is present and fails when absent; (3) refresh and logout both reject requests missing `X-Requested-With: IMPOC-SPA` with 403.
- `cookie-parser` middleware must be mounted in `app.js` to populate `req.cookies`.

**Ask First:** None.

**Never:**
- Do not add a general route-wide CORS configuration that applies to all endpoints — only the auth routes need this in this story.
- Do not store the refresh token anywhere else (e.g., a session table, Redis) — the cookie is the only store.
- Do not modify the token generation or expiry logic; reuse the same `session.expiresAt` already computed by `createAuthTokens()` and `refreshAuthTokens()`.
- Do not add a `preferences` field to login or refresh responses — that is deferred to Epic 12.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid CASHIER login | POST /auth/login with valid credentials | Response status 200, `data` contains `accessToken` and `refreshTokenExpiresAt` only (no `refreshToken` field), `Set-Cookie` header present with `HttpOnly; Secure; SameSite=None; Path=/api/auth` | N/A |
| Valid session refresh | POST /auth/refresh with valid httpOnly cookie present | Response status 200, new `accessToken` in `data`, new `Set-Cookie` header with rotated token's expiry | 400 if no cookie or parsing fails |
| Missing cookie on refresh | POST /auth/refresh with no cookie present | Request fails at validation stage (cookie missing) | 400/401 response |
| Cross-site form attempt to refresh | Cross-site form submits to POST /auth/refresh | Browser attaches cookie (SameSite=None allows it) but request lacks `X-Requested-With` header | 403 Forbidden |
| Genuine cross-origin SPA refresh | Cross-origin fetch to POST /auth/refresh with `X-Requested-With: IMPOC-SPA` from configured `FRONTEND_ORIGIN` | Request succeeds, cookie and new access token returned | N/A |
| Logout with valid session | POST /auth/logout with valid cookie and `X-Requested-With` header | Response status 200, cookie is cleared via `Set-Cookie` with `expires` in past, in-memory session revoked | N/A |
| Invalid origin calling login | POST /auth/login from `other-domain.com` when `FRONTEND_ORIGIN=https://app.example.com` | CORS preflight fails (no `Access-Control-Allow-Origin` header) | 403 (browser blocks response) |

</frozen-after-approval>

## Code Map

- `backend/app.js:20-25` -- Only contains `express.json()` and logging middleware; CORS and cookie-parser must be added here before routes
- `backend/src/modules/auth/auth.controller.js:17-48` -- POST /auth/login handler currently returns `refreshToken` in JSON body (line 41); needs to set cookie and remove field instead
- `backend/src/modules/auth/auth.controller.js:50-69` -- POST /auth/refresh handler currently returns `refreshToken` in JSON body (line 62); needs to read from `req.cookies.refreshToken` and set new cookie
- `backend/src/modules/auth/auth.controller.js:71-85` -- POST /auth/logout handler; needs to add `res.clearCookie('refreshToken', { path: '/api/auth' })`
- `backend/src/modules/auth/auth.controller.js:87-95` -- POST /auth/logout-all handler; needs to add same cookie clearing
- `backend/src/modules/auth/auth-token.service.js:17-32` -- `createAuthTokens()` returns token object; no changes needed, but implementer reuses `expiresAt` for cookie expiry
- `backend/src/modules/auth/auth.routes.js` -- Routes defined; no changes to route definitions, but requireSpaHeader middleware will wrap specific routes
- `backend/tests/auth/auth.test.js:22-226` -- All login and refresh tests currently expect `refreshToken` in response body; must be updated to check `Set-Cookie` headers and test cookie absence scenarios
- `backend/package.json` -- Must add `cors` to dependencies (may already have `cookie-parser`; verify)

## Tasks & Acceptance

**Execution:**
- [x] `backend/package.json` -- Add `cors` package to dependencies if not present
- [x] `backend/app.js` -- Import `cors` and `cookieParser` at top; mount `cookieParser()` after `express.json()` (around line 22)
- [x] `backend/app.js` -- Create CORS config reading `FRONTEND_ORIGIN` from env; mount `cors(corsConfig)` before routes (reject if `FRONTEND_ORIGIN` is missing or falsy)
- [x] `backend/app.js` -- Create `requireSpaHeader` middleware that checks `X-Requested-With: IMPOC-SPA` header and responds with 403 if absent
- [x] `backend/src/modules/auth/auth.controller.js` -- Modify `login` handler to call `res.cookie('refreshToken', tokens.refreshToken, { httpOnly: true, secure: true, sameSite: 'none', path: '/api/auth', expires: tokens.expiresAt })` and remove `refreshToken` field from response data
- [x] `backend/src/modules/auth/auth.controller.js` -- Modify `refresh` handler to read `const refreshToken = req.cookies.refreshToken` instead of from body, and set new cookie on rotated token
- [x] `backend/src/modules/auth/auth.controller.js` -- Modify `logout` and `logout-all` handlers to add `res.clearCookie('refreshToken', { path: '/api/auth' })` before response
- [x] `backend/src/modules/auth/auth.routes.js` -- Wrap `/auth/refresh`, `/auth/logout`, and `/auth/logout-all` routes with `requireSpaHeader` middleware
- [x] `.env.example` -- Add `FRONTEND_ORIGIN=http://localhost:3000` (or appropriate production value)
- [x] `backend/tests/auth/auth.test.js` -- Update login tests (lines 43-177): remove assertions checking for `refreshToken` in response body, add assertions checking `Set-Cookie` header for `HttpOnly`, `Secure`, `SameSite=None`, `Path=/api/auth`
- [x] `backend/tests/auth/auth.test.js` -- Update refresh tests (lines 179-226): change `.send({ refreshToken })` to set cookies via supertest agent or use cookie assertions; add test for refresh failing when cookie is absent
- [x] `backend/tests/auth/auth.test.js` -- Add test: POST /auth/refresh without `X-Requested-With` header returns 403
- [x] `backend/tests/auth/auth.test.js` -- Add test: POST /auth/logout clears cookie and returns 200

**Acceptance Criteria:**
- Given a valid user logs in via POST /auth/login, when the response is received, then `data` contains `accessToken` and `refreshTokenExpiresAt` only (no `refreshToken` key), and the response headers contain a `Set-Cookie` with `HttpOnly; Secure; SameSite=None; Path=/api/auth`
- Given a valid session with an httpOnly refresh-token cookie, when POST /auth/refresh is called from the configured `FRONTEND_ORIGIN` with `X-Requested-With: IMPOC-SPA` header, then the response status is 200, `data` contains a new `accessToken`, and a new `Set-Cookie` header is present with the rotated token's expiry
- Given a POST /auth/refresh request without the cookie present, when the request is made, then validation fails with a 400 or 401 response
- Given a POST /auth/refresh request lacking `X-Requested-With: IMPOC-SPA` header, when the request is made, then the response status is 403 Forbidden
- Given a POST /auth/logout with a valid session cookie, when the request is made, then the response status is 200, the `Set-Cookie` header clears the cookie (sets `expires` to past), and the server-side session is revoked
- Given a cross-origin request from a different origin (not `FRONTEND_ORIGIN`), when POST /auth/login is called, then the CORS preflight fails and the browser blocks the response

## Design Notes

**Why httpOnly cookies over localStorage:** The refresh token must not be readable by JavaScript so that inline scripts, XSS payloads, or `eval()`-based attacks cannot exfiltrate it. A long-lived credential (7 days) in `localStorage` creates a persistent attack surface; a server-controlled httpOnly cookie does not.

**Why `sameSite: 'none'` instead of `strict` or `lax`:** The frontend is deployed on a different origin from the backend (AD-19), so the browser must attach the cookie to cross-origin requests. `sameSite: 'strict'` would forbid this. `sameSite: 'none'` allows the cookie to travel on cross-site requests from any origin, but only if the server explicitly opts in via `credentials: true` in CORS — that is part of the contract this story establishes.

**Why `X-Requested-With` header requirement:** A cross-site form (HTML `<form>`, native image/link navigation) can attach the cookie (because `sameSite: 'none'`) but cannot set custom HTTP headers. A genuine cross-origin `fetch` or XHR from the browser or a native app can set the header. This distinguishes legitimate cross-origin requests from a passive CSRF attack (form submission or pixel load). The header value is arbitrary but fixed; `IMPOC-SPA` identifies the SPA as the legitimate caller.

## Verification

**Commands:**
- `cd backend && npm test -- auth.test.js` -- All auth tests must pass, including new tests for cookie handling and header validation
- `cd backend && npm test -- --coverage backend/src/modules/auth` -- Coverage for auth module must be maintained or improved

**Manual checks:**
- Use curl or Postman to call POST /auth/login from the configured origin and verify `Set-Cookie` header is present with correct attributes (no manual inspection needed if tests pass)
- Call POST /auth/refresh without the cookie and confirm 400/401 response
- Call POST /auth/refresh with cookie but without `X-Requested-With` header and confirm 403 response

## Suggested Review Order

**CORS & Environment Validation**

- Foundation for cross-origin cookie delivery; reads FRONTEND_ORIGIN and validates URL format.
  [`app.js:20-40`](../../backend/app.js#L20)

- Dependency additions required for cookie-parser and CORS middleware.
  [`package.json`](../../backend/package.json)

**Cookie Lifecycle & Token Delivery**

- Login endpoint: removes refreshToken from JSON body, sets httpOnly cookie with secure/sameSite attributes.
  [`auth.controller.js:17-48`](../../backend/src/modules/auth/auth.controller.js#L17)

- Refresh endpoint: reads token from request cookie instead of body, rotates and re-sets cookie on success.
  [`auth.controller.js:50-69`](../../backend/src/modules/auth/auth.controller.js#L50)

- Logout endpoints: clears refresh token cookie server-side to revoke session completely.
  [`auth.controller.js:71-95`](../../backend/src/modules/auth/auth.controller.js#L71)

- Updated validation schema to accept empty refresh body (token now in cookie, not JSON).
  [`auth.validation.js`](../../backend/src/modules/auth/auth.validation.js)

**CSRF Protection via Custom Header**

- Middleware that validates X-Requested-With header for sensitive auth operations; case-insensitive, trims whitespace.
  [`require-spa-header.middleware.js`](../../backend/src/middleware/require-spa-header.middleware.js)

- Routes wrapped with requireSpaHeader: refresh, logout, logout-all (login lacks header validation per design).
  [`auth.routes.js`](../../backend/src/modules/auth/auth.routes.js)

**Test Coverage**

- Login and refresh tests updated to assert Set-Cookie headers with correct attributes; removed body token assertions.
  [`auth.test.js:23-279`](../../backend/tests/auth/auth.test.js#L23)

- Logout tests verify cookie clearing and X-Requested-With validation; edge cases for malformed cookies and case variants.
  [`auth.test.js:283-447`](../../backend/tests/auth/auth.test.js#L283)

**Configuration & Environment**

- Environment variable documentation with example value for local/production deployment.
  [`env.example`](../../backend/.env.example)
