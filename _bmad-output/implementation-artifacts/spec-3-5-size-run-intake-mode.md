---
title: 'Story 3.5: Size-run intake mode'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When scanning multiple units into a lot that vary only by size, the inventory manager must manually reselect the size field for every piece, slowing intake. Lots with size runs (e.g. S, M, L, XL) become repetitive data entry.

**Approach:** Build an optional client-side size-run mode for the intake screen that pre-configures an ordered size sequence, auto-advances to the next size as each unit is scanned, and allows per-scan manual overrides without breaking the sequence. The feature wraps the existing Story 3.3 scan endpoint unchanged — the server cannot distinguish a size-run scan from a manual one.

## Boundaries & Constraints

**Always:**
- Size-run mode is entirely client-side; no new table, column, or backend endpoint (per CAP-9 and AD-25's cart-like pattern)
- The sequence state — ordered size list and current index — lives only in React component state or URL/form state, never persisted
- Every scanned unit submits an explicit `sizeId` to Story 3.3's existing `POST /api/stock-intake-lines/:uuid/scan` endpoint, validated normally by the server
- When a size in the run is deactivated server-side (Story 2.2's `PATCH`), the client's next position skips it; if that scan is submitted with the now-inactive size, the server rejects it exactly as Story 3.3 specifies
- A size-run mode cannot be entered if the active size picklist is empty
- The run wraps back to its start after the last size in the sequence

**Ask First:**
- None — all requirements are settled in epic context

**Never:**
- Add a backend route, migration, or column to persist or retrieve sequence state
- Modify Story 3.3's scan endpoint or its validation logic
- Allow the sequence state to survive a page reload (state resets when the component unmounts or page refreshes)
- Bypass Story 3.3's server-side validation of colour, size active-status, or any other constraint

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Enable size-run mode | Intake screen open, size-run toggle + size picker, e.g. [S, M, L] | Chip displays "Next: S", size field pre-populated with S, field disabled/read-only until override | N/A |
| Scan with auto-advanced size | Barcode scanned while "Next: S" showing, user saves without changing size field | Unit saves with sizeId=S, chip advances to "Next: M", size field pre-filled with M on next row | 400/409 if S is deactivated; user sees server error |
| Wrap-around after last size | Run is [S, M, L], fourth scan submitted with L | Sequence wraps to "Next: S" for the fifth unit | N/A |
| Manual override does not break sequence | Run at "Next: M", user changes size field to L and saves | Unit saves with sizeId=L (override honored), chip advances to "Next: L" (not M or past L), sequence continues from L | 400/409 if L is deactivated; override still honored if valid |
| Size deactivated mid-run | Run is [S, M, L], M is deactivated after S is already scanned | "Next" position would be M, client skips M and shows "Next: L" instead | N/A if user saves with L; if user manually selects M and saves, server rejects it per Story 3.3 |
| No active sizes available | Intake screen, size picklist is empty or all sizes inactive | Size-run mode toggle is unavailable/disabled | N/A |
| Disable size-run mode | Mid-run, toggle off | Mode turns off, size field returns to manual picker, sequence state discarded | N/A |
| Size-run mode survives lot change | User configures run for Lot A, switches to Lot B | Run configuration is cleared; user must re-enable and reconfigure for Lot B | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/components/BarcodeScanner.jsx` (lines ~23–100) -- Existing barcode scanner with state management; will be wrapped or enhanced by an intake form component that manages lot selection, colour/size fields, and size-run sequence state
- `frontend/src/components/StockIntakeForm.jsx` (new) -- Will handle lot selection, size-run mode toggle/configuration, colour picker, and sequence state; delegates barcode scanning to BarcodeScanner and submits scans to the backend via `barcodeApi.scan()`
- `frontend/src/services/barcodeApi.js` (currently empty) -- Will implement `scan({ barcode, stockIntakeLineUuid, colourUuid, sizeUuid, actorUserId })` to call `POST /api/stock-intake-lines/:uuid/scan` (Story 3.3's endpoint)
- `backend/src/modules/intake/stock-intake-line.routes.js` (lines ~35–45) -- Existing route `POST /:uuid/scan` from Story 3.3; no changes needed
- `backend/src/modules/intake/intake.controller.js` (line ~scanIntoLot) -- Existing handler from Story 3.3; no changes needed
- `backend/src/modules/intake/intake.service.js` (line ~scanIntoLot) -- Existing service from Story 3.3; no changes needed
- `frontend/src/BarcodeScanner.css` (lines ~1–50) -- May need minor additions for size-run UI (chip display, disabled size field styling)

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/services/barcodeApi.js` -- Implement `scan()` function calling `POST /api/stock-intake-lines/:uuid/scan` with barcode, colourUuid, sizeUuid; return unit DTO on 201, throw on 4xx/5xx -- Provides client-side API layer for Story 3.3's scan endpoint
- [x] `frontend/src/components/StockIntakeForm.jsx` -- Build intake form UI with lot selector, colour picker, size picker, and size-run mode toggle; manage size sequence state (array of sizeIds, current index, active flag); pre-fill size field based on sequence when enabled; handle form submission to `barcodeApi.scan()` -- Core intake workflow and size-run sequencing logic
- [x] `frontend/src/components/StockIntakeForm.jsx` -- Implement size-run configuration: show a multi-select or ordered list of active sizes, validate at least one size is selected, disable toggle if no sizes available -- Size-run setup UX
- [x] `frontend/src/components/StockIntakeForm.jsx` -- Implement size-run advance logic: after successful scan, increment index modulo run length, skip any sizes now marked inactive, update size field on next render -- Auto-advance and deactivation handling
- [x] `frontend/src/components/StockIntakeForm.jsx` -- Implement manual override handling: when user changes size field before save, accept the override, advance sequence to that size's position (or nearest active), continue from there -- Per-scan override without breaking sequence
- [x] `frontend/src/BarcodeScanner.css` -- Add styles for size-run mode indicator chip (e.g. "Next: M") and disabled size field (read-only appearance) -- Visual feedback for sequence state
- [x] `frontend/src/components/__tests__/StockIntakeForm.test.js` -- Write comprehensive test suite covering size-run mode toggle, auto-advance, manual override, wrap-around, deactivation skipping, empty size list protection, lot change reset -- Test coverage for all acceptance criteria and edge cases

**Acceptance Criteria:**
- Given an intake screen with size-run mode enabled and run [S, M, L], when a barcode is scanned and saved without changing the size field, then the unit is created with sizeId=S, the "Next" indicator shows M, and the size field pre-fills with M on the next row
- Given the run is at "Next: M" and the user manually changes the size field to L before saving, when the scan succeeds, then the unit carries sizeId=L and the sequence advances to "Next: L", advancing from M as though L had been scanned
- Given the run [S, M, L] and the fourth unit is scanned with L, when the form re-renders, then "Next" wraps to S and the size field pre-fills with S for the fifth unit
- Given size-run mode is on and M in the run [S, M, L] is deactivated server-side, when the sequence reaches M, then the client shows "Next: L" and skips M; if the user manually selects M and submits, the backend rejects it per Story 3.3
- Given the size picklist is empty, when the user tries to enable size-run mode, then the toggle is unavailable and the size-run UI is hidden
- Given size-run mode is on, when the user switches to a different lot, then the run configuration is discarded and must be re-enabled for the new lot

## Design Notes

**Sequence State Management:**
The current index into the size-run array is stored as a component state variable (e.g. `currentSizeIndex`). After each successful scan, it increments by 1 modulo the run's length. If the user manually overrides the size field before saving, the code finds that size in the run's array and sets `currentSizeIndex` to that position, so the next advance resumes from there rather than skipping or resetting.

**Deactivated Size Handling:**
After the server returns an error (400) or before a scan is submitted, the client can call an API to check the size's current active status (or it's already cached from the size picklist). When preparing to show "Next: X", the client scans forward from the current index, skipping any sizes marked inactive, until it finds an active one. This preview is UI-only; the actual submission validation still happens server-side per Story 3.3.

**Wrap-Around:**
The index calculation is `(currentSizeIndex + 1) % run.length`. No special cases; the sequence naturally wraps from the last element back to the first.

## Verification

**Commands:**
- `cd {project-root} && npm run test -- frontend/src/components/__tests__/StockIntakeForm.test.js` -- Tests cover: size-run mode enable/disable, auto-advance, manual override, wrap-around, deactivated size skipping, empty size list (unavailable toggle), lot change resets run
- `cd {project-run} && npm run build` -- Frontend builds without errors; no TypeScript/ESLint failures
- `cd {project-root} && npm run dev` -- Start dev server and manually test: enable size-run mode, configure run, scan barcodes, verify size auto-advances and manual override works

**Manual checks:**
- Open the intake screen, enable size-run mode, select sizes [S, M, L], scan a barcode → verify size field pre-fills with S, "Next: M" shows
- Scan second barcode → size should pre-fill with M, "Next: L" shows
- On third scan, manually change size to XL before saving → verify "Next: XL" shows (sequence continues from override)
- Verify that if a size in the run becomes inactive, the client skips it and shows the next active size
- Verify that if you disable size-run mode or switch lots, the run state is cleared and you must reconfigure

## Suggested Review Order

**Entry Point & API Integration**

- Validates all required parameters and ensures errors carry statusCode for proper HTTP handling
  [`barcodeApi.js:19`](../../../frontend/src/services/barcodeApi.js#L19)

**Size-Run Mode Core Logic**

- Enables/disables size-run mode and manages sequence state (sizeRunSequence, currentSizeIndex)
  [`StockIntakeForm.jsx:44`](../../../frontend/src/components/StockIntakeForm.jsx#L44)

- Auto-advances through sequence with modulo wrap-around; skips deactivated sizes
  [`StockIntakeForm.jsx:240`](../../../frontend/src/components/StockIntakeForm.jsx#L240)

- Finds next active size by scanning forward through sequence; returns early if all deactivated
  [`StockIntakeForm.jsx:131`](../../../frontend/src/components/StockIntakeForm.jsx#L131)

- Pre-fills size field based on sequence position; includes bounds check to prevent out-of-range access
  [`StockIntakeForm.jsx:158`](../../../frontend/src/components/StockIntakeForm.jsx#L158)

**Manual Override & Error Handling**

- Handles per-scan override by positioning sequence to selected size; clears override on error
  [`StockIntakeForm.jsx:315`](../../../frontend/src/components/StockIntakeForm.jsx#L315)

- Adds bounds check before setting currentSizeIndex from override to prevent invalid state
  [`StockIntakeForm.jsx:323`](../../../frontend/src/components/StockIntakeForm.jsx#L323)

- Clears override state in catch block to prevent stale override persisting across errors
  [`StockIntakeForm.jsx:352`](../../../frontend/src/components/StockIntakeForm.jsx#L352)

**Data Loading & Input Validation**

- Fetches lots, colours, sizes from backend APIs; displays loading/error states gracefully
  [`StockIntakeForm.jsx:77`](../../../frontend/src/components/StockIntakeForm.jsx#L77)

- Trims barcode input and validates non-empty before submission to prevent blank scans
  [`StockIntakeForm.jsx:271`](../../../frontend/src/components/StockIntakeForm.jsx#L271)

**Test Coverage**

- Tests size-run mode toggle, configuration, auto-advance, wrap-around, override, deactivation
  [`StockIntakeForm.test.js:1`](../../../frontend/src/components/__tests__/StockIntakeForm.test.js#L1)

**Styling**

- Chip indicator ("Next: M"), configuration dialog, disabled size field, responsive design
  [`BarcodeScanner.css:1`](../../../frontend/src/BarcodeScanner.css#L1)

