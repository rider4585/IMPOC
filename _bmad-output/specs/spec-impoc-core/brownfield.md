# Brownfield notes

What already exists, what must be preserved, and the defects this spec obliges the build to reconcile. Repo conventions are not repeated here — they live in `../../../AGENTS.md`, `../../../backend/AGENTS.md`, and `../../../frontend/AGENTS.md`, which are part of this contract.

## Already built — do not rebuild

| Area | State | Location |
|---|---|---|
| Authentication | JWT access + refresh, argon2 hashing, session records | `backend/src/modules/auth/` |
| RBAC | Five seeded roles — ADMIN, MANAGER, INVENTORY_MANAGER, CASHIER, ACCOUNTANT — with role/permission join tables and middleware | `backend/src/modules/roles/`, `src/middleware/authorization.middleware.js` |
| Permission constants | `USERS`, `INVENTORY`, `SALES`, `EXPENSES`, `REPORTS`, `ROLES` groups, seeded to roles | `backend/src/constants/permissions.js`, `database/seeders/20260807175248-seed-role-permissions.js` |
| Barcode PDF generation | Working `bwip-js` + `pdfkit` pipeline, `/generate?pages=N` and `/test-sheet` | `backend/src/modules/barcode/` |
| Camera scanner | Working Code 128 decode on `@zxing/browser` | `frontend/src/components/BarcodeScanner.jsx` |
| Test suite | Auth, users, roles, permissions only. Every module in this spec starts with no coverage. | `backend/tests/` |

Everything else in `SPEC.md` is unbuilt.

The scanner's **decode logic is the asset to preserve**; its surrounding UI is scaffolding to replace (`frontend/AGENTS.md`).

## Defects to reconcile

These are known-wrong today. The build must fix them rather than work around them.

**D1 — Page size is A2, spec requires A4.**
`PDF_CONFIG.size` in `backend/src/modules/barcode/barcode.constants.js` is `'A2'`. CAP-1 requires A4. The whole `BARCODE_LAYOUT` block (4 columns × 6 rows, point-based paddings, `barcode.height: 7`, `text.fontSize: 8`) was sized for A2 and does not produce a 35mm × 8mm barcode with 5pt text and 15pt of writing space. Layout and page size are reworked together, not patched. `BARCODE_TEST_CONFIG` in the same file is already A4 and millimetre-based — it is the closer model.

Every dimension in the reworked layout is a configurable value, not a literal buried in the render (CAP-1): barcode width and height, text size, clear space, margins, and the derived grid. The layout is tuned against a physical print without a code change.

**D2 — The generator can collide.**
`generateBarcodeValues` in `barcode.service.js` builds values as `Date.now()` plus a zero-padded index. Two requests in the same millisecond emit identical values, and a clock adjustment or a second process can reissue a value already on a printed sheet.

The fix is **not** a register of issued values. Sheets are printed in advance and the system deliberately never knows which values exist on paper — intake accepts any value not already bound to a unit. The fix is to replace the timestamp with a single persistent counter (`BarcodeCounter` in `domain-model.md`), incremented atomically per sheet run, whose high-water mark survives restart and database restore. `Unit.barcode`'s unique constraint remains the only binding guard.

**D3 — Barcode routes are unauthenticated.**
`barcode.routes.js` mounts `/generate` and `/test-sheet` with no auth middleware. `backend/AGENTS.md` records this as a policy violation. CAP-1 restricts both to ADMIN and INVENTORY_MANAGER.

The guard is a **new permission constant** (e.g. `INVENTORY.BARCODE_GENERATE = 'inventory.barcode_generate'`) added to `permissions.js` and seeded to those two roles only. It is deliberately not `inventory.create`: MANAGER already holds that permission in the current seeder, and `backend/AGENTS.md` forbids testing role names or string-literal permissions in a route.

**D4 — Controller builds error JSON inline.**
`barcode.controller.js` returns a hand-built `{ success: false, message }` 400 for a bad `pages` parameter. `backend/AGENTS.md` requires a Zod schema in `<name>.validation.js`, then `next(error)`, with `error.middleware.js` shaping every failure. The barcode module has no `barcode.validation.js`; add one when touching this endpoint.

**D5 — Undeclared dependency.**
`BarcodeScanner.jsx` imports `@zxing/library`, which resolves only as a transitive dependency of `@zxing/browser`. Declare it in `frontend/package.json` before a version bump breaks the build.

## Unit interpretation

The source input specified "35mm x 8mm", "5px" text, and "15px" clear space, mixing millimetres and pixels. Confirmed 2026-08-20: the two pixel figures are **PDF points** — pdfkit's native unit — so 5pt text and 15pt of clear space, with the barcode staying in millimetres (35mm ≈ 99.2pt × 8mm ≈ 22.7pt). All of these are configuration defaults, not fixed values. Verify against a physical print before the layout is considered done — CAP-1's success criterion is a caliper reading, not a viewer's zoom level.

## Fit with existing permissions

The seeded permission groups cover inventory, sales, expenses, and reports. Rental has no group, and gets its own: a new `RENTALS.*` group in `permissions.js`, seeded per role, rather than riding on `SALES.*`. Selling rights and rental hand-over rights are therefore granted separately — a CASHIER can be given one without the other, and ACCOUNTANT can be given read-only rental visibility.

The same seeder migration adds `INVENTORY.BARCODE_GENERATE` (D3) and the customer-erasure permission behind CAP-24.
