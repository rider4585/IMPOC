---
name: IMPOC
description: Experience spine for IMPOC — the scan-driven operating surfaces, the owner's dashboard, and the receipt contract.
status: final
created: '2026-08-20'
updated: '2026-08-29'
sources:
  - _bmad-output/specs/spec-impoc-core/SPEC.md
  - _bmad-output/specs/spec-impoc-core/glossary.md
  - _bmad-output/specs/spec-impoc-core/domain-model.md
  - _bmad-output/specs/spec-impoc-core/unit-state-machine.md
  - _bmad-output/specs/spec-impoc-core/dashboard-questions.md
  - _bmad-output/specs/spec-impoc-core/brownfield.md
  - _bmad-output/planning-artifacts/architecture/architecture-IMPOC-2026-08-20/ARCHITECTURE-SPINE.md
  - frontend/AGENTS.md
---

# IMPOC — Experience Spine

> How it works. How it looks lives in `DESIGN.md`, whose tokens are referenced throughout by name in `{path.to.token}` form. Both spines win over any mock, wireframe, or import.
>
> Capability IDs (`CAP-n`), entity names, and status values are used exactly as `SPEC.md` and its companions define them. Where an architecture decision already binds the frontend it is cited as `AD-n` and is **not** re-litigated here.

## Foundation

One React 19 + Vite SPA. No UI system named — `DESIGN.md` is the visual identity and there is no shadcn/MUI/internal-system layer to inherit from or delta against. Light **and** dark are both first-class and follow the device (`prefers-color-scheme`); there is no in-app theme toggle.

**Two design centres, one app.** The operating surfaces — inventory, POS, rental, expenses — are phone-first and hand-held. The owner's dashboard is a wide reading surface designed for tablet and laptop; it stays correct on a phone but is not tuned there.

**The camera is a hard constraint.** `getUserMedia` requires HTTPS, so the app never runs on a plain `http://` LAN address (`frontend/AGENTS.md`; `vite.config.js` keeps `basicSsl()` and `host: true` deliberately). Staff will meet a self-signed-certificate warning in development and that is expected, not a defect.

**The decode core is inherited, not rebuilt.** `src/components/BarcodeScanner.jsx` holds a working Code 128 pipeline — native `BarcodeDetector` where the browser has it, `@zxing/browser` as fallback. **That logic is the asset and is preserved.** Everything wrapped around it — the start screen, the zoom control, the pause behaviour, the styling — is scaffolding this spine replaces. `@zxing/library` must be declared in `frontend/package.json` before it is depended on further (defect D5).

**Online-only, by decision.** No service worker, no offline queue, no local-first store, no sync layer (`SPEC.md` constraint). What replaces offline tolerance is the cold-start contract below.

### Upstream decisions that bind this spine

These arrive from `ARCHITECTURE-SPINE.md` already settled. They are recorded here because they shape screens, not because they are open.

| | What it means on screen |
|---|---|
| **AD-19.1** | The API sleeps after ~15 minutes idle and takes 30–60s to wake. Every call retries with backoff behind an explicit **waking** state. Waking is a normal state with its own visual language, never an error. |
| **AD-22** | The client mints a UUIDv4 **before the first attempt** of a counter gesture and reuses it unchanged across every retry. A replay returns the original result at 200. The user must never be told a committed sale failed. |
| **AD-25** | The cart is client-side only. Scan-time refusals are advisory; checkout re-verifies inside the transaction. Duplicate scans collapse on `unit.uuid` in the client. |
| **AD-26** | Every collection is `{ items, page, pageSize, total }`, 50 default / 200 cap. **Every list and every dashboard drill-down is a paged surface** — there is no "show all". |
| **AD-29** | The authorisation matrix is fixed and splits on which way money moves. `CASHIER` holds no `RENTALS.SETTLE`, `RENTALS.CANCEL`, or `INVENTORY.RECOVER_LOST`, and no refunding exchange. Navigation renders only what a role holds — a withheld surface is absent, never a disabled entry. |
| **AD-33** | Rental money is three buckets on the dashboard — EARNED, DEPOSITS HELD, RENT HELD — shown separately and never summed. A booking's rent and deposit sit in exactly one bucket at any instant. |
| **AD-36** | A whole-bill negotiated total spreads proportionally by selling price across the cart's lines. A floor breach refuses the whole bill, naming the specific piece and its floor price — never the total. |
| **AD-37** | The pinned dashboard card set, the default date range, and any future per-user UI setting persist **server-side**, one JSON document per user in `user_preferences` — never client-side storage. Both `/auth/login` and `/auth/me` return it, so it is present on first paint after a fresh login **and** after a reload or tab reattach, and it follows the signed-in user across devices. A cashier signing into the shop tablet never sees the owner's layout; a user who has customised nothing gets `{}` and the client's own defaults apply. |
| **AD-39–AD-42** | UPI payment is a shared surface, not four separate ones: a payment reference and a UPI deep link are allocated server-side, before any row exists, drawing a QR that writes nothing to any table while it's on screen. The QR's amount is a request the payer's own app may let her edit — never a lock — so a human eye on her success screen, not the QR, is what confirms payment. See *The UPI Payment Pattern* below. |

## Information Architecture

One app, four role-gated sections, plus the receipt as a surface reachable from several places.

**Navigation renders only what the signed-in user's permissions allow.** A section the user cannot enter is absent, not disabled — there is no visible-but-forbidden entry anywhere in the app. Navigation is driven by permission constants, never by a role-name test (`backend/AGENTS.md`; spine Conventions).

**The authorisation matrix is settled, in full, by AD-29 — nothing here is deferred any longer.** It splits on which way money moves: `ADMIN` holds everything; `MANAGER` holds everything `CASHIER` holds plus every money-*out* correction; `INVENTORY_MANAGER` holds the inventory set plus barcode generation and no counter gesture at all; `ACCOUNTANT` is read-only over money and never moves a unit or a customer.

**`CASHIER` holds money-in only, and Counter is smaller than "all of Counter" for them.** Checkout, the three rent-collecting rental gestures (book, hand over, extend), and customer capture/lookup are theirs. `RENTALS.SETTLE`, `RENTALS.CANCEL` and `INVENTORY.RECOVER_LOST` are not — so **Return & settle**, cancelling a booking, and **Recover a lost piece** are simply absent from a cashier's navigation, not disabled entries. Exchange stays reachable but only as far as `CASHIER`'s money-in permission carries it: a dearer swap that collects a difference completes at the counter; a swap that would refund cash is refused (see *State Patterns*) and handed to a manager. This settles the divergence the architecture spine flagged against this file (U-12) and retires the `[ASSUMPTION]` this section used to carry on `MANAGER` and `ACCOUNTANT` — AD-29 is the whole matrix now, not a partial one.

**Chrome:** bottom tab bar on phone (max four items, whatever the role holds), left rail from `tablet` up. Sheets stack one level deep, never two.

