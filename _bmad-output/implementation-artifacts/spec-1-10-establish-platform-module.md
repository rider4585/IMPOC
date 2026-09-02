---
title: 'Establish the platform module — idempotency, cold-start retry, envelope, money, and the API client'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context:
  - _bmad-output/planning-artifacts/epics/epic-01-foundation-barcode.md
  - _bmad-output/planning-artifacts/architecture/architecture-IMPOC-2026-08-20/ARCHITECTURE-SPINE.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every later frontend epic needs to implement cold-start retry logic, idempotency key generation, collection envelope parsing, money formatting, and API authentication. Reimplementing these five pieces across each epic causes inconsistency and bugs; AD-2, AD-19.1, AD-22, and AD-26 demand they be built once, centrally, and imported everywhere.

**Approach:** Create `frontend/src/platform/` with five standalone modules (`requestKey.js`, `wakingRequest.js`, `envelope.js`, `money.js`, `apiClient.js`) plus one shared axios instance exported by `apiClient.js`. Add test tooling (vitest, testing-library) for the first time in the frontend, with unit tests for each module covering the behaviors named below.

## Boundaries & Constraints

**Always:**
- Five new files in `frontend/src/platform/` exactly — no sixth module, no utilities directory alongside it.
- `apiClient.js` exports the single configured axios instance; no other module constructs an axios instance or calls `fetch`.
- `formatPaise()` in `money.js` is the only place division-by-100 money formatting logic exists in the frontend; no ad hoc `(paise / 100).toFixed(2)` anywhere else.
- `requestKey.js` exports `createRequestKey()` that returns `crypto.randomUUID()` — no alternative UUID library.
- Axios instance is created with `withCredentials: true` so httpOnly cookies attach to requests.
- Test runner is vitest with `@testing-library/react` and `@testing-library/jest-dom`; `vitest.config.js` is created; `"test": "vitest run"` added to `package.json` scripts.
- No breaking changes to existing App, BarcodeScanner, or component files (Story 1.16 retires the test scaffolding).

**Ask First:**
- If the axios instance setup requires authentication middleware that depends on Story 1.12 or 1.13 (permissions, tokens), clarify scope with human rather than hardcoding stubs.

**Never:**
- `platform/cart.js` — explicitly out of scope; Epic 5's Story 5.1 adds it to this module later.
- Creating a second axios instance or modifying axios globally (e.g., `axios.interceptors`).
- Hard-coded relative `/api/...` paths; base URL comes from `VITE_API_BASE_URL` env var.
- Default `localStorage` usage for tokens or credentials; httpOnly cookies and memory-held access tokens only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| **requestKey**: Normal call | None | UUIDv4 string | N/A |
| **formatPaise**: Valid paise | 12999 | "₹1,299.50" | N/A |
| **formatPaise**: Invalid input | -100 or "abc" | — | Throws TypeError |
| **wakingRequest**: <1200ms | Promise resolves in 500ms | Resolves with result | N/A |
| **wakingRequest**: 1200–90000ms | Promise unresolved at 1200ms, resolves at 5000ms | Surfaces `waking` at 1200ms, resolves at 5000ms with same key | N/A |
| **wakingRequest**: >90000ms | Promise unresolved at 90s | Surfaces `failed` at 90s with same request key, no new retry attempt | N/A |
| **envelope**: Valid collection | `{ success: true, data: { items: [...], page: 1, pageSize: 50, total: 100 } }` | Returns `{ items, page, pageSize, total }` unwrapped | N/A |
| **envelope**: Invalid shape | Bare array `[...]` or non-collection data | — | Throws error, never silently guesses |
| **apiClient**: Outgoing request | GET `/api/test` with no auth getter registered | Request sent with `withCredentials: true`, no `Authorization` header | N/A |
| **apiClient**: Access token injection | Getter returns "eyJ..." | Outgoing request includes `Authorization: Bearer eyJ...` | N/A |
| **apiClient**: Base URL from env | `VITE_API_BASE_URL=https://example.com/api` | All requests use that base | N/A |

</frozen-after-approval>

## Code Map

