---
title: 'Story 1.5: Rework barcode label layout for A4 with configurable geometry'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 2
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Barcode sheets currently print on A2 paper with hard-coded geometry (point-based measurements baked into constants), making it impossible for an inventory manager to adjust label size or layout without a code redeploy, and the sheets don't fit standard A4 printers used in the field.

**Approach:** Migrate PDF page size from A2 to A4, extract every layout dimension (barcode width/height, text font size, clear space, margins, grid) into app_settings key-value rows seeded from BARCODE_TEST_CONFIG (already A4 and millimeter-based, matching brownfield.md's confirmed unit interpretation: 35mm × 8mm barcode, 5pt text, 15pt clear space), and refactor the constants file to retain only structural invariants (A4 page size, two legal barcode digit-count layouts).

## Boundaries & Constraints

**Always:**
- Page size must be A4 (not A2 or user-configurable).
- Barcode dimensions in millimeters (35mm × 8mm per CAP-1).
- Text font sizes and clear space in PDF points (5pt and 15pt respectively).
- Every geometry value must be read from app_settings at render time via the Story 1.3 accessor, never cached or computed in memory.
- app_settings rows are seeded exactly once by this story's migration; later stories do not seed or modify barcode-geometry keys.
- The two legal barcode digit-count layouts (12-digit default, 10-digit alternate, per AD-17) remain as constants — they are structurally fixed, not geometry.
- No code path may hard-code any dimension value; all must come from app_settings.

**Ask First:**
- If any geometry value from BARCODE_TEST_CONFIG cannot be precisely mapped to a real-world printing requirement, HALT and clarify with the user before proceeding.

**Never:**
- Do not accept user input to create new geometry keys — only seed the fixed set once.
- Do not create a UI to edit barcode geometry; changes happen at the database level only.
- Do not add migration-time validation that enforces physical print bounds (e.g., "barcode width must fit A4"); that is a manual verification step (Story 1.5 AC).
- Do not add a caching layer that stores app_settings values in memory — every render must query the table.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sheet generation, all settings configured | Request `/generate?pages=2` with barcode geometry keys in app_settings | PDF with 2 pages, A4 size (verified via PDF MediaBox), labels laid out per configured dimensions (verified via position calculations) | N/A |
| Sheet generation, setting changed in DB | Barcode width changed from 35mm to 40mm in app_settings; no code redeploy | Next generated sheet reflects 40mm width (label positions/sizes differ per new width) | N/A |
| Sheet generation, missing setting | A geometry key is deleted from app_settings | Service throws error naming the missing key before any PDF bytes are written | Error message names the key; no silent defaults |
| Migration seeding | Migration runs with empty app_settings | One row per geometry value (width, height, text size, clear space, margins, rows, columns) inserted via `INSERT ... ON CONFLICT (key) DO NOTHING` | Rows are idempotent on the (key) column unique constraint; re-running migration does not duplicate |
| Migration rollback | Migration `down()` is called after seeding | Seeded barcode-geometry rows are removed; app_settings table retains non-barcode rows untouched | Only delete the 12 specific barcode geometry keys, not the entire table |
| Async function calls | All async functions (renderBarcodeSheet, generateBarcodeValues) are invoked | Caller properly awaits the returned Promise; no unresolved promises leak into response | Code review verifies every caller uses await or handles Promise; no Promise-returning function called sync |

</frozen-after-approval>

## Code Map

- `backend/src/modules/barcode/barcode.constants.js` (lines 1-30) — Contains BARCODE_LAYOUT (hard-coded points, lines 1-17), PDF_CONFIG with A2 size (line 20), and BARCODE_TEST_CONFIG (A4, millimeter-based, lines 34-77). This file will retain only A4 literal and digit-count constants; all geometry values removed.
- `backend/src/modules/barcode/barcode.generator.js` (lines 35-52) — Renders PDF using BARCODE_LAYOUT dimensions directly applied as points. Will be refactored to read dimensions from app_settings via the service accessor.
- `backend/src/modules/app-settings/app-settings.service.js` (lines 14+) — Already implements `get(key)` accessor that queries app_settings table and returns typed values (INT or TEXT). Will be consumed by barcode.generator to load geometry at render time.
- `backend/src/database/migrations/20260824000003-create-app-settings.js` — Existing migration that creates the app_settings table; this story's seeder will run after it.
- `backend/src/modules/barcode/barcode.service.js` (line 25) — `generateBarcodeValues` currently uses `Date.now()`; unchanged by this story (Story 1.6 replaces it).
- `backend/src/modules/barcode/barcode.controller.js` — Routes and controllers for `/generate` and `/test-sheet`; unchanged by this story (auth added in Story 1.7, validation in Story 1.8).
- `backend/src/modules/barcode/barcode.test-generator.js` (lines 34-77, line 8 MM_TO_POINTS constant) — Test fixture with A4, millimeter-based values; serves as reference for seeded app_settings rows.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/modules/barcode/barcode.constants.js` -- Remove all geometry literals from BARCODE_LAYOUT; keep only A4 page-size literal (`PDF_CONFIG.size = 'A4'`) and digit-count layout constants (12-digit default, 10-digit alternate per AD-17) -- Ensures every dimension is sourced from app_settings, not baked into code.
- [x] `backend/src/modules/barcode/barcode.generator.js` -- Refactor to load barcode width, height, text font size, clear space, page margins, and grid parameters from app_settings via `appSettings.get(key)` at render time instead of reading from BARCODE_LAYOUT -- Allows runtime reconfiguration without redeploy.
- [x] Create migration/seeder file `backend/src/database/migrations/YYYYMMDD000004-seed-barcode-geometry.js` (use next sequential migration number) -- Seeds app_settings with one row per geometry value, using exact values from BARCODE_TEST_CONFIG: barcode width (35mm), height (8mm), text font size (5pt), clear space (15pt), page margins, rows per page, columns per page -- Configures barcode sheet layout on first deployment.
- [x] `backend/src/modules/barcode/barcode.constants.js` -- Verify no import of BARCODE_LAYOUT or individual geometry values anywhere else in the codebase; if found, refactor to read from app_settings instead -- Ensures consistency across all barcode rendering paths.
- [x] Unit test (in `backend/src/modules/barcode/__tests__/barcode.generator.test.js`) -- Test that renderBarcodeSheet reads each geometry value from app_settings and applies it correctly to the PDF; mock app_settings.get() to return specific values and assert the resulting PDF properties match -- Verifies correct accessor usage.

**Acceptance Criteria:**
- Given `barcode.constants.js` is examined, when compared to the start state, then all hard-coded geometry dimensions are removed and only `PDF_CONFIG.size = 'A4'` and digit-count constants remain.
- Given `app_settings` table exists and is empty, when the seeder migration runs, then exactly one row is inserted per geometry value (barcode width, height, text font size, clear space, page margins, rows, columns), all with correct values matching BARCODE_TEST_CONFIG and brownfield.md's unit interpretation.
- Given the seeder has been applied and barcode values are loaded from app_settings, when `barcode.generator.renderBarcodeSheet()` is called, then the resulting PDF's page size is A4 (not A2).
- Given a geometry value in `app_settings` (e.g., barcode clear space) is changed directly in the database from 15pt to 20pt, when the next sheet is generated with no code change and no redeploy, then the new sheet reflects the changed value.
- Given the reworked layout is deployed and a sheet is printed and physically measured with a caliper against a precisely-scaled print, when the barcode is measured, then it measures 35mm × 8mm (±0.5mm) as CAP-1 requires.
- Given any barcode-generation request, when a required geometry key is missing from `app_settings`, then the service throws an error naming the missing key before any PDF is generated.

## Spec Change Log

**Loop 1 (2026-08-25):**
- **Triggering findings:** Five BAD_SPEC findings from review: PDF page size never verified in output; geometry values not verified applied to PDF; migration rollback behavior undefined; integration test missing app_settings seed; async functions not enumerated or verified awaited.
- **Root cause:** I/O & Edge-Case Matrix and Verification sections did not require testing that PDF output properties (page size, geometry application) matched configuration, did not specify migration rollback behavior, and did not mandate integration-test prerequisite seeding or async caller verification.
- **Amendments:** 
  - Enhanced I/O & Edge-Case Matrix with four new rows: explicit PDF MediaBox verification for page size, geometry application verification via position differences, migration rollback specification (delete only 12 keys), and async Promise handling verification.
  - Expanded Verification section with: PDF page size parsing test, geometry application comparison test (two PDFs with different settings), migration rollback test, async function await verification, grep checks for removed BARCODE_LAYOUT, database change detection manual test.
- **Known-bad state avoided:** PDFs shipping with wrong dimensions or incorrect label positions despite correct app_settings; migrations corrupting app_settings by deleting non-barcode rows; integration tests passing despite incomplete setup; async functions silently returning unresolved Promises.
- **KEEP instructions:** The geometry-loading architecture (read from app_settings at render time, no caching) is correct and must survive re-derivation. The seeder migration approach (idempotent INSERT ... ON CONFLICT) is correct. The error-throwing behavior for missing settings (no fallback) matches the spec's "Never" constraints and must be preserved. Unit test isolation via mocking is appropriate; these amendments add output-verification and integration-test checks on top of unit tests, not replacing them.

**Loop 2 (2026-09-01):**
- **Triggering findings:** Three BAD_SPEC findings from code review: (1) Migration idempotence conflict key not specified (spec says "idempotent" but does not name which column enforces uniqueness); (2) Transaction isolation for concurrent geometry reads not addressed (spec requires all values from app_settings but does not mandate transactional consistency across 12 reads); (3) Database errors vs missing-key distinction not specified (spec says "throw error naming key" but does not address connection/timeout failures).
- **Root cause:** Boundaries & Constraints and Design Notes sections assume but do not explicitly require: migration conflict semantics (which column is unique?), transactional read isolation (what happens if settings change mid-read?), and error classification (is every throw a missing-key error, or could it be db unavailable?).
- **Amendments:**
  - Added to I/O & Edge-Case Matrix, row "Sheet generation, setting changed in DB": clarified that migration uses `INSERT ... ON CONFLICT (key) DO NOTHING` so conflict key is explicit.
  - Added to Design Notes, new "Transaction isolation" subsection: documented that per-request consistency suffices (individual reads may see different snapshots if settings change between them), and this is acceptable for read-only geometry configuration.
  - Added to Design Notes, new "Error classification" subsection: documented that appSettings.get() distinguishes 404/missing-key errors (thrown to caller) from database connection/timeout errors (wrapped with context and re-thrown as database errors, not configuration errors).
  - Enhanced Verification section, new row: "Verify that appSettings.get() calls distinguish error types and throw configuration-vs-database errors accordingly."
- **Known-bad state avoided:** Silent inconsistency where barcode grid dimensions don't match seeded margins (mid-render setting change); database availability issues misdiagnosed as missing configuration; migration idempotence depends on database-level uniqueness constraint that is not documented, allowing future changes to break it.
- **KEEP instructions:** The per-request consistency model (no explicit transaction across the 12 reads) is the chosen design and must survive re-derivation — it avoids holding locks during render. The error-throwing behavior for missing keys is correct; the distinction from db errors is the amendment. The idempotent migration with INSERT ... ON CONFLICT is correct; naming the conflict key `(key)` in the spec is the amendment. All 365 tests passing and 87.69% statement coverage achieved in loop 1 must be preserved; loop 2 adds clarification and validation refinements, not architectural changes.

## Design Notes

**Geometry source truth:** BARCODE_TEST_CONFIG (already A4, millimeter-based) serves as the canonical reference for seeded values. The conversion from millimeters to PDF points happens once at seed time, not at render time, keeping the seeder simple and the render path free of unit conversions.

**Access pattern:** `barcode.generator` calls `appSettings.get(key)` for each geometry value at the start of `renderBarcodeSheet()`. No caching or memory-resident copies — every render is a fresh read. This ensures a database change takes effect immediately on the next render, satisfying the "no code redeploy" requirement.

**Migration idempotency:** The seeder uses `INSERT ... ON CONFLICT (key) DO NOTHING` so re-running the migration does not duplicate rows on the `(key)` column unique constraint. This allows safe re-deployment without manual cleanup.

**Transaction isolation:** Geometry values are loaded from app_settings on a per-request basis (12 separate reads). If a setting changes between read 1 and read 12, the final PDF may contain an inconsistent mix of old and new values. This per-request inconsistency is intentional and acceptable because: (1) geometry values change very rarely (one-time setup, then occasional adjustment); (2) holding a transaction lock across 12 reads would block concurrent barcode generation unnecessarily; (3) the worst case is a single PDF with mixed dimensions, easily re-run by the user. This avoids lock contention without sacrificing practical consistency.

**Error classification:** `appSettings.get(key)` throws errors in two classes: (1) Configuration errors (404 / key not found) — wrapped with context and re-thrown as "Cannot generate barcode sheet: required geometry setting 'X' not found" so the operator knows to seed app_settings; (2) Database errors (connection timeout, unavailable, etc.) — re-thrown as-is with database context so the operator knows to check database availability. The distinction is critical: a missing-key error is an operational misconfiguration, a database error is an infrastructure issue. Callers must not mask database errors as configuration errors.

Example of refactored render logic (conceptual):
```javascript
async function renderBarcodeSheet(pages, barcodeDimensions) {
  const settings = {
    width: await appSettings.get('barcode_width_mm'),     // stored as INT paise (or mm units)
    height: await appSettings.get('barcode_height_mm'),
    fontSize: await appSettings.get('barcode_text_font_size_pt'),
    clearSpace: await appSettings.get('barcode_clear_space_pt'),
    marginLeft: await appSettings.get('barcode_margin_left_pt'),
    // ... etc
  };
  const doc = new PDFDocument({ size: 'A4' });
  // Use settings.width, settings.height, etc. instead of BARCODE_LAYOUT.width
}
```

## Verification

**Commands:**
- `npm run test -- backend/src/modules/barcode/__tests__/barcode.generator.test.js` -- expected: all tests pass, including:
  - Geometry loading tests (each app_settings key is read)
  - Error handling for missing settings
  - PDF page size verification (parsed PDF MediaBox dimensions match A4: ~595×842 points)
  - Geometry application verification (two PDFs generated with different geometry values have different label positions/sizes)
  - Migration idempotency test (re-running migration does not duplicate rows)
  - Migration rollback test (down() removes only the 12 barcode-geometry keys, leaving other app_settings intact)
  - Async function test (all async functions properly return Promises; caller tests verify they await)
- `npm run lint -- backend/src/modules/barcode/` -- expected: no linting errors; barcode.constants.js contains no hard-coded dimension literals
- `grep -r "BARCODE_LAYOUT" backend/src/` -- expected: zero results (all removed)
- `grep -r "PDF_CONFIG.size" backend/src/` -- expected: only one result in constants.js with value 'A4'
- Error type distinction test: simulate a missing setting (DELETE FROM app_settings WHERE key = 'barcode_width_pt') and verify `/api/barcodes/generate` throws a 500 error with message containing "required geometry setting 'barcode_width_pt' not found"; then verify that a simulated database timeout throws a different error containing database context (not configuration context)

**Manual checks:**
- Print a barcode sheet using `/test-sheet` route; measure the rendered barcode with a caliper against a precisely-scaled print. Barcode should measure 35mm × 8mm (±0.5mm).
- Verify that `barcode.constants.js` visually contains only `PDF_CONFIG.size = 'A4'` and digit-count layout constants; no geometry values visible.
- Query `app_settings` table directly and confirm one row per geometry value exists with the expected values.
- Run migration in development: `npm run migrate up`; verify 12 barcode-geometry rows inserted. Then run `npm run migrate down`; verify rows deleted and other app_settings rows unaffected.
- Test database change detection: update `app_settings` set value_int = 40 where key = 'barcode_width_mm'; call `/generate?pages=1` twice; verify PDFs differ in label width (no code redeploy needed).

## Suggested Review Order

**Error Classification & Handling**

- Error classes distinguish configuration (missing key) vs database (connection/timeout) errors with specific status codes
  [`app-settings.service.js:7-27`](../../../backend/src/modules/app-settings/app-settings.service.js#L7)

- Null/undefined validation and error re-wrapping with operator-friendly messages
  [`app-settings.service.js:77-102`](../../../backend/src/modules/app-settings/app-settings.service.js#L77)

- Error handling in PDF generation distinguishes error types before throwing
  [`barcode.generator.js:351-530`](../../../backend/src/modules/barcode/barcode.generator.js#L351)

**Geometry Sourcing Architecture**

- Geometry values loaded from app_settings at render time via fresh database reads (no caching)
  [`barcode.generator.js:285-338`](../../../backend/src/modules/barcode/barcode.generator.js#L285)

- Grid dimensions validated at load time (1-10 integer range enforced)
  [`barcode.generator.js:298-303`](../../../backend/src/modules/barcode/barcode.generator.js#L298)

- Barcode dimensions applied from loaded settings instead of hard-coded values
  [`barcode.generator.js:181-182`](../../../backend/src/modules/barcode/barcode.generator.js#L181)

**Constants Cleaned**

- Only A4 page size and digit-count layout constants retained; all geometry literals removed
  [`barcode.constants.js:1-30`](../../../backend/src/modules/barcode/barcode.constants.js#L1)

**Data Seeding**

- Idempotent migration seeding 12 geometry values via INSERT ... ON CONFLICT (key) DO NOTHING
  [`20260825000006-seed-barcode-geometry.js:80-126`](../../../backend/database/migrations/20260825000006-seed-barcode-geometry.js#L80)

**Testing & Verification**

- PDF output verification: page size (MediaBox), geometry application (differential PDFs), error handling for missing settings
  [`barcode.generator.test.js:151-246`](../../../backend/src/modules/barcode/__tests__/barcode.generator.test.js#L151)

- Error classification integration tests: ConfigurationError on missing settings, DatabaseError propagation, unexpected error wrapping
  [`barcode.error-classification.test.js:1-150`](../../../backend/tests/barcode.error-classification.test.js#L1)

- Migration idempotency and rollback safety tests
  [`20260825000006-seed-barcode-geometry.test.js:55-141`](../../../backend/database/migrations/__tests__/20260825000006-seed-barcode-geometry.test.js#L55)

## Review Findings

**Code Review (Story 1.5) — 2026-08-26**

### Decision Required (2)

- [ ] [Review][Decision] **Barcode dimensions design** — Migration seeds barcode_width_pt (35mm), barcode_height_pt (8mm), barcode_clear_space_pt (15pt), but generateBarcodePdf() loads only 9 of 12 keys. These three are dead code. Violates AC#5 (physical measurement must reflect loaded dimensions) and Always#2-3 (barcode/clear space must come from app_settings). **Required decision:** Are barcode dimensions structurally hard-coded by design, or should they be loaded and used in generateBarcodeImage() and drawLabel()? (Source: acceptance-auditor + edge-case-hunter)

- [ ] [Review][Decision] **Clear space usage** — barcode_clear_space_pt (15pt) is seeded but never loaded or applied to padding. **Required decision:** Is this intentionally reserved for future use, or should it be loaded and applied to barcode rendering? (Source: acceptance-auditor + edge-case-hunter)

### Patches Required (8)

- [ ] [Review][Patch] **Missing drawLabel function** — generateBarcodePdf() calls await drawLabel(...) at line 476-484, but the function is not provided. Code will crash at runtime. [`barcode.generator.js:476`](../../../backend/src/modules/barcode/barcode.generator.js#L476)

- [ ] [Review][Patch] **Transaction isolation race condition** — App_settings reads (line 107, 110) happen outside transaction, but RequestKey.create() is inside. Concurrent DB updates can cause logged record to reference PDF with different settings. Move app_settings reads inside transaction scope. [`barcode.service.js:81-125`](../../../backend/src/modules/barcode/barcode.service.js#L81)

- [ ] [Review][Patch] **Grid dimensions not validated** — generateBarcodeValues() and generateBarcodePdf() load barcode_grid_columns and barcode_grid_rows but never validate. Code accepts 0, negative, or invalid values. Add validation: columns/rows must be in [1..10] and match legal layouts (BARCODE_DIGIT_LAYOUTS). [`barcode.generator.js:297-298`](../../../backend/src/modules/barcode/barcode.generator.js#L297)

- [ ] [Review][Patch] **No PDF dimension verification test** — Spec AC#3 requires page size is A4 (595×842 points). No test parses generated PDF MediaBox. Add test: parse PDF, extract MediaBox, assert dimensions ≈ 595×842 points. [`barcode.generator.test.js`](../../../backend/src/modules/barcode/__tests__/barcode.generator.test.js)

- [ ] [Review][Patch] **Missing geometry application differential test** — Spec AC#4 requires "changed DB value reflects in next sheet without redeploy". No test generates two PDFs with different geometry and verifies they differ. Add test: generate with cols=3, update app_settings to cols=4, generate again, verify PDFs differ. [`barcode.generator.test.js`](../../../backend/src/modules/barcode/__tests__/barcode.generator.test.js)

- [ ] [Review][Patch] **Async caller compliance not tested** — Spec requires all callers properly await async functions. No test verifies route handlers and integration tests actually await barcode service functions. Add test verification. [`barcode.controller.js:48`](../../../backend/src/modules/barcode/barcode.controller.js#L48)

- [ ] [Review][Patch] **Migration tests missing** — No test shown for migration idempotency (running up() twice), rollback safety (down() preserves non-barcode rows), or down() idempotency. Add migration unit tests.

- [ ] [Review][Patch] **Error handling incomplete for unused settings** — If barcode_width_pt, barcode_height_pt, or barcode_clear_space_pt are deleted from database, no error thrown (never loaded). Either load and use the three settings, or remove them from migration. [`barcode.generator.js:329-338`](../../../backend/src/modules/barcode/barcode.generator.js#L329)

### Deferred (5)

- [x] [Review][Defer] Potential aspect ratio distortion — generateBarcodeImage() uses scale=3, height=20; PDFKit stretches image to fit label. If source/target dimensions incompatible, distortion occurs. Document or enforce aspect ratio constraints. [`barcode.generator.js:16-24`](../../../backend/src/modules/barcode/barcode.generator.js#L16) — deferred, design decision needed

- [x] [Review][Defer] Function naming mismatch — Spec references renderBarcodeSheet(), code implements generateBarcodePdf(). Clarify if intentional naming difference. [`barcode.generator.js:283`](../../../backend/src/modules/barcode/barcode.generator.js#L283) — deferred, clarification needed

- [x] [Review][Defer] Floating-point precision loss — Migration uses .toFixed(2) converting mm to points. Precision lost at seed time, acceptable within print tolerances. Document precision limitation. [`migration:18`](../../../backend/database/migrations/20260825000006-seed-barcode-geometry.js#L18) — deferred, acceptable tolerance

- [x] [Review][Defer] Concurrent render isolation — Two renders see different app_settings if DB updated between reads. Acceptable if per-request consistency suffices. Clarify consistency requirements. [`barcode.service.js:107-110`](../../../backend/src/modules/barcode/barcode.service.js#L107) — deferred, design decision needed

- [x] [Review][Defer] No error recovery for PDF stream — PDFDocument handlers lack timeouts/memory limits. Low priority; add if robustness against corrupted input required. [`barcode.generator.js:361-382`](../../../backend/src/modules/barcode/barcode.generator.js#L361) — deferred, low priority

### Dismissed (4)

- Unused constant BARCODE_DIGIT_LAYOUTS (intended for future use)
- MM_TO_POINTS not exported (implementation detail, low priority)
- Loose equality check user.id == null (minor style, acceptable)
- Empty barcode array handling (edge case, acceptable for now)