| Surface | Section | Reached from | Purpose | Capability |
|---|---|---|---|---|
| Trips | Inventory | Tab | Buying trips, paged, newest first | CAP-5 |
| Trip detail | Inventory | Trips row | Vendor, date, bill ref, total paid; **variance strip**; the trip's lots | CAP-5 |
| Lot form | Inventory | Trip detail → *Add lot* / *Clone last lot* | The once-per-lot attributes every unit inherits | CAP-6, CAP-8 |
| **Lot intake** | Inventory | Lot form → *Start scanning* | The scan loop and the `8 of 12` counter | **CAP-7, CAP-9** |
| Units | Inventory | Tab → *Units* | All units, filterable by status / type / lot / vendor, paged | — |
| Unit detail | Inventory | Any unit row or scan | Status, history, price snapshots, per-unit ledger | CAP-10, CAP-11, Q13 |
| **Recover a lost piece** | Inventory | Unit detail on a `lost` unit → *Recover* | Pick stock / maintenance / retire, mandatory reason | **CAP-11, AD-35 — `MANAGER` and above only** |
| Barcode sheets | Inventory | Tab → *Print labels* | Request N pages, receive the PDF | CAP-1, CAP-2 |
| **Retail cart** | Counter | Tab | Continuous scan-to-cart, camera never pauses, running total | **CAP-12** |
| Customer sheet | Counter | Cart → *Price & checkout* | Lookup by WhatsApp number, or capture with consent | CAP-13 |
| **Price & checkout** | Counter | Customer sheet → *Continue* | The single confirm screen: price per piece or one negotiated total, then UPI or cash — UPI draws a QR first and *Mark as received* commits; floor-price refusal lands here | **CAP-14, AD-36, AD-39–AD-42** |
| Exchange | Counter | Tab → *Exchange* | Scan a sold unit, swap for another — a refund difference hands off to a manager | CAP-23, AD-29 |
| Availability & booking | Counter | Tab → *Rentals* → *Book* | Date range, scan or pick units, collect rent + deposit — UPI QR or cash, *Mark as received* commits | CAP-17, AD-39–AD-42 |
| **Hand-over** | Counter | Rentals → *Hand over* | Release a booked group; no money moves for an already-booked group. A **walk-in** with no prior booking books and hands over in one visit, collecting rent + deposit there the same way — UPI QR or cash | **CAP-18, AD-39–AD-42** |
| **Extend booking** | Counter | Rentals → an `open` booking → *Extend* | Widen the window at either end, collect the extra rent on the spot — UPI QR or cash, *Mark as received* commits | **CAP-25, AD-39–AD-42 — `CASHIER` and above** |
| **Return & settle** | Counter | Rentals → *Return* | Scan a rented unit, grade it, settle the deposit — `MANAGER` and above only | **CAP-19, AD-29** |
| Out on rent | Counter | Rentals | Open agreements; due today / this week / **overdue** / deposit-exhausted (Q26) | CAP-20, Q11, Q12, Q26 |
| **Dashboard** | Dashboard | Tab | Pinned cards, date range, the three money buckets shown apart | **CAP-22, AD-33, AD-37** |
| Card library | Dashboard | Dashboard → *Add cards* | All 27 questions, groupable, pinnable | CAP-22 |
| Drill | Dashboard | Any card | The paged rows behind one figure | AD-14, AD-26 |
| Picklists | Admin | Tab | Product types (nested), colours, sizes, damage grades | CAP-3 |
| Vendors | Admin | Tab | Vendor registry; their trips, lots, units | CAP-4 |
| Expenses | Admin | Tab | Record and reverse spend | CAP-21 |
| Customers | Admin | Tab | Lookup, consent record, erasure | CAP-13, CAP-24 |
| Settings | Admin | Tab | Exchange window, label geometry | CAP-1, CAP-23, AD-28 |
| **Receipt** | — | Price & checkout, Hand-over, Return & settle, any sale or group reference | The document, in four channels — a settlement slip prints at every return, always | **CAP-15, CAP-18, CAP-19** |

## The Scan Primitive

The single most-repeated gesture in the product, and the one Raviraj specified explicitly. **It works identically almost everywhere a barcode is read** — intake, exchange, hand-over, return — with one deliberate exception, the retail cart, described below.

### The loop: arm → decode → disarm → act → re-arm

1. **Idle.** The camera is **off**. A single primary action in `{components.thumb-action-bar}` reads *Scan barcode*.
2. **Armed.** Tapping it starts the camera. `{components.scan-viewfinder}` fills the upper two-thirds; the gold aperture shows where to hold the label. A *Cancel* affordance is always present.
3. **Decoded.** On a successful read the camera **turns off immediately** — the same instant, not after a delay. `{components.scan-result-card}` replaces the viewfinder showing the barcode value in `{typography.barcode}` and whatever the context knows about that unit. One short haptic pulse.
4. **Act.** The user does the context's work on a still screen with no live camera: enter colour and size, or review a cart line, or pick a damage grade.
5. **Commit.** An explicit button writes the thing. **Nothing is ever committed by a decode alone.**
6. **Re-arm.** A separate explicit action — *Add another unit*, *Scan next item* — returns to step 2.

**There is no rapid-fire mode and no live camera while a form is on screen.** This was chosen deliberately over continuous scanning: a decode that commits on its own is a decode that cannot be corrected, and a camera running under a keyboard both drains the phone and re-reads the label already in frame.

Three properties follow, and every screen except the retail cart inherits them:

- **The camera is never running while the user is typing.** Arming and typing are mutually exclusive states.
- **A decode is a proposal, not a transaction.** It can be discarded with *Cancel* at no cost.
- **Counters and totals move on commit, never on decode.** `8 of 12` becomes `9 of 12` when *Save unit* succeeds — not when the barcode reads.

This cadence governs **lot intake, exchange, hand-over, and return** — everywhere a scan feeds a form a person then reads and confirms. **The retail cart is the one deliberate exception**, settled by Raviraj and closing the question this section used to carry as an `[ASSUMPTION]`: the till does not share intake's cadence, on purpose, because a cashier scanning a bill of fifteen items one confirm-tap at a time is the wrong rhythm for a queue at the counter.

### The retail cart exception: continuous scan, one confirm at the end

CAP-12's whole point is that the camera never pauses at the till. The loop is shorter, and it has no per-piece step 4/5 at all:

1. **Idle.** Cart empty. `{components.thumb-action-bar}` reads *Scan barcode*.
2. **Armed, and it stays armed.** Tapping it starts the camera and the camera **does not turn off between items.** Each successful decode adds a `{components.cart-line}` and re-arms itself in the same instant — there is no scan-result card to dismiss and nothing to confirm per piece.
3. **A refusal does not stop the loop.** A unit that is not `in_stock`, or whose channel is rental, is refused inline — a toast naming the actual status or the channel mismatch, a double haptic — and the camera keeps running for the next item (CAP-12). A duplicate scan highlights the existing line and adds nothing.
4. **The cashier ends the loop deliberately**, tapping *Review cart* or *Price & checkout*. Only then does the camera turn off.
5. **One confirm screen, not per piece.** *Price & checkout* is where the bill is actually priced (CAP-14, AD-36) — see *Component Patterns → Price & checkout screen* and *Flow 4* below. This is also where the floor-price refusal lives; nothing about price or the floor is ever checked at scan time.

Three properties, deliberately the mirror of the intake loop's three:

- **The camera is live for the whole cart, not for one item at a time.** Arming happens once per bill.
- **A scanned unit is already in the cart — not a proposal to confirm.** What stays provisional is its *price*, decided once at the end, never its presence in the cart.
- **The running total moves on every accepted scan**, because there is no separate commit step until the whole bill is priced and paid.

Everywhere else — intake, exchange, hand-over, return — the full arm → decode → disarm → act → commit → re-arm loop above holds exactly as specified, because those screens each do one piece of work a person needs to read before it is written. The cart is the only screen where scanning *is* the work, and pricing is what gets read and confirmed instead.

### Decode failure

The camera stays armed. After 10 seconds without a read, an inline hint appears under the viewfinder — *Hold the label flat, about 15cm from the camera* — and a *Type the number instead* affordance appears beneath it, accepting the human-readable digits printed under every barcode (CAP-1). Manual entry runs the same server call as a scan; the server cannot tell them apart and neither path is privileged.

## Cold Start and Retry Contract

The operational cost of free-tier hosting (AD-19), made into a designed state rather than a bug.

### The waking state

Any request still unanswered at **1200ms** shows `{components.waking-banner}`:

> **Waking the system up.** This takes up to a minute after a quiet spell. Nothing is lost.

It is amber (`{colors.waking}`), never red. Retry uses exponential backoff with jitter, and the banner shows attempt progress, not a spinner alone — a spinner at 45 seconds reads as broken. **The banner never blocks the screen.** Staff can keep scanning into a client-side cart while the API wakes; only the commit waits.

At **90 seconds** it becomes a failure state with a *Try again* button. The gesture's idempotency key is **retained**, so *Try again* is the same gesture, not a new one.

### Idempotency, visible where it matters

Per AD-22 the client mints a UUIDv4 for a counter gesture **before the first attempt** and reuses it across every retry. Two rules follow that are UX rules, not plumbing:

- **A replayed gesture that returns the original result is a success.** The screen shows the completed sale, not a warning and not a duplicate. The user is never told that a sale which actually committed had failed — that is the exact failure AD-22 exists to prevent, and it ends with the cashier ringing the sale twice.
- **A gesture's key is minted when the gesture begins and discarded only when it resolves.** Opening the checkout sheet mints it. Backing out and re-entering mints a new one. The key's lifetime is the sheet's lifetime.

Gestures carrying a key: **checkout** (CAP-14), **booking** (CAP-17), **hand-over** (CAP-18), **extension** (CAP-25), **settlement** (CAP-19), **exchange** (CAP-23), **recovery** (CAP-11, AD-35).

## The UPI Payment Pattern

One shared mechanism, four states, used everywhere the counter takes UPI: **Price & checkout** (CAP-14), **booking** and **walk-in hand-over** (CAP-17, CAP-18), and **extension** (CAP-25) — the same general payment surface `SPEC.md` describes once and binds to all four (`ARCHITECTURE-SPINE.md` AD-39–AD-42). Stated once here; each screen's own entry in *Component Patterns* and *State Patterns* below points back to this section rather than repeating it — the same discipline `SPEC.md` uses for its own constraint.

**This closes U-18.** The previous copy in this file described payment on these screens as "pick UPI or cash, then commit," in one step. That is no longer what any of the four screens do. The shape now is: price the bill, draw the QR, write nothing, let a human eye confirm it, then commit.

No screen in this pattern ever contacts a payment provider, and none ever tells staff or the customer that a UPI payment "succeeded" — the cashier's own look at the customer's phone is the entire confirmation, and every state below is worded so that stays true on screen, not just in the constraint that governs it.

