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
- **Tests:** frontend `npx vitest run` (405 passing); backend `NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit` (744 passing).
- **Env:** `backend/.env` needs DB creds, `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, `STORE_NAME/ADDRESS/PHONE`. `.env` files are gitignored — never commit them.

## Current state (2026-09-13)

- **142 tickets done.** Latest (2026-09-13): **R-55** vendor bill photo — Take photo (in-app camera, native fallback) / gallery → review / retake, downscaled to 1600 px JPEG (`components/PhotoCapture.jsx` is the reusable image input; the only file input in the app, still base64 in `trip_vendors.receipt_image`); **R-54** Google review QR on the customer display after payment (held until POS *Close transaction*; link in Picklists → Review links, `review_links` table); **R-53** digital pet on the customer display (weighted random animations, per-row fps, tap-to-poke); **R-51** GST on purchases — CGST/SGST % on stocks, CGST/SGST ₹ on vendor bills (total paid is GST-inclusive; no reconciliation), live “cost per unit incl. GST” hint on the stock form (migration `20260913000004`); **R-48** barcode values `SHREE` + base-36 timestamp + base-36 counter (15 chars, e.g. `SHREE0D4N5H000V`, unique even if `barcode_seq` is reset; columns widened to 32); **R-49** Print labels stays usable after a download (toast + fresh request key) and the label's price box takes the space under the barcode; **R-50** barcode sheet configurator — single-row `barcode_layouts` table (mm), "Configure barcode sheet" section on Print labels with live SVG preview + server-rendered `GET /api/barcodes/preview`; the generator no longer reads `app_settings` barcode keys. Plus friendly wording for backend-down/5xx errors (`apiClient.friendlyServerMessage`). Before that: UPI-QR checkout + customer display (R-35), POS display polish (R-42), barcode scanner (R-41), mobile responsiveness (R-44), intake fix (R-43), colourful A5 receipt (R-45).
- **Done 2026-09-13:** **R-53 digital pet** on the customer display idle screen — `frontend/src/platform/petEngine.js` (sprite engine + weighted random scheduler with per-animation hold times), `components/DigitalPet.jsx`, sheet at `frontend/public/pet/pet-sheet.png`, dev tuning page `/pet/pet-engine.html`.
- **Parked by user (revisit ~2026-10-13):** **R-52** — hide / remove / keep the Buying templates module, after a month of production use. No changes made there.
- **Open (planned, not started):**
  - **R-46 Campaigns** — Instagram + WhatsApp publishing + insights. Feasibility done: IG posts/stories + insights are official-API buildable; WhatsApp Status and WhatsApp *Channels* have **no official API** (only ban-risk unofficial tools); compliant WhatsApp = Cloud API marketing templates to opted-in customers.
  - **R-47 Receipt delivery** — send the receipt at checkout via email / WhatsApp / SMS. Recommended build: thin adapters + `pg-boss` (Postgres queue, no new infra) + Nodemailer, reusing `delivery_logs` + the R-45 receipt HTML + a tokenized `/receipt/:token` page. Email is near-free; WhatsApp/SMS are paid + gated (WhatsApp Cloud API + WABA; SMS + India DLT).
- Both are parked on user decisions — see `context/tasks.json` (R-46, R-47) for the full analysis and open questions.

## Key conventions & gotchas

- **GST (R-51):** stock rates are percents (`cgstRatePct`/`sgstRatePct`), bill GST is paise (`cgstPaise`/`sgstPaise`); `total_paid_paise` is GST-inclusive and is never reconciled against them. Landed cost is computed client-side only.
- **Money:** BIGINT paise end-to-end; DTOs return strings; never coerce to JS `Number` for large values.
- **Migrations:** ESM export style (`const migration = {...}; export const up = migration.up.bind(migration)`) — CommonJS `module.exports` breaks under `type: module`.
- **Internal-scroll layout:** every flex ancestor needs `min-h-0` for an internal-scroll child to bound (a column flex hides the bug on desktop but breaks mobile).
- **Barcodes:** value format is locked in `barcode.constants.js` (`BARCODE_FORMAT`); sheet geometry lives in `barcode_layouts` (one row) and the math in `barcode-layout.geometry.js` ⇔ `frontend/src/platform/labelLayout.js` (keep identical); changing any `*.barcode` column type requires dropping/re-creating the R-32 grid views first (see migration `20260913000001`). If phone scanning of the 15-char code is flaky at 35 mm, raise `barcode_width_pt` in app_settings.
- **Receipt:** the branded HTML receipt is self-contained (inline CSS + SVG); the logo is a one-constant swap (`RECEIPT_LOGO_SRC`). The 58/80mm thermal text receipt is intentionally left plain (store does not use a thermal printer).
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
