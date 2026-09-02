---
stepsCompleted: [1, 2, 3]
epicsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
inputDocuments:
  - _bmad-output/specs/spec-impoc-core/SPEC.md
  - _bmad-output/specs/spec-impoc-core/glossary.md
  - _bmad-output/specs/spec-impoc-core/domain-model.md
  - _bmad-output/specs/spec-impoc-core/unit-state-machine.md
  - _bmad-output/specs/spec-impoc-core/dashboard-questions.md
  - _bmad-output/specs/spec-impoc-core/brownfield.md
  - _bmad-output/planning-artifacts/architecture/architecture-IMPOC-2026-08-20/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-IMPOC-2026-08-20/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-IMPOC-2026-08-20/EXPERIENCE.md
  - AGENTS.md
  - backend/AGENTS.md
  - frontend/AGENTS.md
---

# IMPOC - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for IMPOC, decomposing the capabilities in `SPEC.md`, the technical decisions in `ARCHITECTURE-SPINE.md`, and the behavioural/visual contract in the `DESIGN.md` / `EXPERIENCE.md` UX pair into implementable stories. IMPOC is a spec-driven brownfield project — `SPEC.md`'s **capabilities (CAP-n)** stand in for functional requirements, its **Constraints** and **Non-goals** stand in for non-functional requirements, and `ARCHITECTURE-SPINE.md`'s **architecture decisions (AD-n)** stand in for the technical/additional requirements a PRD-driven project would carry separately.

## Requirements Inventory

### Functional Requirements

Sequenced defects first — nothing can be scanned until barcodes are unique and A4 sheets print correctly — then capabilities in the spine's own build order.

**Brownfield defects (gate all intake work):**

- FR-D1: Fix barcode label layout — page size A2 → A4; every dimension (barcode width/height, text size, clear space, margins, grid) becomes a configurable value, not a literal.
- FR-D2: Replace the colliding `Date.now()`-based barcode value generator with a single persistent counter (`barcode_seq`) whose high-water mark survives restart and restore.
- FR-D3: Add authentication/authorization to `/generate` and `/test-sheet` barcode routes — ADMIN and INVENTORY_MANAGER only, via a new permission constant.
- FR-D4: Replace the barcode controller's hand-built error JSON with a Zod schema (`barcode.validation.js`) and `next(error)`, per the repo's error-shaping convention.
- FR-D5: Declare `@zxing/library` as an explicit `frontend/package.json` dependency (currently only a transitive dependency of `@zxing/browser`).

**Capabilities:**

- FR1 (CAP-1): Barcode sheet printing — N-page A4 PDF of blank Code 128 labels at 35mm×8mm (±0.5mm), 5pt human-readable number, 15pt handwriting space; ADMIN/INVENTORY_MANAGER only.
- FR2 (CAP-2): Barcode uniqueness — values come from a single persistent counter, strictly increasing, with no register of printed values; never rewinds on restart or restore.
- FR3 (CAP-3): Reference picklists — product-type hierarchy (nestable), colour, size, and damage-grade lists; intake rejects non-active entries; deactivation never alters existing records.
- FR4 (CAP-4): Vendor registry — every buying trip requires a vendor; a vendor's page lists every trip/lot/unit sourced from them.
- FR5 (CAP-5): Record a buying trip — vendor, date, bill reference, total paid; displays variance against Σ(lot quantity × buying price).
- FR6 (CAP-6): Define a lot — once-per-lot attributes (product type, name, quantity, buying/selling/floor price, channel, rental terms); rejects floor > selling or overdue-per-day ≤ rent-per-day.
- FR7 (CAP-7): Scan units into a lot — barcode + colour/size only; refuses an already-bound barcode naming the existing unit; blocks exceeding declared quantity.
- FR8 (CAP-8): Clone the last lot — pre-filled, fully editable, independent of the original.
- FR9 (CAP-9): Size-run intake mode — auto-advancing size sequence with wraparound; per-scan override that doesn't break the sequence.
- FR10 (CAP-10): Unit lifecycle enforcement — server enforces `unit-state-machine.md` exactly; every accepted transition writes a durable event (who/when/why/cause).
- FR11 (CAP-11): Take a unit out of circulation, and recover a lost one — damaged/lost/retired/maintenance transitions; one recovery action (ADMIN/MANAGER only, mandatory reason) restores stock value and reverses no money.
- FR12 (CAP-12): Scan-to-cart — continuous scan with no per-piece confirm; refuses non-`in_stock` or wrong-channel units inline without breaking the loop; duplicate scan collapses to one line.
- FR13 (CAP-13): Customer capture and lookup — WhatsApp-number lookup for returning customers; capture with consent flag/timestamp/purpose for new ones; checkout blocked until attached.
- FR14 (CAP-14): Retail checkout — commit-time re-verification of `in_stock`; per-piece or single negotiated-total pricing (spread per AD-36); floor-price refusal naming the piece; UPI/cash; snapshots on the sale.
- FR15 (CAP-15): Sale receipt — every line, total, payment method, snapshotted customer name, date, and a reference that reproduces the same receipt later unchanged.
- FR16 (CAP-17): Book rental units — date-range hold; rent (full window) + deposit collected as **held money, not revenue**; refused if window exceeds `floor(deposit / overduePerDay)`; retail-channel units cannot be booked.
- FR17 (CAP-18): Hand over rental units — one receipt per group interaction, each unit settling independently; no money moves at hand-over; walk-in books-and-hands-over in one transaction.
- FR18 (CAP-19): Rental return and settlement — closes one unit's agreement only; rent never recomputed/pro-rated; deposit settlement deducts overdue + damage/cleaning (never below zero); routes to stock/maintenance/retired; settlement slip always prints; write-off path for a piece that never returns.
- FR19 (CAP-20): Overdue visibility — overdue and accrued charge computed at read time with no stored flag and no scheduled job; deposit-exhaustion review list.
- FR20 (CAP-21): Record expenses — category, amount, date, note; unit-linked upkeep expenses; corrections are reversing rows.
- FR21 (CAP-22): Owner dashboard — every question in `dashboard-questions.md` (27 questions across three money buckets — earned, deposits held, rent held) answered for a user-chosen date range, each figure derived and drillable to its rows.
- FR22 (CAP-23): Retail exchange — reversing row for the returned line (original untouched), new line for the outgoing piece, difference collected/refunded, refused server-side beyond the configurable window (default 7 days).
- FR23 (CAP-24): Customer data consent and erasure — consent flag/timestamp/purpose on every customer; admin erasure anonymises the customer row without touching transaction snapshots; erased number becomes reusable.
- FR24 (CAP-25): Extend a booking — widens (never narrows) an `open` booking's window; recomputes rent by the same formula; re-checks the max-period rule; collects the difference at the counter.

**Retired:** CAP-16 (retail return) — superseded by CAP-23 (exchange). The ID is never reused.

### NonFunctional Requirements

- NFR1: All money is stored and computed as integer paise (`BIGINT`), named with a `_paise` suffix. No float, decimal, or rupee-denominated column anywhere.
- NFR2: Prices are snapshotted at two tiers — lot → unit at intake, unit → transaction row at checkout/booking. Editing a source record never alters a recorded transaction.
- NFR3: A completed sale, rental agreement, or expense is never UPDATEd. Corrections are always new reversing rows referencing the original.
- NFR4: No cron, scheduler, or background worker of any kind. Overdue status, maximum rental period, and the deposit-exhaustion date are derived on every read, never stored.
- NFR5: Every table carries created/updated timestamps and a soft-delete column. No domain row is ever hard-deleted.
- NFR6: The checkout/transition race guard is a compare-and-swap on the unit's status column — never `SELECT ... FOR UPDATE`, never a unique constraint on `sale_lines.unit_id`.
- NFR7: Rental availability is enforced by a generated `daterange` column plus a partial `EXCLUDE` (`btree_gist`) constraint — not an application-level check, not a `reserved` status.
- NFR8: Every mutating gesture carries a client-generated idempotency key (UUIDv4), verified against a single `request_keys` table; a replay returns the original committed result.
- NFR9: Shop time is `Asia/Kolkata`. Every day-boundary computation (overdue, exchange window, dashboard ranges) happens in Postgres via `AT TIME ZONE`, never from the server's local clock or `new Date()`.
- NFR10: The system is online-only — no service worker, offline queue, local-first store, or sync layer.
- NFR11: Rental days are counted inclusively as `(endDate − startDate) + 1` everywhere — booking rent, the maximum-period check, and utilisation — with no second formula anywhere.
- NFR12: Payment method is recorded as UPI or cash only. No payment gateway, card processing, or provider SDK.
- NFR13: Every barcode is Code 128, generated via `bwip-js` + `pdfkit` only, unique for the unit's whole life; every label dimension is runtime-configurable without a code change.
- NFR14: No reusable product-template or master-catalogue table — the lot is the template.
- NFR15: Access control reuses the five existing roles plus new permission constants (`RENTALS.*`, `CUSTOMERS.*`, `INVENTORY.BARCODE_GENERATE`, `INVENTORY.RECOVER_LOST`, `SETTINGS.MANAGE`); no route may test a role name or a string-literal permission.
- NFR16: Free-tier hosting is the deployment target — client must tolerate a 30–60s cold start with visible retry/backoff; no server filesystem writes (receipts/PDFs stream to the response); pooled DB connections (`max: 5`); an unauthenticated, no-DB-round-trip `/api/health` endpoint for external keep-warm pinging.
- NFR17: The dashboard read side is hand-written parameterised SQL over plain (never materialized) views only — the reports module imports no Sequelize model and calls no write-side service.
- NFR18: Every dashboard question ships as a `summary()`/`lines()` pair, both paginated; every collection response uses the `{ items, page, pageSize, total }` envelope (default 50, cap 200).
- NFR19: Logs are structured JSON to stdout carrying a request id; no external log or error-tracking vendor.
- NFR20: Out of scope by design — GST/tax invoicing, loyalty/points, vendor returns, multi-store/multi-currency, a customer-facing storefront, retail↔rental channel conversion, identity-document capture at rental hand-over, and outright sale refunds (exchange is the only post-sale path).

