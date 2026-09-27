# CONTEXT-RESUME.md — Handoff for Other AI Tools

**Last updated:** 2026-09-28
**Branch:** `context` (all planning docs live here; clean code goes to `main`)

---

## Quick Start

1. **Read `CONTEXT.md`** at repo root — full project context (stack, conventions, what's built, what's open).
2. **Read `context/board.md`** — shift log with all completed work and decisions.
3. **Read `context/tasks.json`** — kanban ticket log with per-ticket details.
4. **Read `context/god-memory.md`** — orchestrator's durable memory (decisions, gotchas, lessons).
5. **This file** — what happened in the last session, what's next, what needs attention.

---

## What Happened in the Last Sessions (2026-09-28)

### Completed (user sign-off)
- **R-72 Stock intake screen back button layout & positioning fix (2026-09-28)**:
  - User reported: in stocks intake screen the Back button was overlapping with the left nav bar on desktop and with the header on mobile.
  - Root cause: `StockIntake.jsx` lacked `position: relative` on its container, causing `absolute left-4 top-4 z-30` to position relative to the viewport at (16, 16) — directly on top of desktop left sidebar nav (0-240px) and mobile brand header (0-56px, z-20).
  - Fix: Added `relative min-h-full flex-1 sm:rounded-xl` to the root container and moved the Back button into an in-flow action bar (`flex items-center justify-between px-4 pt-4 pb-2`). Adjusted intake counter spacing (`pb-4`) to eliminate collision risks.
  - Added unit test in `stockIntake.test.jsx` verifying in-flow rendering and navigation to `/trips/:tripUuid`.
  - Shipped on `main` (`d53295f`) and `context` (`4ad4585`).
- **R-71 Barcode scanner custom audio & haptic feedback for valid/invalid scans (2026-09-28)**:
  - User supplied custom audio files: `frontend/public/sounds/valid-scan.mp3` and `frontend/public/sounds/invalid-scan.mp3`.
  - Created `frontend/src/platform/scannerSound.js` pre-loading and caching HTML5 Audio instances, resetting `currentTime = 0` for instantaneous repeated playback, synthesized Web Audio API oscillator fallback tones (rising chime for valid, error buzz for invalid) if blocked by browser autoplay policies or audio files fail, and paired vibration haptics.
  - Integrated across: `BarcodeScanner.jsx` (camera scan decode / camera errors), `POSScreen.jsx` (hardware barcode reader & camera additions to cart / lookup errors / duplicate / out-of-stock), and `StockIntake.jsx` (unit intake save / refusal / 404 / timeouts).
  - Test suite `frontend/src/platform/__tests__/scannerSound.test.js` (6/6 passing).
  - Shipped on `main` (`32145e1`) and `context` (`19de0fb`).
- **R-70 Mobile UI accessibility & layout improvements — DataGrid min-height (2026-09-28)**:
  - User reported: on small height mobile devices, only one row or partial row was visible in DataGrids and scrolling was awkward.
  - Enforced `max-md:min-h-[360px] max-md:min-h-[45vh]` and momentum touch scrolling in `DataGrid.jsx` and CSS, audited 16 screen containers.
  - Test suite `DataGrid.test.jsx` (6/6 passing).
  - Shipped on `main` (`3312ad9`) and `context` (`4371252`).
- **Receipt Template Preview Modal Upgrade & Native Scroll Fix (2026-09-23)**:
  - User requested: large / full-screen modal for receipt template preview in `TemplateBuilder.jsx`, and reported inability to scroll to the bottom of the receipt.
  - Root cause: Dynamic `iframeHeight` calculation (`doc.body.scrollHeight` on `onLoad`) under-reported content height before fonts/assets rendered, freezing the iframe height to ~850px and clipping the footer. Mouse wheel events over the iframe were trapped by the iframe document and could not scroll the outer container.
  - Fix: Upgraded preview `<Dialog>` to `fullScreen`, centered a document preview card (`max-w-[760px]`) containing an `h-full w-full` iframe, and injected scoped styling (`padding: 16px 0 48px 0`, `min-height: 100%`, smooth scrolling) so the iframe scrolls its own content natively down to the signature line with generous margin. Added a **Print preview** button in the modal footer.
  - Verification: 51/51 Vitest suites (467 tests pass), 53/53 Jest suites (828 tests pass), Vite build clean.
  - Deployed: `main` (`d51f08c`) and `context` (`5e44127`).
- **R-69 DataGrid action column popover / overflow menu pattern (system-wide, 2026-09-21)**:
  - User requested: System-wide pattern for grids with action columns — if an action column has more than 1 action button, show the most-used action directly in the cell, and group all other options in a small popover/dropdown menu. If only 1 action, keep it as a standalone button.
  - Implemented reusable primitive `ActionMenu.jsx` (`frontend/src/components/ui/`):
    - 1 action: renders standalone Button (no menu).
    - 2+ actions: primary action button + `⋯` (`MoreHorizontal`) overflow trigger button opening a portal popover (`createPortal`).
    - Smart viewport positioning (flip-above near viewport bottom), keyboard navigation (ArrowUp/Down, Escape), stopPropagation on row clicks, full dark/light mode token support.
  - Converted multi-action screens: `UsersScreen`, `RolesScreen`, `VendorsScreen`, `FlatPicklistManager`, `ExpensesScreen`, `StocksScreen`, `EnquiriesScreen`.

