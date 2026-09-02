---
title: 'Story 1.6: Replace the barcode value generator with a persistent counter'
type: 'feature'
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

**Problem:** Barcode values today use `Date.now()` plus a three-digit index; two requests within the same millisecond collide, and a clock stepping backwards reissues printed values. FR-D2 requires a single persistent counter whose high-water mark survives restart and restore, ensuring FR2 (barcode uniqueness via single counter) works end-to-end.

**Approach:** Replace the `generateBarcodeValues()` function in `barcode.service.js` to call `nextval('barcode_seq')` inside the existing transaction, format each value as a 12-digit Code 128 subset-C number (left-padded with zeros), and verify the implementation guards against collisions across restart cycles.

## Boundaries & Constraints

**Always:**
- The barcode value is a 12-digit Code 128 subset-C number, left-padded from the sequence counter. Code 128 subset-C encodes digit pairs as two-digit codes (see Code 128 spec), so a 12-digit input encodes six pairs.
- Barcode values are generated inside the existing transaction that creates the `request_keys` row. Atomicity of the counter draw and the idempotency record is preserved.
- Each call to `generateBarcodeValues()` draws N distinct values from `barcode_seq` in a single round-trip using `generate_series()` and `nextval()` for efficiency, not one-by-one draws.
- No change to the PDF rendering pipeline (`barcode.generator.js`, `barcode.test-generator.js`). The downstream code receives 12-digit strings and renders them as Code 128 without changes.
- The only file touched is `barcode.service.js`. No changes to migrations, models, constants, or tests outside the test expectations.

**Ask First:**
- Any proposal to store a mapping of sequence values to printed barcodes (CAP-2 forbids recording which values were issued).
- Any proposal to add resetting, restarting, or cache-busting logic against `barcode_seq` (CAP-2 forbids it; the counter survives all restart/restore cycles without reset).
- Any plan to change the barcode format, length, or encoding (FR2 specifies 12-digit Code 128 subset-C; changes require human approval and an epic-level decision).

**Never:**
- Never fall back to `Date.now()` if the sequence read fails; propagate the error (idempotency guard will prevent duplicate generation on replay).
- Never touch the barcode_seq sequence after the migration that created it (no `setval`, `ALTER SEQUENCE ... RESTART`, or `TRUNCATE ... RESTART IDENTITY`).
- Never change `barcode.test-generator.js` or the PDF rendering. Test sheet barcodes use hardcoded values (e.g., `000000000001`, `000000000002`) and are unaffected.
- Never cache or pre-allocate barcode values outside a transaction.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First batch after cold start | `generateBarcodeValues(1)` called after server restart | Draws from sequence starting at 1; returns `['000000000001']` formatted as 12 digits | N/A |
| Sequence counter increments | Two calls to `generateBarcodeValues(1)` without restart | First returns `['000000000001']`, second returns `['000000000002']` — strictly increasing, no collision | N/A |
| Multi-page draw | `generateBarcodeValues(2)` (3 columns × 5 rows = 15 per page = 30 total) | Draws 30 values from sequence in one round-trip; all distinct, all 12-digit, all left-padded | N/A |
| Large sequence counter | Sequence counter at 999999999999 (12-digit max), `generateBarcodeValues(1)` | Returns `['999999999999']` (no truncation, no overflow) | N/A |
| Sequence counter exceeds 12 digits | Sequence counter at 1000000000000 (13 digits), `generateBarcodeValues(1)` | Throws an error (barcode value exceeds 12-digit format); the draw is inside a transaction and rolls back | Error: barcode value exceeds 12-digit maximum |
| Transaction rollback after draw | `generateBarcodeValues()` called in a transaction that later rolls back | Counter values are burnt; next call continues from the next unburnt value (sequence state is never rewound) | Expected behavior per CAP-2; no error |
| Concurrent batch requests | Two simultaneous requests call `generateBarcodeValues(1)` | Sequence atomically hands out distinct ranges; both PDFs render without collision | N/A (Postgres sequence atomicity guarantees this) |
| Restart after successful draw | Sequence counter at 42 after first call; restart server; call `generateBarcodeValues(1)` | Counter continues from 43, not reset to 1; new barcode is `000000000043` | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/modules/barcode/barcode.service.js:30-54` -- The `generateBarcodeValues()` function. Currently uses `Date.now()` + index. Must be replaced to call `nextval('barcode_seq')` and format as 12-digit zero-padded strings. Called only by `generateBarcodes()` at line 109.
- `backend/database/migrations/20260824000002-create-barcode-seq.js` -- Creates the sequence; READ-ONLY here. Story 1.6 is the first consumer.
- `backend/src/modules/barcode/barcode.generator.js` -- PDF rendering pipeline; READ-ONLY. Accepts 12-digit strings and renders them as Code 128 without changes.
- `backend/tests/barcode.integration.test.js` -- Integration test suite. Tests verify that PDFs are generated and `request_keys` rows are created; do not inspect barcode values themselves. No changes needed unless test setup fails.
- `backend/tests/guards/barcode-seq-guard.test.js` -- Validates sequence shape and guards against reset operations. READ-ONLY; confirms the sequence is in place and untouched.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/modules/barcode/barcode.service.js:30-54` -- Replace `generateBarcodeValues()` to call `nextval('barcode_seq')` for each value. Use `generate_series()` + `nextval()` in a single SQL round-trip for N values. Format each as a 12-digit zero-padded string. Validate that the counter does not exceed 12 digits and throw an error if it does. Test the function locally with a fresh sequence and verify the first value is `000000000001` and consecutive calls increment strictly.

