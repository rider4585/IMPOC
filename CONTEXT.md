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

- **Tests:** frontend `npx vitest run` (357 passing); backend `NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit` (718 passing).
- **Env:** `backend/.env` needs DB creds, `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, `STORE_NAME/ADDRESS/PHONE`. `.env` files are gitignored — never commit them.

## Current state (2026-09-11)

- **133 tickets done.** Latest work: UPI-QR checkout + public customer display (R-35), POS display polish with logo QR + spoken thank-you (R-42), cross-platform barcode scanner (R-41, works iOS/macOS/mobile; Windows uses an external camera), app-wide mobile responsiveness (R-44), intake colour/size per-unit fix (R-43), and the **colourful A5 branded HTML receipt** (R-45).
- **Open (planned, not started):**
  - **R-46 Campaigns** — Instagram + WhatsApp publishing + insights. Feasibility done: IG posts/stories + insights are official-API buildable; WhatsApp Status and WhatsApp *Channels* have **no official API** (only ban-risk unofficial tools); compliant WhatsApp = Cloud API marketing templates to opted-in customers.
  - **R-47 Receipt delivery** — send the receipt at checkout via email / WhatsApp / SMS. Recommended build: thin adapters + `pg-boss` (Postgres queue, no new infra) + Nodemailer, reusing `delivery_logs` + the R-45 receipt HTML + a tokenized `/receipt/:token` page. Email is near-free; WhatsApp/SMS are paid + gated (WhatsApp Cloud API + WABA; SMS + India DLT).
- Both are parked on user decisions — see `context/tasks.json` (R-46, R-47) for the full analysis and open questions.

## Key conventions & gotchas

- **Money:** BIGINT paise end-to-end; DTOs return strings; never coerce to JS `Number` for large values.
- **Migrations:** ESM export style (`const migration = {...}; export const up = migration.up.bind(migration)`) — CommonJS `module.exports` breaks under `type: module`.
- **Internal-scroll layout:** every flex ancestor needs `min-h-0` for an internal-scroll child to bound (a column flex hides the bug on desktop but breaks mobile).
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