- `frontend/package.json` — Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom` to devDependencies; add `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/instrument-sans` to dependencies; add `"test": "vitest run"` to scripts. Currently declares axios, already declares @zxing/library.
- `frontend/src/main.jsx` — Will import fontsource packages once Story 1.11 lands; this story does not touch it.
- `frontend/src/` — No `platform/` directory exists yet; Story 1.10 creates it with five new files.
- `frontend/vitest.config.js` — New file, Vite preset, jsdom environment (needed for `crypto.randomUUID()` and DOM testing).
- `frontend/src/platform/requestKey.js` — New. Exports `createRequestKey()` → `crypto.randomUUID()`.
- `frontend/src/platform/wakingRequest.js` — New. Exports `wakingRequest(fn)` that wraps a promise, surfaces `waking` at 1200ms, `failed` at 90s.
- `frontend/src/platform/envelope.js` — New. Exports parser that unwraps `{ success, data: { items, page, pageSize, total } }` → `{ items, page, pageSize, total }`.
- `frontend/src/platform/money.js` — New. Exports `formatPaise(paise)` → "₹1,299.50" (half-up, 2dp, Indian grouping).
- `frontend/src/platform/apiClient.js` — New. Creates and exports one configured axios instance with `withCredentials: true`, base URL from `VITE_API_BASE_URL`, and `setAccessTokenGetter(fn)` injection point.
- `frontend/src/platform/requestKey.test.js`, `.../wakingRequest.test.js`, `.../envelope.test.js`, `.../money.test.js` — New test files covering all AC scenarios above.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/package.json` -- Add test and font dependencies, add test script -- Enables testing tooling and self-hosted fonts for Story 1.11.
- [x] `frontend/vitest.config.js` -- Create with jsdom environment, resolve React, setup testing-library -- Configures the test runner.
- [x] `frontend/src/platform/requestKey.js` -- Export `createRequestKey()` using `crypto.randomUUID()` -- Idempotency key generation per AD-22.
- [x] `frontend/src/platform/money.js` -- Export `formatPaise(paise)` with half-up rounding, Indian grouping, ₹ symbol; throw on non-integer or negative -- Single source of money formatting per AD-2.
- [x] `frontend/src/platform/envelope.js` -- Export parser that unwraps `{ success, data: { items, page, pageSize, total } }` and throws on invalid shape -- Collection parsing per AD-26.
- [x] `frontend/src/platform/wakingRequest.js` -- Export wrapper function that surfaces `{ status: 'waking' }` at 1200ms and `{ status: 'failed' }` at 90s with exponential backoff -- Cold-start retry per AD-19.1.
- [x] `frontend/src/platform/apiClient.js` -- Create axios instance with `withCredentials: true`, base URL from env var, and `setAccessTokenGetter(fn)` injection -- Shared API client per AD-19, AD-22.
- [x] `frontend/src/platform/requestKey.test.js` -- Unit tests for `createRequestKey()` structure and type -- Verify idempotency key format.
- [x] `frontend/src/platform/money.test.js` -- Unit tests for `formatPaise()` covering valid inputs (12999 → "₹1,299.50"), edge cases (0, 1, 100), and error cases (negative, non-integer, null) -- Verify money formatting.
- [x] `frontend/src/platform/envelope.test.js` -- Unit tests for parser covering valid collection, bare array rejection, and non-collection data rejection -- Verify envelope safety.
- [x] `frontend/src/platform/wakingRequest.test.js` -- Unit tests for timing: <1200ms resolves directly, 1200–90000ms surfaces `waking` then resolves, >90000ms surfaces `failed` with same key -- Verify cold-start retry contract.
- [x] `frontend/src/platform/apiClient.test.js` -- Unit tests for axios instance creation, base URL from env, access token injection via getter, and `withCredentials: true` in config -- Verify API client setup.

**Acceptance Criteria:**

- **Given** `platform/requestKey.js` exists and exports `createRequestKey()`
  **When** it is called
  **Then** it returns a string matching the UUID v4 format (36 chars including hyphens)
  **And** repeated calls return distinct values

- **Given** `platform/money.js` exports `formatPaise()`
  **When** called with `12999`
  **Then** it returns `"₹1,299.50"`
  **When** called with `0`
  **Then** it returns `"₹0.00"`
  **When** called with `-100` or `"abc"`
  **Then** it throws a `TypeError`

- **Given** `platform/envelope.js` exports a parser
  **When** called with `{ success: true, data: { items: [{uuid: "123"}], page: 1, pageSize: 50, total: 100 } }`
  **Then** it returns `{ items: [{uuid: "123"}], page: 1, pageSize: 50, total: 100 }`
  **When** called with a bare array `[{...}]`
  **Then** it throws an error (never silently returns the array)
  **When** called with `{ success: true, data: "not a collection" }`
  **Then** it throws an error

