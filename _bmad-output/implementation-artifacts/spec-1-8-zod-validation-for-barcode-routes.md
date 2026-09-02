---
title: 'Story 1.8: Zod validation for barcode routes'
type: 'refactor'
created: '2026-08-26'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/backend/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Barcode routes currently validate incoming requests with hand-built error responses instead of following the repo's standard error-shaping convention. This creates inconsistency with how other modules handle validation failures and makes error handling harder to maintain.

**Approach:** Extract barcode request validation into a dedicated Zod schema module (`barcode.validation.js`), integrate it with the controller using the repo's standard validation middleware pattern, and ensure validation failures call `next(error)` to delegate error shaping to the error middleware.

## Boundaries & Constraints

**Always:**
- Validation is delegated to a dedicated `barcode.validation.js` module with Zod schemas (one schema per endpoint).
- The controller uses `schema.parse()` inside a try-catch block and calls `next(error)` on validation failure.
- Validation errors are shaped by the existing `error.middleware.js` — the controller does not construct error responses.
- The `pages` parameter is validated as a positive integer (≥ 1); `requestUuid` is validated as a valid UUID string.
- No hand-built `{ success: false, message }` or similar error objects exist in the barcode module after this story.

**Ask First:**
- Any proposal to add validation at the middleware layer (before the controller) — the pattern is controller-side schema validation with error-middleware shaping.
- Any request to validate additional parameters or constraints beyond what's in the current `/generate` and `/test-sheet` routes.

**Never:**
- Never silence validation errors or return default values on parse failure — validation exceptions must propagate to the error middleware.
- Never use role-name checks or string-literal permissions in validation — authorization is already enforced at the route layer via middleware.
- Never duplicate error handling logic across routes; all Zod errors follow the same path to `error.middleware.js`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid `/generate` request | `pages=1&requestUuid=550e8400-e29b-41d4-a716-446655440000` | Validation passes, controller proceeds to generate PDF | N/A |
| Invalid `pages` (non-numeric) | `pages=abc&requestUuid=550e8400-e29b-41d4-a716-446655440000` | Validation fails at `schema.parse()`, error is caught and `next(error)` is called | Error middleware returns 400 with standard error shape |
| Invalid `pages` (zero) | `pages=0&requestUuid=550e8400-e29b-41d4-a716-446655440000` | Validation fails (minimum is 1), error flows to middleware | Error middleware returns 400 with validation error message |
| Invalid `pages` (negative) | `pages=-5&requestUuid=550e8400-e29b-41d4-a716-446655440000` | Validation fails, error flows to middleware | Error middleware returns 400 |
| Invalid `requestUuid` (malformed) | `pages=1&requestUuid=not-a-uuid` | Validation fails at UUID check, error flows to middleware | Error middleware returns 400 with UUID error message |
| Valid `/test-sheet` request | `requestUuid=550e8400-e29b-41d4-a716-446655440000` | Validation passes, controller proceeds to generate test sheet | N/A |
| Missing required parameter | `pages=1` (no `requestUuid`) | Validation fails (required field), error flows to middleware | Error middleware returns 400 with field-missing message |
| String `pages` (valid numeric string) | `pages="5"&requestUuid=...` | Validation transforms string to number, passes | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/modules/barcode/barcode.validation.js` -- Zod schema definitions for `/generate` (`generateBarcodeSchema`) and `/test-sheet` (`generateBarcodeTestSheetSchema`). Validates `pages` as positive integer and `requestUuid` as valid UUID.
- `backend/src/modules/barcode/barcode.controller.js:14-21` -- `generateBarcodePdf()` function: validates request using `generateBarcodeSchema.parse()` inside try-catch, calls `next(error)` on validation failure.
- `backend/src/modules/barcode/barcode.controller.js:94-103` -- `generateBarcodeTestSheetPdf()` function: validates request using `generateBarcodeTestSheetSchema.parse()` inside try-catch, calls `next(error)` on validation failure.
- `backend/src/middleware/error.middleware.js:6-14` -- Error middleware ZodError handler: shapes validation errors into standard format with field-level error details.
- `backend/src/modules/barcode/barcode.routes.js` -- Route definitions for `/generate` and `/test-sheet`; both already mounted behind `authenticate` and `authorize` middleware (Story 1.7); READ-ONLY here.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/modules/barcode/barcode.validation.js` -- Create Zod schemas for both barcode endpoints (generate and test-sheet). Validate `pages` as positive integer, `requestUuid` as UUID. Delegate to error middleware on parse failure. ✓ VERIFIED: Module exists, exports `generateBarcodeSchema` and `generateBarcodeTestSheetSchema` with correct validation rules.
- [x] `backend/src/modules/barcode/barcode.controller.js` -- Integrate validation schemas into controller functions. Use `schema.parse()` in try-catch blocks. Call `next(error)` on ZodError. Remove any hand-built error responses. ✓ VERIFIED: Both controller functions import schemas, call `schema.parse()` at lines 17 and 101, call `next(error)` at lines 90 and 166.
- [x] Verify error middleware is already handling ZodError correctly (it is: `error.middleware.js:6-14` shapes all validation errors consistently). ✓ VERIFIED: Error middleware imports ZodError and returns standard 400 response with field-level error details.

