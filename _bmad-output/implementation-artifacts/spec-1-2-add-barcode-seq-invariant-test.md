---
title: 'Story 1.2 Add: barcode_seq Invariant Test'
type: 'test'
created: '2026-08-25'
status: 'done'
route: 'one-shot'
---

# Story 1.2 Add: barcode_seq Invariant Test

## Intent

**Problem:** Story 1.2's migration is implemented and verified against the live database, but has no test to guard against someone later editing it (e.g., accidentally removing `CACHE 1`, which would silently burn barcode numbers at connection close).

**Approach:** Add a read-only invariant test in `backend/tests/guards/` that verifies the sequence shape matches the migration's specification and scans source code to prevent calls to `ALTER SEQUENCE ... RESTART` or `setval` against the sequence.

## Suggested Review Order

1. [tests/guards/barcode-seq-guard.test.js:13-35](backend/tests/guards/barcode-seq-guard.test.js) — test setup creates the sequence once per run
2. [tests/guards/barcode-seq-guard.test.js:38-67](backend/tests/guards/barcode-seq-guard.test.js) — database shape assertion queries pg_sequence and validates all six options
3. [tests/guards/barcode-seq-guard.test.js:69-78](backend/tests/guards/barcode-seq-guard.test.js) — pg_depend check confirms no owned-by-column dependency
4. [tests/guards/barcode-seq-guard.test.js:82-95](backend/tests/guards/barcode-seq-guard.test.js) — source scan guard prevents reset operations in application code
5. [tests/guards/barcode-seq-guard.test.js:97-160](backend/tests/guards/barcode-seq-guard.test.js) — scan implementation with directory traversal and false-positive filtering

## Test Results

- All 122 tests pass: 119 existing + 3 new guard tests
- New test file: `backend/tests/guards/barcode-seq-guard.test.js`
- Database assertions: ✓ sequence exists, ✓ data type is bigint, ✓ increment 1, ✓ start 1, ✓ cycle NO, ✓ cache 1, ✓ no owned-by dependency
- Source scan: ✓ no ALTER SEQUENCE RESTART, ✓ no setval against barcode_seq

## Notes

- Test does NOT call `nextval()` — only reads sequence metadata
- Test creates sequence in setup with error-handling for "already exists"
- Source scan uses built-in Node fs rather than glob, excludes node_modules and common build directories
- All queries are read-only; test creates nothing, alters nothing, drops nothing