- **Given** `platform/wakingRequest.js` exports a request wrapper
  **When** the wrapped function resolves in <1200ms
  **Then** the wrapper resolves with the result immediately
  **When** the wrapped function remains unresolved after 1200ms
  **Then** the caller surfaces a `{ status: 'waking', requestKey }` object and continues retrying with exponential backoff
  **When** 90 seconds have elapsed without resolution
  **Then** the wrapper surfaces `{ status: 'failed', requestKey }` without issuing a new attempt

- **Given** `platform/apiClient.js` exports a configured axios instance
  **When** inspected
  **Then** its config includes `withCredentials: true`
  **And** its `baseURL` is read from the `VITE_API_BASE_URL` environment variable (never a hard-coded path)
  **And** it exports `setAccessTokenGetter(fn)` to register a function
  **When** a request is made after `setAccessTokenGetter((/* no param */) => "eyJ...")` is called
  **Then** the request carries `Authorization: Bearer eyJ...`
  **When** no getter is registered or the getter returns nothing
  **Then** the request carries no `Authorization` header

- **Given** `vitest` and `@testing-library/react` are added to `frontend/package.json`
  **When** `npm test` is run
  **Then** all five modules have automated test coverage and all tests pass

- **Given** the frontend app and build process
  **When** the build runs
  **Then** `frontend/package-lock.json` is regenerated; the app builds without errors; no existing components are broken

## Design Notes

**Cold-start wake/retry:** The wrapper does not block the UI thread. A component calling `wakingRequest(async () => fetch(...))` can still update state or re-render while waiting. The wrapper returns status objects (`{ status: 'waking' }` or `{ status: 'failed' }`) that the caller renders alongside the original promise. Backoff uses exponential timing: 1.2s → 2.4s → 4.8s, etc., capped at 30s between attempts.

**Money formatting:** The function throws (not silently defaults) on invalid input because an undetected format bug on a price is worse than a visible crash. Indian digit grouping: 1299.50 → "1,299.50" (groups of three from the right, with commas separating).

**Access token injection:** `setAccessTokenGetter()` is a simple function registration, not a middleware. It allows Story 1.14 (login) to inject the current token without this story depending on auth flows. A getter that returns `null`/`undefined` is treated as "no auth"; a getter that throws is not caught here.

**Axios base URL from env:** This allows the frontend build to be deployed separately from the backend (AD-19). `VITE_API_BASE_URL` defaults to something like `https://api.example.com/api` in production; locally it can be `http://localhost:3000/api`.

## Verification

**Commands:**
- `npm test` -- All five module tests and integration tests pass, no coverage gaps.
- `npm run build` -- Frontend builds successfully, no console errors or broken imports.

**Manual checks:**
- Inspect `frontend/src/platform/` — five `.js` files and five `.test.js` files exist.
- Inspect `frontend/package.json` — `vitest`, `@testing-library/react`, `@testing-library/jest-dom` in devDependencies; `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/instrument-sans` in dependencies.
- Inspect `frontend/vitest.config.js` — exists and exports a config with jsdom environment.

## Suggested Review Order

**HTTP Client Foundation**

- Configured axios instance with withCredentials, baseURL from env, token injection point; validates env var
  [`apiClient.js:8-45`](../../../frontend/src/platform/apiClient.js#L8)

**Request Management**

- UUID v4 generation with error handling for idempotency per AD-22
  [`requestKey.js:8-14`](../../../frontend/src/platform/requestKey.js#L8)

- Cold-start retry: waking at 1200ms, failure at 90s, exponential backoff with jitter, timer cleanup on resolution
  [`wakingRequest.js:14-90`](../../../frontend/src/platform/wakingRequest.js#L14)

**Response Handling**

- Collection envelope parser: validates success flag, unwraps shape, type-checks fields
  [`envelope.js:8-50`](../../../frontend/src/platform/envelope.js#L8)

**Data Formatting**

- Paise-to-rupee with half-up rounding, Indian grouping (2/3 from right), strict validation on input
  [`money.js:8-36`](../../../frontend/src/platform/money.js#L8)

**Testing & Configuration**

- Vitest setup with jsdom, React, testing-library; 64 tests covering all modules and error paths
  [`vitest.config.js:1-12`](../../../frontend/vitest.config.js#L1)

- Test dependencies and script added; fontsource packages for self-hosted typography (Story 1.11)
  [`package.json:6-30`](../../../frontend/package.json#L6)