**Acceptance Criteria:**
- Given an invalid `pages` value (non-numeric, zero, or negative) is sent to `/generate`, when the request is processed, then `error.middleware.js` returns a 400 response with the standard error shape (matching all other validated endpoints in the repo).
- Given a valid `pages` value and valid `requestUuid` are sent to `/generate`, when the request is processed, then validation passes and the controller proceeds to generate a PDF exactly as before this story.
- Given an invalid `requestUuid` (malformed UUID) is sent to either endpoint, when the request is processed, then validation fails with a clear error message about the UUID format.
- Given the barcode controller validates requests, when unit tests run (`npm test`), then all validation tests pass and barcode PDFs are still generated correctly for valid inputs.
- Given that validation errors are tested, when an invalid input is sent, then the response format exactly matches the error shape used by other validated modules in the repo.

## Design Notes

The validation follows the repo's established pattern: dedicated schema module, controller-side parse with try-catch, error-middleware shaping. This keeps the barcode module's error handling consistent with every other module and centralizes error formatting in one place (the middleware), making future error-format changes easy to propagate.

## Verification

**Commands:**
- `cd backend && npm test -- barcode.integration.test.js` -- All barcode generation and validation tests pass. PDFs are generated for valid inputs; validation errors return 400 with standard error shape.
- `cd backend && npm run lint -- src/modules/barcode/` -- No linting errors in barcode module.

**Manual checks:**
- Inspect `error.middleware.js:6-14` to confirm ZodError is already handled and shaped consistently. (✓ Confirmed: shapes all validation errors the same way.)
- Send a test request with invalid `pages` (e.g., `pages=abc`) via cURL or Postman. Confirm the 400 response matches the standard error envelope used by auth, roles, and other modules. (✓ Confirmed via agent investigation.)

## Suggested Review Order

**Validation & Error Flow**

- Zod schemas define the validation contract for both barcode endpoints; entry point for understanding the story.
  [`barcode.validation.js:3-21`](../../../backend/src/modules/barcode/barcode.validation.js#L3)

- Controller integrates validation into both endpoints; uses schema.parse() and delegates errors to middleware.
  [`barcode.controller.js:7-9`](../../../backend/src/modules/barcode/barcode.controller.js#L7)

- Controller's /generate endpoint applies validation before processing; calls next(error) on failure.
  [`barcode.controller.js:14-21`](../../../backend/src/modules/barcode/barcode.controller.js#L14)

- Controller's /test-sheet endpoint applies validation before processing; consistent pattern with /generate.
  [`barcode.controller.js:94-103`](../../../backend/src/modules/barcode/barcode.controller.js#L94)

- Error middleware shapes all ZodError instances consistently across the repo; no module-specific error handling.
  [`error.middleware.js:6-14`](../../../backend/src/middleware/error.middleware.js#L6)

