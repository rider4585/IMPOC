# CONTEXT-RESUME.md — Handoff for Other AI Tools

**Last updated:** 2026-09-15
**Branch:** `context` (all planning docs live here; clean code goes to `main`)

---

## Quick Start

1. **Read `CONTEXT.md`** at repo root — full project context (stack, conventions, what's built, what's open).
2. **Read `context/board.md`** — shift log with all completed work and decisions.
3. **Read `context/tasks.json`** — kanban ticket log with per-ticket details.
4. **Read `context/god-memory.md`** — orchestrator's durable memory (decisions, gotchas, lessons).
5. **This file** — what happened in the last session, what's next, what needs attention.

---

## What Happened in the Last Session (2026-09-15)

### Completed
- **R-63 Customer Enquiries** — fully done and user-tested. `customer_enquiries` table, `/api/enquiries`, Enquiries page under POS / Counter. Open/Closed tabs, log with CustomerPicker, close = tap-to-send WhatsApp/email/SMS links or close quietly. jest 769/769, vitest 436/436.
- **R-47 scope update** — receipt template versioning + webpage builder re-scoped. Previous delivery scope folded into R-62e. Plan finalized with user's answers to all 4 open questions (see below).
- **Board visibility fix** — added task summary table to top of `board.md` showing all tasks by status.

### R-47 Finalized Decisions (user answered 2026-09-15)
1. **Builder:** use an npm module (NOT custom-built). Must support tables and inline CSS edits. Candidates: react-email-editor (Unlayer), @bolttech/template-editor (Craft.js), email-block-builder.
2. **Snapshots:** store BOTH structured JSON (`receipt_payload` JSONB) AND rendered HTML in `receipt_snapshots`.
3. **Bulk export:** admin-triggered folder export keyed by invoice number. Purpose: recovery if PDFs lost.
4. **Two active templates:** one for retail sales, one for rentals. Older versions inactive but in DB for export.

### Files Updated
- `context/tasks.json` — R-47 card updated with user answers in humanQA + details
- `context/board.md` — R-47 section rewritten with finalized decisions + task summary table at top
- `context/god-memory.md` — R-47 user decisions logged

---

## Current State

| Metric | Value |
|--------|-------|
| Done (tasks.json) | 148 |
| Doing | 0 (R-60 was doing, now closed as code-complete — awaiting laptop run) |
| Blocked | 0 (R-52 was blocked/parked, now closed as done — user decided to revisit ~2026-10-13) |
| Todo | 17 (R-46, R-47, R-62 + a–n) |
| Tests | jest 769/769, vitest 436/436 |

### Active Tickets
- **R-60** (doing): durable backups — verified `pg_dump` twice daily, manual encrypted Google Drive upload, restore script. `setup.cmd` re-run registers it all. **Awaiting user run on laptop.**
- **R-47** (todo): receipt template versioning + webpage builder. Plan finalized, not yet dispatched. Needs: npm module evaluation → implementation kickoff.
- **R-62 + a–n** (todo): Customer Communication & Campaign platform. 15 sub-cards planned, none dispatched. Waiting on: user go + which mailbox to send from.
- **R-46** (todo): Instagram publishing (narrowed). Needs Meta accounts + app review. Parked.
- **R-52** (blocked): Buying templates module. User parked to ~2026-10-13 to decide Hide/Remove/Keep after production use.

---

## What to Do Next

### Immediate (when user says go)
1. **R-47 implementation** — evaluate npm modules for template builder, then build receipt template versioning + snapshot system. Start with Phase 1 (DB schema + template CRUD API + snapshot capture).
2. **R-62a** — comm platform foundation. Waiting on user go + mailbox decision.

### Not Blocking
- R-60 is done code-wise, waiting on user to run `setup.cmd` on the laptop.
- R-46 needs Meta accounts (external dependency).
- R-52 is parked by user decision.

---

## Key Files for R-47 (receipt builder)

| File | Purpose |
|------|---------|
| `backend/src/modules/receipts/receipts.service.js` | Core receipt builder (buildSaleReceipt/buildRentalReceipt) — snapshot capture goes here |
| `backend/src/modules/receipts/receipts.html.js` | Hardcoded branded HTML template (to be replaced by versioned templates) |
| `frontend/src/platform/brandedReceiptHtml.js` | Frontend copy of receipt HTML (keep in sync) |
| `backend/database/models/DeliveryLog.js` | `receipt_payload` JSONB (continues for email/WhatsApp via R-62) |
| `backend/src/modules/sales/sales.service.js` | Will trigger snapshot on sale creation |
| `backend/src/modules/rentals/rental-agreement.service.js` | Will trigger snapshot on rental creation |
| `backend/database/models/ReceiptTemplate.js` | To be created |
| `backend/database/models/ReceiptSnapshot.js` | To be created |

---

## Conventions to Follow

- **Branch:** `context` for planning/docs, `main` for clean code only.
- **Migrations:** ESM export style (`const migration = {...}; export const up = migration.up.bind(migration)`). CommonJS `module.exports` breaks under `type: module`.
- **Money:** BIGINT paise end-to-end; DTOs return strings; never coerce to JS `Number`.
- **Tests:** frontend `npx vitest run`; backend `NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit`.
- **Branding:** shop name/logo in `app_settings`; never hard-code. Use `useBranding()` (frontend) / `getShopName()` (backend).
- **Internal-scroll layout:** every flex ancestor needs `min-h-0` for internal-scroll child to bound.
- **Context branch policy:** planning docs in `context/` and `hive/` (gitignored). Only clean code merges to `main`.

---

## Files in `context/`

| File | What |
|------|------|
| `board.md` | Shift log / freeform plan (full project history) |
| `tasks.json` | Kanban ticket log with per-ticket detail |
| `tasks-archive.json` | Archived/completed ticket log |
| `god-memory.md` | Orchestrator's durable memory |
| `memory-index.md` | Index of all agent memories |
| `PROTOCOL.md` | Hive orchestration protocol |
| `COMMANDS.md` | Command reference |
| `findings/*` | Security, UI/UX, backend, Postgres reviews |
