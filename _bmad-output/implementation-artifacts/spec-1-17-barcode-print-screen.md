---
title: 'Story 1.17: Barcode print screen'
type: 'feature'
created: '2026-09-01'
status: 'done'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
context: [
  '_bmad-output/planning-artifacts/epics/epic-01-foundation-barcode.md',
  '_bmad-output/implementation-artifacts/epic-1-context.md',
]
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 1 builds backend infrastructure and frontend foundation (auth, platform module, theme, routing) but ships nothing an inventory manager can use at the shop. The `/generate` barcode endpoint exists but has no UI, leaving the epic infrastructure-complete but unusable.

**Approach:** Implement `BarcodePrintScreen.jsx` to let staff request N-page barcode sheets through the app they already carry. The screen consumes the platform module's idempotency, cold-start retry, and API client contracts established in Stories 1.10–1.14; it wires them to the existing backend `/api/barcodes/generate` endpoint; and it fulfills CAP-1's user-facing acceptance bar: "request and receive a sheet of blank barcode labels."

## Boundaries & Constraints

**Always:** 
- Route is permission-gated by navigation registry (Story 1.15); do not add a secondary guard
- Request key is minted once when screen is entered; same key is reused across all retries of the same attempt; fresh key only if staff navigates away and back
- Cold-start waking status appears at 1200ms; 90-second failure timeout; both come from `wakingRequest.js`
- First-attempt success returns PDF binary; response handling triggers download with filename `barcodes.pdf`
- Replay success (same requestUuid) returns JSON; no download; show "already generated" message instead
- Error messages come from server response, displayed inline, never generic
- Validation errors for non-positive page counts are server-side; screen shows the message
- 403 on an unpermitted role redirects through `RouteGuard` (Story 1.15), not rendered here
- `pages` input accepts a positive integer; story does not enforce bounds, validation is backend's job

**Ask First:** 
- [None]

**Never:** 
- Do not build a UI for `/test-sheet` (calibration sheet); it remains API-only for Story 1.5's physical caliper check
- Do not persist request key to localStorage or sessionStorage
- Do not default or pre-fill pages input; user must supply a value
- Do not show a loading spinner or disabled state during waking; use the banner component instead

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| **First-attempt success** | Valid pages (e.g., 5), first requestUuid | PDF response; blob downloaded as `barcodes.pdf`; success message "Sheet generated — 5 page(s)." | N/A |
| **Replay (cached)** | Same requestUuid as prior success | JSON `{ success: true, message, data: { resultUuid } }`; no download triggered; message "This sheet was already generated in your last attempt. Nothing new was printed — use the copy you already have." | N/A |
| **Cold-start waking** | Request unresolved at 1200ms | `wakingRequest.js` returns `{ status: 'waking', requestKey }`; screen shows waking banner (`{components.waking-banner}`) without blocking other UI | Screen remains interactive; form stays usable |
| **Cold-start failure** | Request unresolved at 90s | `wakingRequest.js` returns `{ status: 'failed', requestKey }`; screen shows retained-key "Try again" state, reusing same requestUuid on user retry | Allow staff to retry with same key |
| **Validation error (e.g., invalid page count)** | Non-numeric, zero, or negative pages | Server returns 400 or 422; screen shows server's error message inline on form | Display error, clear form (optional), allow resubmit |
| **Permission denied (403)** | User lacks `INVENTORY.BARCODE_GENERATE` but somehow reaches route (e.g., direct URL after permissions change) | `RouteGuard` redirects before screen renders (Story 1.15 behavior) | Redirect to first permitted route |

</frozen-after-approval>

## Code Map

