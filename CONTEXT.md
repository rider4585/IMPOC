# IMPOC — Project Context & Handoff

Context branch for the IMPOC application (a.k.a. **Shree Fashion Store** POS/inventory system).
This branch carries the full project context so a new session or team member can continue.
The `main` branch holds only the clean application (`backend/`, `frontend/`).

---

## What this is

A shop-management web app for a fashion retail store: **Inventory** (trips → vendors → stocks → units, barcode intake), **POS/checkout** (retail + rental, UPI-QR payment, customer display), **Rentals**, **Expenses**, **Customers** (with consent), **Reports/Dashboard**, and a **branded printable receipt**. Role-based access throughout.

## Stack

- **Frontend:** React 19 + Vite (rolldown), Tailwind v4, framer-motion, TanStack Table v8, cmdk, lucide-react, `@zxing` (barcode), `qrcode.react`. Tests: Vitest.
- **Backend:** Node (ESM) + Express + Sequelize + PostgreSQL. Money stored as BIGINT paise. Auth: JWT (memory-only access token) + httpOnly refresh cookie. Tests: Jest.
- **Branch:** work is on `framework/md-impoc`; `main` = clean app; `context` = this handoff.

## Run it

```
# Postgres must be running; create dev + test DBs.
cd backend
cp .env.example .env        # then fill values (see below)
npm install
npm run db:migrate && npm run db:seed
npm run dev                 # http://localhost:3000

cd ../frontend
npm install --legacy-peer-deps   # (pre-existing @testing-library/react peer conflict)
npm run dev                 # https://localhost:5173 (basic-ssl); dev:host for LAN access
```