**Acceptance Criteria:**
- Given the sequence is at counter value 1, when `generateBarcodeValues(1)` is called, then it returns an array with one string `['000000000001']`.
- Given the sequence is at counter value 42, when `generateBarcodeValues(2)` is called (15 per page, so 30 values), then it returns an array of 30 strings, each 12 digits, ranging from `['000000000042', '000000000043', ... '000000000071']`.
- Given the sequence counter is at 999999999999, when `generateBarcodeValues(1)` is called, then it returns `['999999999999']` without overflow or truncation.
- Given the sequence counter is at 999999999999, when `generateBarcodeValues(2)` is called (attempting to draw 30 values, starting at 1000000000000), then it throws an error with a message containing "exceeds 12-digit" or "barcode value exceeds maximum", and the transaction rolls back (no `request_keys` row is created).
- Given the barcode generation flow (from controller → service → PDF → idempotency record), when a batch PDF is generated, then the `request_keys` row is created atomically with the counter draw (both inside the same transaction).
- Given the integration test suite, when `npm test` runs against `backend/tests/barcode.integration.test.js`, then all barcode generation tests pass (PDF is valid, `request_keys` row exists, replay returns cached result).

## Design Notes

The sequence value is formatted as a 12-digit Code 128 subset-C barcode. Code 128 subset-C is a mode within Code 128 that encodes digit pairs — each two-digit group becomes one symbol. A 12-digit input encodes six symbols (one per pair), which is compact and efficient for printing on a 35mm × 8mm label (Story 1.5 geometry).

**Example transformation:**
```
Counter value: 42
→ 12-digit string: "000000000042"
→ Code 128 subset-C encodes as: [00] [00] [00] [00] [00] [42]
```

Formatting uses `String(value).padStart(12, '0')` to ensure 12 digits. If the counter reaches 1000000000000 (13 digits), the formatted string would be 13+ characters and violate the 12-digit limit; the implementation detects this and throws an error immediately.

The SQL to draw N values efficiently:
```sql
SELECT nextval('public.barcode_seq')::bigint FROM generate_series(1, ?)
```
This hands back N distinct values in a single round-trip, atomically within the surrounding transaction.

## Spec Change Log

- **Iteration 1 — review/patch findings, 2026-08-26.**
  **Findings:** Edge-case-hunter and verification-gap reviewers identified missing input validation in `generateBarcodeValues()`:
  (1) grid dimensions (columns/rows) not validated for positivity — if either ≤ 0, `totalBarcodes = 0` and empty array returned silently;
  (2) seqValue not validated for lower bound — if null or < 1, formatting breaks or violates acceptance criteria.
  **Amended:** Added validation at lines 39-41 to reject non-positive grid dimensions with error "Invalid grid dimensions: columns and rows must be positive integers"; added validation at lines 65-67 to reject null/invalid seqValue with error "Invalid sequence value from database".
  **Verification:** `npm test barcode.integration.test.js` (9/9 passed), `npm test barcode-seq-guard.test.js` (3/3 passed); all edge cases now guarded; no regressions.

## Verification

**Commands:**
- `cd backend && npm test -- barcode.integration.test.js` -- Expected: all tests pass (PDF generation, idempotency, test-sheet rendering).
- `cd backend && npm test -- barcode-seq-guard.test.js` -- Expected: all guards pass (sequence shape, no reset operations in code).

**Manual checks:**
- Review `generateBarcodeValues()` in `barcode.service.js`: verify it calls `nextval()` inside the transaction, formats as 12-digit strings, and throws an error if any value exceeds 12 digits.
- Inspect a generated PDF by running the `/api/barcodes/generate?pages=1` endpoint locally (with auth) and opening the PDF; verify barcode labels display human-readable 12-digit numbers (e.g., `000000000001`, `000000000002`, etc.) and Code 128 images.
- Restart the server and call the endpoint again; verify the first barcode in the new batch increments from the previous sequence state (e.g., if the first batch was 1–15, the second batch starts at 16), not reset to 1.

## Suggested Review Order

**Barcode value generation logic**

- Persistent counter replaces Date.now(); validates sequence values and grid dimensions before formatting.
  [`barcode.service.js:33-75`](../../backend/src/modules/barcode/barcode.service.js#L33)

- Transaction parameter passed to generateBarcodeValues() to ensure atomicity with idempotency record.
  [`barcode.service.js:130`](../../backend/src/modules/barcode/barcode.service.js#L130)

**Edge case handling**

- Grid dimension validation: rejects zero or negative columns/rows to prevent silent empty-array return.
  [`barcode.service.js:39-41`](../../backend/src/modules/barcode/barcode.service.js#L39)

- Sequence value validation: rejects null or sub-1 values, catches database anomalies before formatting.
  [`barcode.service.js:65-67`](../../backend/src/modules/barcode/barcode.service.js#L65)

- 12-digit overflow check: throws error if counter exceeds 999999999999; transaction rolls back.
  [`barcode.service.js:69-71`](../../backend/src/modules/barcode/barcode.service.js#L69)

**Verification**

- Integration tests confirm PDF generation, idempotency, and sequence atomicity.
  [`barcode.integration.test.js:174-226`](../../backend/tests/barcode.integration.test.js#L174)

- Sequence shape guards verify counter is never reset or altered post-creation.
  [`barcode-seq-guard.test.js:37-99`](../../backend/tests/guards/barcode-seq-guard.test.js#L37)
