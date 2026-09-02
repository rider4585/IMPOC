---
title: Fix Doubled /api Prefix Bug
type: bugfix
created: 2026-09-02
status: done
baseline_commit: NO_VCS
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The barcode print screen fails to load with "Cannot GET /api/api/barcodes/generate" — the /api prefix is doubled. Root cause: `VITE_API_BASE_URL` is already `http://localhost:3001/api`, so all apiClient calls should pass paths WITHOUT /api. Auth calls follow this convention (`/auth/login`, `/auth/refresh`), but two barcode files break it.

**Approach:** Remove the `/api` prefix from the two broken call sites, update the test assertion to match the correct path, and implement one prevention mechanism so this doesn't recur as new screens are added.

## Boundaries & Constraints

**Always:** 
- apiClient base URL already includes `/api` — paths passed to apiClient.get/post/put/delete must NOT start with `/api`
- Test changes must align with production code changes
- Prevention mechanism must catch doubled slashes in API paths

**Ask First:** None

**Never:** 
- Do not change VITE_API_BASE_URL or the apiClient configuration
- Do not add /api prefix to other auth or service calls

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Barcode print after fix | User requests 7 pages | apiClient.get('/barcodes/generate', {params: {pages: 7, ...}}) | N/A |
| Barcode scan after fix | Scan data submitted | apiClient.post('/stock-intake-lines/{uuid}/scan', {...}) | N/A |
| Test assertion | componentRenders and button clicked | apiClient.get called with '/barcodes/generate' (not '/api/barcodes/generate') | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/screens/BarcodePrintScreen.jsx:49` — Broken call: `apiClient.get('/api/barcodes/generate', ...)`. Fix: remove `/api` prefix.
- `frontend/src/services/barcodeApi.js:56` — Broken URL: `/api/stock-intake-lines/${stockIntakeLineUuid}/scan`. Fix: remove `/api` prefix.
- `frontend/src/screens/__tests__/BarcodePrintScreen.test.js:79` — Test assertion expects wrong path: `/api/barcodes/generate`. Fix: update to `/barcodes/generate`.
- `frontend/src/platform/apiClient.js` — Defines baseURL from VITE_API_BASE_URL (already includes `/api`). Reference only, do not modify.
- `frontend/src/services/authApi.js` — Shows correct pattern: calls like `apiClient.post('/auth/login', ...)` with NO `/api` prefix. Reference for prevention strategy.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/screens/BarcodePrintScreen.jsx:49` -- Change `apiClient.get('/api/barcodes/generate', ...)` to use centralized route constant -- Aligns with apiClient convention where base URL already includes /api
- [x] `frontend/src/services/barcodeApi.js:56` -- Change `/api/stock-intake-lines/${stockIntakeLineUuid}/scan` to use centralized route constant -- Same convention fix
- [x] `frontend/src/screens/__tests__/BarcodePrintScreen.test.js:79` -- Update assertion to match corrected behavior with centralized constant -- Test must reflect correct behavior
- [x] `frontend/src/platform/routes.js` -- Create new centralized routes file exporting path constants for barcode endpoints -- Prevents future occurrences by centralizing path definitions
- [x] Update BarcodePrintScreen.jsx to import and use centralized path constant instead of hardcoded string
- [x] Update barcodeApi.js to import and use centralized path constant instead of hardcoded string

**Acceptance Criteria:**
- Given the barcode print screen is rendered in a browser, when the user requests a PDF sheet, then the request is made to `/barcodes/generate` (not `/api/api/barcodes/generate`)
- Given the barcode scan endpoint is called, when stock intake data is submitted, then the request is made to `/stock-intake-lines/{uuid}/scan` (not `/api/api/...`)
- Given the test suite runs, when BarcodePrintScreen.test.js executes, then the assertion expects the correct path without doubling
- Given the centralized routes file exists, when a developer adds a new barcode or API call, then they import from `frontend/src/platform/routes.js` instead of hardcoding strings, eliminating the doubled-prefix risk

## Spec Change Log

**Loop 1 — Review findings (4 patches applied):**
- UUID validation missing in STOCK_INTAKE_ROUTES.SCAN → Added validation, encoding, and JSDoc to prevent malformed URLs and injection vulnerabilities
- No unit test coverage for routes.js → Created `frontend/src/platform/__tests__/routes.test.js` with 14 comprehensive tests covering both barcode and stock intake routes
- Tests don't verify full URL construction (baseURL + path) → Added test in BarcodePrintScreen.test.js verifying that `/api` + `/barcodes/generate` = `/api/barcodes/generate`
- Missing JSDoc for SCAN function → Added complete JSDoc documenting parameter format, return value, and error conditions
- **KEEP:** All original fixes remain intact. New tests confirm the bug fix is correct and prevent regression.

## Design Notes

**Why this bug existed:** Mocked apiClient in tests never resolve against the configured base URL, so they pass even with malformed paths. The actual browser request fails because the doubled prefix doesn't match any backend route.

**Centralized routes approach:** Creating `frontend/src/platform/routes.js` eliminates URL string duplication at the source. Screens import path constants instead of hardcoding strings. This prevents the bug class entirely — a screen developer can't accidentally add `/api` if they're using constants.

## Verification

**Commands:**
- `npm test -- BarcodePrintScreen.test.js` -- expected: All tests pass with updated assertion
- `npm run build` -- expected: No build errors or type errors

**Manual checks (if no CLI):**
- Open browser, navigate to barcode print screen, submit request → verify it makes a call to `/api/barcodes/generate` (correct single /api in full URL via network tab)
- Verify barcode scan feature works end-to-end with corrected path

## Suggested Review Order

**Prevention Mechanism**

- Centralized route constants prevent hardcoding `/api` prefix in future screens.
  [`routes.js:1`](../../../frontend/src/platform/routes.js#L1)

- UUID validation and encoding guard against malformed paths and injection.
  [`routes.js:17`](../../../frontend/src/platform/routes.js#L17)

**Screen & Service Updates**

- Screen imports and uses centralized barcode route constant.
  [`BarcodePrintScreen.jsx:5`](../../../frontend/src/screens/BarcodePrintScreen.jsx#L5)

- Service imports and uses centralized stock intake route function.
  [`barcodeApi.js:10`](../../../frontend/src/services/barcodeApi.js#L10)

**Test Coverage**

- Unit tests verify route constant correctness and encoding behavior.
  [`routes.test.js:1`](../../../frontend/src/platform/__tests__/routes.test.js#L1)

- URL construction test proves baseURL + path = correct single-/api prefix.
  [`BarcodePrintScreen.test.js:337`](../../../frontend/src/screens/__tests__/BarcodePrintScreen.test.js#L337)

- Screen test assertion uses centralized constant instead of hardcoded string.
  [`BarcodePrintScreen.test.js:80`](../../../frontend/src/screens/__tests__/BarcodePrintScreen.test.js#L80)
