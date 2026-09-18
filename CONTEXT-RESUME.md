# CONTEXT-RESUME.md — Handoff for Other AI Tools

**Last updated:** 2026-09-18
**Branch:** `context` (all planning docs live here; clean code goes to `main`)

---

## Quick Start

1. **Read `CONTEXT.md`** at repo root — full project context (stack, conventions, what's built, what's open).
2. **Read `context/board.md`** — shift log with all completed work and decisions.
3. **Read `context/tasks.json`** — kanban ticket log with per-ticket details.
4. **Read `context/god-memory.md`** — orchestrator's durable memory (decisions, gotchas, lessons).
5. **This file** — what happened in the last session, what's next, what needs attention.

---

## What Happened in the Last Sessions (2026-09-18)

### Completed (user sign-off)
- **R-66 hide Buying templates UI** (R-52 interim, user: "for now remove the template option UI only, keep the functionality just hide it from frontend"). Frontend-only + reversible: removed the `/trips/:tripUuid/templates` route + `TemplateForm` import in `App.jsx`; removed the *Pre-fill from a buying template* picker / *No buying templates saved* note / *Manage buying templates* button + their state/fetch/handler in `StockForm.jsx`; dropped the 2 StockForm tests for that UI. Kept for restore: `TemplateForm.jsx`, `templatesApi.js`, `TEMPLATE_ROUTES`, the backend module, `stock_templates` table + data. Verified vitest 434/434 (node v20.19.6) + `vite build` clean. On `context` 4ba5b78 + `main` 634d87e. **Done 2026-09-18 by user sign-off.** R-52 stays blocked until ~mid-Oct fate decision.
- **SemVer baseline + first release** (2026-09-18): bumped both `package.json`s to **1.0.0**, annotated tag **`v1.0.0`** on `main` (`2c48ad6`), and **published the first GitHub Release** at https://github.com/rider4585/IMPOC/releases/tag/v1.0.0 from the CLI (keychain token + curl; see `docs/VERSIONING.md`). `gh` 2.101.0 installed (`/opt/homebrew/bin/gh`) — token lacks `read:org`, so use `GH_TOKEN="$(security find-internet-password -s github.com -w)" gh ...`.

### Completed (2026-09-17)
- **R-60 durable backups (user sign-off; laptop run still to do)** — `pg_dump` twice daily at 14:00 + 21:00 (local + encrypted Google Drive via rclone), log-driven catch-up at next power-on, first backup during setup. Already-setup laptop: run `setup-backup-local.cmd` then `setup-backup-cloud.cmd` as admin (elevated PowerShell). Commit `9f2aa17`; see `docs/WINDOWS_PRODUCTION_SETUP.md` §8.
- **R-65 enquiry close** — WhatsApp-only composer (temp, pre-R-62) + fixed the close 500 (`delivery_logs` entity-type CHECK gained `ENQUIRY`, migration `20260917000001`, test-setup mirrors the CHECKs).
- **R-64 barcode PDF always fresh** — removed the `request_keys` idempotency replay so `GET /api/barcodes/generate` never returns a cached JSON marker on cold start (the "Waking the system up" lockout). Backend `barcode.service.js`/`barcode.controller.js` + frontend `wakingRequest.js` + unit/integration tests. Shipped both branches (`context` bcb1740, `main` 172e0b6). No migrations.
- **Single canonical `context/tasks.json`** — consolidated the split (99 cards + `context/tasks-archive.json`) into ONE file: **165 tasks (148 done / R-60 doing / R-52 blocked / 15 todo R-62 family)**; archive removed. Commit b5439de. `hive/tasks.json` kept in sync. Never overwrite `context/tasks.json` from a stale/truncated copy — patch it in place.

### Completed (2026-09-16)
- **R-47 receipt-template rework** (user re-scope) — shipped to `context` and cherry-picked to `main` (clean code only). Recaps:
  - Only **2 templates** (Sale/Rental), creation removed from backend + frontend.
  - Each save = **new version** row (draft, `max+1`); the published version stays live; **Publish** (`POST /:uuid/activate`) marks a version active.
  - POS/rentals render the **ACTIVE** template via the engine (`renderReceiptFromPayload`) through `captureSnapshot`; preview + snapshots no longer silently used `buildBrandedReceiptHtml`.
  - Fixed the **blank-on-edit** editor: `TemplateBuilder.jsx` rewritten from `react-email-editor` (Unlayer can't load raw HTML) to an HTML source editor with insert-placeholder / item-loop / image-slot + server Preview.
  - Engine gained `store.wordmark` and **image slots** (`<div class="receipt-image-slot">`): dashed box in preview, stripped from printed receipts until replaced with a real `<img>` — the shop will add images later.
  - Migrations `20260916000001` (publish rules) + `20260916000002` (image-slot content onto published rows); seeder `20260915000007` updated (RENTAL active, names 'Sale Receipt'/'Rental Receipt', HTML now exports `SALE_TEMPLATE_HTML`).
  - Verified: `db:migrate`/`db:seed`/`db:refresh` clean, backend jest 806/806, frontend vitest 436/436, build clean.
- **Hive ops**: scheduler standup handled + filed; a reply to `scheduler` bounced again (not a floor agent — never reply to scheduler, handle standups locally). R-47 card set to done; board + memory + `context/` snapshots synced.

### Open item (non-blocking)
- The physical-receipt photo could not be machine-read by the orchestrator; the template replicates the R-45 branded A5 design. If the printed receipt differs (address/phone block, GST lines, extra note), that is a small seed-HTML tweak — tell the team when convenient.

---

## Current State

| Metric | Value |
|--------|-------|
| Done (tasks) | 151 |
| Doing | 0 |
| Blocked | 1 (R-52, parked to ~2026-10-13) |
| Todo | 15 (R-62 + a–n, all parked by user) |
| Tests | jest 806/806, vitest 434/434 (was 436; −2 for the removed StockForm template-picker tests) |

### Notable Passive Items
- **R-66** (done, user sign-off 2026-09-18): Buying templates UI hidden (FE only, reversible — `TemplateForm.jsx`/`templatesApi.js`/backend/table intact for a later keep/restore decision).
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