1. **QR drawn and waiting.** The cashier has priced the bill (or the booking, the walk-in total, the extension's difference) and picked **UPI**. The screen draws the code, the amount beside it, and the payment reference — `PAY000123`, readable at a glance so the cashier can call it out or write it on a paper slip if the printer is down. Under the code, plainly: *Nothing recorded yet.* Nothing is written to any table while this is on screen — no sale, no booking, no agreement, not even an idempotency-key row exists yet (AD-42).

   Worth stating here, not only in the constraint it comes from: **the amount on the QR is a request, not a lock** — some UPI apps let the payer edit it before paying. The QR is never treated as proof that the right amount, or any amount, arrived. That's exactly why the next state — not this one — is where the actual confirmation happens.

2. **Mark as received.** The customer has paid and shows her phone's success screen. The cashier looks at it himself and taps **Mark as received** — the control that commits. Its wording never implies the app checked anything: no *Payment confirmed*, no *Verifying…*, nothing that reads as the system having contacted anyone. A short line beside the button says so directly: *Check her phone shows it went through, then tap.* The tap itself is the confirmation, made by the cashier, in his name — this is the one and only moment the sale, booking, or agreement row is written, now carrying `paymentMethod: UPI` and the reference drawn in step 1.

3. **Switch to cash mid-flow.** UPI can be down on either end — the shop's connection or the customer's own app. The cashier dismisses the QR and flips the payment method to cash; the screen restates the same total against **Mark as received**, this time with no QR and no reference field. The reference drawn for the abandoned QR is never sent and never reused — it simply gaps in the sequence, expected and harmless (AD-39). *Mark as received* now commits the same one sale, booking, or agreement as cash — one record, recorded once, as cash, never a second attempt layered on the first.

4. **Cancel.** The customer decides not to buy, or not to book, or not to extend. The screen clears — cart, booking-in-progress, or extension panel — and **no request is ever sent**. There is nothing to delete, stated plainly rather than left as an implementation detail, because it's the one property this whole design exists to give: *Nothing was recorded. [The cart is clear. / No booking was made. / Nothing changed.]* A bill drawn up and abandoned leaves exactly the trace a bill never opened would: none.

`[NOTE FOR UX]` DESIGN.md does not yet define a visual component for the QR panel itself (sizing, corner treatment, how it sits inside the Price & checkout / Booking / Extension layouts). This section fixes the behaviour and the microcopy; the panel's visual spec is raised for DESIGN.md's next pass rather than invented here.

**Non-goal, closed here so it isn't re-litigated per screen:** the QR always renders on the screen that drew it. The ESP32 wireless display is a non-goal for now — nothing above describes, or needs, a second surface for it.

## Money, Deposits and Reversals on Screen

The spec's arithmetic rules, expressed as display rules. These are non-negotiable.

- **Every amount is integer paise on the wire and rounded once, at display.** No intermediate rounding anywhere in the client. Rendered as `₹1,299.50` — Indian digit grouping, always two decimals, always `{typography.money*}` with tabular numerals.
- **A deposit is never rendered in an income colour.** `{components.deposit-figure}` and `{colors.money-held}` exist for exactly this. Wherever a deposit appears — booking, hand-over receipt, settlement, Q6 — it is visibly a third kind of money.
- **Rental money on the dashboard is three buckets, and they are never added together (AD-33).** EARNED (`{colors.money-in}`), DEPOSITS HELD, and RENT HELD (both `{colors.money-held}`, each labelled by name — see `{components.money-bucket-row}`) render as three independent figures. No fourth "total rental money" figure exists anywhere in the UI; there is structurally nowhere for one to be computed, because a booking's rent and deposit sit in exactly one bucket at any instant and summing across the three would double-count money that has not finished changing hands. A drill from any one bucket opens only that bucket's rows.
- **Reversed rows stay on screen.** A reversing row and its original both render, both in `{colors.money-reversed}`, the original struck through. The ledger is additive (AD-5) and hiding a reversal makes the screen disagree with the database.
- **Rent is never shown as pro-rated, ever.** An early return displays *Rent — paid in full at booking. Not refundable.* on the settlement screen, so no one at the counter has to remember the policy.
- **Derived figures are labelled as derived.** Overdue days, accrued charge, maximum rental period, trip variance, sell-through, utilisation, payback: each carries the inputs that produced it inline. Nothing derived is presented as if it were recorded (CAP-20, CAP-22).
- **A floor-price refusal is a server decision.** The client warns as the price drops toward the floor, but the warning is advisory and the refusal message shown to staff is the server's own (CAP-14).

## Voice and Tone

Microcopy. Brand voice lives in `DESIGN.md → Brand & Style`. English only — no i18n layer, no bilingual labels.

Staff are known, trained in person, and working fast in front of a customer. Messages are short, name the specific thing, and say what to do next. **An error message that does not name the barcode or the unit is a defect.**

| Do | Don't |
|---|---|
| "8 of 12 scanned" | "Progress: 66%" |
| "Already used — barcode 0000451237 is a red kurti, sold on 14 Aug." | "Duplicate barcode" |
| "This one is out on rent. Due back 17 Aug." | "Invalid status" |
| "₹1,200 is below the floor price of ₹1,400. The sale was refused." | "Validation failed" |
| "Waking the system up. Nothing is lost." | "Network error — please retry" |
| "Rent was paid in full at booking. Nothing is refunded for an early return." | *(silence, and an argument at the counter)* |
| "Deposit held: ₹2,000 — the customer's money." | "Deposit: ₹2,000" |
| "Erasing removes this customer's name and number. Past receipts are untouched." | "Are you sure? This action cannot be undone." |
| "Check her phone shows it went through, then tap." | "Payment confirmed" / "Verifying payment…" |
| Say the number, the date, the status | Say "error", "invalid", "failed" on their own |

**Consent copy (CAP-13)** is plain and specific, not a legal wall: *"We'll keep your name, WhatsApp number, birthday and email so we can find your purchases and reach you about them."* — with the purpose it records being the purpose it states.

## Component Patterns

Behavioural. Visual specs live in `DESIGN.md → Components`.

| Component | Where | Behavioural rules |
|---|---|---|
| Scan viewfinder | Intake, exchange, hand-over, return | Live only while armed. Off on decode, on cancel, on navigate-away, and on tab-hide. Never running under a keyboard. |
| Scan viewfinder — continuous | Retail cart only | Live for the whole cart-building session, not one item at a time. Off only when the cashier deliberately ends the loop (*Review cart* / *Price & checkout*), on navigate-away, or on tab-hide. See *The Scan Primitive → The retail cart exception*. |
| Scan result card | Intake, exchange, hand-over, return | Appears on decode with the barcode and the context's knowledge of it. Dismissable at no cost. **Not used in the retail cart** — a decode there writes a cart line directly, with no intermediate card to dismiss. |
| Intake counter | Lot intake | `N of M`. Increments on **commit**. At `M`, the *Save unit* action is disabled and the loop offers *Close lot* — the lot cannot exceed its declared quantity (CAP-7). |
| Size-run chip | Lot intake, size-run on | Shows the size the **next** scan will take. Tapping the size field on any unit overrides that one unit without breaking the sequence (CAP-9). |
| Status pill | Everywhere a unit appears | Always carries text. Colour is redundant reinforcement, never the only signal. Overdue is derived at render, never read from a stored flag. |
| Cart line | Retail cart | One line per `unit.uuid`, added automatically the instant a scan decodes — no confirm tap. A duplicate scan highlights the existing line and does not add a second (CAP-12, AD-25). Swipe-left or an explicit control removes. Carries no price field until *Price & checkout*; the running total shown in the cart is the sum of selling prices, a preview only, never the transacted total. |
| Price & checkout screen | Retail cart → *Price & checkout* | The single confirm step CAP-14 describes. A segmented toggle picks **Per piece** or **One total for the bill**, cashier's choice, per bill. *Per piece*: each line gets its own editable price field, each checked against its own floor as it is typed. *One total*: one field for the negotiated total; the app spreads it proportionally to selling price (AD-36) and shows the computed per-line breakdown read-only beneath it before commit. Whichever mode, the floor check runs once, on commit, against every line's resulting price — never per keystroke, never per scan. Once the price clears the floor, the cashier picks **UPI** or **Cash**: UPI hands off to the shared UPI QR panel below; cash goes straight to *Mark as received* with no QR at all. |
| UPI QR panel | Price & checkout, Booking, Walk-in hand-over, Extension | The shared surface for all four UPI-collecting screens — one behaviour, described once in *The UPI Payment Pattern*, not restated per screen. Renders the code, the priced amount, and the payment reference the instant **UPI** is picked; swaps to cash inline, on the same screen, with no navigation away and no QR left showing. `[NOTE FOR UX]` visual spec not yet in DESIGN.md — see *The UPI Payment Pattern*. |
| Money figure | Everywhere | `{typography.money*}`, tabular. Colour only when the figure is counted somewhere. |
| Money bucket row | Dashboard | Three `{components.dashboard-card}` instances — EARNED, DEPOSITS HELD, RENT HELD — laid out side by side on `tablet`+, stacked on phone, with no combined figure rendered across them anywhere (AD-33). Each is independently pinnable and drillable. |
| Waking banner | Global | Non-blocking. Appears at 1200ms, escalates at 90s. Never covers the primary action. |
| Dashboard card | Dashboard | One question, one figure, one drill affordance. Pinnable, unpinnable, reorderable. Point-in-time cards say so rather than silently ignoring the range. |
| Drill sheet | Dashboard | Bottom sheet on phone, side panel from `tablet`. Always paged (AD-26). Header restates the figure it opened from so the total and its rows are visible together. |
| Date range control | Dashboard | Presets *Today* / *This week* / *This month* / *Custom*, default Today. One control governs every range card on the page. |
| Customer sheet | Price & checkout, booking | WhatsApp number first. A hit loads the record for confirmation without retyping; a miss opens capture with the consent block (CAP-13). |
| Receipt sheet | After any commit | Four channels, one document. See below. |
| Thumb action bar | Every operating screen | Fixed to the bottom, holds exactly **one** primary action. Content reserves `{spacing.thumb-safe-bottom}` beneath it so nothing is ever obscured. Absent on the dashboard, which is a reading surface. |
| Buttons | Everywhere | One primary per screen (`{components.button-primary}`). Secondary is outline (`{components.button-secondary}`), never a second fill. `{components.button-danger}` is reserved for erasure, reversal, and marking a unit lost or damaged — never for cancel or back. Every button carries a verb naming what it writes. |
| Deposit figure | Booking, hand-over, settlement, Q6 — and **rent held**, the same shape, wherever rent sits uncollected-as-income: booking, Q25 (AD-33) | Renders in `{colors.money-held}` with the word *held* adjacent — *deposit held* or *rent held*, never bare — everywhere either appears. Structurally incapable of rendering as takings. |
| Recovery panel | Unit detail on a `lost` unit | Three destination choices — *Return to stock* / *Send to maintenance* / *Retire* — plus a **required** reason field with no default and no placeholder that could pass as one; the commit button stays disabled until both are set (CAP-11, AD-35). States plainly, before commit: *This adds the unit's buying price back to stock. No money moves and nothing already earned is reversed.* |
| Extension panel | An `open` booking → *Extend* | Two date fields pre-filled with the current window, editable only outward — narrowing either end is refused inline before the request is even sent (CAP-25). Recomputes rent live as the window widens and shows the **difference to collect**, never a full re-charge. Re-runs the same `floor(deposit / overduePerDay)` check the original booking used. Collecting the difference goes through the same UPI QR panel as every other counter payment — UPI or cash, *Mark as received* commits (see *The UPI Payment Pattern*). |

## Receipt Contract

**This settles the architecture spine's one deferred receipt item — visual layout and delivery channel — and nothing else.** The rest of the receipt contract is already fixed upstream: one renderer serves retail and rental; a receipt is re-rendered on demand from committed rows and never stored; it is addressed by `sale.uuid` or `group_uuid`; and re-rendering the same reference reproduces the same document because every value on it is a snapshot (AD-24).

### Layout — A5 portrait sheet

Not a thermal roll. There is a printer at the counter and the rental receipt in particular has to carry a terms block and deposit arithmetic that a 58mm roll cannot hold legibly.

`{components.receipt-sheet}` is black on white in **every theme and every channel** — the screen view, the PDF, the WhatsApp attachment, and the print are one document, never four variants. Margin `{spacing.receipt-margin}`.

Blocks, in order:

1. **Header** — shop name, address, phone. No logo required.
2. **Reference and date** — the reference that reproduces this document (CAP-15), and the transaction date.
3. **Customer** — the **snapshotted** name and WhatsApp number from the transaction row, never joined from `customers` (AD-18). A receipt for an erased customer still renders, unchanged.
4. **Lines** — retail: unit name, size, colour, transacted price. Rental: one block per unit carrying its rent-per-day, deposit, overdue-per-day, start date and due date, all snapshotted from the booking (CAP-18).
5. **Totals** — the total, and for rental the rent total and the deposit shown separately and labelled *held, refundable at return*.
6. **Payment** — UPI or cash, as recorded.
7. **Rental terms footnote** — on rental receipts only: rent is not pro-rated, the overdue rate, and that the deposit is settled against overdue and damage at return.

**Reversals and exchanges print.** An exchange produces a receipt showing the reversed line struck through, the new line, and the signed difference collected or refunded (CAP-23).

**A settlement slip prints at every rental return, always** — confirmed by Raviraj, no longer an assumption. `SPEC.md` (CAP-19) requires it explicitly: **whether or not anything was deducted**, settlement produces a printed slip showing deposit held, overdue deducted, damage deducted, and the balance returned, rendered by the same `{components.receipt-sheet}` and A5 layout as the sale receipt, through the same four channels. A clean return with nothing to deduct still gets a slip reading *Deposit held ₹2,000 — nothing deducted — ₹2,000 returned*, so "no slip" never has to be read as "nothing to prove."

### Delivery — four channels, chosen per receipt

All four sit on the receipt surface after a commit. None is configured globally; staff pick at the moment of issue.

| Channel | Behaviour |
|---|---|
| **View** | Renders on the counter phone immediately after the commit. Always available, always the default. |
| **Download PDF** | Streams the A5 PDF from the server and saves it to the device. Nothing is written to a server filesystem (AD-19.2). |
| **Send on WhatsApp** | A server-side send (AD-38): the client calls one route; the server renders the PDF in-process, uploads it to Meta, and sends a pre-approved template message with the receipt as a document header — no share sheet, no client-side attachment, no `wa.me` fallback. Three states, and only three. **Sending** — the client's own transient in-flight state while the request is outstanding: *"Sending on WhatsApp…"*, the button disabled. **Accepted** — the synchronous 2xx: *"Accepted by WhatsApp"*, paired always with *"Not a delivery confirmation — View, PDF and Print still work."* Meta has taken the message for delivery; that is never read as the customer having received it, because confirming that would need a webhook this build deliberately does not have. **Failed** — a synchronous rejection (bad number, auth failure, template mismatch): *"WhatsApp didn't accept it. View, PDF and Print still work."* No label, toast or status on this row ever says *delivered* or *sent to the customer*. |
| **Print** | Browser print at A5 through the counter printer. One `@media print` stylesheet; the same document. |

`[NOTE FOR UX]` The WhatsApp path deliberately avoids a public receipt URL. A link the customer could open would need an unauthenticated route serving snapshotted customer data — precisely the shape of defect D3 — and no such route is in scope. Sharing the file itself needs neither.

**A receipt is re-openable forever** from the sale or the rental group, through all four channels, with identical output. That is what "the record is saved" means here: the *rows* are durable and the document is reproducible from them. `[NOTE FOR UX]` Raviraj asked for the receipt to be "saved in db"; persisting the rendered PDF itself would breach the spine's receipt contract and is raised upstream rather than routed around.

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Waking | Global | `{components.waking-banner}`, non-blocking, backoff retry, key retained. |
| Wake failed (90s) | Global | Banner becomes a failure with *Try again*. Same idempotency key. Cart intact. |
| Camera denied | Any scan surface | *IMPOC needs the camera to scan barcodes.* Plus how to re-grant, plus *Type the number instead* — never a dead end. |
| Not HTTPS | Any scan surface | *The camera only works over a secure connection.* Named explicitly, because the failure is otherwise silent. |
| Decode failing | Armed viewfinder | Hint at 10s, manual entry offered. Camera stays armed. |
| Barcode already used | Intake | Refusal naming the existing unit — what it is and its status (CAP-7). Camera re-arms on dismiss. This is also the visible floor under CAP-2: after a database restore a reissued value degrades to exactly this refusal, never to two units sharing a code (AD-17). |
| Lot full | Intake | *12 of 12 — lot complete.* Save disabled, *Close lot* offered. |
| Wrong channel | Cart (continuous scan) | Inline refusal toast — *This is a rental piece. It can't go in a retail sale* — and the reverse. Double haptic. The camera stays live and the loop is unbroken; nothing was added (CAP-12). |
| Not in stock | Cart (continuous scan) | Inline refusal toast naming the **actual** status and, where relevant, the date. Camera stays live (CAP-12). |
| Duplicate scan | Cart | Existing line highlights, count unchanged. No error (CAP-12, AD-25). |
| Below floor | Price & checkout | Runs once, on commit, against the priced result — never at scan time, never per keystroke. **Per piece:** that one field turns `{colors.danger}` before the cashier finishes typing. **One total:** the server refuses the **whole bill**, naming the **specific unit** whose spread share fell short and its floor price — never the bill total — because that is the number the cashier can act on (AD-36). The cashier raises the total or reprices that one line individually; the software does not reallocate the shortfall onto another line. |
| Checkout lost the race | Price & checkout | *Sold a moment ago at another counter* naming the unit. That line is removed; the rest of the cart survives. |
| No customer attached | Price & checkout | Checkout blocked with the reason stated, routing to the customer sheet (CAP-13). |
| QR drawn and waiting | Price & checkout, Booking, Walk-in hand-over, Extension | Code, priced amount, and payment reference render together; *Nothing recorded yet* stated directly beneath. No sale, booking, or agreement row exists in any table while this is on screen (AD-42). See *The UPI Payment Pattern*. |
| Mark as received | Price & checkout, Booking, Walk-in hand-over, Extension | The commit control. Never worded to imply the app verified the payment — *Check her phone shows it went through, then tap* sits beside it. This tap is the only moment the row is written, carrying `paymentMethod: UPI` and the reference drawn above. |
| Switched to cash mid-flow | Price & checkout, Booking, Walk-in hand-over, Extension | UPI down on either end: the QR is dismissed, the method flips to cash, the same total re-shows against *Mark as received* with no reference field. One record commits, as cash, in the same gesture — the abandoned reference simply gaps (AD-39). |
| Cancelled before commit | Price & checkout, Booking, Walk-in hand-over, Extension | *Nothing was recorded.* Because nothing was ever written before this tap, there is no row to delete and no reference to reclaim — a drawn-up-then-abandoned bill leaves the same trace as one never opened at all: none. |
| Window unavailable | Booking | The conflicting window named, and the windows that **are** free — a unit with a booking on the 14th–17th is still bookable for the 5th–7th (CAP-17). |
| Window too long | Booking, Extension | *This deposit covers up to N days.* Shows `floor(deposit / overduePerDay)` and its inputs — re-run identically on an extension against the unchanged deposit (CAP-17, CAP-25). |
| Booking narrowed | Extension | Refused before the request sends: *An extension can only widen the window, never shorten it.* The date field simply will not accept a value inside the original window (AD-31). |
| Overdue | Anywhere a rented unit shows | Derived at render. Days late and accrued charge, capped at the deposit, with the arithmetic inline. No stored flag, no job (CAP-20). |
| Deposit exhausted | Out on rent → deposit-exhaustion list (Q26) | A live agreement past `dueDate + floor(deposit / overduePerDay)` days appears on this review list with the customer, days late, and deposit consumed — a prompt to decide write-off, never a trigger. Nothing changes because the date passed; a person opens the row and acts (AD-34). |
| Sibling still out | Settlement | After settling one of a group: *Settled 1 of 3. Two pieces still out.* (CAP-19, AD-21). |
| Beyond repair | Settlement | Grade with a `RETIRE` outcome routes straight to retired and shows the unit's final ROI (CAP-19, Q23). |
| Blocked by a live booking | Any transition off `in_stock` other than hand-over — marking a unit damaged or lost | Refused, naming the **blocking booking**, its **window**, and the **customer's snapshotted name** — e.g. *This piece is booked 14–17 Aug for Priya Sharma. Cancel the booking first.* A `CASHIER` holds no `RENTALS.CANCEL` (AD-29) and cannot clear this alone: the refusal names exactly what to relay, and the next step is fetching a manager — never a dead end, never a generic "action not allowed" (AD-8). |
| Refunding exchange, held by CASHIER | Exchange | A cheaper swap needs a cash refund. A `CASHIER` is money-in only (AD-29): the screen states the refund amount and *A manager needs to complete this exchange* rather than silently failing or letting the swap complete without the refund. |
| Outside exchange window | Exchange | Refused server-side, naming the sale date and the window (CAP-23). |
| Empty — no trips / units / sales | Any list | States what the surface is for and offers its one action. Never a bare "No results". |
| Empty — filtered to nothing | Any list | *No units match these filters* plus a clear-filters action. Distinct from a genuinely empty surface. |
| Loading a page of a list | Any list | Skeleton rows at the page's own height, so the page does not jump (AD-26). |
| Permission absent | Any | The surface is not in the navigation at all. No disabled entries, no teasers. |

## Interaction Primitives

- **Tap to act.** One primary action per operating screen, in `{components.thumb-action-bar}`.
- **Explicit commit, always.** Nothing writes on a decode, on a blur, or on a timer. Every write has a button with a verb on it.
- **Long-press is reserved for system text selection** — barcode values and reference numbers are meant to be copyable.
- **Swipe-left removes a cart line.** The only swipe gesture in the app, and it is reversible by re-scanning.
- **Haptics carry scan outcomes:** one short pulse on decode, a double pulse on a refusal. Never on navigation.
- **Pull-to-refresh on lists only.** Never on the dashboard — its date range is the refresh.
- **Every drill-down is paged.** No infinite scroll, no "show all" (AD-26).
- **Banned:** carousels; auto-advancing anything; toast-only confirmation of a money movement; modal-over-modal; hover-dependent controls anywhere in the operating surfaces; colour as the sole carrier of a status.

## Accessibility Floor

Behavioural. Visual contrast lives in `DESIGN.md`.

- **Colour is never the only signal.** Every `{components.status-pill}` carries its status as text. Every money figure carries a sign or a word — `Deposit held`, `Reversed`, `Refunded` — not just a hue. This is the floor's single most load-bearing rule in a product this colour-coded.
- **No rupee figure, refusal, or status warning ever sits on a glass surface (`{components.surface-glass}`).** DESIGN.md's surface treatment system exists precisely so this can be stated as a hard rule rather than checked case by case: glass and soft both work by lowering contrast, and this app's job is getting money read correctly at a counter, in daylight, on a phone. Where a glass-shelled surface must show a rupee figure — the dashboard drill sheet is the one case that arises — the figure sits on the flat row inside the sheet, never on the glass shell itself (see `DESIGN.md → Elevation & Depth`).
- **Glass is only permitted over a backdrop the design controls** — a dimmed overlay, a live camera feed inside its fixed frame, or a defined gradient. Never over a scrolling list: contrast against a glass panel then depends on whatever content happens to be scrolled underneath at that instant, which the design cannot guarantee.
- **Every glass panel is checked for contrast against its own controlled backdrop, measured, not assumed** — against DESIGN.md's stated WCAG AA targets, on the actual backdrop it renders over, not on an assumption that translucency is automatically legible.
- **Neumorphic-style shading barely functions in dark mode**, which is the second reason `{components.surface-soft}` always keeps a real border rather than relying on shadow alone: a shadow-only lift reads clearly in light mode and all but disappears once the surface and its ground both go dark.
- **Touch targets ≥ 48px**, primary actions 52px. The thumb bar keeps the primary action inside one-handed reach.
- **Focus is visible on every interactive element** — `{colors.focus-ring}`, 2px, never removed. Traversal follows reading order.
- **Screen readers:** every control labelled with role and state. The intake counter is an `aria-live="polite"` region announcing *"9 of 12 scanned"* on each commit; the retail cart's running total is the same pattern, announcing the newest line on every accepted scan since there is no per-piece confirm to announce instead. Scan refusals announce assertively — a refusal missed at the counter becomes a wrong unit sold.
- **The camera is never the only path.** Manual barcode entry is available on every scan surface, permanently, not just after a failure.
- **Reduce Motion:** the scan-result lift and the drill-sheet rise become instant. No functional change.
- **Reduce Transparency (`prefers-reduced-transparency`):** every `{components.surface-glass}` instance renders its solid `fallback-background` instead — no blur, same layout, same content. This is also the fallback when `backdrop-filter` is unsupported.
- **Text scales to 200% without clipping a control.** The `8 of 12` counter and thumb-bar actions are checked at that setting.
- **Never rely on hover** in the operating surfaces — they are touch-first by definition.

## Responsive & Platform

| Breakpoint | Operating surfaces | Dashboard |
|---|---|---|
| `phone` < 600px | The design centre. Single column, bottom tab bar, thumb action bar, viewfinder at two-thirds height. | One column, cards stacked, drill as a bottom sheet. Correct, not optimised. |
| `tablet` 600–1023px | Same single column, centred at 640px. Left rail replaces the tab bar. | **A design centre.** Two-column card grid, drill as a side panel. |
| `wide` ≥ 1024px | Unchanged — a cart does not get better when it gets wider. | Three-column grid to 1400px. Cards and drill visible together. |

Print is a fifth context and belongs to the receipt alone: one `@media print` stylesheet at A5, `{components.receipt-sheet}`, no app chrome.

## Key Flows

### Flow 1 — Intake a lot of twelve kurtis (Meera, inventory manager, Tuesday morning, two vendor trips to enter)

1. Meera opens **Inventory → Trips**, taps *New trip*, picks the vendor, enters the date, the bill reference, and the ₹14,400 they handed over.
2. Trip detail opens with a variance strip reading *No lots yet.*
3. She taps *Add lot* and fills it once: Kurti → Round-neck, "Round-neck kurti", quantity 12, buying ₹1,200, selling ₹1,999, floor ₹1,700, channel retail.
4. She taps *Start scanning*. The lot intake surface opens: `0 of 12` in `{typography.counter}`, camera **off**, one action — *Scan barcode*.
5. She taps it. The viewfinder opens. She holds the first label to the gold aperture.
6. It decodes. **The camera turns off.** The barcode shows in `{typography.barcode}` with the lot's inherited prices beneath it, and two empty fields: colour, size.
7. She picks Red and M, taps *Save unit*. The counter ticks to `1 of 12` and announces it.
8. She taps *Add another unit*. Camera on. Scan. Camera off. Colour and size are **pre-filled from the last unit** — for a lot that is mostly one colour she changes nothing and taps *Save unit* again.
9. **Climax:** the counter reads `8 of 12` while she is halfway through the pile, and she can see at a glance how many labels are left to stick — the question she is actually asking, answered without her doing arithmetic.
10. On the twelfth save the counter reads `12 of 12 — lot complete`, *Save unit* disables, and *Close lot* is offered.
11. Back on trip detail the variance strip reads *Recorded ₹14,400 · Lots ₹14,400 · Variance ₹0*.

**Refusal:** a label already bound refuses at step 6 with *Already used — barcode 0000451237 is a red kurti, in stock.* Double haptic. Dismiss re-arms the camera. Nothing was written.

**Cold start:** if the API is asleep at step 7, the waking banner appears, the unit commits on the retry, and the counter ticks then. It never ticks twice.

### Flow 2 — The second lot, in one edit (Meera, four minutes later)

1. Still on trip detail, Meera taps **Clone last lot**.
2. The lot form opens with every field copied from the round-neck lot and fully editable.
3. She changes the name to "V-neck kurti", the product subtype to V-neck, and the quantity to 8. Nothing else.
4. *Start scanning* — `0 of 8`, the same loop.
5. **Climax:** a second lot costs two field edits instead of nine, and the original lot and its twelve units are untouched (CAP-8).

**Refusal:** a cloned lot whose floor price now exceeds its selling price, or whose overdue-per-day is not greater than its rent-per-day, is rejected on save with the offending pair named — the clone inherits the lot's validation, not an exemption from it (CAP-6).

### Flow 3 — A size run (Meera, a lot of 12 that varies only by size)

1. On the lot form she turns on **Size-run mode** and sets the run: S, M, L, XL.
2. Intake opens with `{components.size-run-chip}` reading **Next: S**.
3. She scans. Camera off. Colour is pre-filled; **size is pre-filled with S**. *Save unit*. The chip advances to **Next: M**.
4. Four scans record S, M, L, XL. The fifth chip reads **Next: S** — the run wraps.
5. One piece is actually an L out of order. She taps the size field on that unit and picks L before saving.
6. **Climax:** the chip still reads **Next: XL** for the following scan — an override changed one unit and did not break the sequence (CAP-9).

**Refusal:** a size deactivated from the picklist mid-run drops out of the run and the chip advances past it; intake refuses any size that is not an active picklist entry (CAP-3). A run cannot be configured from an empty size list — size-run mode is unavailable until sizes exist.

### Flow 4 — Sell a kurti (Anjali, cashier, customer waiting at the counter with a stack of five pieces)

1. Anjali opens **Counter → Retail cart**. Empty state: *Scan the first item.* She taps *Scan barcode* once — the camera arms and **stays armed**.
2. She scans all five pieces one after another, holding each label to the aperture in turn. Each decode lands a `{components.cart-line}` and the camera never turns off between them — no card to dismiss, no tap to confirm, the running total climbing with every scan: ₹1,999 → ₹3,799 → …
3. Piece three turns out to be rental stock. Inline toast: *This is a rental piece. It can't go in a retail sale.* Double haptic — the camera keeps running and she moves straight to piece four.
4. She scans the round-neck kurti twice by accident, reaching for the next piece before it registers. The existing line highlights; the total does not move (CAP-12, AD-25).
5. All five real pieces scanned, she taps **Price & checkout** — only now does the camera turn off. **The idempotency key is minted here.** The customer sheet opens on the WhatsApp field. She types the number; it is on file; the customer's name loads for confirmation.
6. **The single confirm screen.** She picks **One total for the bill** — the customer has bargained for the lot. She types ₹8,500 against a cart selling for ₹9,750. The app spreads it proportionally across the five lines (AD-36) and shows the computed per-line breakdown, read-only, before she commits.
7. One line's spread share lands at ₹380 against that piece's ₹450 floor. The **whole bill** is refused, naming that one piece and its floor price — not the ₹8,500 total, which gives her nothing to act on. She raises the total to ₹8,650 and the spread clears every line.
8. She picks **UPI**. The screen draws a QR for ₹8,650 with the reference `PAY000418` beside it and *Nothing recorded yet* underneath — no sale exists yet (*The UPI Payment Pattern*). The customer opens her own UPI app, pays, and turns her phone around to show the success screen.
9. Anjali looks at it herself and taps **Mark as received**. The API is cold; the waking banner appears; the retry carries the same key. Only now does the sale commit, carrying `paymentMethod: UPI` and `PAY000418`.
10. **Climax:** the receipt renders — one document, four buttons: *View · PDF · WhatsApp · Print*. She taps **WhatsApp**; the button reads *Sending on WhatsApp…*, then *Accepted by WhatsApp* — accepted for delivery, not confirmed read — and the customer leaves before the last kurti is folded.
11. All five units are `sold`; each sale line carries its own spread price and its buying-price snapshot; the customer's name and number are copied onto the sale.

**UPI down:** the QR sits unpaid for a minute and the customer's banking app won't load. Anjali switches the payment method to **Cash** — the QR disappears, `PAY000418` is never sent and simply gaps — and taps **Mark as received** against the same ₹8,650. One sale commits, as cash.

**Customer changes her mind:** with the QR still on screen, she decides against the whole bill. Anjali taps **Cancel** — the cart clears and nothing was ever sent to the server. No sale, no line, no reference: there was never anything to delete.

**Race:** if another counter sold a unit between the scan and the commit, checkout fails naming that unit, that one line is removed, and the rest of the cart survives — Anjali does not rebuild the sale (CAP-14).

**Blocked by a live booking:** later that morning Anjali notices a damaged saree on the rack while ringing up other items and taps *Mark damaged* from its scan result. Refused: *This piece is booked 14–17 Aug for Priya Sharma. Cancel the booking first.* She holds no `RENTALS.CANCEL` (AD-29) — she cannot clear it herself, so she relays exactly that line to a manager, who cancels the booking (returning the deposit) and then marks the piece damaged (AD-8).

### Flow 5 — Book three sarees for a wedding (Anjali, customer planning for the 14th–17th)

1. **Counter → Rentals → Book.** She sets the window first: 14 Aug – 17 Aug. The header reads **4 days** — `(end − start) + 1`, per AD-23, stated on screen so nobody argues about it later.
2. She scans the first saree. Camera off. The card shows its rental terms — rent/day, deposit, overdue/day — and **Available for this window**.
3. Second saree: **Booked 15–16 Aug.** The refusal names the conflicting window and shows the windows that *are* free.
4. She picks a different saree. Three units in the group.
5. The money block: rent for 4 days per unit, **the total rent in `{colors.money-held}` labelled *held — not yet earned, becomes income when the hire finishes***, and the deposit total in the same colour labelled *held — the customer's money, returned at settlement*. Neither is `{colors.money-in}` — collected is not the same as earned (AD-33), and the booking screen is the first place that has to hold that line.
6. One saree's window would exceed `floor(deposit / overduePerDay)`. Refusal shows the arithmetic: *This deposit covers up to 3 days.*
7. She picks **UPI**. The QR draws for the rent-plus-deposit total, with the payment reference beside it and *Nothing recorded yet* underneath — no booking exists yet (*The UPI Payment Pattern*). The customer pays and shows her phone. Anjali checks it and taps **Mark as received**.
8. **Climax:** the booking confirms, carrying the drawn payment reference. **Rent and deposit are both collected now, and both go into the shop's held buckets, not its takings** — the screen says so — and the same three sarees are still bookable for the 5th–7th. Nothing was taken off the floor; the units stay `in_stock` (CAP-17).

**UPI down:** the customer's app won't load. Anjali switches to **Cash** — the QR is dismissed, the reference gaps — and taps **Mark as received** against the same total. One booking commits, as cash.

### Flow 6 — Hand over, then settle one piece at a time (Anjali hands over on the 14th; Vikram, manager, settles on the 17th)

**Hand-over, the 14th (Anjali, cashier — `RENTALS.HANDOVER` is hers, AD-29):**

1. **Rentals → Hand over.** She finds the booking by the customer's WhatsApp number.
2. She scans each of the three sarees against the booking; each turns `rented`.
3. The screen states plainly: **No payment due — rent and deposit were collected at booking.**
4. **Climax:** one receipt for all three, each carrying its own rent/day, deposit, overdue/day, start and due date snapshotted from the booking. Three agreements, one `group_uuid`, one document (CAP-18, AD-21).

**Return, the 17th (Vikram, manager — `RENTALS.SETTLE` is MANAGER and above only, AD-29; **Return & settle** does not appear in a cashier's navigation at all):**

5. **Rentals → Return.** Scan the first saree. Camera off. Its agreement, its due date, and *Returned on time* appear.
6. Damage grade from the picklist: **Clean**. Charge pre-fills ₹0.
7. Settlement: deposit ₹2,000 held, overdue ₹0, damage ₹0, **balance returned ₹2,000**. Beneath it, in plain words: *Rent was paid in full at booking. Nothing is refunded for an early return.*
8. *Settle and return to stock.* The unit is `in_stock`. **A settlement slip prints — always, whether or not anything was deducted** (CAP-19). The screen reads **Settled 1 of 3. Two pieces still out.**
9. Second saree: grade **Heavy cleaning**, default ₹300 pre-filled. Vikram overrides to ₹250 for this case. Balance ₹1,750. Outcome routes it to maintenance. Its slip prints too.
10. **Climax:** the third saree never comes back. Under **Out on rent**, it shows as overdue the instant the page loads — *2 days late · ₹400 accrued · capped at ₹2,000 deposit* — with the arithmetic inline and no job having run anywhere (CAP-20). Weeks later it crosses into the deposit-exhaustion list (Q26); Vikram is the one who can act on it there too.

**Walk-in (Anjali, a customer with no prior booking):** a customer walks in wanting two sarees for the weekend, nothing booked ahead. Anjali opens **Rentals → Hand over → Walk-in**, sets the window, scans both sarees, and prices the visit the same booking screen would. She picks **UPI**: the QR draws for rent plus deposit across both pieces, reference beside it, *Nothing recorded yet* underneath — no booking, no agreement, exists yet (*The UPI Payment Pattern*). The customer pays, shows her phone; Anjali taps **Mark as received**. In that one tap the booking and the hand-over both commit and both sarees become `rented` — one receipt, one `group_uuid`, no separate booking step the customer has to wait through. Had she paid cash instead, the same tap would have committed the same way, as cash.

### Flow 7 — The owner's month (Raviraj, laptop, last evening of the month)

1. He opens **Dashboard** on the laptop. Date range defaults to Today; he switches to **This month**.
2. His pinned cards are already there — the four he cares about, chosen once from the library and remembered against his own account, so they show up whether he opens the dashboard on the shop laptop or, later tonight, on his phone (AD-37).
3. **Did the shop make money?** (Q4) — one figure in `{typography.display}`, net position for the month, with takings and spend as its two inputs beneath it.
4. He taps it. The drill sheet opens as a side panel: takings by kind, expenses by category, stock purchases by trip — **paged, 50 at a time** (AD-26). The rows add to the number he tapped.
5. **The three rental buckets sit together as `{components.money-bucket-row}`, and none of them add up to a fourth number.** EARNED is this month's rental income, already folded into Q4 above. **Deposits held** (Q6) and **rent held** (Q25) sit beside it in `{colors.money-held}`, each labelled by name, each *point in time — not affected by the date range*. He reads all three and never sees them summed, because AD-33 leaves nowhere in the UI for that sum to exist.
6. He drills **deposits held** and gets one row per deposit currently held, including a booking paid but not yet collected — real cash in the drawer with no agreement row behind it. He drills **rent held** the same way and sees the rent sitting against three sarees booked for next weekend, not yet earned.
7. **Which pieces have eaten their whole deposit and need a decision?** (Q26) — a short list, two rows this month. He opens one: a saree three weeks overdue, deposit exhausted eleven days ago, customer's name and number right there. He decides to write it off from this screen — the piece moves to `lost`, and the booking's rent and its whole deposit move out of the held buckets and into EARNED, dated to today (AD-32, AD-34).
8. **What came back after I wrote it off?** (Q27) — one recovered anklet, its buying price added back to stock value this month, shown on its own line beside shrinkage rather than folded into it.
9. **Which vendor's stock actually sells?** (Q16) — sell-through and realised margin per vendor. He drills into the weakest one and sees the lots.
10. He taps *Add cards* and pins **Q8 — what is not moving**, which he had not thought to look at.
11. **Climax:** he closes the month knowing whether the shop made money, which vendor to skip next trip, how much of the drawer is not his — split cleanly into what he still owes as deposits and what is rent not yet earned — which pieces need a write-off decision, and which rental pieces have paid for themselves — without opening a database client or a notebook.

**Empty range:** a card whose range contains no rows shows `₹0` or `—` with *No rows in this range*, never a blank or a spinner. It is a real answer and reads as one.

**Cold start on a heavy drill:** the waking banner appears inside the drill panel, the summary figure above it stays visible, and the page does not reset the owner's range or unpin anything.

**Every card behaves the same way:** a summary figure and a paged drill, per AD-14. A total he cannot open is not an answer, and there is no card in the library that breaks that rule.

### Flow 8 — An exchange, three days later (Anjali, customer wants a dearer kurti)

1. **Counter → Exchange.** Scan the sold kurti. Camera off. Its sale appears: sold 3 days ago, ₹1,750, within the 7-day window.
2. *Exchange this piece.* She scans the outgoing kurti — ₹2,400.
3. The screen shows both halves: the returned line struck through in `{colors.money-reversed}`, the new line, and **Collect ₹650** in `{colors.money-in}`.
4. Payment method, then commit — one gesture, one idempotency key.
5. **Climax:** the original sale row is untouched, a reversing row carries the negative, the returned kurti is back `in_stock` with its original price snapshots intact, and the receipt prints showing all three figures (CAP-23).

**Beyond the window:** refused server-side, naming the sale date. *There is no path that refunds a sale outright* — and the screen never offers one.

**A cheaper swap:** the same flow with a customer trading down — the outgoing piece is ₹1,400 against the returned ₹1,750. The screen shows **Refund ₹350** in `{colors.money-out}` instead of a *Collect* figure, and states *A manager needs to complete this exchange* — Anjali is money-in only (AD-29) and cannot commit a cash refund on her own authority. She hands the screen to a manager, who commits it exactly as she would have for a dearer swap.

### Flow 9 — Moving a wedding out three days (Anjali, the customer calls before hand-over)

1. The customer who booked three sarees for 14–17 Aug calls: the wedding moved, she needs them 17–20 Aug instead. Anjali finds the booking under **Counter → Rentals** by the customer's WhatsApp number — it is still `open`, not yet handed over.
2. **Extend.** The window fields show 14–17 Aug, pre-filled. She sets the new end date to 20 Aug. Because the amendment only ever widens, she cannot drag the start date later than the 14th — the field simply refuses it (AD-31).
3. Rent recomputes live for the new 7-day window (AD-23) and the screen shows **Collect ₹2,100** — the difference only, never a full re-charge. She picks **UPI**: the QR draws for ₹2,100 with its own reference, *Nothing recorded yet* underneath — the booking's dates haven't moved yet (*The UPI Payment Pattern*).
4. The customer pays and shows her phone. Anjali checks it and taps **Mark as received** — only now does the extension commit, carrying the reference.
5. **Climax:** she collects ₹2,100 at the counter, in the same gesture, and the booking's dates now hold 14–20 Aug — no rent was ever refunded on the shrink-then-grow the old cancel-and-rebook path would have needed, and there was none to refund because the window only ever widened.

**Refusal — too long for the deposit:** a second attempt to push the end date to 25 Aug is refused: *This deposit covers up to 9 days.* Same arithmetic, same message shape as a fresh booking (CAP-17, CAP-25).

### Flow 10 — A lost saree turns up again (Vikram, manager, weeks later)

1. A saree written off in April — rent and its whole ₹2,000 deposit already recognised as income that month — turns up at the back of a rail nobody had checked. Vikram opens **Inventory → Units**, finds it by barcode; its status pill reads `lost`.
2. **Recover.** The panel states plainly, before he touches anything: *This adds the unit's buying price back to stock. No money moves and nothing already earned is reversed.* He is `MANAGER`, so the action is his to take (`INVENTORY.RECOVER_LOST`, AD-29) — a `CASHIER` or `INVENTORY_MANAGER` would not find this action here at all.
3. He picks **Return to stock** and types the reason the field requires: *Found behind the rental rail during restock — never actually left the shop.*
4. **Climax:** the unit becomes `in_stock`, bookable again with no residue — its old booking and agreement no longer hold its dates. Stock value rises by its buying price. April's income figure does not move: the rent and deposit recognised that month stand exactly as they were, because a recovery reverses stock loss and never money (AD-35).
5. On the dashboard, this shows twice and never once: netted into **Q10 — shrinkage**, so April's write-off and today's recovery cancel to the true net loss, and as its own line on **Q27 — recoveries**, valued at the full buying price, so a piece that genuinely walked back through the door is never reported as a ₹0 event.

**Refusal — beyond repair:** had the saree come back damaged past use, Vikram would pick **Retire** instead. The unit moves `lost → retired` directly — one event that is both the exit from `lost` and the entry into `retired`, netting to zero shrinkage while still showing as its own recovery line (AD-35).

## Open Questions

None open. The one remaining item from the prior run — identity documents at rental hand-over — was already resolved upstream: `SPEC.md`'s Non-goals closes this explicitly (2026-08-20), no identity-type, reference, or document-image column exists on a rental agreement, and hand-over captures nothing beyond the customer record.

**Closed by this run** (2026-08-29), recorded so it is not reopened: **U-18**, raised by `ARCHITECTURE-SPINE.md` against this file — the old Price & checkout / booking / walk-in hand-over / extension screens described UPI payment as "pick UPI or cash, then commit" in one step, no QR, nothing written until confirmation, which is not what CAP-14/17/18/25 and AD-39 through AD-42 now specify. All four screens are rewritten against the shared four-state pattern — QR drawn and waiting, Mark as received, switch to cash mid-flow, cancel before commit — stated once in *The UPI Payment Pattern* and referenced from *Component Patterns*, *State Patterns*, and Flows 4, 5, 6, and 9 rather than restated per screen.

**Closed by earlier runs**, recorded so they are not reopened: **pinned-card persistence** — this file previously raised it as unresolved (client-side, matching the AD-25 cart tier, "raised, not assumed"). `ARCHITECTURE-SPINE.md`'s AD-37, added since, settles it the other way: server-side, one JSON document per user in `user_preferences`, restored on both `/auth/login` and `/auth/me`. Recorded in *Foundation → Upstream decisions* and the Dashboard IA row above; Flow 7 shows Raviraj's cards following him across devices rather than being described as merely "remembered." Also closed by earlier runs: the scan cadence question (the retail cart is a deliberate, permanent exception — *The Scan Primitive → The retail cart exception*); the settlement-slip question (confirmed always, CAP-19); MANAGER/ACCOUNTANT permissions (settled in full by AD-29).
