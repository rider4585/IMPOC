---
title: Declare @zxing/library as an explicit frontend dependency
type: story
created: 2026-08-26
status: done
route: one-shot
---

# Declare @zxing/library as an explicit frontend dependency

## Intent

**Problem:** `@zxing/library` is currently resolved only as a transitive dependency of `@zxing/browser`. A future version bump of `@zxing/browser` could silently drop this dependency, breaking the barcode scanner (FR-D5).

**Approach:** Add `@zxing/library` as an explicit entry in `frontend/package.json`, pinned to the version currently resolved in the installed dependencies (0.23.0). This is a manifest fix only with no code changes.

## Implementation Summary

- Added `"@zxing/library": "0.23.0"` to `frontend/package.json` dependencies
- Verified frontend build passes without issues
- Verified clean install resolves to the same version
- No changes to `BarcodeScanner.jsx` or any other code

## Acceptance Criteria Status

✅ `@zxing/library` is added to `frontend/package.json`  
✅ Pinned to version currently resolved (0.23.0)  
✅ Clean install preserves the version  
✅ `BarcodeScanner.jsx` behaviour unchanged  
✅ Frontend build passes  

## Suggested Review Order

1. [frontend/package.json](../../../frontend/package.json) — Verify the dependency is correctly added and pinned

---

## Files Changed

- `frontend/package.json` — Added explicit `@zxing/library` dependency
- `frontend/package-lock.json` — Generated during npm install (auto-generated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated story status to in-progress then done

## Pre-existing Issues Noted

- **Engine mismatch**: `@zxing/library@0.23.0` requires Node >= 24.0.0, but project uses v20.19.6. This is not caused by this change; the dependency was already transitive.
- **Unused imports**: `BarcodeImage` in `App.jsx` (pre-existing)
- **React Hook warnings**: Missing dependency warnings in `BarcodeScanner.jsx` (pre-existing)