### Additional Requirements

Architecture decisions (`ARCHITECTURE-SPINE.md`, AD-1…AD-37) that bind implementation but aren't independently user-facing capabilities:

- Paradigm: layered modular monolith (`routes → controller → service → Sequelize model`) with a ledger-style write side and a CQRS-lite read side (`reports` module, SQL over plain views only). A service may call another service; nothing else crosses those lines except the one sanctioned exception (`units.service` reads `rental_bookings` directly for AD-8's booked-unit guard).
- AD-1: `uuid` on the wire, integer `id` never leaves the process (except `unit.barcode` as the scan-time key).
- AD-2: Money formatting/rounding is a single shared client formatter module (paise → ₹, half-up, 2dp, Indian grouping) — a **client-side obligation**, not left to "display."
- AD-3: Constrained string columns (`VARCHAR` + named CHECK), never Postgres `ENUM`; every constrained value is `UPPERCASE_SNAKE`.
- AD-4/AD-5: `deleted_at` on every new table; three row-mutability tiers (append-only ledger / terminal-freeze / mutable master data) are exhaustive over every new table.
- AD-6: Shop time is `Asia/Kolkata`; overdue is strict on the shop day; the exchange window is shop-day inclusive.
- AD-7: Rental availability = generated `daterange` + partial `EXCLUDE USING gist` (requires `btree_gist`).
- AD-8: `units.service.transitionUnit()` is the sole writer of `units.status`/`channel`/rental snapshots/`unit_status_events`, via one atomic compare-and-swap; carries the booked-unit guard, the booking-state CAS, and the `LOST`-recovery guard.
- AD-9: Partial unique indexes make "at most one reversal per row" and "at most one open agreement per unit" database facts.
- AD-10: One unmanaged transaction per counter gesture, opened by the service; nothing but Postgres I/O inside it; receipts render after commit.
- AD-11: Postgres constraint violations translated centrally (`withDbErrors`), keyed on constraint name.
- AD-12/AD-13: Read side is parameterised SQL over six plain views that own all netting (reversals, three-bucket rental money) — no money/event query reads the underlying tables directly.
- AD-14/AD-15: Every dashboard question declares a `shop_day`-column range anchor via its AD-13 view; a fixed, exhaustive index set.
- AD-16: No scheduler anywhere — overdue, max period, and deposit-exhaustion date are all computed in the rendering SELECT.
- AD-17: Barcode value = 7-digit minute prefix (computed in Postgres) + 5-digit `nextval('barcode_seq')`, digits-only, with a boot-time guard against reissuing an already-claimed minute.
- AD-18: Customer erasure mutates only the `customers` row; no historical read may join to `customers` for name/number (snapshots only).
- AD-19: Free-tier hosting envelope — cold start, ephemeral filesystem, pooled connections, and an owned health endpoint; three hard requirements bind whichever Postgres is chosen (`btree_gist` support, IANA timezone database, both pooled and direct connection strings).
- AD-20: Migrations ordered by dependency, forward-only once hosted; `btree_gist` enablement is migration step one, alone, so an unsupported host fails immediately.
- AD-21: Rental grouping is a `group_uuid` column on both rental tables, generated in the service — no header table.
- AD-22: Every mutating gesture carries a client `requestUuid`, checked against one `request_keys` table (insert-last, inside the gesture's own transaction); the enumerated gesture set may not be silently extended.
- AD-23: `rentalDays = (endDate − startDate) + 1`, one formula, every consumer.
- AD-24: Two-tier snapshot rule; no read path re-derives a snapshotted value by joining to its source.
- AD-25: The cart is client-side only (no `carts` table); every cart rule is re-enforced server-side at scan time and again at commit.
- AD-26: One collection envelope (`{ items, page, pageSize, total }`) for every list/drill endpoint.
- AD-27: A cancelled booking settles on the booking row itself (`cancelled_at`, `deposit_returned_paise`) — no agreement row is invented.
- AD-28: Runtime-tunable values (label geometry, exchange window) live in `app_settings`; structural values live in code.
- AD-29: The authorisation matrix is fixed and splits on which way money moves — `RENTALS.*` is six verbs (VIEW/BOOK/HANDOVER/EXTEND/SETTLE/CANCEL); `INVENTORY.RECOVER_LOST` is MANAGER+ only.
- AD-30: Structured JSON logging with a request id shared across retries.
- AD-31: A booking may be extended (never shortened) while `OPEN`, via the same CAS shape; no signed delta row.
- AD-32: A booking whose unit never returns terminates as `WRITTEN_OFF` in one transaction with the unit's move to `lost`.
- AD-33: Rental money is three buckets — EARNED / DEPOSITS HELD / RENT HELD — never summed; income recognised only at one of four exhaustive close events, anchored to that event's own day.
- AD-34: A person marks a unit lost; the deposit-exhaustion date is a derived prompt, never a trigger.
- AD-35: Exactly one arc (`recover`) leaves `LOST`; it reverses stock value and never money.
- AD-36: A whole-bill bargain spreads proportionally by selling price (largest-remainder method); a floor breach refuses the whole bill naming the specific unit.
- AD-37: Per-user preferences (pinned dashboard cards, default date range) persist server-side in one `user_preferences` JSONB row per user, restored on both `/auth/login` and `/auth/me`.

**Migration order (binding):** `btree_gist` extension enabled alone as migration 1 → `barcode_seq` → `app_settings` → `request_keys` → picklists (product types, colours, sizes, damage grades) → vendors → stock intakes/lines → units → customers → sales/sale lines → rental bookings/agreements → unit status events → expenses → customer erasure audit → report views → report indexes → user preferences → seeders (permissions, damage grades, colours/sizes).

**Parked decisions, each attached to a specific downstream story:**

- The five client-side obligations this spine fixes but leaves homeless — **the cart (AD-25), the idempotency key (AD-22), cold-start retry (AD-19.1), the collection envelope (AD-26), and money formatting (AD-2)** — must be assigned a home by the first frontend epic's opening story, which must explicitly name the frontend module/library that owns all five.
- **Receipt delivery channel** (the WhatsApp OS-share-sheet path vs. the `wa.me` text-link fallback) is settled at the CAP-15 (sale receipt) story, tested against a real device.
- **Hosting provider choice and the backup/restore procedure** attach to the deployment story, selected against AD-19's three hard requirements: `CREATE EXTENSION btree_gist` permitted, the IANA timezone database available, and both a pooled and a direct Postgres connection string exposed.

### UX Design Requirements

From the `DESIGN.md` / `EXPERIENCE.md` spine pair — `DESIGN.md` owns visual identity/tokens, `EXPERIENCE.md` owns behaviour/states/flows.

- UX-DR1: Design token system — warm-retail palette split into brand tokens (chrome/actions) and semantic tokens (6 unit-status colours, 4 money-kind colours), both light and dark, following `prefers-color-scheme` with no in-app toggle; typography ramp (Bricolage Grotesque display, Instrument Sans everything else, system-mono for barcodes), radii, and spacing scale implemented as reusable tokens.
- UX-DR2: Three-surface elevation system — FLAT / SOFT / GLASS — implemented as shared surface components with the binding assignment table enforced (money-deciding/refusal surfaces always FLAT; dashboard shell GLASS; ordinary cards SOFT; receipt exempt).
- UX-DR3: Status-pill component — the 6 unit-status colour tokens, always carrying a text label, colour never the sole signal.
- UX-DR4: Money-figure / deposit-figure components — sign-neutral plain figures vs. the 4 money-kind colours (in/out/held/reversed); deposits and rent-held always render `money-held` with the word "held" adjacent; every rupee figure in a `{typography.money*}` role with mandatory tabular numerals.
- UX-DR5: Money-bucket-row component — EARNED / DEPOSITS HELD / RENT HELD as three independent, edge-to-edge dashboard cards; no combined/fourth figure ever rendered.
- UX-DR6: The scan primitive (arm → decode → disarm → act → commit → re-arm) as a shared component/hook governing intake, exchange, hand-over, and return — camera off the instant a barcode decodes, nothing commits on decode alone.
- UX-DR7: The retail-cart continuous-scan exception — camera stays armed for the whole cart session; inline refusal toasts that don't break the loop; duplicate-scan collapse keyed on `unit.uuid`; single end-of-cart confirm step.
- UX-DR8: Cold-start "waking" banner — non-blocking, amber, appears at 1200ms, exponential backoff with jitter and visible attempt progress, escalates to a retry-with-same-key failure state at 90s.
- UX-DR9: Price & checkout screen — per-piece vs. one-total segmented toggle; AD-36 proportional spread shown read-only before commit; floor check runs once on commit and refuses naming the specific unit and its floor price.
- UX-DR10: Receipt-sheet component — A5 portrait, black-on-white in every theme/channel, the 7 fixed content blocks in order, reversed lines struck through, 4 delivery channels (View / Download PDF / Send on WhatsApp / Print) chosen per-receipt at issue time.
- UX-DR11: Dashboard-card and drill-sheet components — one figure per card, pinnable/reorderable (per AD-37), always-paged drill-down (AD-26), point-in-time cards explicitly labelled as such.
- UX-DR12: Date-range control — Today / This week / This month / Custom presets (default Today), one control governing every range-scoped card on the page.
- UX-DR13: Recovery panel — 3 destination radio choices (stock/maintenance/retire) plus a mandatory reason field with no default/placeholder, commit disabled until both set, explicit "no money moves" statement before commit.
- UX-DR14: Extension panel — date fields editable outward-only (narrowing rejected client-side before the request sends), live rent recompute showing only the difference to collect, re-run max-period check.
- UX-DR15: Customer sheet — WhatsApp-number-first lookup/capture flow with the CAP-13 consent copy block.
- UX-DR16: Permission-driven navigation — bottom tab bar (phone, max 4 items) / left rail (tablet+); a withheld section is absent, never a disabled entry, driven by the AD-29 permission matrix.
- UX-DR17: Accessibility floor — WCAG AA contrast (checked against actual glass backdrops, not assumed), colour never the sole signal, 48px/52px touch targets, always-visible focus ring, `aria-live` scan/counter announcements, `prefers-reduced-motion` and `prefers-reduced-transparency` handling, 200%-text-scale support with no clipping.
- UX-DR18: Responsive layout system — phone-first single column for all operating surfaces (thumb action bar, thumb-safe bottom padding); dashboard as a wide reading surface (1-col phone / 2-col tablet / 3-col wide, GLASS shell); a dedicated `@media print` A5 stylesheet with no app chrome for the receipt.
- UX-DR19: Voice-and-tone microcopy standard — every message names the specific barcode/unit/status/date/amount; no bare "error"/"invalid"/"failed"/"validation failed" text anywhere in the client.
- UX-DR20: The full named state-pattern library from `EXPERIENCE.md → State Patterns` (waking, wake-failed, camera denied, not-HTTPS, decode-failing, barcode-already-used, lot-full, wrong-channel, not-in-stock, duplicate-scan, below-floor, checkout-lost-race, no-customer-attached, window-unavailable, window-too-long, booking-narrowed, overdue, deposit-exhausted, sibling-still-out, beyond-repair, blocked-by-live-booking, refunding-exchange-held-by-cashier, outside-exchange-window, empty states, permission-absent) implemented with their prescribed treatments.

### FR Coverage Map

Stories live in `epics/`, one file per epic (see [Story Files](#story-files) below) — this map points into those files by story number (e.g. `3.2` = Story 3.2 in `epics/epic-03-trips-lot-intake.md`); it does not restate acceptance criteria. Story numbers come from each epic file's own headings; requirement attributions come from each story's "So that ... (IDs)" line, cross-checked against inline citations in acceptance criteria for requirements a "So that" line doesn't name. A `†` marks a requirement satisfied mainly by omission or convention rather than by one story's own acceptance criteria — read its note before treating the story list as the whole story.

#### Functional Requirements

| ID | Requirement | Stories |
| --- | --- | --- |
| FR-D1 | Fix barcode label layout (A2→A4, configurable geometry) | 1.5 |
| FR-D2 | Persistent `barcode_seq` counter, survives restart/restore | 1.2, 1.6 |
| FR-D3 | Auth on `/generate` and `/test-sheet` barcode routes | 1.7 |
| FR-D4 | Zod validation + `next(error)` for barcode routes | 1.8 |
| FR-D5 | Declare `@zxing/library` as explicit frontend dependency | 1.9 |
| FR1 (CAP-1) | Barcode sheet printing (A4 PDF, Code 128 labels) | 1.5 |
| FR2 (CAP-2) | Barcode uniqueness via single persistent counter | 1.6 |
| FR3 (CAP-3) | Reference picklists (product type, colour, size, damage grade) | 2.1, 2.2, 2.3 (backend); 2.5, 2.6, 2.7 (frontend Picklists screen, this run) |
| FR4 (CAP-4) | Vendor registry + vendor trip/lot/unit history page | 2.4 (CRUD), 3.6 (history view) — backend; 2.8 (frontend Vendors screen), 3.12 (frontend vendor detail, this run) |
| FR5 (CAP-5) | Record a buying trip | 3.1 (backend); 3.7 (frontend Trips screen, this run) |
| FR6 (CAP-6) | Define a lot | 3.2 (backend); 3.8 (frontend Lot form, this run) |
| FR7 (CAP-7) | Scan units into a lot | 3.3 (backend); 3.9 (frontend Lot intake scan loop, this run) |
| FR8 (CAP-8) | Clone the last lot | 3.4 (backend); 3.10 (frontend, this run) |
| FR9 (CAP-9) | Size-run intake mode | 3.5 (backend, also fed by 2.2's colour/size picklists); 3.11 (frontend, this run) |
| FR10 (CAP-10) | Unit lifecycle enforcement via `transitionUnit()` | 4.1 (backend); 4.6 (frontend Units list/detail screen, this run) |
| FR11 (CAP-11) | Take a unit out of circulation / recover a lost one | 4.2, 4.3, 4.4 (backend); 4.7, 4.8, 4.9 (frontend, this run) |
| FR12 (CAP-12) | Scan-to-cart | 5.2 |
| FR13 (CAP-13) | Customer capture and lookup | 5.3 (capture/lookup), 10.4 (own-details screen) |
| FR14 (CAP-14) | Retail checkout | 5.5 |
| FR15 (CAP-15) | Sale receipt (render + WhatsApp send) | 6.2, 6.3 |
| FR16 (CAP-17) | Book rental units | 7.2, 8.3 (cancel-before-handover path) |
| FR17 (CAP-18) | Hand over rental units | 7.5 |
| FR18 (CAP-19) | Rental return and settlement | 8.1, 8.2 (write-off path) |
| FR19 (CAP-20) | Overdue visibility, no stored flag/scheduled job | 8.4 |
| FR20 (CAP-21) | Record expenses | 9.1, 9.2 (corrections) |
| FR21 (CAP-22) | Owner dashboard, all 27 questions | 4.5 (Q15), 7.6 (Q22), 8.4 (Q12, Q26), 8.6 (Q11) — the five operational questions, re-sequenced by Raviraj (this run) into the epics that already own the tables they read; Q15 additionally gets its own frontend screen at 4.10 (this run's frontend restructure); the remaining 22, plus the dashboard shell that presents all 27, in Epic 12: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10 |
| FR22 (CAP-23) | Retail exchange | 6.1 (window snapshot), 6.4 (exchange gesture) |
| FR23 (CAP-24) | Customer data consent and erasure | 10.1, 10.2, 10.3, 10.4, 10.5 |
| FR24 (CAP-25) | Extend a booking | 8.5 |

**Retired:** CAP-16 (retail return) is explicitly closed off, not implemented — Stories 6.1 and 6.4 each state no story resurrects it, and 6.4's acceptance criteria assert no standalone refund route exists.

#### Non-Functional Requirements

| ID | Requirement | Stories |
| --- | --- | --- |
| NFR1 | Money as integer paise (`BIGINT`, `_paise` suffix), no float | 3.1, 3.2, 3.3 establish the convention; every later money-bearing story (5.4, 5.5, 6.1, 7.1, 7.2, 8.1, 9.1…) follows it |
| NFR2 | Two-tier price snapshot (lot→unit, unit→transaction) | 3.3 (tier one, intake), 5.4/5.5 (tier two, sale), 7.1/7.2 (tier two, rental) |
| NFR3 | Completed sale/agreement/expense never UPDATEd; reversing rows only | 9.2 (explicit); the same discipline is enforced structurally in 5.4/6.4 (`sales`) and 7.1/7.4 (`rental_agreements`) via AD-9's partial unique indexes |
| NFR4 | No cron/scheduler/background worker anywhere | 11.9 (dedicated proof story); the rule is what 8.4 and 12.1 are built to satisfy by construction |
| NFR5 | `deleted_at` + timestamps on every table; no hard delete | Established per new table across 1.1–1.4, 2.1–2.4, 3.1–3.3, 5.4, 7.1, 7.4, 9.1, 10.1; explicit mutability-tier framing in 7.1 (AD-4/AD-5) and 8.3 (AD-5) |
| NFR6 | Checkout/transition race guard is compare-and-swap, never `SELECT...FOR UPDATE` | 4.1 |
| NFR7 | Rental availability via generated `daterange` + partial `EXCLUDE` (`btree_gist`) | 7.1 |
| NFR8 | Every mutating gesture carries a client idempotency key, checked against `request_keys` | 1.4 (infrastructure); applied by every mutating-gesture story thereafter (5.1, 5.5, 7.2, 7.5, 8.1, 8.5, 9.1, 9.2, 10.1, 10.2) |
| NFR9 | Day-boundary computation in Postgres via `Asia/Kolkata`, never server clock | 5.3, 12.4 (explicit); the same discipline runs through every AD-6 citation (6.1, 6.4, 7.1, 8.x, 9.x, 10.x, 11.4) |
| NFR10 † | System is online-only — no service worker/offline queue/local-first store | No story builds or tests this directly; it is satisfied by omission across the whole build. The closest concrete decision is 5.1's cart being explicitly in-memory-only (no `localStorage`/`sessionStorage`) rather than a client-side persistence layer. |
| NFR11 | Rental days counted inclusively, `(end−start)+1`, one formula everywhere | 7.2 (defines the shared `rentalDays()` helper); reused unchanged by 8.1, 8.5 |
| NFR12 | Payment method is UPI or cash only, no gateway/card SDK | 5.4 (defines the `sales.payment_method` CHECK set); reused verbatim by 7.2 (`rental_bookings`), 8.1 (`rental_agreements.settlement_method`) |
| NFR13 | Every barcode is Code 128 via `bwip-js`+`pdfkit`, runtime-configurable dimensions | 1.5 (configurable geometry), 1.6 (12-digit Code 128 subset-C value) |
| NFR14 | No reusable product-template/master-catalogue table — the lot is the template | 3.2 (lot as the template), 3.4 (clone-last-lot copies a lot, not a catalogue) |
| NFR15 | Access control reuses the five roles + new permission constants; no role-name/string-literal test | 1.7 (`INVENTORY.BARCODE_GENERATE`); the "no dedicated constant needed" check recurs explicitly in 3.1, 3.3, 4.2, and the full matrix is exercised throughout every AD-29 citation (4.4, 7.2, 7.5, 8.1, 8.3–8.5, 9.1, 9.2, 10.1, 10.2, 10.5) |
| NFR16 | Free-tier hosting envelope — cold start, no FS writes, pooled connections, health endpoint | 6.2 (no FS writes, receipts stream); 11.1–11.9 (the whole epic) |
| NFR17 | Dashboard read side is hand-written SQL over plain views only, no Sequelize import | 12.3 (the story that builds and mechanically enforces the boundary); 8.1, 12.1 apply it |
| NFR18 | Every dashboard question ships `summary()`/`lines()`, both paginated, `{items,page,pageSize,total}` envelope | 12.3 |
| NFR19 | Structured JSON logs to stdout carrying a request id | 11.7 |
| NFR20 | Out of scope by design (GST invoicing, loyalty, vendor returns, multi-store, storefront, channel conversion, ID capture, outright refunds) | 6.1, 6.4 (the exchange-only / no-refund-path guarantee is the one item from this list a story actively enforces); the rest of the list is scope this build simply never adds |

#### Additional Requirements (Architecture)

Architecture decisions from `ARCHITECTURE-SPINE.md` (AD-1…AD-37). The unlabeled **Paradigm** decision (layered modular monolith with a CQRS-lite read side, and exactly one sanctioned cross-module exception) is enforced structurally throughout the backend epics (1–4, 7–10); its one named exception — `units.service` reading `rental_bookings` directly — is built at Story 7.3, and the CQRS-lite read-side boundary itself is established at Story 12.3.

| ID | Decision | Stories |
| --- | --- | --- |
| AD-1 | `uuid` on the wire, internal `id` never leaves the process | 7.1, 7.4, 9.1, 10.1, 10.2, 10.4 |
| AD-2 | Client-side money formatter (paise→₹, half-up, Indian grouping) | 5.1 (builds `platform/money.js`); consumed by 6.x, 9.x, 10.5 |
| AD-3 | Constrained strings via named `CHECK`, never `ENUM`, `UPPERCASE_SNAKE` | 7.1, 9.1 |
| AD-4 / AD-5 | `deleted_at` on every table; three row-mutability tiers | 7.1, 7.4, 9.1, 12.4, 10.1 (creation); 8.3 (cancellation as a mutable-tier write) |
| AD-6 | Shop time `Asia/Kolkata`; shop-day boundaries everywhere | 6.1, 6.4, 8.1, 8.4, 9.1, 12.1, 10.2, 10.4, 11.4 |
| AD-7 | Rental availability = generated `daterange` + partial `EXCLUDE USING gist` | 7.1, 7.2, 11.1 |
| AD-8 | `transitionUnit()` sole writer of unit status/channel/snapshots/events | 4.1 (stands it up), 4.2 (uses it), 5.5, 6.4, 7.2, 7.3 (adds the booked-unit guard deferred from 4.1), 7.5, 8.5 |
| AD-9 | Partial unique indexes: "at most one reversal" / "at most one open agreement" | 5.4, 6.4, 7.4, 8.1, 8.2, 9.2, 10.1, 10.2 |
| AD-10 | One unmanaged transaction per gesture; receipts render post-commit | 5.5, 6.2, 6.4, 7.2, 7.5, 8.1, 8.5, 9.1, 9.2, 10.2, 11.4 |
| AD-11 | Postgres constraint violations translated centrally (`withDbErrors`) | 10.2 |
| AD-12 / AD-13 | Read side = parameterised SQL over six plain views, no direct table reads | 6.4, 8.1, 8.2, 8.4, 12.1, 12.3, 12.5–12.9, 10.3, 12.10 |
| AD-14 / AD-15 | Every dashboard question declares a `shop_day` range anchor; fixed index set | 6.4, 12.1, 12.2, 12.4, 12.5–12.9 |
| AD-16 | No scheduler; overdue/max-period/deposit-exhaustion computed in the rendering SELECT | 7.2, 8.4, 8.5, 11.3, 11.9 |
| AD-17 | Barcode value = minute prefix + `nextval('barcode_seq')`, boot-time guard | 1.2, 1.6, 11.2, 11.3 |
| AD-18 | Customer erasure mutates only `customers`; no historical read joins live | 5.3, 8.4, 12.9, 10.1, 10.2, 10.3 (historical read audit), 10.4, 12.10 (reporting read audit, Epic 12 — split from 10.3 by this run since the reporting side did not exist in Epic 10) |
| AD-19 | Free-tier hosting envelope (cold start, ephemeral FS, pooled conns, health endpoint) | 1.1, 1.4, 5.1 (AD-19.1 client retry), 6.2 (AD-19.2 nothing stored), 10.5, 11.1–11.8 |
| AD-20 | Migrations ordered by dependency, forward-only; `btree_gist` first | 1.1, 5.4, 7.1, 7.4, 11.1, 11.2, 11.4, 11.8 |
| AD-21 | Rental grouping via `group_uuid` column, no header table | 6.2, 7.1, 7.2, 7.4, 7.5 |
| AD-22 | Client `requestUuid` idempotency key, checked against `request_keys` | 1.4, 5.1, 5.5, 7.2, 7.5, 8.1, 8.5, 9.1, 9.2, 10.1, 10.2, 10.5, 11.7 |
| AD-23 | `rentalDays = (end−start)+1`, one formula everywhere | 7.2, 8.1, 8.5 |
| AD-24 | Two-tier snapshot rule; no read re-derives a snapshotted value | 5.4, 6.2, 6.4, 7.1, 7.4, 7.5, 8.5 (via AD-23 formula reuse), 10.2, 10.3, 11.5 |
| AD-25 | Cart is client-side only; every rule re-enforced server-side | 5.1 (builds `platform/cart.js`), 5.2 |
| AD-26 | One collection envelope `{items,page,pageSize,total}` for every list/drill endpoint | 5.1, 8.4, 12.3, 12.4, 12.5–12.9 |
| AD-27 | Cancelled booking settles on the booking row itself, no invented agreement row | 8.3 |
| AD-28 | Runtime-tunable values live in `app_settings`; structural values in code | 1.3, 1.5, 6.1 |
| AD-29 | Fixed authorisation matrix, split on which way money moves | 1.7, 4.4, 6.4, 7.2, 7.5, 8.1, 8.3–8.5, 9.1, 9.2, 10.1, 10.2, 10.5 |
| AD-30 | Structured JSON logging with a shared request id | 11.7 |
| AD-31 | Booking extension via the same CAS shape, no signed delta row | 8.5 |
| AD-32 | Non-returning unit terminates `WRITTEN_OFF` + unit to `lost`, one transaction | 8.2 |
| AD-33 | Rental money = three buckets (EARNED/DEPOSITS HELD/RENT HELD), never summed | 7.2, 8.1, 8.2, 8.3, 8.5, 12.1, 12.4, 12.5, 12.7 |
| AD-34 | Person marks a unit lost; deposit-exhaustion date is a derived prompt | 4.4, 8.2, 8.4, 12.1, 11.9 |
| AD-35 | Exactly one arc (`recover`) leaves `LOST` | 4.4, 12.6 |
| AD-36 | Whole-bill bargain spreads proportionally by selling price | 5.5 |
| AD-37 | Per-user preferences persist server-side in `user_preferences` JSONB | 12.4 |

#### UX Design Requirements

| ID | Requirement | Stories |
| --- | --- | --- |
| UX-DR1 † | Design token system (palette, typography ramp, radii, spacing) | No story's acceptance criteria name a dedicated tokens deliverable — the shared `platform/money.js` tabular-numeral styling in 5.1 is the one concrete token-level artifact any story actually ships. Flag for the team: token/typography setup reads as assumed frontend groundwork rather than a scoped, testable story. |
| UX-DR2 | Three-surface elevation system (FLAT/SOFT/GLASS) | 5.2 (FLAT refusal toasts, FLAT cart surface per `DESIGN.md`'s binding rule); 12.4 (GLASS dashboard shell) |
| UX-DR3 | Status-pill component (6 unit-status colours, always labelled) | 4.6 (this run) — the first story to build `{components.status-pill}` as a real, shared, reusable component, consumed by every later unit-status-bearing screen in this run (4.6–4.10) and by every future epic that shows a unit's status. Story 3.12 (also this run) ships earlier in build order and uses a plain-text status fallback instead, since the component did not yet exist when it was written — recorded in 3.12's own text, not retrofitted. This closes the gap the previous run of this document flagged (`†`, no story named the component directly). |
| UX-DR4 | Money-figure / deposit-figure components, tabular numerals, money-held labelling | 5.1 (`formatPaise()` + tabular-numeral class); 12.4 (money-bucket cards render through it) |
| UX-DR5 | Money-bucket-row component (EARNED / DEPOSITS HELD / RENT HELD, no 4th figure) | 12.4 |
| UX-DR6 | Shared scan primitive (arm→decode→disarm→act→commit→re-arm) | Named explicitly as the pattern Story 5.2 deliberately departs from for the cart exception; the primitive's backend shape is first built at 3.3 (lot intake scanning) and reused by 4.2 (mark damaged/lost), 6.4 (exchange), 7.5 (hand-over), 8.1 (return); its first real **frontend** implementation is 3.9 (this run), which explicitly states the cadence it deliberately does not share with Epic 5's future retail-cart continuous-scan screen |
| UX-DR7 | Retail-cart continuous-scan exception (camera stays armed, inline refusals) | 5.2 |
| UX-DR8 | Cold-start "waking" banner, exponential backoff with jitter | 5.1 (builds `platform/wakingRequest.js`); surfaced again in 10.x and 11.x flows |
| UX-DR9 † | Price & checkout screen (per-piece/one-total toggle, AD-36 spread shown read-only) | Referenced by name throughout Story 5.5's acceptance criteria (`Price & checkout` screen, proportional spread, floor refusal) but never cited by its UX-DR number — treat 5.5 as the owning story, but confirm against `EXPERIENCE.md` directly since the story text never names UX-DR9. |
| UX-DR10 | Receipt-sheet component (A5, 7 fixed blocks, 4 delivery channels) | 6.2 (renderer + View/Download/Print), 6.3 (WhatsApp channel) |
| UX-DR11 | Dashboard-card and drill-sheet components (pinnable, always-paged drill-down) | 12.4 |
| UX-DR12 | Date-range control (Today/This week/This month/Custom, one control governs the page) | 12.4 |
| UX-DR13 | Recovery panel (3 destination radios, mandatory reason, no default) | 4.9 (this run) — the component's actual, correct home: Epic 4's `recover` action, matching `DESIGN.md`'s own component name and the mandatory-reason-no-default requirement verbatim, including the explicit "no money moves" statement. 10.5's erase-confirmation panel remains a structurally similar but functionally different panel and is left as its own citation below — this run does not touch Epic 10, so that mapping is corrected here only by giving UX-DR13 its real story, not by editing 10.5's own text. |
| UX-DR14 | Extension panel (outward-only dates, live rent recompute) | 8.5 |
| UX-DR15 | Customer sheet (WhatsApp-number-first, consent copy block) | 5.3 (capture/lookup), 10.4 (own-details screen) |
| UX-DR16 | Permission-driven navigation (absent section, never disabled) | 12.4, 10.5; also every frontend story this run adds (2.5, 2.8, 3.7, 4.6, 4.10), each registering its nav entry through `frontend/src/app/navigation.js`'s permission-gated registry (Story 1.15) rather than a role-name check |
| UX-DR17 † | Accessibility floor (WCAG AA, 48/52px targets, `aria-live`, reduced-motion/transparency, 200% scale) | Only the `aria-live` slice is concretely built, in 5.2 (`aria-live="polite"` cart announcements, assertive refusal announcements). No story's acceptance criteria test contrast, touch-target sizing, `prefers-reduced-motion`/`prefers-reduced-transparency` handling, or 200%-text-scale support — this requirement is materially thinner in the story set than in `EXPERIENCE.md`. |
| UX-DR18 | Responsive layout system (phone-first, dashboard 1/2/3-col, print stylesheet) | 6.2 (`@media print` A5 stylesheet) |
| UX-DR19 | Voice-and-tone microcopy standard (name the specific barcode/unit/status/date/amount) | 10.5; the standard is implicitly followed by every refusal-naming acceptance criterion across the story set (e.g. 3.3, 5.5, 6.4) rather than tested as its own deliverable |
| UX-DR20 | Full named state-pattern library (waking, wake-failed, camera-denied, …) | Spread across the stories that hit each named state rather than one dedicated story: 5.1/5.2 (waking, wake-failed, camera-denied, not-HTTPS, decode-failing, duplicate-scan), 5.2 (wrong-channel, not-in-stock, barcode-already-used, lot-full), 5.3 (no-customer-attached), 5.5 (below-floor, checkout-lost-race), 7.2 (window-unavailable, window-too-long, blocked-by-live-booking), 7.3 (blocked-by-live-booking guard itself), 8.2 (beyond-repair), 8.4 (overdue, deposit-exhausted, sibling-still-out), 8.5 (booking-narrowed), 6.4 (refunding-exchange-held-by-cashier, outside-exchange-window), 10.5 (permission-absent) |

**Coverage note:** every FR (including FR-D1–FR-D5), every NFR, every AD-1…AD-37, and every UX-DR is attributed to at least one story above. Three items (marked `†`) are covered only weakly or by omission rather than by a story built to deliver them — NFR10 (online-only, satisfied by never building offline support), UX-DR1 (design tokens — Story 1.11 builds the token theme itself, but no story ships a dedicated "design system" deliverable beyond it), and UX-DR9 (Price & checkout screen, never cited by its UX-DR number). This run resolved the two other items the previous pass flagged: **UX-DR3** (status-pill) now has a real owning story, 4.6, and **UX-DR13** (recovery panel) now has its correct owning story, 4.9, rather than only a citation on a structurally similar but functionally different panel (10.5). UX-DR17 still has a separate flag worth the team's attention: its accessibility floor is far narrower in the stories than in `EXPERIENCE.md`, and this run's frontend stories, while following the `aria-live` and touch-target rules stated inline (see 3.9, 4.7–4.9), do not add a dedicated contrast/reduced-motion/200%-scale test story either.

## Epic List

Sequencing rationale: the first block gates everything else — nothing can be scanned until barcodes are unique (FR-D2) and A4 sheets print correctly (FR-D1), so defects and CAP-1/CAP-2 lead. Backend data-model epics (2–4) then follow the spine's migration order (`btree_gist` → `barcode_seq` → `app_settings` → `request_keys` → picklists → vendors → stock intakes/lines → units). **Corrected across two later runs, this text was originally written before either ran:** Epic 1 is where four of the five homeless client-side obligations (AD-2, AD-19.1, AD-22, AD-26) actually get assigned an owner, in its own Stories 1.10–1.17 — the fifth, `cart.js` (AD-25), stays with Epic 5's Story 5.1, since nothing before Epic 5 has a cart to manage. Epic 1 is therefore the first frontend-facing epic, not Epic 5; and Epics 2, 3, and 4 each now ship their own frontend screens on top of Epic 1's foundation, ahead of Epic 5, so each module is usable as it lands rather than the whole frontend waiting on the retail counter. Retail (6), rental (7–8), expenses (9), consent/erasure (10) and deployment (11) follow in the order the spine's remaining migration steps and parked decisions imply. **Re-sequenced by Raviraj, this run:** the owner dashboard (CAP-22) — previously the second half of Epic 9 — is now **Epic 12**, moved to the very end of the build, after deployment, so it can be designed once the shop has actually been run and Raviraj knows what is worth showing on it. Five of the 27 dashboard questions are operational rather than analytical, and deferring them to the end would leave Raviraj unable to run the business in the meantime; this run carried those five out to the epics that already own the tables they read, each shipping at no infrastructure cost of its own — Epic 4 (Q15), Epic 7 (Q22), and Epic 8 (Q11, plus Q12/Q26, already there from before this run).

### Epic 1: Foundation & Barcode Remediation
Staff can generate correct, uniquely-numbered A4 barcode sheets, and the database carries the extensions and tables every later epic depends on.
**FRs covered:** FR-D1, FR-D2, FR-D3, FR-D4, FR-D5, FR1 (CAP-1), FR2 (CAP-2)
**Implementation notes:** Establishes the first four migration steps in the spine's binding order — `btree_gist` enabled alone as migration 1 (AD-20), `barcode_seq` (AD-17, FR-D2), `app_settings` for runtime-tunable label geometry (AD-28, FR-D1), and `request_keys` (AD-22) so the idempotency table exists before any epic needs it. Barcode value shape is the 7-digit minute prefix + 5-digit `nextval('barcode_seq')` (AD-17) with a boot-time guard against reissuing a claimed minute. Route auth uses the new `INVENTORY.BARCODE_GENERATE` permission (NFR15), not a role-name check. Error shape moves to Zod + `next(error)` (FR-D4) per the repo's existing convention. This epic is entirely backend; no UI beyond the existing print trigger changes. **Flagged, not fixed, this run:** the not-yet-written login story (part of this epic's coming frontend-foundation work) must account for `user_preferences` and AD-37's `preferences` field not existing until Epic 12 ships — see this epic's own implementation notes for the full flag.

### Epic 2: Reference Data & Vendor Registry
Staff can maintain the product-type/colour/size/damage-grade picklists and the vendor registry that every later purchase and intake record depends on.
**FRs covered:** FR3 (CAP-3), FR4 (CAP-4)
**Implementation notes:** Continues the migration order — picklists, then vendors. Deactivation must never alter existing records (deactivate ≠ delete, per AD-4/AD-5's mutable-master-data tier); intake-side validation that rejects non-active entries belongs to Epic 3, not here. **Resolved:** the vendor's page listing every trip/lot/unit sourced from them (FR4's second half) moves to Epic 3 — it is a read over `stock_intakes`, `stock_intake_lines` and `units`, none of which exist until Epic 3 creates them, so Epic 2 has nothing to build that view against. This epic ships vendor CRUD only. **Frontend added this run (Stories 2.5–2.8):** the Picklists screen and the Vendors screen, both permission-gated and both importing Epic 1's `platform/` module rather than reimplementing money formatting, pagination, or retry — see this epic's own file for the full account. This epic's acceptance bar, matching Epic 1's: after Story 2.8, Raviraj can shape the shop's own picklists and vendor list from his phone.

### Epic 3: Buying Trips & Lot Intake
Staff can record a buying trip, define a lot against it, and scan physical units into stock — including the clone-last-lot and size-run shortcuts.
**FRs covered:** FR5 (CAP-5), FR6 (CAP-6), FR7 (CAP-7), FR8 (CAP-8), FR9 (CAP-9)
**Implementation notes:** Migration order continues: stock intakes/lines, then units. Lot definition enforces floor ≤ selling and overdue-per-day ≤ rent-per-day server-side (FR6). Unit scan-in refuses an already-bound barcode by naming the existing unit, and blocks exceeding declared quantity (FR7) — both server-enforced, not just UI guards. No reusable product-template/master-catalogue table exists (NFR14): the lot is the template, so clone-last-lot (FR8) copies a prior lot's fields rather than instantiating from a catalogue. **Carried over from Epic 2:** this epic also owns the vendor detail view (a read listing every trip/lot/unit sourced from a given vendor, FR4's second half) — it belongs here rather than in Epic 2 because it reads `stock_intakes`, `stock_intake_lines` and `units`, all of which this epic creates. Sequence it as a late story, once those tables and at least the trip/lot stories exist. **Frontend added this run (Stories 3.7–3.12):** the Trips screen, Lot form, Lot intake's scan loop (this build's first real implementation of `EXPERIENCE.md`'s Scan Primitive), Clone last lot, Size-run mode, and the vendor detail history view carried over from Epic 2. This epic's acceptance bar, matching Epic 1's: after Story 3.12, Raviraj can run a real intake session — record a trip, define a lot, scan units in, including a size run — entirely from the app.

### Epic 4: Unit Lifecycle, Recovery & Loss Management
Staff can move a unit through damaged/lost/retired/maintenance transitions and recover a lost item without corrupting stock value or money.
**FRs covered:** FR10 (CAP-10), FR11 (CAP-11); partial FR21 (CAP-22) — Q15 only
**Implementation notes:** `units.service.transitionUnit()` becomes the sole writer of unit status/channel/rental snapshots (AD-8), via one atomic compare-and-swap (NFR6) — this is the epic that stands that service up, so every later epic touching unit state (cart refusal, checkout re-verification, rental hand-over/return, recovery) calls into it rather than writing `units.status` directly. Every accepted transition writes a durable `unit_status_events` row (who/when/why/cause). Recovery is `ADMIN`/`MANAGER`-only, mandatory reason, restores stock value, and reverses no money (AD-35) — one arc only. **Resolved:** AD-8's booked-unit guard (refusing a transition out of `in_stock` other than hand-over while a live booking covers today or later) is **not** built here — it needs `rental_bookings`, which doesn't exist until Epic 7. `transitionUnit()`'s guard is structured so Epic 7 can append that predicate without touching this epic's code; Epic 7 creates the table and wires the check together, in the same epic, so no window exists where a live booking goes unchecked. This mirrors Epic 2's vendor-history deferral to Epic 3. **This note must be mirrored into Epic 7's own implementation notes when that epic's stories are written** — not done in this run, since it belongs to an epic this run does not touch. **Carried in by this run's re-sequencing:** Story 4.5 answers Q15 ("what is in the workshop") as a live-table read, moved out of the (now-relocated) Epic 12 dashboard epic — it is the first `modules/reports/questions/` file this build creates, ahead of Epic 8's Story 8.4 in build order; see this epic's own file for the full account. **Frontend added this run (Stories 4.6–4.10):** the Units list/detail screen — which also stands up the shared `{components.status-pill}` component (UX-DR3) — mark damaged/lost, resolve out of maintenance, recover a lost unit (`MANAGER`/`ADMIN` only, per AD-29), and the Workshop screen answering Q15, wired so a resolved unit drops off it automatically. This epic's acceptance bar, matching Epic 1's: after Story 4.10, Raviraj can look up a unit, act on its lifecycle, and see the workshop queue, all from the app.

### Epic 5: Retail Cart, Customer Capture & Checkout (Frontend Foundation)
A cashier can continuously scan items into a cart, attach a customer, and complete a sale — cash or UPI, per-piece or one negotiated total.
**FRs covered:** FR12 (CAP-12), FR13 (CAP-13), FR14 (CAP-14)
**Implementation notes:** This is the first frontend-facing epic, and its opening story must explicitly name the shared frontend module that becomes the permanent home for the five client-side obligations the spine leaves homeless: the cart itself, held client-side only with every rule re-enforced server-side at scan time and again at commit (AD-25); the client-generated `requestUuid` idempotency key attached to every mutating gesture (AD-22); the cold-start wake/retry banner and backoff logic (AD-19.1); the `{ items, page, pageSize, total }` collection-envelope client contract (AD-26); and the shared paise→₹ money formatter (AD-2). Every later frontend epic imports from this module rather than reimplementing any of the five. Scan-to-cart refuses non-`in_stock` or wrong-channel units inline without breaking the scan loop, and duplicate scans collapse to one line, keyed on `unit.uuid` (UX-DR7). Checkout re-verifies `in_stock` at commit time (closing the scan-to-commit race via the same CAS from Epic 4), spreads a negotiated total proportionally by selling price (AD-36), and refuses below-floor by naming the specific piece. Checkout is blocked until a customer is attached (FR13); customer lookup is WhatsApp-number-first with a consent flag/timestamp/purpose captured for new customers.

### Epic 6: Sale Receipts & Retail Exchange
A customer receives a receipt they can view, download, or have sent to them, and can exchange a piece within the shop's return window.
**FRs covered:** FR15 (CAP-15), FR22 (CAP-23)
**Implementation notes:** The receipt-delivery channel decision — WhatsApp OS-share-sheet vs. the `wa.me` text-link fallback — is settled and tested against a real device as part of the FR15 story, not left open past this epic. Receipt content is the 7 fixed blocks in a fixed order (UX-DR10), reproducible unchanged from the stored reference later. Exchange writes a reversing row for the returned line (original untouched) plus a new line for the outgoing piece, nets the difference, and is refused server-side beyond the configurable window (default 7 days) (FR22). CAP-16 (the old retail-return capability) is retired and superseded by this exchange flow; its ID is never reused and no story in this epic should resurrect it.

### Epic 7: Rental Booking & Handover
Staff can book a rental unit for a date range, collect rent and deposit as held money, and hand the unit over — one receipt per group, no money moving at hand-over.
**FRs covered:** FR16 (CAP-17), FR17 (CAP-18); partial FR21 (CAP-22) — Q22 only
**Implementation notes:** Rental availability is enforced by a generated `daterange` column plus a partial `EXCLUDE USING gist` constraint (AD-7) — relying on the `btree_gist` extension Epic 1 already enabled — not an application-level overlap check. Booking is refused if the window exceeds `floor(deposit / overduePerDay)`; retail-channel units cannot be booked. Rental grouping uses a `group_uuid` column on both rental tables (AD-21), no header table. Hand-over settles each unit in the group independently even though it's one receipt; a walk-in can book-and-hand-over in a single transaction. **Carried over from Epic 4:** this epic also wires AD-8's booked-unit guard into `units.service.transitionUnit()` — deliberately left unbuilt in Epic 4 because `rental_bookings` didn't exist yet, with the guard structured there as an ordered list of pre-write checks precisely so this epic could append the predicate without touching Epic 4's CAS statement or any check it already added. `units.service` reads `rental_bookings` directly for this one predicate — the single sanctioned cross-module table read the architecture spine's dependency-direction rule carves out — never a call into `rentals.service`, which would be a circular import failing at module load, since `rentals.service` itself calls into `units.service` for the hand-over transition. **Migration renumbering carried over from Story 6.1:** `rental_bookings` takes migration slot 18 and `rental_agreements` slot 19 — one slot later than the Requirements Inventory's migration order implies — because Story 6.1 already claimed slot 17 for `exchange_window_days_snapshot`. **Carried in by this run's re-sequencing:** Story 7.6 answers Q22 ("what is booked but not yet collected") as a live-table read, moved out of the (now-relocated) Epic 12 dashboard epic — it reads `rental_bookings` directly, needing nothing from Epic 12's view layer.

### Epic 8: Rental Returns, Settlement, Extension & Overdue Visibility
Staff can close out a returning unit's agreement, extend an active booking outward, and see which bookings are overdue or at deposit-exhaustion risk — all without a scheduler.
**FRs covered:** FR18 (CAP-19), FR19 (CAP-20), FR24 (CAP-25); partial FR21 (CAP-22) — Q11, Q12, Q26
**Implementation notes:** Return closes exactly one unit's agreement; rent is never recomputed or pro-rated (AD-23's single formula stands); deposit settlement deducts overdue plus damage/cleaning and never goes below zero; a settlement slip always prints. A unit that never returns terminates as `WRITTEN_OFF` in one transaction with the unit's move to `lost` (AD-32). Extension widens the window only — narrowed dates are rejected client-side before the request even sends (UX-DR14) and again server-side — recomputes rent by the same formula, and re-runs the max-period check. Overdue status and the deposit-exhaustion date are both derived at read time with no stored flag and no scheduled job (NFR4, AD-16) — this epic is where that derivation logic is written once and shared by the settlement and visibility stories alike. Story 8.4 (Q12, overdue; Q26, deposit-exhaustion) shipped before this run and is unchanged by it, other than its cross-references to the dashboard epic being corrected from "Epic 9" to "Epic 12". **Carried in by this run's re-sequencing:** Story 8.6 answers Q11 ("what is out on rent right now") as a live-table read, joining Q12/Q26 as this epic's third carried-in dashboard question; all three read `rental_agreements`/`rental_bookings` directly, needing nothing from Epic 12's view layer.

### Epic 9: Expenses
The owner can log shop expenses — category, amount, date, note — with corrections as reversing rows, never an edit.
**FRs covered:** FR20 (CAP-21)
**Implementation notes:** The pre-existing `EXPENSES.UPDATE` permission is knowingly left alone as an orphaned grant (NFR3/CAP-21 forbid the UPDATE it would gate); `EXPENSES.REVERSE` is the permission the actual correction route checks. **Re-sequenced by Raviraj, this run:** this epic previously also carried the owner dashboard (CAP-22) as a second batch (old Stories 9.3–9.11). That work is now **Epic 12**, the final epic in the build, and its stories have since been renumbered 12.1–12.10 (see Epic 12's own implementation notes for the mapping); this epic covers expenses alone (Stories 9.1–9.2) and ships exactly one migration, slot 21.

### Epic 10: Customer Data Consent & Erasure
An admin can erase a customer's personal data on request while every past transaction still shows correct totals.
**FRs covered:** FR23 (CAP-24)
**Implementation notes:** Erasure mutates only the `customers` row (AD-18); every historical read already joins to snapshotted name/number from Epic 5/6's transaction rows, never live to `customers`, so this epic changes no other module's read path. An erased number becomes reusable. Small in FR count but a genuine standalone deliverable — it is a compliance action, not a sub-feature of checkout. **Re-sequenced by Raviraj, this run:** the erasure-audit migration moves from slot 25 to **slot 22**, now the next open slot after Epic 9's `21-create-expenses`, since Epic 12's dashboard migrations (views, indexes, `user_preferences`) no longer land between this epic and Epic 9 — the actual build order now matches the Requirements Inventory's own binding-order prose for the first time. Story 10.3 is now split: this epic's copy covers the historical read side only (verifiable now); the reporting read side (the six AD-13 views, the remaining 22 dashboard questions) moves to Epic 12's new Story 12.10, since neither exists until that epic ships.

### Epic 11: Deployment & Hosting Readiness
The shop can actually reach the app on the open internet, on free-tier hosting, with a documented way to restore from backup if something goes wrong.
**FRs covered:** none directly (NFR16, AD-19 close out here)
**Implementation notes:** This is the epic where the parked hosting-provider choice and backup/restore procedure are finally settled, selected against AD-19's three hard requirements: `CREATE EXTENSION btree_gist` permitted, the IANA timezone database available, and both a pooled and a direct Postgres connection string exposed. Covers the unauthenticated, no-DB-round-trip `/api/health` endpoint used for external keep-warm pinging, pooled connections (`max: 5`), and confirms no server filesystem writes anywhere (receipts stream to the response, per Epic 6). This is the one epic organized by technical necessity rather than end-user value — it is the precondition for every other epic's work being reachable at all.

### Epic 12: Owner Dashboard
The owner can open one dashboard, see all three rental money buckets kept visibly apart, and get an answer, with drill-down, to every one of the 27 dashboard questions — now the final epic in the build, per Raviraj's decision (this run), so it can be designed once the shop has actually run and he knows what is worth showing.
**FRs covered:** FR21 (CAP-22) — the 22 questions not already delivered by Epics 4, 7, and 8
**Implementation notes:** Inherits the six AD-13 views, the AD-15 index set, the reports module pattern, the dashboard shell (with `user_preferences` and AD-37's pinned-card persistence in full), and the five question-group stories from the old "Expenses & Owner Dashboard" epic — these kept their original numbers (Stories 9.3–9.11) when the dashboard first moved here, and have since been renumbered **12.1–12.9** in this same order, per this document's later cleanup pass (mapping recorded in Epic 12's own implementation notes). Five questions (Q11, Q12, Q15, Q22, Q26) are **already delivered** by Epics 4, 7, and 8 and are **not rebuilt here** — Story 12.7 only wires their existing routes into the card registry. Migrations run at slots 23 (views), 24 (indexes), 25 (`user_preferences`), immediately following Epic 10's slot 22. New **Story 12.10** (originally numbered 9.12) completes Epic 10's Story 10.3 split, auditing the reporting read side against AD-18 now that the views and questions exist. This epic closes the list rather than the epic depending on it (Epic 1's login story) waiting for it — see Epic 1's own flagged note.


## Story Files

**Stories live in `epics/`, one file per epic — never in this document.** This file is the index: requirements inventory, epic list, and coverage map. Sharding keeps each epic independently readable and, more practically, keeps any tool or agent that writes one epic's stories from having to read every other epic's first.

| Epic | File | Stories | Status |
| --- | --- | --- | --- |
| 1 | `epics/epic-01-foundation-barcode.md` | 1.1 – 1.17 | Complete |
| 2 | `epics/epic-02-reference-data-vendors.md` | 2.1 – 2.8 | Complete |
| 3 | `epics/epic-03-trips-lot-intake.md` | 3.1 – 3.12 | Complete |
| 4 | `epics/epic-04-unit-lifecycle-recovery.md` | 4.1 – 4.10 | Complete |
| 5 | `epics/epic-05-cart-customer-checkout.md` | 5.1 – 5.5 | Complete |
| 6 | `epics/epic-06-receipts-exchange.md` | 6.1 – 6.4 | Complete |
| 7 | `epics/epic-07-rental-booking-handover.md` | 7.1 – 7.6 | Complete |
| 8 | `epics/epic-08-rental-returns-settlement.md` | 8.1 – 8.6 | Complete |
| 9 | `epics/epic-09-expenses.md` | 9.1 – 9.2 | Complete |
| 10 | `epics/epic-10-consent-erasure.md` | 10.1 – 10.5 | Complete |
| 11 | `epics/epic-11-deployment-hosting.md` | 11.1 – 11.9 | Complete |
| 12 | `epics/epic-12-owner-dashboard.md` | 12.1 – 12.10 | Complete |

**94 stories written across all 12 epics. The breakdown is complete.** **Re-sequenced by Raviraj, this run:** the epic previously titled "Expenses & Owner Dashboard" is split — Epic 9 now covers expenses alone (Stories 9.1–9.2), and everything dashboard-related (the old Stories 9.3–9.11, plus a new Story 9.12) moves to **Epic 12**, the final epic in the build, after deployment. At the time of that move, every moved story kept its original number rather than being renumbered into Epic 12's own sequence, per that run's own instruction. **A later cleanup pass renumbers Epic 12's stories 12.1–12.10** (old-to-new mapping recorded in Epic 12's own implementation notes), since the old numbers made the epic read as though it still belonged to Epic 9. Three new stories were added, one each to Epics 4, 7, and 8 (Stories 4.5, 7.6, 8.6), each answering one of the five dashboard questions this run judged operational rather than analytical and moved out of the dashboard epic to the epic that already owns the table it reads — the other two of the five (Q12, Q26) were already at Epic 8's Story 8.4 from before this run. The [FR Coverage Map](#fr-coverage-map) above has been regenerated against the finished set of 94 stories across 12 epics.

**Frontend restructure, completed across three runs — this is the last one.** Epic 1 gained its frontend-foundation stories (1.10–1.17) in an earlier run, establishing the `platform/` module, the `DESIGN.md` token theme, the permission-driven route guard and app shell, and the login screen. This run adds the frontend screens for Epics 2, 3 and 4 (Stories 2.5–2.8, 3.7–3.12, 4.6–4.10 — 15 new stories, all appended to their existing epic files, none renumbered), so each of those three modules is usable and testable as it ships rather than waiting on Epic 5's retail counter. This also corrects a stale total this document carried since Epic 1's own frontend stories landed: the previous "71 stories" count here was computed against Epic 1's old 1.1–1.9 span and was never updated when Stories 1.10–1.17 shipped; the true pre-this-run total was 79, and this run's 15 additions bring it to 94. Every new screen imports Epic 1's `platform/money.js` (`formatPaise()`), `platform/envelope.js` (the AD-26 collection parser), and `platform/wakingRequest.js` (the cold-start retry wrapper) rather than reimplementing any of the three; every list follows AD-26's `{ items, page, pageSize, total }` envelope; and every nav entry is permission-gated through `frontend/src/app/navigation.js`'s registry per AD-29 — a surface a signed-in user cannot reach is absent from navigation, never present and disabled. Epic 4's Story 4.6 is also the first story in this build to stand up the shared `{components.status-pill}` component UX-DR3 names; Epic 3's Story 3.12 shipped earlier in build order and used a plain-text status fallback instead, since the component did not yet exist to import — recorded in both stories' own text rather than retrofitted. Each of the three epics now states its own "something Raviraj can open and use" acceptance bar in its implementation notes, matching the shape Epic 1's notes already used for Story 1.17's print screen.

Cross-epic dependencies already resolved and recorded in the relevant files: the vendor history view moved from Epic 2 to Epic 3; `unit_status_events` is created in Epic 4 with its `sale_line_id` and `agreement_id` foreign keys deferred to Stories 5.4 and 7.4 respectively; AD-8's booked-unit guard was deferred from Epic 4 to Story 7.3; Epic 8's first batch (Stories 8.1–8.3) shipped no migration because Stories 7.1 and 7.4 created its settlement and cancellation columns ahead of time; its second batch (Story 8.4) ships exactly one, migration slot 20, adding `rental_agreements.deposit_exhausted_on` as a generated column. **Migration order, re-sequenced by this run:** Epic 9 (expenses only) ships one migration, slot 21; Epic 10 (`customer_erasure_audit`) now follows directly at **slot 22** — no longer slot 25 — since Epic 12's dashboard migrations no longer sit between them; Epic 12 then ships the six AD-13 report views (slot 23), the AD-15 index set (slot 24), and `user_preferences` (slot 25) as the build's last three migrations before seeders. This is the first point in the build where the actual migration order matches the Requirements Inventory's own binding-order prose (`expenses → customer erasure audit → report views → report indexes → user preferences`) without needing the "prose describes dependency order, not a literal reservation of numbers" caveat every earlier epic's notes had to state. Story 10.3 (Epic 10) is split by this run: its historical-read audit stays in Epic 10, and a new Story 12.10 (Epic 12) completes the reporting-read audit and the dashboard-reconciliation test, neither of which could run before Epic 12's views existed. Epic 1's own implementation notes now flag, without resolving, that its not-yet-written login story returns no `preferences` field until Epic 12 ships `user_preferences`.