- `frontend/src/screens/BarcodePrintScreen.jsx` — Placeholder; implement full component here. Exported and already wired to navigation registry (Story 1.15).
- `frontend/src/app/navigation.js` — Registry entry already defined: `{ permission: PERMISSIONS.INVENTORY.BARCODE_GENERATE, label: 'Print labels', path: '/barcode-sheets', element: BarcodePrintScreen }`. No changes needed.
- `frontend/src/platform/requestKey.js` — Provides `createRequestKey()` to mint UUIDv4 per AD-22.
- `frontend/src/platform/wakingRequest.js` — Wraps async functions with cold-start detection (1200ms waking, 90s failure timeout).
- `frontend/src/platform/apiClient.js` — Configured axios instance with `withCredentials: true` (Story 1.10). Use for GET `/api/barcodes/generate`.
- `frontend/src/constants/permissions.js` — `PERMISSIONS.INVENTORY.BARCODE_GENERATE = 'inventory.barcode_generate'`. Already declared and seeded (Story 1.7).
- `backend/src/modules/barcode/barcode.controller.js` — Existing `generateBarcodePdf` endpoint: first attempt returns PDF binary, replay returns JSON `{ success, data: { resultUuid } }`. Query params: `pages` (positive int), `requestUuid` (UUID).
- `backend/src/modules/barcode/barcode.validation.js` — Validates `pages` and `requestUuid`. Refer to error shapes it produces.
- `frontend/src/theme/tokens.css` — `.surface-flat` class for form styling per DESIGN.md default surface rule.
- `EXPERIENCE.md` → Voice and Tone, Responsive & Platform, Cold Start and Retry Contract — Reference for message phrasing, responsive layout rules, and waking-banner contract.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/screens/BarcodePrintScreen.jsx` -- Implement component with pages input, form, and request logic -- Deliver the user-facing screen
- [x] Add unit tests covering: valid submission → PDF download, replay → "already generated" message, waking banner display, error message display, validation error handling

**Acceptance Criteria:**
- Given staff member on the Print Labels screen with valid permissions, when they enter `5` pages and submit, then the screen calls `GET /api/barcodes/generate?pages=5&requestUuid={key}` through the platform apiClient, receives a PDF response, downloads it as `barcodes.pdf`, and shows "Sheet generated — 5 page(s)."
- Given the same request replayed with the same requestUuid, when submitted, then the endpoint returns `{ success: true, message, data: { resultUuid } }`, the screen does not trigger a download, and shows "This sheet was already generated in your last attempt. Nothing new was printed — use the copy you already have."
- Given a request unresolved at 1200ms, when the cold-start threshold passes, then `wakingRequest.js` returns `{ status: 'waking', requestKey }` and the screen renders the waking banner without blocking form interaction.
- Given a request unresolved at 90s, when the failure threshold passes, then `wakingRequest.js` returns `{ status: 'failed', requestKey }` and the screen surfaces a "Try again" state that reuses the same requestUuid on retry.
- Given a validation error (e.g., non-positive pages), when the server returns a 400 or 422 response with an error message, then the screen displays that message inline on the form.
- Given a signed-in `CASHIER` user (who lacks `INVENTORY.BARCODE_GENERATE`), when they navigate to `/barcode-sheets` directly, then `RouteGuard` (Story 1.15) redirects them away before any part of this screen renders.
- Given a signed-in `INVENTORY_MANAGER` user with permission, when they reach the screen and submit, then the screen uses `platform/apiClient.js` to issue the request (not fetch or a separate axios instance), and the browser's withCredentials flag attaches the httpOnly refresh token to the auth endpoint automatically per Story 1.13's cookie scope.

## Spec Change Log

<!-- Append-only. Populated by step-04 during review loops. Empty until first loopback. -->

## Design Notes

**Component structure & state:** The screen holds one piece of transient state: `requestKey`, minted via `createRequestKey()` on mount and retained for retries until the user navigates away. On first entry, key is new. On return to the screen (after navigating elsewhere), a fresh key is minted on re-mount. This aligns with the EXPERIENCE.md rule "the key's lifetime is the sheet's lifetime."

**Response handling difference:** The backend returns two distinct response types:
- **First attempt:** `application/pdf` binary; must be read as a Blob and triggered as a download
- **Replay:** `{ success: true, message, data: { resultUuid } }` JSON; no download; message shown instead

The screen must detect response type (check Content-Type header or try-catch on blob parsing) and branch accordingly.

**Waking banner:** `wakingRequest.js` returns a status object `{ status: 'waking', requestKey }` at 1200ms if the promise is still pending. The screen should render `{components.waking-banner}` (EXPERIENCE.md) without blocking the form. On success or failure, the banner is replaced with the actual result.

**Message phrasing:** Per EXPERIENCE.md Voice and Tone ("name the specific thing"), success shows the requested page count: "Sheet generated — {n} page(s)." Errors show the server's own message. Replay shows the specific alternative message to distinguish it from a new success.

</Specification>

## Verification

**Commands:**
- `npm test` (in `frontend/`) -- All tests pass, including Story 1.17 tests
- `npm run build` (in `frontend/`) -- No build errors or warnings

**Manual checks (if no CLI):**
- Open the app, sign in as `INVENTORY_MANAGER`, navigate to "Print labels" screen
- Enter `5` in the pages field and submit; after ~1s, verify waking banner appears; after full response, verify PDF downloads as `barcodes.pdf`
- Refresh the page, return to the screen, submit the same page count; verify "already generated" message appears and no new download occurs
- Enter invalid input (e.g., `-5` or `abc`) and verify server error message displays inline
- As a `CASHIER` user, attempt to reach `/barcode-sheets` directly; verify redirect to first permitted route

## Suggested Review Order

**Component Implementation**

- Mints request key once on mount; reuses across retries; fresh key on re-entry per spec contract
  [`BarcodePrintScreen.jsx:28-31`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L28)

- Wraps API call with wakingRequest for cold-start retry (1200ms waking, 90s failure timeout)
  [`BarcodePrintScreen.jsx:47-58`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L47)

**Response Handling**

- Detects response type by Content-Type header; branches PDF vs JSON paths accordingly
  [`BarcodePrintScreen.jsx:75-96`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L75)

- First attempt: downloads PDF blob as `barcodes.pdf`; shows success with page count
  [`BarcodePrintScreen.jsx:78-91`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L78)

- Replay: shows "already generated" message; no download; prevents re-generation
  [`BarcodePrintScreen.jsx:93-96`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L93)

**State Management & Double-Submit Protection**

- Keeps form disabled during waking and failed states to prevent double-submit
  [`BarcodePrintScreen.jsx:61-71`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L61)

- Retry button restores loading state; clears error and status on re-attempt
  [`BarcodePrintScreen.jsx:107-111`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L107)

**Error Handling**

- Sanitizes error messages; ensures string type to prevent XSS injection
  [`BarcodePrintScreen.jsx:98-104`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L98)

- Server errors displayed inline; no generic messages; form remains usable
  [`BarcodePrintScreen.jsx:146-150`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L146)

**UI & Styling**

- Form with pages input; remains interactive during waking banner display
  [`BarcodePrintScreen.jsx:152-181`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L152)

- Waking, success, replay, and error states styled per DESIGN.md surface rules
  [`BarcodePrintScreen.css`](../../../frontend/src/screens/BarcodePrintScreen.css)

**Test Coverage**

- 16 comprehensive tests: initial render, validation, PDF/JSON responses, retry flow, error handling
  [`BarcodePrintScreen.test.js:23-340`](../../../frontend/src/screens/__tests__/BarcodePrintScreen.test.js#L23)

- Verification gaps covered: page count display, filename accuracy, retry success, error state
  [`BarcodePrintScreen.test.js:324-340`](../../../frontend/src/screens/__tests__/BarcodePrintScreen.test.js#L324)