- **Production (Windows shop laptop):** `deploy/windows/setup.cmd` (once, as admin) + `start.cmd` on login; backend under pm2 serves `frontend/dist` on one port. Guide: `docs/WINDOWS_PRODUCTION_SETUP.md`.
- **Tests:** frontend `npx vitest run` (436 passing); backend `NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit` (806 passing).
- **Env:** `backend/.env` needs DB creds, `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, `STORE_NAME/ADDRESS/PHONE`. `.env` files are gitignored — never commit them.

## Current state (2026-09-16)

- **150 tickets done.** Latest (2026-09-17): **R-64** barcode PDF always fresh — removed the `request_keys` idempotency replay so `GET /api/barcodes/generate` never returns a cached JSON marker on cold start (shipped both branches); (2026-09-16): **R-63** Customer Enquiries (see below); (2026-09-14): **R-61** scanner zoom presets 1×/2×/3× (default 2×, remembered per device); **R-59** Units page — Scan button finds a unit by camera; **R-58** theme drawer — editable shop name + logo (server-side, public `GET /api/branding`, admin `branding.manage`) and a custom accent colour picker; **R-57** add-unit page — new colour/size can be created inline from the (searchable) dropdowns; **R-56** sheet configurator templates (`barcode_layout_templates`) + page sizes A3/A4/A5/Letter/Custom (mm/cm/inch, stored mm; no 10-row cap — fit check rules); **R-55** vendor bill photo — Take photo (in-app camera, native fallback) / gallery → review / retake, downscaled to 1600 px JPEG (`components/PhotoCapture.jsx` is the reusable image input; the only file input in the app, still base64 in `trip_vendors.receipt_image`); **R-54** Google review QR on the customer display after payment (held until POS *Close transaction*; link in Picklists → Review links, `review_links` table); **R-53** digital pet on the customer display (weighted random animations, per-row fps, tap-to-poke); **R-51** GST on purchases — CGST/SGST % on stocks, CGST/SGST ₹ on vendor bills (total paid is GST-inclusive; no reconciliation), live “cost per unit incl. GST” hint on the stock form (migration `20260913000004`); **R-48** barcode values `SHREE` + base-36 timestamp + base-36 counter (15 chars, e.g. `SHREE0D4N5H000V`, unique even if `barcode_seq` is reset; columns widened to 32); **R-49** Print labels stays usable after a download (toast + fresh request key) and the label's price box takes the space under the barcode; **R-50** barcode sheet configurator — single-row `barcode_layouts` table (mm), "Configure barcode sheet" section on Print labels with live SVG preview + server-rendered `GET /api/barcodes/preview`; the generator no longer reads `app_settings` barcode keys. Plus friendly wording for backend-down/5xx errors (`apiClient.friendlyServerMessage`). Before that: UPI-QR checkout + customer display (R-35), POS display polish (R-42), barcode scanner (R-41), mobile responsiveness (R-44), intake fix (R-43), colourful A5 receipt (R-45).
- **Done 2026-09-13:** **R-53 digital pet** on the customer display idle screen — `frontend/src/platform/petEngine.js` (sprite engine + weighted random scheduler with per-animation hold times), `components/DigitalPet.jsx`, sheet at `frontend/public/pet/pet-sheet.png`, dev tuning page `/pet/pet-engine.html`.
- **Done 2026-09-16:** **R-47 receipt-template rework** (user re-scope + image placeholders) — only 2 templates (Sale/Rental), no create-new; every save writes a new `version` row as a DRAFT (`max+1`) while the published version stays live; an explicit **Publish** (`POST /:uuid/activate`) makes a version active; POS/rentals render the ACTIVE template through the engine (`renderReceiptFromPayload`) via `captureSnapshot` (fallback to the static builder only on template error); RENTAL seeded active, names 'Sale Receipt'/'Rental Receipt'; preview + snapshots actually use the stored template (previously silently used `buildBrandedReceiptHtml`); engine gained `store.wordmark` and image-slot support (`<div class="receipt-image-slot">` = dashed box in editor preview, stripped from printed receipts until replaced with a real `<img>`); `TemplateBuilder.jsx` rewritten from `react-email-editor` (blank-on-edit — Unlayer only loads its own JSON design, but templates store raw HTML) to a plain HTML editor with insert-placeholder / item-loop / image-slot + server Preview. Migrations `20260916000001` (publish-rules normalisation) + `20260916000002` (image-slot HTML onto published rows). Verified: `db:migrate`/`db:seed`/`db:refresh` clean, backend jest 806, frontend vitest 436, build clean. Note: physical-receipt photo could not be machine-read; template replicates the R-45 branded A5 design — a visual diff vs the printed receipt, if any, is a small seed-HTML tweak.
- **Done 2026-09-15:** **R-63 Customer Enquiry module** — `customer_enquiries` table, `/api/enquiries`, **Enquiries** page under POS / Counter (Open/Closed tabs, log with `CustomerPicker`, close = *tell the customer it's available* via tap-to-send WhatsApp / email / SMS links, or *close quietly*; reopen). No auto-matching by design. R-62g later routes the message through the real engine.
- **In test (built, awaiting the laptop run):** **R-60** durable backups — verified `pg_dump` twice daily via Task Scheduler, manual encrypted Google Drive upload (rclone, date folders), restore script; `setup.cmd` re-run registers it all (steps 10–11, additive). See `docs/WINDOWS_PRODUCTION_SETUP.md` §8.
- **Parked by user (revisit ~2026-10-13):** **R-52** — hide / remove / keep the Buying templates module, after a month of production use. No changes made there.
- **Open (planned, not started):**
  - **R-62 Customer Communication & Campaign platform** (epic + R-62a–n, planned 2026-09-14) — templates, notification engine + swappable providers, invoice auto-send, birthday programme, stock-availability alerts, campaigns, analytics. Phase 1 = **email (SMTP, real send) + WhatsApp via `wa.me` hand-off** (staff taps *Open WhatsApp*); SMS later; **no public URL** (LAN-only laptop → no links/webhooks yet). Design: `docs/COMMUNICATION_PLATFORM.md`. Waiting on: user go + which mailbox to send from.
  - ~~**R-46 Instagram publishing**~~ — REMOVED (too soon to plan, user 2026-09-15). WhatsApp part lives in R-62.
  - **R-47** original plan was folded into R-62e (2026-09-14); **reopened 2026-09-16 by the user** with the publish/version + physical-receipt scope and shipped (see *Done 2026-09-16* above).

## Key conventions & gotchas

- **GST (R-51):** stock rates are percents (`cgstRatePct`/`sgstRatePct`), bill GST is paise (`cgstPaise`/`sgstPaise`); `total_paid_paise` is GST-inclusive and is never reconciled against them. Landed cost is computed client-side only.
- **Money:** BIGINT paise end-to-end; DTOs return strings; never coerce to JS `Number` for large values.
- **Migrations:** ESM export style (`const migration = {...}; export const up = migration.up.bind(migration)`) — CommonJS `module.exports` breaks under `type: module`.
- **Internal-scroll layout:** every flex ancestor needs `min-h-0` for an internal-scroll child to bound (a column flex hides the bug on desktop but breaks mobile).
- **Branding:** shop name/logo live in `app_settings` (`shop_name`, `shop_logo`); read via `useBranding()` on the frontend and `getShopName()` on the backend — never hard-code the shop name.
- **Barcodes:** value format is locked in `barcode.constants.js` (`BARCODE_FORMAT`); sheet geometry lives in `barcode_layouts` (one row) and the math in `barcode-layout.geometry.js` ⇔ `frontend/src/platform/labelLayout.js` (keep identical); changing any `*.barcode` column type requires dropping/re-creating the R-32 grid views first (see migration `20260913000001`). If phone scanning of the 15-char code is flaky at 35 mm, raise `barcode_width_pt` in app_settings.
- **Receipt:** the branded HTML receipt is self-contained (inline CSS + SVG); the logo is a one-constant swap (`RECEIPT_LOGO_SRC`). The 58/80mm thermal text receipt is intentionally left plain (store does not use a thermal printer).
- **Receipt templates:** `receipt_templates` rows are **versions**, `is_active` = published; POS snapshots render only the ACTIVE template through the engine (`backend/src/modules/receipt-templates/`). Save = new draft `max+1` (never deactivates the published version); Publish = `activateTemplate`. `<div class="receipt-image-slot">` placeholders show as a dashed box in the editor preview and are stripped from printed receipts until replaced with a real `<img>`. Template HTML lives in the DB — seeded by `20260915000007`, patched by `20260916000001` (publish rules) and `20260916000002` (image-slot content).
- **DB migration verification rule:** Any task that creates/modifies a migration, model, seeders, or database schema MUST run all three verification steps before marking done. This is non-negotiable — a broken migration or seeder blocks all other devs and the production deploy:
  1. `npm run db:migrate` — verify new migrations apply cleanly on an existing DB.
  2. `npm run db:seed` — verify seeders run without errors (if your task touches seeders).
  3. `npm run db:refresh` — verify the full lifecycle (undo-all → migrate → seed) completes without errors. This catches backward-compatibility issues: a migration that works on a fresh DB but breaks when un-done, or a seeder that conflicts with earlier migrations.
  After all three pass, run the backend test suite (`NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit`) to confirm no regressions.
- **sequelize-cli ESM gotcha:** `sequelize-cli` 6.6.5 with Node ESM (`"type": "module"`) caches named replacements from earlier file revisions. If a migration uses `:roleId` named replacements and fails with `Named replacement ":roleId" has no entry in the replacement map`, switch to direct SQL interpolation with IDs from your own SELECT queries (safe since values are integer IDs from the DB, not user input). See `20260915000006-seed-receipt-template-permissions.js` for the pattern.
- **Security review** (R-23) findings are in `context/findings/SECURITY-FINDINGS.md` — SEC-* tickets track remediation.

## What's in `context/`

Curated snapshots of the orchestration workspace (`hive/`, which is gitignored and ~1.7 GB of local state):

| File | What |
|---|---|
| `board.md` | The freeform plan / shift log (full project history). |
| `tasks.json` (+ `tasks-archive.json`) | The kanban ticket log — who did what, per ticket, with detail. |
| `god-memory.md` | The orchestrator's durable memory: decisions, gotchas, lessons. |
| `memory-index.md` | Index of all agent memories. |
| `PROTOCOL.md`, `COMMANDS.md` | The hive orchestration protocol + command reference. |
| `findings/*` | Security, UI/UX, backend, Postgres reviews + the schema audit. |

`md-framework/` (tracked at repo root) holds the agent framework/skills used to build this.
