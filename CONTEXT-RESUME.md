# CONTEXT-RESUME.md — Handoff for Other AI Tools

**Last updated:** 2026-09-21
**Branch:** `context` (all planning docs live here; clean code goes to `main`)

---

## Quick Start

1. **Read `CONTEXT.md`** at repo root — full project context (stack, conventions, what's built, what's open).
2. **Read `context/board.md`** — shift log with all completed work and decisions.
3. **Read `context/tasks.json`** — kanban ticket log with per-ticket details.
4. **Read `context/god-memory.md`** — orchestrator's durable memory (decisions, gotchas, lessons).
5. **This file** — what happened in the last session, what's next, what needs attention.

---

## What Happened in the Last Sessions (2026-09-20 / 2026-09-21)

### Completed (user sign-off)
- **R-69 DataGrid action column popover / overflow menu pattern (system-wide)**:
  - User requested: System-wide pattern for grids with action columns — if an action column has more than 1 action button, show the most-used action directly in the cell, and group all other options in a small popover/dropdown menu. If only 1 action, keep it as a standalone button.
  - Implemented reusable primitive `ActionMenu.jsx` (`frontend/src/components/ui/`):
    - 1 action: renders standalone Button (no menu).
    - 2+ actions: primary action button + `⋯` (`MoreHorizontal`) overflow trigger button opening a portal popover (`createPortal`).
    - Smart viewport positioning (flip-above near viewport bottom), keyboard navigation (ArrowUp/Down, Escape), stopPropagation on row clicks, full dark/light mode token support.
  - Converted multi-action screens: `UsersScreen` (Edit + Menu: Roles, Deactivate/Activate, Delete), `RolesScreen` (Permissions + Menu: Edit, Delete), `VendorsScreen` (Edit + Menu: History, Deactivate/Activate), `FlatPicklistManager` (Edit + Menu: Deactivate/Activate), `ExpensesScreen` (Edit + Menu: Cancel), `StocksScreen` (Units + Menu: Scan), `EnquiriesScreen` (Edit + Menu: Close; standalone Reopen when closed).
  - Single action screens verified as standalone buttons: `CustomersScreen`, `SessionsScreen`, `SalesListScreen`, `TripsScreen`, `TripDetailScreen`, `VendorDetail`.
  - Streamlined action column widths from 180-320px down to 130-150px, recovering significant horizontal space for data columns across all screens.
  - Fixed unmounted toast timer cleanup in `ToastProvider`.
  - Verified: 8/8 ActionMenu tests, full frontend suite (51/51 files, 467/467 tests pass), build clean, 53/53 backend suites (828/828 tests pass). Shipped on user sign-off.
- **R-68 Active Sessions & Device Management in Admin**:
  - Full active session tracking and device management panel in Admin under `/sessions`.
  - User/device telemetry (OS, browser, device, IP, last active), status tracking (`ACTIVE`, `REVOKED`, `EXPIRED`), multi-device breakdown cards, and remote revocation.
- **R-67 Wi-Fi & LAN Network Access Modal + Dynamic IP QR (v1.1.0 release)**:
  - User requested a screen or modal to display the exact Wi-Fi link for other devices (phones/tablets) to connect to IMPOC over local Wi-Fi with static/dynamic router IP.
  - User decisions: Header icon only (no dedicated router screen) + dynamic IP fetch on every modal open.
  - Backend: Added `GET /api/system/network` (`backend/src/modules/system/`) returning active IPv4 interfaces, server port, and primary URL via `os.networkInterfaces()`. Updated CORS in `backend/app.js` to allow private LAN IP ranges (`192.168.*`, `10.*`, `172.16-31.*`, localhost) with credentials so Wi-Fi devices are never blocked. Test suite `backend/tests/system/system.test.js` (11/11 pass).
  - Frontend: Added `NetworkAccessModal.jsx` featuring `QRCodeSVG` (qrcode.react with center shop monogram), monospace URL box with 1-click Copy button + toast, network interface picker (Wi-Fi vs Ethernet), and 3-step mobile connection guide. Integrated `Wifi` button into `AppShell.jsx` desktop and mobile headers.
  - Versioning: Bumped `backend/package.json` and `frontend/package.json` to **1.1.0**, annotated git tag **`v1.1.0`** pushed to origin. Shipped to both `main` and `context`. Verified by user and marked **DONE**.

---

## Current State

| Metric | Value |
|--------|-------|
| Done (tasks) | 154 |
| Doing | 0 |
| Blocked | 1 (R-52, parked to ~2026-10-13) |
| Todo | 15 (R-62 family, all parked) |
| Tests | jest 828/828 (53 suites), vitest 467/467 (51 files) — 100% passing |

### Notable Passive Items
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