---

## Current State

| Metric | Value |
|--------|-------|
| Done (tasks) | 157 |
| Doing | 0 |
| Blocked | 1 (R-52, parked to ~2026-10-13) |
| Todo | 15 (R-62 family, all parked) |
| Tests | jest 828/828 (53 suites), vitest 480/480 (53 files) — 100% passing |

### Notable Passive Items
- **R-72** (done, 2026-09-28): Stock intake screen back button layout & positioning fix.
- **R-71** (done, 2026-09-28): Barcode scanner custom valid/invalid audio & haptic feedback.
- **R-70** (done, 2026-09-28): Mobile UI accessibility & DataGrid min-height.
- **R-69** (done, user sign-off 2026-09-21): DataGrid action column popover / overflow menu pattern (ActionMenu).
- **R-68** (done, user sign-off 2026-09-21): Active Sessions & Device Management in Admin.
- **R-67** (done, user sign-off 2026-09-20): Wi-Fi & LAN access modal with dynamic IP QR + connection guide (v1.1.0).
- **R-66** (done, user sign-off 2026-09-18): Buying templates UI hidden (FE only, reversible).
- **R-60** (done by user sign-off, **laptop run still to do**): durable backups — `pg_dump` twice daily 14:00+21:00, log-driven catch-up, local + encrypted cloud. `docs/WINDOWS_PRODUCTION_SETUP.md` §8.
- **R-52** (blocked, revisit ~2026-10-13): Buy/templates module — Hide/Remove/Keep decision after production use (interim = R-66 hide).
- **R-62 + a–n** (todo, **parked**): Customer Communication & Campaign platform. User: "dont start any work on R-62 tasks". Do not dispatch until user says go. Phase 1 = email (Brevo SMTP) + WhatsApp `wa.me` hand-off; no public URL.

---

## What to Do Next

1. **R-47 follow-ups** (only if the user raises them): visual diff vs physical receipt → tweak seed HTML; add a real `<img>` in the template editor once the shop has the artwork (replace the `.receipt-image-slot` div).
2. **R-62** — awaiting user go + mailbox decision. NOT to be started before that.
3. **R-60** — user runs `setup-backup-local.cmd` + `setup-backup-cloud.cmd` on the shop laptop.
4. **R-52** — revisit ~2026-10-13: keep or fully remove the Buying templates module (interim R-66 hide).

---

## Key Files for R-47 (receipt templates)

| File | Purpose |
|------|---------|
| `backend/src/modules/receipt-templates/` | Controller/routes/service/validation + `receipt-template-engine.js` (Handlebars-style renderer, `store.wordmark`, image-slot strip/preview) |
| `backend/src/modules/receipt-templates/receipt-templates.service.js` | Publish-first `updateTemplate` (max+1 draft), `activateTemplate`, `previewTemplate` (`{preview:true}`), `captureSnapshot` |
| `backend/database/migrations/20260916000001-publish-rules.js`, `20260916000002-image-slot.js` | R-47 rework data migrations |
| `backend/database/seeders/20260915000007-receipt-templates-seed.js` | Seeded SALE/RENTAL HTML (exported `SALE_TEMPLATE_HTML`) |
| `backend/tests/receipt-templates/receipt-templates.test.js` | Publish-first + image-slot tests (37) |
| `frontend/src/components/TemplateBuilder.jsx` | HTML source editor + Insert placeholder/item-row/image-slot + server Preview |
| `frontend/src/screens/admin/ReceiptTemplatesScreen.jsx` | 2 grouped templates, version history, Published/Draft badges, Publish |
| `frontend/src/components/receipts/BrandedReceiptDialog.jsx`, `ReceiptSection.jsx` | POS prints `snapshot.renderedHtml` from the ACTIVE template |

---

## Conventions to Follow

- **Branch:** `context` for planning/docs, `main` for clean code only. Context-only changes (docs, `context/`, root `CONTEXT*`) never go to `main`; app code (backend/frontend) ships to both via cherry-pick.
- **Versioning (SemVer, `docs/VERSIONING.md`):** every shipped change = version bump + annotated tag `vX.Y.Z` on `main` (baseline v1.0.0). PATCH = fix | MINOR = feature (default) | MAJOR = breaking/big. God bumps + tags at integration; workers never tag. GitHub Releases only for major improvements.
- **Migrations:** ESM export style; CommonJS `module.exports` breaks under `type: module`.
- **Money:** BIGINT paise end-to-end; DTOs return strings; never coerce to JS `Number`.
- **Tests:** frontend `npx vitest run` (from frontend/); backend `NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit` (never `--runInBand`).
- **DB verification rule:** any migration/seeder change → `db:migrate` + `db:seed` + `db:refresh`, then full backend jest.
- **Branding:** shop name/logo in `app_settings`; never hard-code (frontend `useBranding()` / backend `getShopName()`).
- **Hive:** scheduler is NOT a floor agent — never reply to it via outbox (bounces); handle standups locally and file to `.done`. Edit `hive/*.json` with Node, not PowerShell.
- **Receipt templates:** HTML lives in the DB; only the active version renders POS receipts; `.receipt-image-slot` divs are stripped from printed output until replaced with a real `<img>`.